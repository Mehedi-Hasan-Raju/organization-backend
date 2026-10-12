-- CreateEnum
CREATE TYPE "InternshipInterviewStatus" AS ENUM ('SCHEDULED', 'COMPLETED', 'CANCELLED', 'NO_SHOW');

-- CreateTable
CREATE TABLE "internship_interviews" (
    "id" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL DEFAULT 30,
    "meetingUrl" TEXT,
    "location" TEXT,
    "notes" TEXT,
    "status" "InternshipInterviewStatus" NOT NULL DEFAULT 'SCHEDULED',
    "interviewerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internship_interviews_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "internship_interviews_applicationId_scheduledAt_idx" ON "internship_interviews"("applicationId", "scheduledAt");

-- CreateIndex
CREATE INDEX "internship_interviews_interviewerId_idx" ON "internship_interviews"("interviewerId");

-- CreateIndex
CREATE INDEX "internship_interviews_status_idx" ON "internship_interviews"("status");

-- AddForeignKey
ALTER TABLE "internship_interviews" ADD CONSTRAINT "internship_interviews_interviewerId_fkey" FOREIGN KEY ("interviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internship_interviews" ADD CONSTRAINT "internship_interviews_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "internship_applications"("id") ON DELETE CASCADE ON UPDATE CASCADE;
