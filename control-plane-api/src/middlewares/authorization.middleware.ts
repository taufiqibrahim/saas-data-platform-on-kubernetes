import { cerbosClient } from '@/clients/cerbos.client';
import logger from '@/config/logger';
import { HttpError } from '@/types/errors';

export interface CheckPermissionInput {
  principal: {
    kind: string;
    id: bigint | number;
    roles: string[];
    attr?: Record<string, unknown>;
  };
  resource: {
    kind: string;
    id: string | number;
    attr?: Record<string, unknown>;
  };
  action: string;
}

export async function checkPermission(input: CheckPermissionInput): Promise<void> {
  logger.debug({ input }, 'Checking permission against Cerbos policy');
  const allowed = await cerbosClient.isAllowed({
    principal: input.principal,
    resource: input.resource,
    action: input.action,
  });

  if (!allowed) {
    throw new HttpError(403, 'Forbidden');
  }
}
