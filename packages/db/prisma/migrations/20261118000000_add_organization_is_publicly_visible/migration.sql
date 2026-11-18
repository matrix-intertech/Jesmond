-- AlterTable
ALTER TABLE "Organization" ADD COLUMN IF NOT EXISTS "isPubliclyVisible" BOOLEAN NOT NULL DEFAULT true;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Organization_isPubliclyVisible_idx" ON "Organization"("isPubliclyVisible");
