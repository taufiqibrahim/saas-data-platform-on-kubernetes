import { proxyActivities } from '@temporalio/workflow';

import type * as AccountProvisioningActivities from '../activities/accountProvisioning.activities';
import type * as EmailActivities from '../activities/email.activities';
import { TASK_QUEUES } from '../constants';

interface ProvisionAccountWorkflowInput {
  accountName: string;
  extAccountId: string;
  initialAccountOwnerEmail: string;
}

const accountProvisioning = proxyActivities<typeof AccountProvisioningActivities>({
  taskQueue: TASK_QUEUES.SHARED,
  startToCloseTimeout: '5 minutes',
  retry: {
    maximumAttempts: 3,
  },
});

const emails = proxyActivities<typeof EmailActivities>({
  taskQueue: TASK_QUEUES.SHARED,
  startToCloseTimeout: '1 minute',
});

export async function accountProvisioningWorkflow(
  input: ProvisionAccountWorkflowInput,
): Promise<string> {
  try {
    console.log('accountProvisioningWorkflow');

    const provisionExternalAuthOutput = await accountProvisioning.provisionExternalAuth({
      accountName: input.accountName,
      extAccountId: input.extAccountId,
      ownerEmail: input.initialAccountOwnerEmail,
    });

    await accountProvisioning.updateAccountStatus(input.extAccountId, 'ACTIVE');

    await emails.sendEmail(provisionExternalAuthOutput.emailOptions);

    return 'SUCCESS';
  } catch (err) {
    await accountProvisioning.rollbackExternalAuth(input.extAccountId);
    await accountProvisioning.updateAccountStatus(input.extAccountId, 'PROVISION_FAILED');
    throw err;
  }
}
