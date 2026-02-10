import { connectTemporalClient } from '@/clients/temporal.client';

import { TASK_QUEUES } from './constants';
import { accountProvisioningWorkflow } from './workflows';

export type StartAccountProvisioning = (input: {
  accountName: string;
  extAccountId: string;
  initialAccountOwnerEmail: string;
}) => Promise<string>;

export const startAccountProvisioning: StartAccountProvisioning = async (input) => {
  const temporalClient = await connectTemporalClient();
  const workflowId = `accountProvisioning/${input.extAccountId}/${Date.now()}`;
  await temporalClient.workflow.start(accountProvisioningWorkflow, {
    args: [
      {
        accountName: input.accountName,
        extAccountId: input.extAccountId,
        initialAccountOwnerEmail: input.initialAccountOwnerEmail,
      },
    ],
    taskQueue: TASK_QUEUES.SHARED,
    workflowId,
  });

  return workflowId;
};
