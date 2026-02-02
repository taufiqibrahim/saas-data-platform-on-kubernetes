import { Client, Connection } from '@temporalio/client';

import config from '@/config/config';

export async function connectTemporalClient(): Promise<Client> {
  const connection = await Connection.connect({
    address: config.temporal.address,
  });

  return new Client({
    connection,
    namespace: config.temporal.namespace,
  });
}
