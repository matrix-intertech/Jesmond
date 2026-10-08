-- CreateTable
CREATE TABLE "FoodMenu" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodMenu_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodMenuCategory" (
    "id" TEXT NOT NULL,
    "menuId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodMenuCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FoodMenuItem" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "price" INTEGER NOT NULL,
    "imageUrl" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isVegetarian" BOOLEAN NOT NULL DEFAULT false,
    "prepTimeMins" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FoodMenuItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "FoodMenu_organizationId_idx" ON "FoodMenu"("organizationId");

-- CreateIndex
CREATE INDEX "FoodMenu_branchId_idx" ON "FoodMenu"("branchId");

-- CreateIndex
CREATE INDEX "FoodMenuCategory_menuId_displayOrder_idx" ON "FoodMenuCategory"("menuId", "displayOrder");

-- CreateIndex
CREATE INDEX "FoodMenuItem_categoryId_displayOrder_idx" ON "FoodMenuItem"("categoryId", "displayOrder");

-- AddForeignKey
ALTER TABLE "FoodMenu" ADD CONSTRAINT "FoodMenu_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodMenu" ADD CONSTRAINT "FoodMenu_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "RetailBranch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodMenuCategory" ADD CONSTRAINT "FoodMenuCategory_menuId_fkey" FOREIGN KEY ("menuId") REFERENCES "FoodMenu"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FoodMenuItem" ADD CONSTRAINT "FoodMenuItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FoodMenuCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
