-- CreateTable
CREATE TABLE "item_point_exclusions" (
    "id" SERIAL NOT NULL,
    "pattern" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "item_point_exclusions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "item_point_exclusions_pattern_key" ON "item_point_exclusions"("pattern");
