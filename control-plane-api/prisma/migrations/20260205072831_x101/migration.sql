/*
  Warnings:

  - You are about to drop the column `expiredAt` on the `workspace_cluster_agents` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "workspace_cluster_agents" DROP COLUMN "expiredAt";
