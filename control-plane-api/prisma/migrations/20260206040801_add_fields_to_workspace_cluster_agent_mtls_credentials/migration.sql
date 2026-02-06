-- AlterTable
ALTER TABLE "workspace_cluster_agent_mtls_credentials" ADD COLUMN     "caProvider" TEXT NOT NULL DEFAULT 'self-signed',
ADD COLUMN     "certFingerprint" TEXT,
ADD COLUMN     "certSerialNumber" TEXT,
ALTER COLUMN "caCert" DROP NOT NULL;
