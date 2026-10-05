-- CreateTable
CREATE TABLE IF NOT EXISTS "point_group_mappings" (
    "id" SERIAL NOT NULL,
    "itemGroup" TEXT NOT NULL,
    "category" "ReportCategory" NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "point_group_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "point_group_mappings_itemGroup_key" ON "point_group_mappings"("itemGroup");

-- Copy existing mappings from item_group_mappings into point_group_mappings
INSERT INTO "point_group_mappings" ("itemGroup", "category", "isDefault", "createdAt")
SELECT "itemGroup", "category", "isDefault", "createdAt" FROM "item_group_mappings"
ON CONFLICT ("itemGroup") DO NOTHING;
