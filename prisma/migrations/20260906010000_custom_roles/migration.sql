-- Every statement here is written to be safe to re-run from a partially
-- applied state — see the notes in 20260905130000_multi_cabang_dan_akun for
-- why: a migration reported as "failed" by Prisma does not guarantee nothing
-- in it actually committed.

-- AlterTable
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "roleId" INTEGER;

-- CreateTable
CREATE TABLE IF NOT EXISTS "custom_roles" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "permissions" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "custom_roles_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "custom_roles_name_key" ON "custom_roles"("name");

-- AddForeignKey
DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "custom_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
