-- CreateEnum
CREATE TYPE "PropertyVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'SUSPENDED');

-- AlterTable
ALTER TABLE "Property" ADD COLUMN     "verificationStatus" "PropertyVerificationStatus" NOT NULL DEFAULT 'PENDING';
