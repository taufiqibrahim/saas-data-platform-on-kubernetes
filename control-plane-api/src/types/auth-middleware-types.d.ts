import { JWTPayload } from 'jose';

// import { UserInternalSessionInfo } from '@/domains/user/user.type';

export {}; // <-- mark as a module

export interface PrincipalAuthInfo {
  id: bigint;
  uid: string;
  externalId: string;
  kind: string;
  email: string;
  roles: string[];
  attr: {
    system_roles?: string[];
    accounts?: Record<
      string,
      {
        roles: string[];
      }
    >;
    workspaces?: Record<
      string,
      {
        account_id: string;
        roles: string[];
      }
    >;
  };
}

declare global {
  namespace Express {
    interface Request {
      jwtPayload: JWTPayload;
      principal: PrincipalAuthInfo;
      // email: string;
      // user: UserInternalSessionInfo;
      // roles: string[];
    }
  }
}
