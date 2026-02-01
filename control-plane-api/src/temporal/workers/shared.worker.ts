import { NativeConnection, Worker } from '@temporalio/worker';
import dotenv from 'dotenv';
import { resolve } from 'path';
import pino from 'pino';

import activities from '../activities';
import { TASK_QUEUES } from '../constants';
import logger from '../logger';
import * as workflows from '../workflows';

const env = dotenv.config();

async function run() {
  const connection = await NativeConnection.connect({
    address: process.env.TEMPORAL_ADDRESS || env.parsed?.TEMPORAL_ADDRESS || 'localhost:7233',
  });

  console.info('Loaded activities:', Object.keys(activities));
  console.info('Loaded workflows:', Object.keys(workflows));

  const workflowsPath = resolve(__dirname, '../workflows');

  type LogLevel = pino.Level;
  const worker = await Worker.create({
    workflowsPath: workflowsPath,
    activities,
    taskQueue: TASK_QUEUES.SHARED,
    connection,
    sinks: {
      logger: {
        log: {
          fn(workflowInfo, level: LogLevel, message: string) {
            logger[level]({
              workflow_id: workflowInfo.workflowId,
              run_id: workflowInfo.runId,
              namespace: workflowInfo.namespace,
              task_queue: workflowInfo.taskQueue,
              msg: message,
            });
          },
        },
      },
    },
  });
  await worker.run();
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
