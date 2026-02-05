import * as forge from 'node-forge';
import * as https from 'https';
import * as crypto from 'crypto';
import { sign } from 'jsonwebtoken';
import { randomUUID } from 'crypto';
import fs from 'fs';
import logger from '@/config/logger';
import { AgentMTLSCredentials } from '../workspace/workspace.type';

export interface CertVerificationResult {
  valid: boolean;
  agentId?: string;
  workspaceId?: string;
  expiresAt?: Date;
}

/**
 * Certificate Provider interface for easy migration between CA backends
 * Implementations: StepCaProvider (local/dev), AwsPcaProvider (production)
 */
export interface CertProvider {
  issueCertificate(
    commonName: string,
    metadata: { agentUid: string; workspaceUid: string }
  ): Promise<AgentMTLSCredentials>;

  verifyCertificate(certPem: string): CertVerificationResult;

  getCaCertificate(): string;
}

/**
 * Step CA provider using smallstep CA HTTP API
 * Docs: https://smallstep.com/docs/step-ca/certificate-authority-server-production
 */
class StepCaProvider implements CertProvider {
  private stepCaUrl: string;
  private stepCaHost: string;
  private stepCaPort: number;
  private stepProvisioner: string;
  private jwtSigningKey: string;
  private rootCaPath: string;
  private caCertPem!: string;
  private caCert!: forge.pki.Certificate;

  constructor() {
    this.stepCaUrl = process.env.STEP_CA_URL || 'https://ca.saas.internal:9000';
    const url = new URL(this.stepCaUrl);
    this.stepCaHost = url.hostname;
    this.stepCaPort = parseInt(url.port) || 443;
    this.stepProvisioner = process.env.STEP_CA_PROVISIONER || 'saas-control-plane';
    this.jwtSigningKey = process.env.STEP_CA_JWT_SIGNING_KEY!;
    this.rootCaPath = process.env.STEP_CA_ROOT || '/etc/step-ca/certs/root_ca.crt';

    this.loadCaCertificate();
  }

  private loadCaCertificate(): void {
    try {
      this.caCertPem = fs.readFileSync(this.rootCaPath, 'utf8');
      this.caCert = forge.pki.certificateFromPem(this.caCertPem);
      logger.info({ caPath: this.rootCaPath }, 'Loaded Step CA root certificate');
    } catch (error) {
      logger.error({ error, caPath: this.rootCaPath }, 'Failed to load Step CA root certificate');
      throw new Error(`Failed to load CA certificate from ${this.rootCaPath}`);
    }
  }

  /**
   * Generate a CSR using node-forge
   */
  private generateCsr(commonName: string, workspaceUid: string): { csr: string; privateKey: string } {
    const keys = forge.pki.rsa.generateKeyPair(2048);
    const csr = forge.pki.createCertificationRequest();

    csr.publicKey = keys.publicKey;
    csr.setSubject([
      { name: 'commonName', value: commonName },
      { shortName: 'OU', value: workspaceUid },
      { name: 'organizationName', value: 'SaaS Data Platform' },
    ]);

    // Add SAN extension
    csr.setAttributes([
      {
        name: 'extensionRequest',
        extensions: [
          {
            name: 'subjectAltName',
            altNames: [{ type: 2, value: commonName }], // DNS type
          },
        ],
      },
    ]);

    csr.sign(keys.privateKey, forge.md.sha256.create());

    return {
      csr: forge.pki.certificationRequestToPem(csr),
      privateKey: forge.pki.privateKeyToPem(keys.privateKey),
    };
  }

  /**
   * Create a JWK provisioner token for Step CA
   */
  private createProvisionerToken(commonName: string, csrPem: string): string {
    // Compute SHA256 of CSR (DER encoded)
    const csrDer = forge.util.decode64(
      csrPem
        .replace(/-----BEGIN CERTIFICATE REQUEST-----/, '')
        .replace(/-----END CERTIFICATE REQUEST-----/, '')
        .replace(/\s/g, '')
    );
    const sha256 = crypto.createHash('sha256').update(Buffer.from(csrDer, 'binary')).digest('base64url');

    const token = sign(
      {
        sha: sha256,
        sans: [commonName],
        step: {
          ra: {
            provisioner: this.stepProvisioner,
          },
        },
      },
      this.jwtSigningKey,
      {
        algorithm: 'HS256',
        subject: commonName,
        issuer: this.stepProvisioner,
        audience: `${this.stepCaUrl}/1.0/sign`,
        expiresIn: '5m',
        jwtid: randomUUID(),
      }
    );

    return token;
  }

  /**
   * Call Step CA /1.0/sign endpoint
   */
  private async signCsr(csrPem: string, token: string, validityDays: number): Promise<string> {
    const notAfter = new Date();
    notAfter.setDate(notAfter.getDate() + validityDays);

    const requestBody = JSON.stringify({
      csr: csrPem,
      ott: token,
      notAfter: notAfter.toISOString(),
    });

    return new Promise((resolve, reject) => {
      const req = https.request(
        {
          hostname: this.stepCaHost,
          port: this.stepCaPort,
          path: '/1.0/sign',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(requestBody),
          },
          ca: this.caCertPem, // Trust the Step CA root
          rejectUnauthorized: true,
        },
        (res) => {
          let data = '';
          res.on('data', (chunk) => (data += chunk));
          res.on('end', () => {
            if (res.statusCode !== 200 && res.statusCode !== 201) {
              logger.error({ statusCode: res.statusCode, body: data }, 'Step CA sign request failed');
              reject(new Error(`Step CA returned ${res.statusCode}: ${data}`));
              return;
            }
            try {
              const response = JSON.parse(data);
              resolve(response.crt);
            } catch (e) {
              reject(new Error(`Failed to parse Step CA response: ${data}`));
            }
          });
        }
      );

      req.on('error', (e) => {
        logger.error({ error: e }, 'Step CA request error');
        reject(e);
      });

      req.write(requestBody);
      req.end();
    });
  }

  async issueCertificate(
    commonName: string,
    metadata: { agentUid: string; workspaceUid: string }
  ): Promise<AgentMTLSCredentials> {
    const { agentUid, workspaceUid } = metadata;
    const certValidityDays = 90;

    // Generate CSR and private key
    const { csr, privateKey } = this.generateCsr(commonName, workspaceUid);

    // Create provisioner token
    const token = this.createProvisionerToken(commonName, csr);

    // Sign the CSR via Step CA API
    const clientCert = await this.signCsr(csr, token, certValidityDays);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + certValidityDays);

    logger.info({ agentUid, workspaceUid, commonName }, 'Issued mTLS certificate via Step CA');

    return {
      clientCert,
      clientKey: privateKey,
      caCert: this.caCertPem,
      expiresAt,
    };
  }

  verifyCertificate(certPem: string): CertVerificationResult {
    try {
      const cert = forge.pki.certificateFromPem(certPem);

      // Verify certificate chain against CA
      const caStore = forge.pki.createCaStore([this.caCert]);
      const verified = forge.pki.verifyCertificateChain(caStore, [cert]);

      if (!verified) {
        logger.debug('Certificate chain verification failed');
        return { valid: false };
      }

      // Check expiration
      const now = new Date();
      if (now < cert.validity.notBefore || now > cert.validity.notAfter) {
        logger.debug({ notBefore: cert.validity.notBefore, notAfter: cert.validity.notAfter }, 'Certificate expired');
        return { valid: false };
      }

      // Extract identity from CN (format: agent-{agentUid})
      const cn = cert.subject.getField('CN')?.value as string;
      const agentId = cn?.replace('agent-', '');

      // Extract workspace from OU if present
      const ou = cert.subject.getField('OU')?.value as string;

      return {
        valid: true,
        agentId,
        workspaceId: ou,
        expiresAt: cert.validity.notAfter,
      };
    } catch (error) {
      logger.error({ error }, 'Certificate verification error');
      return { valid: false };
    }
  }

  getCaCertificate(): string {
    return this.caCertPem;
  }
}

/**
 * AWS Private CA provider (placeholder for production migration)
 *
 * To migrate to AWS PCA:
 * 1. Install @aws-sdk/client-acm-pca
 * 2. Implement this class
 * 3. Set CA_PROVIDER=aws-pca environment variable
 *
 * Example implementation sketch:
 *
 * class AwsPcaProvider implements CertProvider {
 *   private pcaArn: string;
 *   private acmPcaClient: ACMPCAClient;
 *
 *   constructor() {
 *     this.pcaArn = process.env.AWS_PCA_ARN!;
 *     this.acmPcaClient = new ACMPCAClient({ region: process.env.AWS_REGION });
 *   }
 *
 *   async issueCertificate(commonName: string, metadata) {
 *     // 1. Generate CSR locally (same as StepCaProvider)
 *     // 2. Use IssueCertificateCommand to submit CSR
 *     // 3. Use GetCertificateCommand to retrieve signed cert
 *   }
 *
 *   verifyCertificate(certPem: string) {
 *     // Same forge-based verification, just with AWS PCA root cert
 *   }
 *
 *   getCaCertificate() {
 *     // Use GetCertificateAuthorityCertificateCommand
 *   }
 * }
 */

/**
 * Certificate Service - abstracts CA provider for mTLS certificate management
 */
export class CertService {
  private provider: CertProvider;

  constructor(provider?: CertProvider) {
    // Default to Step CA, can be overridden for AWS PCA in production
    // Future: use CA_PROVIDER env var to select provider
    this.provider = provider || new StepCaProvider();
  }

  /**
   * Issue mTLS certificate for an agent
   */
  async issueAgentCertificate(agentUid: string, workspaceUid: string): Promise<AgentMTLSCredentials> {
    const commonName = `agent-${agentUid}`;
    return this.provider.issueCertificate(commonName, { agentUid, workspaceUid });
  }

  /**
   * Verify a client certificate
   */
  verifyCertificate(certPem: string): CertVerificationResult {
    return this.provider.verifyCertificate(certPem);
  }

  /**
   * Get the CA certificate for trust store configuration
   */
  getCaCertificate(): string {
    return this.provider.getCaCertificate();
  }
}
