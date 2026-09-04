-- CreateTable
CREATE TABLE "item_group_point_defaults" (
    "id" SERIAL NOT NULL,
    "itemGroup" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_group_point_defaults_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "item_group_point_defaults_itemGroup_key" ON "item_group_point_defaults"("itemGroup");
