-- CreateEnum
CREATE TYPE "PlatformProviderNameEnum" AS ENUM ('KUBERNETES', 'AWS_EKS', 'ALICLOUD_ACK');

-- CreateEnum
CREATE TYPE "RoleTypeEnum" AS ENUM ('MANAGED_ROLE', 'CUSTOMER_MANAGED_ROLES');

-- CreateEnum
CREATE TYPE "PolicyScopeEnum" AS ENUM ('SYSTEM', 'ACCOUNT', 'WORKSPACE');

-- CreateEnum
CREATE TYPE "AccountPlanEnum" AS ENUM ('free', 'enterprise');

-- CreateEnum
CREATE TYPE "AccountStatusEnum" AS ENUM ('PROVISIONING', 'PROVISION_FAILED', 'ACTIVE', 'UPDATING', 'UPDATE_FAILED', 'DELETING', 'DELETE_FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "AccountMemberStatus" AS ENUM ('INVITED', 'ACTIVE');

-- CreateEnum
CREATE TYPE "StorageType" AS ENUM ('s3', 'gcs', 'oss');

-- CreateEnum
CREATE TYPE "WorkspaceStatus" AS ENUM ('PENDING', 'CREATING', 'CREATE_FAILED', 'RUNNING', 'UPDATING', 'UPDATE_FAILED', 'STOPPING', 'STOPPED', 'STOP_FAILED', 'DELETING', 'DELETE_FAILED', 'DELETED');

-- CreateEnum
CREATE TYPE "WorkspaceClusterAgentStatus" AS ENUM ('PendingRegistration', 'Active', 'Suspended', 'Deleted');

-- CreateTable
CREATE TABLE "platform_providers" (
    "id" SERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "name" "PlatformProviderNameEnum" NOT NULL,
    "displayName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "platform_providers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_provider_regions" (
    "id" SERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT NOT NULL,
    "platformProviderId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_provider_regions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "principals" (
    "id" BIGSERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "principals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "policy_definitions" (
    "id" BIGSERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "scope" "PolicyScopeEnum" NOT NULL,
    "accountId" BIGINT,
    "workspaceId" BIGINT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "definition" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "updatedById" BIGINT NOT NULL,

    CONSTRAINT "policy_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "system_roles" (
    "id" BIGSERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "system_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "principal_system_roles" (
    "id" BIGSERIAL NOT NULL,
    "principalId" BIGINT NOT NULL,
    "roleId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "principal_system_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" BIGSERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "extAccountId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "platformProviderId" INTEGER NOT NULL,
    "platformProviderRegionId" INTEGER NOT NULL,
    "plan" "AccountPlanEnum" NOT NULL DEFAULT 'enterprise',
    "status" "AccountStatusEnum" NOT NULL DEFAULT 'PROVISIONING',
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdById" BIGINT NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_roles" (
    "id" BIGSERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" "RoleTypeEnum" NOT NULL,
    "accountId" BIGINT NOT NULL,
    "createdById" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_members" (
    "id" BIGSERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "accountId" BIGINT NOT NULL,
    "principalId" BIGINT NOT NULL,
    "joinedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_member_roles" (
    "id" BIGSERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "accountMemberId" BIGINT NOT NULL,
    "accountRoleId" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "account_member_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspaces" (
    "id" BIGSERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "extWorkspaceId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "metadata" JSONB DEFAULT '{}',
    "status" "WorkspaceStatus" NOT NULL DEFAULT 'PENDING',
    "accountId" BIGINT NOT NULL,
    "clusterAgentId" BIGINT,
    "createdById" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "workspaces_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "workspace_cluster_agents" (
    "id" BIGSERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "workspaceId" BIGINT NOT NULL,
    "bootstrapTokenId" BIGINT,
    "mtlsCredentialId" BIGINT,
    "status" "WorkspaceClusterAgentStatus" NOT NULL DEFAULT 'PendingRegistration',
    "lastPingAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

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

-- CreateTable
CREATE TABLE "workspace_cluster_agent_mtls_credentials" (
    "id" BIGSERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "workspaceClusterAgentId" BIGINT NOT NULL,
    "caProvider" TEXT NOT NULL DEFAULT 'self-signed',
    "caCert" TEXT,
    "certSerialNumber" TEXT,
    "certFingerprint" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "workspace_cluster_agent_mtls_credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "apps" (
    "id" BIGSERIAL NOT NULL,
    "uid" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isFreeTier" BOOLEAN NOT NULL DEFAULT false,
    "metadata" JSONB DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "apps_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "platform_providers_uid_key" ON "platform_providers"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "platform_providers_name_key" ON "platform_providers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "platform_provider_regions_uid_key" ON "platform_provider_regions"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "platform_provider_regions_platformProviderId_name_key" ON "platform_provider_regions"("platformProviderId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "principals_uid_key" ON "principals"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "principals_email_key" ON "principals"("email");

-- CreateIndex
CREATE UNIQUE INDEX "policy_definitions_uid_key" ON "policy_definitions"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "policy_definitions_name_key" ON "policy_definitions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "system_roles_uid_key" ON "system_roles"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "system_roles_name_key" ON "system_roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "principal_system_roles_principalId_roleId_key" ON "principal_system_roles"("principalId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_uid_key" ON "accounts"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_extAccountId_deletedAt_key" ON "accounts"("extAccountId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_name_deletedAt_key" ON "accounts"("name", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "account_roles_uid_key" ON "account_roles"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "account_roles_accountId_name_key" ON "account_roles"("accountId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "account_members_uid_key" ON "account_members"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "account_members_accountId_principalId_key" ON "account_members"("accountId", "principalId");

-- CreateIndex
CREATE UNIQUE INDEX "account_member_roles_uid_key" ON "account_member_roles"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "account_member_roles_accountMemberId_accountRoleId_key" ON "account_member_roles"("accountMemberId", "accountRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_uid_key" ON "workspaces"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_clusterAgentId_key" ON "workspaces"("clusterAgentId");

-- CreateIndex
CREATE INDEX "workspaces_accountId_extWorkspaceId_name_idx" ON "workspaces"("accountId", "extWorkspaceId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_extWorkspaceId_deletedAt_key" ON "workspaces"("extWorkspaceId", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "workspaces_accountId_name_deletedAt_key" ON "workspaces"("accountId", "name", "deletedAt");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_cluster_agents_uid_key" ON "workspace_cluster_agents"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_cluster_agents_bootstrapTokenId_key" ON "workspace_cluster_agents"("bootstrapTokenId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_cluster_agents_mtlsCredentialId_key" ON "workspace_cluster_agents"("mtlsCredentialId");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_cluster_agent_bootstrap_tokens_uid_key" ON "workspace_cluster_agent_bootstrap_tokens"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "workspace_cluster_agent_mtls_credentials_uid_key" ON "workspace_cluster_agent_mtls_credentials"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "apps_uid_key" ON "apps"("uid");

-- CreateIndex
CREATE UNIQUE INDEX "apps_name_key" ON "apps"("name");

-- AddForeignKey
ALTER TABLE "platform_provider_regions" ADD CONSTRAINT "platform_provider_regions_platformProviderId_fkey" FOREIGN KEY ("platformProviderId") REFERENCES "platform_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_definitions" ADD CONSTRAINT "policy_definitions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "principals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policy_definitions" ADD CONSTRAINT "policy_definitions_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "principals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "principal_system_roles" ADD CONSTRAINT "principal_system_roles_principalId_fkey" FOREIGN KEY ("principalId") REFERENCES "principals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "principal_system_roles" ADD CONSTRAINT "principal_system_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "system_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_platformProviderId_fkey" FOREIGN KEY ("platformProviderId") REFERENCES "platform_providers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_platformProviderRegionId_fkey" FOREIGN KEY ("platformProviderRegionId") REFERENCES "platform_provider_regions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "principals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_roles" ADD CONSTRAINT "account_roles_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_roles" ADD CONSTRAINT "account_roles_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "principals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_members" ADD CONSTRAINT "account_members_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_members" ADD CONSTRAINT "account_members_principalId_fkey" FOREIGN KEY ("principalId") REFERENCES "principals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_member_roles" ADD CONSTRAINT "account_member_roles_accountMemberId_fkey" FOREIGN KEY ("accountMemberId") REFERENCES "account_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_member_roles" ADD CONSTRAINT "account_member_roles_accountRoleId_fkey" FOREIGN KEY ("accountRoleId") REFERENCES "account_roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_clusterAgentId_fkey" FOREIGN KEY ("clusterAgentId") REFERENCES "workspace_cluster_agents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspaces" ADD CONSTRAINT "workspaces_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "principals"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_cluster_agents" ADD CONSTRAINT "workspace_cluster_agents_workspaceId_fkey" FOREIGN KEY ("workspaceId") REFERENCES "workspaces"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_cluster_agents" ADD CONSTRAINT "workspace_cluster_agents_bootstrapTokenId_fkey" FOREIGN KEY ("bootstrapTokenId") REFERENCES "workspace_cluster_agent_bootstrap_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_cluster_agents" ADD CONSTRAINT "workspace_cluster_agents_mtlsCredentialId_fkey" FOREIGN KEY ("mtlsCredentialId") REFERENCES "workspace_cluster_agent_mtls_credentials"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_cluster_agent_bootstrap_tokens" ADD CONSTRAINT "workspace_cluster_agent_bootstrap_tokens_workspaceClusterA_fkey" FOREIGN KEY ("workspaceClusterAgentId") REFERENCES "workspace_cluster_agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "workspace_cluster_agent_mtls_credentials" ADD CONSTRAINT "workspace_cluster_agent_mtls_credentials_workspaceClusterA_fkey" FOREIGN KEY ("workspaceClusterAgentId") REFERENCES "workspace_cluster_agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
