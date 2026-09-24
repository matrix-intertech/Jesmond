-- CreateEnum
CREATE TYPE "PropertyPermission" AS ENUM ('VIEW', 'MANAGE');

-- AlterTable
ALTER TABLE "PropertyManager" ADD COLUMN     "permission" "PropertyPermission" NOT NULL DEFAULT 'MANAGE';
