CREATE TYPE "AdminRole" AS ENUM ('ADMIN', 'VOLUNTEER');
CREATE TYPE "EventStatus" AS ENUM ('OPEN', 'PAUSED', 'CLOSED');
CREATE TYPE "AuditResult" AS ENUM ('GRANTED', 'ALREADY_CHECKED_IN', 'DENIED', 'RATE_LIMITED', 'EVENT_CLOSED', 'TOKEN_REJECTED', 'LOOKUP_FOUND', 'LOOKUP_NONE', 'UNCHECKED', 'EDITED', 'DELETED');
CREATE TYPE "CheckInMethod" AS ENUM ('SELF', 'DESK');

CREATE TABLE "Student" (
  "id" TEXT NOT NULL,
  "studentId" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "mobile" TEXT,
  "department" TEXT,
  "email" TEXT,
  "year" TEXT,
  "extraData" JSONB,
  "checkedIn" BOOLEAN NOT NULL DEFAULT false,
  "checkinAt" TIMESTAMP(3),
  "checkinBy" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "Student_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminUser" (
  "id" TEXT NOT NULL,
  "username" TEXT NOT NULL,
  "passwordHash" TEXT NOT NULL,
  "displayName" TEXT,
  "role" "AdminRole" NOT NULL DEFAULT 'ADMIN',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "AdminUser_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AdminSession" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AdminSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "CheckIn" (
  "id" TEXT NOT NULL,
  "studentId" TEXT,
  "studentKey" TEXT NOT NULL,
  "enteredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "method" "CheckInMethod" NOT NULL,
  "actorUserId" TEXT,
  "actorUsername" TEXT,
  "revertedAt" TIMESTAMP(3),
  "reversedByUserId" TEXT,
  "reversalReason" TEXT,
  CONSTRAINT "CheckIn_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "AuditLog" (
  "id" TEXT NOT NULL,
  "rawInput" TEXT NOT NULL,
  "lookupId" TEXT NOT NULL,
  "result" "AuditResult" NOT NULL,
  "studentId" TEXT,
  "studentKey" TEXT,
  "actor" TEXT,
  "ipHash" TEXT,
  "userAgent" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "EventSettings" (
  "id" TEXT NOT NULL DEFAULT 'primary',
  "eventToken" TEXT NOT NULL,
  "eventName" TEXT NOT NULL DEFAULT 'OBSIDIAN ''26',
  "tagline" TEXT NOT NULL DEFAULT 'Unfold the Unknown',
  "status" "EventStatus" NOT NULL DEFAULT 'OPEN',
  "requireQrToken" BOOLEAN NOT NULL DEFAULT false,
  "announcement" TEXT,
  "announcementExpiresAt" TIMESTAMP(3),
  "announcementHistory" JSONB NOT NULL DEFAULT '[]',
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "EventSettings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "RateLimitBucket" (
  "keyHash" TEXT NOT NULL,
  "windowStart" TIMESTAMP(3) NOT NULL,
  "count" INTEGER NOT NULL DEFAULT 1,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "RateLimitBucket_pkey" PRIMARY KEY ("keyHash", "windowStart")
);

CREATE UNIQUE INDEX "Student_studentId_key" ON "Student"("studentId");
CREATE INDEX "Student_checkedIn_idx" ON "Student"("checkedIn");
CREATE INDEX "Student_department_idx" ON "Student"("department");
CREATE UNIQUE INDEX "AdminUser_username_key" ON "AdminUser"("username");
CREATE UNIQUE INDEX "AdminSession_tokenHash_key" ON "AdminSession"("tokenHash");
CREATE INDEX "AdminSession_expiresAt_idx" ON "AdminSession"("expiresAt");
CREATE INDEX "CheckIn_studentId_enteredAt_idx" ON "CheckIn"("studentId", "enteredAt");
CREATE INDEX "CheckIn_studentKey_enteredAt_idx" ON "CheckIn"("studentKey", "enteredAt");
CREATE INDEX "CheckIn_enteredAt_idx" ON "CheckIn"("enteredAt");
CREATE INDEX "CheckIn_revertedAt_idx" ON "CheckIn"("revertedAt");
CREATE INDEX "AuditLog_result_idx" ON "AuditLog"("result");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_actor_idx" ON "AuditLog"("actor");
CREATE UNIQUE INDEX "EventSettings_eventToken_key" ON "EventSettings"("eventToken");
CREATE INDEX "RateLimitBucket_expiresAt_idx" ON "RateLimitBucket"("expiresAt");

ALTER TABLE "AdminSession" ADD CONSTRAINT "AdminSession_userId_fkey" FOREIGN KEY ("userId") REFERENCES "AdminUser"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "CheckIn" ADD CONSTRAINT "CheckIn_reversedByUserId_fkey" FOREIGN KEY ("reversedByUserId") REFERENCES "AdminUser"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "Student"("id") ON DELETE SET NULL ON UPDATE CASCADE;
