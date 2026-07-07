-- AlterTable
ALTER TABLE "InterviewSlot" ADD COLUMN     "applicationId" TEXT,
ADD COLUMN     "location" TEXT,
ADD COLUMN     "notes" TEXT;

-- AddForeignKey
ALTER TABLE "InterviewSlot" ADD CONSTRAINT "InterviewSlot_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;
