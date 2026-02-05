/*
  Warnings:

  - You are about to drop the `workspace_bootstrap_tokens` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[clusterAgentId]` on the table `workspaces` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "workspace_bootstrap_tokens" DROP CONSTRAINT "workspace_bootstrap_tokens_workspaceId_fkey";

-- AlterTable
ALTER TABLE "workspaces" ADD COLUMN     "clusterAgentId" BIGINT;

-- DropTable
DROP TABLE "workspace_bootstrap_tokens";

-- CreateTable
CREATE TABLE "workspace_cluster_agents" (
    "id" BIGSERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "workspaceId" BIGINT NOT NULL,
    "bootstrapTokenId" BIGINT,
    "lastPingAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiredAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_cluster_agents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_cluster_agent_bootstrap_tokens" (
    "id" BIGSERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "workspaceClusterAgentId" BIGINT NOT NULL,
    "token" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiredAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_cluster_agent_bootstrap_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_cluster_agents_uid_key" ON "workspace_cluster_agents"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_cluster_agents_bootstrapTokenId_key" ON "workspace_cluster_agents"("bootstrapTokenId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_cluster_agent_bootstrap_tokens_uid_key" ON "workspace_cluster_agent_bootstrap_tokens"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_clusterAgentId_key" ON "workspaces"("clusterAgentId");

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_clusterAgentId_fkey" FOREIGN KEY ("clusterAgentId") REFERENCES "workspace_cluster_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_cluster_agents" ADD CONSTRAINT "workspace_cluster_agents_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_cluster_agents" ADD CONSTRAINT "workspace_cluster_agents_bootstrapTokenId_fkey" FOREIGN KEY ("bootstrapTokenId") REFERENCES "workspace_cluster_agent_bootstrap_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_cluster_agent_bootstrap_tokens" ADD CONSTRAINT "workspace_cluster_agent_bootstrap_tokens_workspaceClusterA_fkey" FOREIGN KEY ("workspaceClusterAgentId") REFERENCES "workspace_cluster_agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
