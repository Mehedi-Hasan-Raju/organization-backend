-- CreateEnum
CREATE TYPE "InternshipProgramStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'CLOSED');

-- CreateEnum
CREATE TYPE "InternshipApplicationStatus" AS ENUM ('PENDING', 'UNDER_REVIEW', 'SHORTLISTED', 'INTERVIEW', 'SELECTED', 'REJECTED', 'WITHDRAWN');

-- CreateTable
CREATE TABLE "internship_programs" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "requirements" TEXT,
    "seats" INTEGER NOT NULL DEFAULT 1,
    "deadline" TIMESTAMP(3),
    "status" "InternshipProgramStatus" NOT NULL DEFAULT 'DRAFT',
    "departmentId" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internship_programs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "internship_applications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "programId" TEXT NOT NULL,
    "cvUrl" TEXT,
    "coverLetter" TEXT,
    "status" "InternshipApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "adminNote" TEXT,
    "reviewerId" TEXT,
    "appliedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "internship_applications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "internship_programs_slug_key" ON "internship_programs"("slug");

-- CreateIndex
CREATE INDEX "internship_programs_status_idx" ON "internship_programs"("status");

-- CreateIndex
CREATE INDEX "internship_programs_departmentId_idx" ON "internship_programs"("departmentId");

-- CreateIndex
CREATE INDEX "internship_programs_deadline_idx" ON "internship_programs"("deadline");

-- CreateIndex
CREATE INDEX "internship_applications_programId_status_idx" ON "internship_applications"("programId", "status");

-- CreateIndex
CREATE INDEX "internship_applications_userId_idx" ON "internship_applications"("userId");

-- CreateIndex
CREATE INDEX "internship_applications_reviewerId_idx" ON "internship_applications"("reviewerId");

-- CreateIndex
CREATE UNIQUE INDEX "internship_applications_userId_programId_key" ON "internship_applications"("userId", "programId");

-- AddForeignKey
ALTER TABLE "internship_programs" ADD CONSTRAINT "internship_programs_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internship_applications" ADD CONSTRAINT "internship_applications_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internship_applications" ADD CONSTRAINT "internship_applications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "internship_applications" ADD CONSTRAINT "internship_applications_programId_fkey" FOREIGN KEY ("programId") REFERENCES "internship_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
