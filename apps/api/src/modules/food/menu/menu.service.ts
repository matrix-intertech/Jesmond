import { Injectable, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { 
  CreateFoodMenuDto, 
  UpdateFoodMenuDto, 
  CreateFoodMenuCategoryDto, 
  UpdateFoodMenuCategoryDto, 
  CreateFoodMenuItemDto, 
  UpdateFoodMenuItemDto 
} from './dtos/menu.dto';

@Injectable()
export class MenuService {
  constructor(private readonly prisma: PrismaService) {}

  // ==========================================
  // MENUS
  // ==========================================

  async getMenus(organizationId: string) {
    return this.prisma.foodMenu.findMany({
      where: { organizationId },
      include: {
        branch: true,
      },
    });
  }

  async getMenuById(organizationId: string, menuId: string) {
    const menu = await this.prisma.foodMenu.findFirst({
      where: { id: menuId, organizationId },
      include: {
        categories: {
          include: {
            items: {
              orderBy: { displayOrder: 'asc' },
            },
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!menu) {
      throw new NotFoundException('Menu not found');
    }

    return menu;
  }

  async createMenu(organizationId: string, dto: CreateFoodMenuDto) {
    // Verify branch belongs to organization
    const branch = await this.prisma.retailBranch.findFirst({
      where: { id: dto.branchId, organizationId },
    });

    if (!branch) {
      throw new NotFoundException('Branch not found or does not belong to organization');
    }

    return this.prisma.foodMenu.create({
      data: {
        organizationId,
        branchId: dto.branchId,
        name: dto.name,
        description: dto.description,
      },
    });
  }

  async updateMenu(organizationId: string, menuId: string, dto: UpdateFoodMenuDto) {
    const menu = await this.prisma.foodMenu.findFirst({
      where: { id: menuId, organizationId },
    });

    if (!menu) {
      throw new NotFoundException('Menu not found');
    }

    return this.prisma.foodMenu.update({
      where: { id: menuId },
      data: dto,
    });
  }

  // ==========================================
  // CATEGORIES
  // ==========================================

  async createCategory(organizationId: string, dto: CreateFoodMenuCategoryDto) {
    const menu = await this.prisma.foodMenu.findFirst({
      where: { id: dto.menuId, organizationId },
    });

    if (!menu) {
      throw new NotFoundException('Menu not found or you do not have permission');
    }

    return this.prisma.foodMenuCategory.create({
      data: {
        menuId: dto.menuId,
        name: dto.name,
        description: dto.description,
        displayOrder: dto.displayOrder || 0,
      },
    });
  }

  async updateCategory(organizationId: string, categoryId: string, dto: UpdateFoodMenuCategoryDto) {
    const category = await this.prisma.foodMenuCategory.findFirst({
      where: { 
        id: categoryId,
        menu: { organizationId },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found');
    }

    return this.prisma.foodMenuCategory.update({
      where: { id: categoryId },
      data: dto,
    });
  }

  // ==========================================
  // MENU ITEMS
  // ==========================================

  async createMenuItem(organizationId: string, dto: CreateFoodMenuItemDto) {
    const category = await this.prisma.foodMenuCategory.findFirst({
      where: { 
        id: dto.categoryId,
        menu: { organizationId },
      },
    });

    if (!category) {
      throw new NotFoundException('Category not found or you do not have permission');
    }

    return this.prisma.foodMenuItem.create({
      data: {
        categoryId: dto.categoryId,
        name: dto.name,
        description: dto.description,
        price: dto.price,
        imageUrl: dto.imageUrl,
        displayOrder: dto.displayOrder || 0,
        isVegetarian: dto.isVegetarian || false,
        prepTimeMins: dto.prepTimeMins,
      },
    });
  }

  async updateMenuItem(organizationId: string, itemId: string, dto: UpdateFoodMenuItemDto) {
    const item = await this.prisma.foodMenuItem.findFirst({
      where: { 
        id: itemId,
        category: {
          menu: { organizationId },
        },
      },
    });

    if (!item) {
      throw new NotFoundException('Menu item not found');
    }

    return this.prisma.foodMenuItem.update({
      where: { id: itemId },
      data: dto,
    });
  }

  // ==========================================
  // PUBLIC API
  // ==========================================

  async getPublicMenu(branchId: string) {
    const menus = await this.prisma.foodMenu.findMany({
      where: { 
        branchId,
        isActive: true,
      },
      include: {
        categories: {
          where: { isActive: true },
          include: {
            items: {
              where: { isActive: true },
              orderBy: { displayOrder: 'asc' },
            },
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    return menus;
  }
}
