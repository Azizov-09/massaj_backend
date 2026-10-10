-- DropForeignKey
ALTER TABLE "Attendance" DROP CONSTRAINT IF EXISTS "Attendance_appointmentId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT IF EXISTS "Transaction_appointmentId_fkey";

-- DropForeignKey
ALTER TABLE "Transaction" DROP CONSTRAINT IF EXISTS "Transaction_sessionId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT IF EXISTS "Session_appointmentId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT IF EXISTS "Session_childId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT IF EXISTS "Session_specialistId_fkey";

-- DropForeignKey
ALTER TABLE "Session" DROP CONSTRAINT IF EXISTS "Session_serviceId_fkey";

-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_childId_fkey";

-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_parentId_fkey";

-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_specialistId_fkey";

-- DropForeignKey
ALTER TABLE "Appointment" DROP CONSTRAINT IF EXISTS "Appointment_serviceId_fkey";

-- DropIndex
DROP INDEX IF EXISTS "Attendance_appointmentId_key";

-- DropIndex
DROP INDEX IF EXISTS "Transaction_appointmentId_idx";

-- DropIndex
DROP INDEX IF EXISTS "Transaction_sessionId_idx";

-- AlterTable Attendance
ALTER TABLE "Attendance" DROP COLUMN IF EXISTS "appointmentId";
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "specialistId" UUID;
ALTER TABLE "Attendance" ADD COLUMN IF NOT EXISTS "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- AlterTable Transaction
ALTER TABLE "Transaction" DROP COLUMN IF EXISTS "appointmentId";
ALTER TABLE "Transaction" DROP COLUMN IF EXISTS "sessionId";

-- DropTable
DROP TABLE IF EXISTS "Session";

-- DropTable
DROP TABLE IF EXISTS "Appointment";

-- DropEnum
DROP TYPE IF EXISTS "SessionStatus";

-- DropEnum
DROP TYPE IF EXISTS "AppointmentStatus";

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Attendance_specialistId_idx" ON "Attendance"("specialistId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Attendance_date_idx" ON "Attendance"("date");

-- AddForeignKey
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_specialistId_fkey" FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE SET NULL ON UPDATE CASCADE;
