-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "PasswordResetStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'USED', 'EXPIRED');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- CreateTable
CREATE TABLE IF NOT EXISTS "password_reset_requests" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "note" TEXT,
    "requestIp" TEXT,
    "status" "PasswordResetStatus" NOT NULL DEFAULT 'PENDING',
    "tokenHash" TEXT,
    "expiresAt" TIMESTAMP(3),
    "failedAttempts" INTEGER NOT NULL DEFAULT 0,
    "approvedBy" TEXT,
    "approvedAt" TIMESTAMP(3),
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "password_reset_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS "master_recovery_codes" (
    "id" SERIAL NOT NULL,
    "userId" INTEGER NOT NULL,
    "codeHash" TEXT NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "master_recovery_codes_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "password_reset_requests_tokenHash_key" ON "password_reset_requests"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "password_reset_requests_userId_status_idx" ON "password_reset_requests"("userId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "password_reset_requests_status_createdAt_idx" ON "password_reset_requests"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "master_recovery_codes_codeHash_key" ON "master_recovery_codes"("codeHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "master_recovery_codes_userId_usedAt_idx" ON "master_recovery_codes"("userId", "usedAt");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "password_reset_requests" ADD CONSTRAINT "password_reset_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "master_recovery_codes" ADD CONSTRAINT "master_recovery_codes_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
