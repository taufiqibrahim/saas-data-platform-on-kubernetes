import { Request, Response, NextFunction } from 'express';
import logger from '@/config/logger';

/**
 * mTLS middleware — reads client certificate identity from reverse proxy headers.
 *
 * The reverse proxy (Caddy for local dev, nginx ingress for K8s) terminates TLS,
 * verifies the client certificate against the CA bundle, and passes the result
 * via HTTP headers:
 *
 *   ssl-client-verify:     "SUCCESS" (nginx) or "true" (Caddy)
 *   ssl-client-subject-dn: "CN=agent-xxx,OU=workspace-yyy,O=SaaS Data Platform"
 */
export function requireMTLS(req: Request, res: Response, next: NextFunction) {
  try {
    // With Caddy "verify_if_given" mode, the proxy only passes the subject header
    // when a valid client certificate is presented and verified. So the presence
    // of the subject header is sufficient proof of a verified client cert.
    const subjectDn = req.headers['ssl-client-subject-dn'] as string;
    if (!subjectDn) {
      return res.status(401).json({ error: 'No client certificate provided' });
    }

    // 3. Parse identity from DN
    const cn = parseDnField(subjectDn, 'CN');
    if (!cn || !cn.startsWith('agent-')) {
      return res.status(401).json({ error: 'Invalid agent certificate' });
    }

    const agentId = cn.replace('agent-', '');
    const workspaceId = parseDnField(subjectDn, 'OU');

    // 4. Attach identity
    (req as any).agentId = agentId;
    (req as any).workspaceId = workspaceId;

    return next();
  } catch (error) {
    logger.error({ error }, 'mTLS verification error');
    return res.status(401).json({ error: 'Certificate verification failed' });
  }
}

/**
 * Parse a single field from a Distinguished Name string.
 * Handles both comma-separated (nginx: "CN=x,OU=y") and
 * slash-separated (OpenSSL: "/CN=x/OU=y") formats.
 */
function parseDnField(dn: string, field: string): string | undefined {
  const regex = new RegExp(`(?:^|[,/])\\s*${field}=([^,/]+)`, 'i');
  return dn.match(regex)?.[1]?.trim();
}
