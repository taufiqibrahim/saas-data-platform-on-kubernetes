-- CreateEnum
CREATE TYPE "WorkspaceClusterAgentStatus" AS ENUM ('PendingRegistration', 'Active', 'Suspended', 'Deleted');

-- AlterTable
ALTER TABLE "workspace_cluster_agents" ADD COLUMN     "status" "WorkspaceClusterAgentStatus" NOT NULL DEFAULT 'PendingRegistration';
