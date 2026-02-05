-- AlterTable
ALTER TABLE "workspace_cluster_agents" ALTER COLUMN "lastPingAt" DROP NOT NULL,
ALTER COLUMN "expiredAt" DROP NOT NULL;
