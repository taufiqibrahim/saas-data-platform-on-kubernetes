import { EmailNotificationOptions } from '@/types/notification.type';

export interface ProvisionAccountResponse {
  emailOptions?: EmailNotificationOptions;
}

/**
 * Adapter interface
 */
export interface AuthProviderProvisioningAdapter {
  provisionAccount(input: {
    extAccountId: string;
    accountName: string;
    ownerEmail: string;
    options?: Record<string, unknown>;
  }): Promise<ProvisionAccountResponse | null>;

  rollbackAccount(input: { accountUid: string; options?: Record<string, unknown> }): Promise<void>;
}
