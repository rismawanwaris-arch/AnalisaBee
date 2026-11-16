-- CreateTable
CREATE TABLE IF NOT EXISTS "attention_programs" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attention_programs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "attention_programs_name_key" ON "attention_programs"("name");

-- CreateTable
CREATE TABLE IF NOT EXISTS "attention_point_entries" (
    "id" SERIAL NOT NULL,
    "tanggal" DATE NOT NULL,
    "employeeId" INTEGER NOT NULL,
    "programId" INTEGER NOT NULL,
    "qty" INTEGER NOT NULL DEFAULT 1,
    "pointsPerUnit" INTEGER NOT NULL,
    "totalPoints" INTEGER NOT NULL,
    "note" TEXT,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attention_point_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX IF NOT EXISTS "attention_point_entries_tanggal_idx" ON "attention_point_entries"("tanggal");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "attention_point_entries_employeeId_tanggal_idx" ON "attention_point_entries"("employeeId", "tanggal");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "attention_point_entries_programId_idx" ON "attention_point_entries"("programId");

-- AddForeignKey
DO $$ BEGIN
    ALTER TABLE "attention_point_entries" ADD CONSTRAINT "attention_point_entries_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "attention_point_entries" ADD CONSTRAINT "attention_point_entries_programId_fkey" FOREIGN KEY ("programId") REFERENCES "attention_programs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;
