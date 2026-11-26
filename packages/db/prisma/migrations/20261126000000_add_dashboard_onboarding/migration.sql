-- CreateEnum
CREATE TYPE "DashboardOnboardingStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'SKIPPED');

-- CreateTable
CREATE TABLE "DashboardOnboarding" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "dashboardId" TEXT NOT NULL,
    "tutorialVersion" INTEGER NOT NULL DEFAULT 1,
    "status" "DashboardOnboardingStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "lastCompletedStep" INTEGER NOT NULL DEFAULT 0,
    "completedAt" TIMESTAMP(3),
    "skippedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardOnboarding_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "DashboardOnboarding_userId_idx" ON "DashboardOnboarding"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardOnboarding_userId_dashboardId_key" ON "DashboardOnboarding"("userId", "dashboardId");

-- AddForeignKey
ALTER TABLE "DashboardOnboarding" ADD CONSTRAINT "DashboardOnboarding_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
