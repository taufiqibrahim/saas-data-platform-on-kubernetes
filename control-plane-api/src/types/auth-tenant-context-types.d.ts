export {};

declare global {
  namespace Express {
    interface Request {
      accountId: bigint;
      accountUid: string;
      extAccountId: string;
      workspaceUid: string;
      // account?: Account;
      // workspace?: Workspace;
    }
  }
}
