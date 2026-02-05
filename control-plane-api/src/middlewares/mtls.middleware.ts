import { Request, Response, NextFunction } from 'express';
import { TLSSocket } from "tls";
import forge from 'node-forge';
import { CertService } from '../domains/certificate/cert.service';
import logger from '@/config/logger';

const certService = new CertService();

export function requireMTLS(req: Request, res: Response, next: NextFunction) {
  try {
    // Get client certificate from TLS connection
    const tlsSocket = req.socket as TLSSocket;
    const cert = tlsSocket.getPeerCertificate();

    if (!cert || !cert.raw) {
      return res.status(401).json({ error: 'No client certificate provided' });
    }

    // Convert to PEM
    const certPem = forge.pki.certificateToPem(
      forge.pki.certificateFromAsn1(
        forge.asn1.fromDer(cert.raw.toString('binary'))
      )
    );

    // Verify certificate
    const { valid, agentId, workspaceId } = certService.verifyCertificate(certPem);

    if (!valid || !agentId) {
      return res.status(401).json({ error: 'Invalid certificate' });
    }

    // Attach identity to request for downstream handlers
    (req as any).agentId = agentId;
    (req as any).workspaceId = workspaceId;
    return next();
  } catch (error) {
    logger.error({ error }, 'mTLS verification error:');
    return res.status(401).json({ error: 'Certificate verification failed' });
  }
}