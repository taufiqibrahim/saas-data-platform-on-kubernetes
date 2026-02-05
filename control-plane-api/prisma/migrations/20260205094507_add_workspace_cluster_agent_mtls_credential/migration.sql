/*
  Warnings:

  - A unique constraint covering the columns `[mtlsCredentialId]` on the table `workspace_cluster_agents` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "workspace_cluster_agents" ADD COLUMN     "mtlsCredentialId" BIGINT;

-- CreateTable
CREATE TABLE "workspace_cluster_agent_mtls_credentials" (
    "id" BIGSERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "workspaceClusterAgentId" BIGINT NOT NULL,
    "caCert" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_cluster_agent_mtls_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "workspace_cluster_agent_mtls_credentials_uid_key" ON "workspace_cluster_agent_mtls_credentials"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_cluster_agents_mtlsCredentialId_key" ON "workspace_cluster_agents"("mtlsCredentialId");

-- AddForeignKey
ALTER TABLE "workspace_cluster_agents" ADD CONSTRAINT "workspace_cluster_agents_mtlsCredentialId_fkey" FOREIGN KEY ("mtlsCredentialId") REFERENCES "workspace_cluster_agent_mtls_credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_cluster_agent_mtls_credentials" ADD CONSTRAINT "workspace_cluster_agent_mtls_credentials_workspaceClusterA_fkey" FOREIGN KEY ("workspaceClusterAgentId") REFERENCES "workspace_cluster_agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
