BEGIN;

CREATE TYPE "AppointmentStatus" AS ENUM (
  'SCHEDULED', 'CONFIRMED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED', 'NO_SHOW'
);

CREATE TABLE "Appointment" (
  "id" UUID NOT NULL,
  "childId" UUID NOT NULL,
  "parentId" UUID NOT NULL,
  "specialistId" UUID NOT NULL,
  "serviceId" UUID NOT NULL,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "status" "AppointmentStatus" NOT NULL DEFAULT 'SCHEDULED',
  "courseKey" VARCHAR(100),
  "sequenceNumber" INTEGER,
  "notes" VARCHAR(1000),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Appointment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "Appointment_time_check" CHECK ("endAt" > "startAt"),
  CONSTRAINT "Appointment_course_check" CHECK (
    ("courseKey" IS NULL AND "sequenceNumber" IS NULL)
    OR ("courseKey" IS NOT NULL AND "sequenceNumber" BETWEEN 1 AND 100)
  )
);

CREATE UNIQUE INDEX "Appointment_courseKey_sequenceNumber_key" ON "Appointment"("courseKey", "sequenceNumber");
CREATE UNIQUE INDEX "Appointment_specialistId_startAt_key" ON "Appointment"("specialistId", "startAt");
CREATE UNIQUE INDEX "Appointment_childId_startAt_key" ON "Appointment"("childId", "startAt");
CREATE INDEX "Appointment_parentId_idx" ON "Appointment"("parentId");
CREATE INDEX "Appointment_serviceId_idx" ON "Appointment"("serviceId");
CREATE INDEX "Appointment_status_idx" ON "Appointment"("status");
CREATE INDEX "Appointment_startAt_idx" ON "Appointment"("startAt");

ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_childId_fkey"
  FOREIGN KEY ("childId") REFERENCES "Child"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_parentId_fkey"
  FOREIGN KEY ("parentId") REFERENCES "Parent"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_specialistId_fkey"
  FOREIGN KEY ("specialistId") REFERENCES "Specialist"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "Appointment" ADD CONSTRAINT "Appointment_serviceId_fkey"
  FOREIGN KEY ("serviceId") REFERENCES "Service"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Attendance" ADD COLUMN "appointmentId" UUID;
CREATE UNIQUE INDEX "Attendance_appointmentId_key" ON "Attendance"("appointmentId");
ALTER TABLE "Attendance" ADD CONSTRAINT "Attendance_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Transaction" ADD COLUMN "appointmentId" UUID;
ALTER TABLE "Transaction" ALTER COLUMN "idempotencyKey" TYPE VARCHAR(512);
CREATE UNIQUE INDEX "Transaction_appointmentId_key" ON "Transaction"("appointmentId");
CREATE UNIQUE INDEX "Transaction_payment_once_key"
  ON "Transaction"("paymentId") WHERE "type" = 'PAYMENT' AND "paymentId" IS NOT NULL;
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_appointmentId_fkey"
  FOREIGN KEY ("appointmentId") REFERENCES "Appointment"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Payment" ADD CONSTRAINT "Payment_amount_positive_check" CHECK ("amount" > 0);
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_amount_positive_check" CHECK ("amount" > 0);
ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_payment_shape_check" CHECK (
  "type" <> 'PAYMENT'
  OR (
    "paymentId" IS NOT NULL
    AND "parentId" IS NOT NULL
    AND "childId" IS NOT NULL
    AND "direction" = 'IN'
  )
);

COMMIT;
