-- CreateTable
CREATE TABLE "item_points" (
    "id" SERIAL NOT NULL,
    "pattern" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "item_points_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "item_points_pattern_key" ON "item_points"("pattern");
