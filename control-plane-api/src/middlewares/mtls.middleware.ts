import { Request, Response, NextFunction } from 'express';
import { TLSSocket } from "tls";
import logger from '@/config/logger';
import config from '@/config/config';

export function requireMTLS(req: Request, res: Response, next: NextFunction) {
  try {

    const tlsSocket = req.socket as TLSSocket;

    // 1. Cryptographic gate (TLS already validated everything)
    if (!tlsSocket.authorized) {
      return res.status(401).json({
        error: tlsSocket.authorizationError || "Unauthorized",
      });
    }

    // 2. Extract peer certificate
    const cert = tlsSocket.getPeerCertificate(true);
    if (!cert || !cert.subject) {
      return res.status(401).json({ error: "No client certificate provided" });
    }

    // 3. Identity validation (this is ALL app logic should do)
    const cn = cert.subject.CN || "";
    if (!cn.startsWith("agent-")) {
      return res.status(401).json({ error: "Invalid agent certificate" });
    }

    const agentId = cn.replace("agent-", "");
    const workspaceId = cert.subject.OU;

    // Optional issuer pinning
    if (cert.issuer.CN !== `${config.app.name} Intermediate CA`) {
      return res.status(401).json({ error: "Invalid certificate issuer" });
    }

    // 4. Attach identity
    (req as any).agentId = agentId;
    (req as any).workspaceId = workspaceId;

    return next();
  } catch (error) {
    logger.error({ error }, 'mTLS verification error:');
    return res.status(401).json({ error: 'Certificate verification failed' });
  }
}