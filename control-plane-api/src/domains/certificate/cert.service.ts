/**
 * Certificate Service for mTLS Certificate Management
 *
 * Supports multiple CA backends via provider pattern:
 * - SelfSignedProvider: Per-workspace self-signed CA (default, simplest)
 * - StepCaProvider: Shared CA via Step CA HTTP API
 * - AwsPcaProvider: AWS Private CA (production)
 *
 * Configure via config.ca (CA_PROVIDER env var): "self-signed" | "step-ca" | "aws-pca"
 */

import * as crypto from 'crypto';
import { X509Certificate } from 'crypto';
import { randomUUID } from 'crypto';
import fs from 'fs';
import * as https from 'https';
import { sign } from 'jsonwebtoken';
import * as forge from 'node-forge';
import * as path from 'path';

import config, {
  AwsPcaCaConfig,
  CaConfig,
  SelfSignedCaConfig,
  StepCaCaConfig,
} from '@/config/config';
import logger from '@/config/logger';

import { AgentMTLSCredentials } from '../workspace/workspace.type';

// =============================================================================
// Types
// =============================================================================

export interface CertProvider {
  issueCertificate(
    commonName: string,
    metadata: { agentUid: string; workspaceUid: string },
  ): Promise<AgentMTLSCredentials>;

  getCaCertificate?(): string;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Extract serial number and fingerprint from a PEM certificate
 */
function extractCertMetadata(certPem: string): { serialNumber: string; fingerprint: string } {
  const cert = new X509Certificate(certPem);
  return {
    serialNumber: cert.serialNumber,
    fingerprint: cert.fingerprint256.replace(/:/g, '').toLowerCase(),
  };
}

// =============================================================================
// Provider 1: Self-Signed (Default)
// =============================================================================

/**
 * Self-Signed Certificate Provider
 *
 * Generates a unique CA per workspace. Simple, no external dependencies.
 *
 * PKI Structure:
 *   Workspace CA (self-signed) → Agent Cert (leaf)
 *
 * Pros:
 * - No external CA infrastructure needed
 * - Works immediately
 * - Each workspace isolated
 *
 * Cons:
 * - Can't verify cross-workspace
 * - CA cert must be stored with agent for verification
 */
class SelfSignedProvider implements CertProvider {
  private validityDays: number;

  constructor(caConfig: SelfSignedCaConfig) {
    this.validityDays = caConfig.validityDays;
    logger.info({ validityDays: this.validityDays }, 'Initialized self-signed CA provider');
  }

  async issueCertificate(
    commonName: string,
    metadata: { agentUid: string; workspaceUid: string },
  ): Promise<AgentMTLSCredentials> {
    const { agentUid, workspaceUid } = metadata;

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.validityDays);

    // Generate Workspace CA (self-signed)
    const caKeys = forge.pki.rsa.generateKeyPair(2048);
    const caCert = forge.pki.createCertificate();

    caCert.publicKey = caKeys.publicKey;
    caCert.serialNumber = '01';
    caCert.validity.notBefore = new Date();
    caCert.validity.notAfter = expiresAt;

    const caAttrs = [
      { name: 'commonName', value: `Workspace ${workspaceUid} CA` },
      { name: 'organizationName', value: 'SaaS Data Platform' },
    ];
    caCert.setSubject(caAttrs);
    caCert.setIssuer(caAttrs);
    caCert.setExtensions([
      { name: 'basicConstraints', cA: true },
      { name: 'keyUsage', keyCertSign: true, digitalSignature: true },
    ]);
    caCert.sign(caKeys.privateKey, forge.md.sha256.create());

    // Generate Agent Certificate
    const clientKeys = forge.pki.rsa.generateKeyPair(2048);
    const clientCert = forge.pki.createCertificate();

    clientCert.publicKey = clientKeys.publicKey;
    clientCert.serialNumber = '02';
    clientCert.validity.notBefore = new Date();
    clientCert.validity.notAfter = expiresAt;

    clientCert.setSubject([
      { name: 'commonName', value: commonName },
      { shortName: 'OU', value: workspaceUid },
      { name: 'organizationName', value: 'SaaS Data Platform' },
    ]);
    clientCert.setIssuer(caAttrs);
    clientCert.setExtensions([
      { name: 'basicConstraints', cA: false },
      { name: 'keyUsage', digitalSignature: true, keyEncipherment: true },
      { name: 'extKeyUsage', clientAuth: true },
    ]);
    clientCert.sign(caKeys.privateKey, forge.md.sha256.create());

    const clientCertPem = forge.pki.certificateToPem(clientCert);
    const { serialNumber, fingerprint } = extractCertMetadata(clientCertPem);

    logger.info(
      { agentUid, workspaceUid, commonName, expiresAt, serialNumber },
      'Issued self-signed mTLS certificate',
    );

    return {
      caCert: forge.pki.certificateToPem(caCert),
      clientCert: clientCertPem,
      clientKey: forge.pki.privateKeyToPem(clientKeys.privateKey),
      expiresAt,
      certSerialNumber: serialNumber,
      certFingerprint: fingerprint,
      caProvider: 'self-signed',
    };
  }
}

// =============================================================================
// Provider 2: Step CA (HTTP API)
// =============================================================================

/**
 * Step CA Provider
 *
 * Issues certificates via Step CA's HTTP API using JWK provisioner.
 *
 * PKI Structure:
 *   Root CA → Intermediate CA → Agent Cert (leaf)
 *
 * Config (from config.ca when provider is 'step-ca'):
 * - url: Step CA server URL
 * - rootCertPath: Path to root CA cert (for TLS trust)
 * - intermediateCertPath: Path to intermediate CA cert (for verification)
 * - provisioner: Provisioner name
 * - jwkPrivateKey: Decrypted JWK private key JSON
 * - validityDays: Certificate validity in days
 *
 * To get JWK key:
 *   cat docker/step-ca/secrets/password | step crypto jwe decrypt \
 *     --key=docker/step-ca/config/ca.json --password-file=/dev/stdin
 */
class StepCaProvider implements CertProvider {
  private stepCaUrl: string;
  private stepCaHost: string;
  private stepCaPort: number;
  private stepProvisioner: string;
  private validityDays: number;
  private jwtSigningKey!: crypto.KeyObject;
  private jwtSigningKid!: string;
  private rootCaPem!: string;
  private intermediateCaPem!: string;

  constructor(caConfig: StepCaCaConfig) {
    this.stepCaUrl = caConfig.url;
    const url = new URL(this.stepCaUrl);
    this.stepCaHost = url.hostname;
    this.stepCaPort = parseInt(url.port) || 443;
    this.stepProvisioner = caConfig.provisioner;
    this.validityDays = caConfig.validityDays;

    this.loadSigningKey(caConfig.jwkPrivateKey);
    this.loadCaCertificates(caConfig.rootCertPath, caConfig.intermediateCertPath);
  }

  private loadSigningKey(jwkPrivateKey: string): void {
    if (!jwkPrivateKey) {
      throw new Error('Step CA JWK private key not configured (STEP_CA_JWK_PRIVATE_KEY)');
    }
    const jwk = JSON.parse(jwkPrivateKey);

    this.jwtSigningKey = crypto.createPrivateKey({ key: jwk, format: 'jwk' });
    this.jwtSigningKid = jwk.kid;
    logger.info(
      { kid: this.jwtSigningKid, provisioner: this.stepProvisioner },
      'Loaded Step CA provisioner key',
    );
  }

  private loadCaCertificates(rootCertPath: string, intermediateCertPath: string): void {
    const rootPath = path.resolve(rootCertPath);
    const intermediatePath = path.resolve(intermediateCertPath);

    this.rootCaPem = fs.readFileSync(rootPath, 'utf8');
    this.intermediateCaPem = fs.readFileSync(intermediatePath, 'utf8');

    logger.info({ rootPath, intermediatePath }, 'Loaded Step CA certificates');
  }

  private generateCsr(
    commonName: string,
    workspaceUid: string,
  ): { csr: string; privateKey: string } {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const csr = forge.pki.createCertificationRequest();

    csr.publicKey = keys.publicKey;
    csr.setSubject([
      { name: 'commonName', value: commonName },
      { shortName: 'OU', value: workspaceUid },
      { name: 'organizationName', value: 'SaaS Data Platform' },
    ]);
    csr.setAttributes([
      {
        name: 'extensionRequest',
        extensions: [{ name: 'subjectAltName', altNames: [{ type: 2, value: commonName }] }],
      },
    ]);
    csr.sign(keys.privateKey, forge.md.sha256.create());

    return {
      csr: forge.pki.certificationRequestToPem(csr),
      privateKey: forge.pki.privateKeyToPem(keys.privateKey),
    };
  }

  private createProvisionerToken(commonName: string, csrPem: string): string {
    const csrDer = forge.util.decode64(
      csrPem
        .replace(/-----BEGIN CERTIFICATE REQUEST-----/, '')
        .replace(/-----END CERTIFICATE REQUEST-----/, '')
        .replace(/\s/g, ''),
    );
    const sha256 = crypto
      .createHash('sha256')
      .update(Buffer.from(csrDer, 'binary'))
      .digest('base64url');

    return sign({ sha: sha256, sans: [commonName] }, this.jwtSigningKey, {
      algorithm: 'ES256',
      subject: commonName,
      issuer: this.stepProvisioner,
      audience: `${this.stepCaUrl}/1.0/sign`,
      expiresIn: '5m',
      jwtid: randomUUID(),
      keyid: this.jwtSigningKid,
    });
  }

  private async signCsr(csrPem: string, token: string, validityDays: number): Promise<string> {
    const notAfter = new Date();
    notAfter.setDate(notAfter.getDate() + validityDays);

    const body = JSON.stringify({ csr: csrPem, ott: token, notAfter: notAfter.toISOString() });

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: this.stepCaHost,
          port: this.stepCaPort,
          path: '/1.0/sign',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(body),
          },
          ca: this.rootCaPem,
          rejectUnauthorized: true,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode !== 200 && res.statusCode !== 201) {
              reject(new Error(`Step CA returned ${res.statusCode}: ${data}`));
              return;
            }
            const parsed = JSON.parse(data);
            // Include intermediate cert so the client presents the full chain
            resolve(parsed.ca ? parsed.crt + '\n' + parsed.ca : parsed.crt);
          });
        },
      );
      req.on('error', reject);
      req.write(body);
      req.end();
    });
  }

  async issueCertificate(
    commonName: string,
    metadata: { agentUid: string; workspaceUid: string },
  ): Promise<AgentMTLSCredentials> {
    const { agentUid, workspaceUid } = metadata;

    const { csr, privateKey } = this.generateCsr(commonName, workspaceUid);
    const token = this.createProvisionerToken(commonName, csr);
    const clientCert = await this.signCsr(csr, token, this.validityDays);

    const { serialNumber, fingerprint } = extractCertMetadata(clientCert);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + this.validityDays);

    logger.info(
      { agentUid, workspaceUid, commonName, expiresAt, serialNumber },
      'Issued mTLS certificate via Step CA',
    );

    // Note: caCert IS included in response for agent to use, but NOT stored per-agent in DB
    // (it's the same shared root CA for all agents)
    return {
      clientCert,
      clientKey: privateKey,
      caCert: this.rootCaPem, // Shared root CA - included in response, not stored per-agent
      expiresAt,
      certSerialNumber: serialNumber,
      certFingerprint: fingerprint,
      caProvider: 'step-ca',
    };
  }

  getCaCertificate(): string {
    return this.rootCaPem;
  }
}

// =============================================================================
// Provider 3: AWS Private CA (Placeholder)
// =============================================================================

/**
 * AWS Private CA Provider
 *
 * For production deployment on AWS.
 *
 * Config (from config.ca when provider is 'aws-pca'):
 * - caArn: ARN of the Private CA
 * - caCertPath: Path to CA certificate (or fetch from AWS)
 * - region: AWS region
 * - validityDays: Certificate validity in days
 *
 * Implementation requires @aws-sdk/client-acm-pca:
 * - IssueCertificateCommand to submit CSR
 * - GetCertificateCommand to retrieve signed cert
 * - GetCertificateAuthorityCertificateCommand for CA cert
 */
class AwsPcaProvider implements CertProvider {
  constructor(_caConfig: AwsPcaCaConfig) {
    // TODO: Implement when migrating to AWS
    throw new Error('AWS PCA provider not implemented yet');
  }

  async issueCertificate(): Promise<AgentMTLSCredentials> {
    throw new Error('Not implemented');
  }
}

// =============================================================================
// Certificate Service
// =============================================================================

/**
 * Certificate Service
 *
 * Main entry point. Selects provider based on config.ca.provider.
 *
 * Usage:
 *   const certService = new CertService();
 *   const creds = await certService.issueAgentCertificate(agentUid, workspaceUid);
 */
export class CertService {
  private provider: CertProvider;

  constructor(provider?: CertProvider, caConfig?: CaConfig) {
    if (provider) {
      this.provider = provider;
    } else {
      const cfg = caConfig || config.ca;

      switch (cfg.provider) {
        case 'step-ca':
          this.provider = new StepCaProvider(cfg);
          break;
        case 'aws-pca':
          this.provider = new AwsPcaProvider(cfg);
          break;
        case 'self-signed':
        default:
          this.provider = new SelfSignedProvider(cfg as SelfSignedCaConfig);
          break;
      }

      logger.info({ provider: cfg.provider }, 'Initialized certificate service');
    }
  }

  async issueAgentCertificate(
    agentUid: string,
    workspaceUid: string,
  ): Promise<AgentMTLSCredentials> {
    const commonName = `agent-${agentUid}`;
    return this.provider.issueCertificate(commonName, { agentUid, workspaceUid });
  }

  getCaCertificate(): string | undefined {
    return this.provider.getCaCertificate?.();
  }
}
