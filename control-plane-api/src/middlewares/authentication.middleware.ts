import { NextFunction, Request, Response } from 'express';
import { createRemoteJWKSet, decodeJwt, jwtVerify } from 'jose';

import logger from '@/config/logger';
import * as PrincipalService from '@/domains/principal/principal.service';
import { PrincipalAuthInfo } from '@/types/auth-middleware-types';
// import { getAccountByExtId } from '@/domains/account/account.service';
// import { getInternalUserByEmail } from '@/domains/user/user.service';
// import { UserInternalSessionInfo } from '@/domains/user/user.type';

// import { getUserRoles } from './getUserRoles';
// import config from '@/config/config';

// // Keycloak settings
// const JWKS = createRemoteJWKSet(new URL(`${config.keycloak.issuer}/protocol/openid-connect/certs`));
// const ISSUER = config.keycloak.issuer;

// export async function getUserFromToken(req: Request, payload: JWTPayload, getInternalUserByEmail: (email: string) => Promise<UserInternalSessionInfo | null>) {
//   const email =
//     typeof payload.email === 'string'
//       ? payload.email
//       : typeof (payload as any).preferred_username === 'string'
//         ? (payload as any).preferred_username
//         : undefined;

//   if (!email) return null;

//   const user = await getInternalUserByEmail(email);
//   if (!user) logger.warn('User not found in db');
//   if (!user) return null;

//   (req as any).user = user;
//   return user;
// }

// /**
//  * Extracts the realm (extAccountId) from the issuer URL.
//  * Example:
//  *   "http://keycloak.local:8080/realms/h4v2pfr69n2" → "h4v2pfr69n2"
//  */
// function extractExtAccountIdFromIss(iss?: string): string | undefined {
//   if (!iss) return undefined;
//   const match = iss.match(/\/realms\/([^/]+)$/);
//   return match?.[1];
// }

async function resolvePrincipal(email: string): Promise<PrincipalAuthInfo> {
  const principal: PrincipalAuthInfo = await PrincipalService.getPrincipalAuthInfo(email);
  logger.debug({ principal }, 'Resolving principal');
  return principal;
}

/**
 * Express middleware to authenticate requests using a Bearer JWT.
 *
 * - Verifies the token using JOSE and a JWKS key set.
 * - Attaches the raw JWT payload to `req.kcUser`.
 * - If `payload.sub` is present, looks up the user and sets `req.user`.
 * - For `/onboarding` paths, skips user lookup but still verifies token.
 * - Returns HTTP 401 for invalid, missing, or unverified tokens.
 *
 * @param req - Express Request object
 * @param res - Express Response object
 * @param next - Express NextFunction to pass control
 */
export async function authenticationMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    logger.debug(
      {
        path: req.path,
        // authHeader: req.headers.authorization
      },
      'Incoming request',
    );

    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      res.status(401).json({ message: 'Missing or malformed token' });
      return;
    }

    const token = authHeader.split(' ')[1];
    const { iss, sub, azp, email } = decodeJwt(token);
    logger.debug({ iss, sub, azp, email }, 'Decoded token info');

    if (!email) {
      res.status(401).json({ message: 'Unauthorized. Missing email in token' });
      return;
    }
    // req.email = email as string;

    const JWKS = createRemoteJWKSet(new URL(`${iss}/protocol/openid-connect/certs`));
    const { payload } = await jwtVerify(token, JWKS, { issuer: iss });

    // req.kcUser = payload;
    if (!payload.sub) {
      res.status(401).json({ message: 'Unauthorized. Missing subject in token' });
      return;
    }

    req.principal = await resolvePrincipal(email as string);

    // req.roles = await getUserRoles(payload, email);
    // logger.debug({ roles: req.roles }, 'Merged Keycloak + DB roles');

    // const isOnboarding = req.path.endsWith('onboarding');
    // const isAdmin = req.path.startsWith('/admin');
    // const isUserMe = req.path === '/user/me';

    // if (isOnboarding) {
    //   return next();
    // }

    // req.extAccountId = extractExtAccountIdFromIss(payload.iss) || '';

    // if (isAdmin) {
    //   const user = await getUserFromToken(req, payload, getInternalUserByEmail);
    //   if (!user || user.email !== 'system@quant-data.io') {
    //     res.status(401).json({ message: 'Unauthorized' });
    //     return
    //   }
    //   return next();
    // }

    // const account = await getAccountByExtId(req.extAccountId);
    // req.accountUid = account.uid;
    // req.accountId = account.id;

    // if (isUserMe) return next();

    // const user = await getUserFromToken(req, payload, getInternalUserByEmail);
    // if (!user) {
    //   res.status(401).json({ message: 'Unauthorized' });
    //   return
    // }

    // req.user = user;
    // logger.debug({
    //   // kcUser: req.kcUser,
    //   extAccountId: req.extAccountId,
    //   accountUid: req.accountUid,
    //   workspaceUid: req.workspaceUid,
    // }, 'Request attributes');

    next();
  } catch (err) {
    req.log.error({ err }, 'Token validation failed');
    res.status(401).json({ message: 'Invalid token' });
  }
}

// export async function verifyBffToken(req: Request, res: Response, next: NextFunction) {
//   const authHeader = req.headers['authorization'];
//   let token: string | undefined;

//   if (authHeader && authHeader.startsWith('Bearer ')) {
//     token = authHeader.split(' ')[1];
//   }

//   if (token && token === config.allowedTokens.bffToken) {
//     next();
//   } else if (!token) {
//     res.status(401).json({ message: 'Missing token' });
//   } else {
//     res.status(403).json({ message: 'Invalid token' });
//   }
// }

// export { };
