-- AlterTable
ALTER TABLE "Course" ADD COLUMN "semester" TEXT;

-- CreateIndex
CREATE INDEX "Course_semester_idx" ON "Course"("semester");

-- Backfill existing courses based on semester pattern in code or name
UPDATE "Course"
SET "semester" = COALESCE(
  substring("code" from '([0-9]{4}/[0-9]{2}/[12])'),
  substring("name" from '([0-9]{4}/[0-9]{2}/[12])')
);
