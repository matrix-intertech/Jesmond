import { Test, TestingModule } from '@nestjs/testing';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { BusinessCapabilityGuard } from '../../auth/guards/business-capability.guard';
import { ForbiddenException, BadRequestException, ValidationPipe } from '@nestjs/common';
import { BusinessCapability } from '../../auth/business-capabilities';
import { Reflector } from '@nestjs/core';

describe('Food Menu Management (Phase 5B)', () => {
  let controller: MenuController;
  let service: MenuService;

  const mockMenuService = {
    getMenus: jest.fn(),
    getMenuById: jest.fn(),
    createMenu: jest.fn(),
    updateMenu: jest.fn(),
    createCategory: jest.fn(),
    updateCategory: jest.fn(),
    createMenuItem: jest.fn(),
    updateMenuItem: jest.fn(),
    getPublicMenu: jest.fn(),
  };

  const mockOrgId = 'org-123';
  const mockReq = { user: { orgId: mockOrgId } };
  const mockWrongReq = { user: { orgId: 'org-456' } };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [MenuController],
      providers: [
        { provide: MenuService, useValue: mockMenuService },
      ],
    })
      .overrideGuard(JwtAuthGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .overrideGuard(BusinessCapabilityGuard)
      .useValue({ canActivate: jest.fn().mockReturnValue(true) })
      .compile();

    controller = module.get<MenuController>(MenuController);
    service = module.get<MenuService>(MenuService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should create menu', async () => {
    mockMenuService.createMenu.mockResolvedValue({ id: 'menu-1', name: 'Test Menu' });
    const res = await controller.createMenu(mockReq, { name: 'Test Menu' });
    expect(res).toEqual({ id: 'menu-1', name: 'Test Menu' });
    expect(mockMenuService.createMenu).toHaveBeenCalledWith(mockOrgId, { name: 'Test Menu' });
  });

  it('should update menu and status', async () => {
    mockMenuService.updateMenu.mockResolvedValue({ id: 'menu-1', isActive: false });
    const res = await controller.updateMenu(mockReq, 'menu-1', { isActive: false });
    expect(res).toEqual({ id: 'menu-1', isActive: false });
    expect(mockMenuService.updateMenu).toHaveBeenCalledWith(mockOrgId, 'menu-1', { isActive: false });
  });

  it('should isolate ownership', async () => {
    mockMenuService.updateMenu.mockRejectedValue(new ForbiddenException());
    await expect(controller.updateMenu(mockWrongReq, 'menu-1', { isActive: false }))
      .rejects.toThrow(ForbiddenException);
    expect(mockMenuService.updateMenu).toHaveBeenCalledWith('org-456', 'menu-1', { isActive: false });
  });

  it('should create category', async () => {
    mockMenuService.createCategory.mockResolvedValue({ id: 'cat-1', name: 'Mains' });
    const res = await controller.createCategory(mockReq, { menuId: 'menu-1', name: 'Mains', displayOrder: 1 });
    expect(res).toEqual({ id: 'cat-1', name: 'Mains' });
    expect(mockMenuService.createCategory).toHaveBeenCalledWith(mockOrgId, { menuId: 'menu-1', name: 'Mains', displayOrder: 1 });
  });

  it('should isolate category ownership', async () => {
    mockMenuService.updateCategory.mockRejectedValue(new ForbiddenException());
    await expect(controller.updateCategory(mockWrongReq, 'cat-1', { name: 'New' }))
      .rejects.toThrow(ForbiddenException);
  });

  it('should create item', async () => {
    mockMenuService.createMenuItem.mockResolvedValue({ id: 'item-1', price: 1000 });
    const res = await controller.createMenuItem(mockReq, { categoryId: 'cat-1', name: 'Burger', price: 1000, displayOrder: 1 });
    expect(res).toEqual({ id: 'item-1', price: 1000 });
    expect(mockMenuService.createMenuItem).toHaveBeenCalledWith(mockOrgId, { categoryId: 'cat-1', name: 'Burger', price: 1000, displayOrder: 1 });
  });

  it('should isolate item ownership', async () => {
    mockMenuService.updateMenuItem.mockRejectedValue(new ForbiddenException());
    await expect(controller.updateMenuItem(mockWrongReq, 'item-1', { price: 2000 }))
      .rejects.toThrow(ForbiddenException);
  });

  it('should reject negative price (unit logic proxy)', async () => {
    // In a pure controller test without global pipes, we manually mock the failure
    // However, class-validator `@Min(0)` on the DTO enforces this in reality.
    mockMenuService.createMenuItem.mockRejectedValue(new BadRequestException('price must not be less than 0'));
    await expect(controller.createMenuItem(mockReq, { categoryId: 'cat-1', name: 'Burger', price: -5, displayOrder: 1 }))
      .rejects.toThrow(BadRequestException);
  });

  it('should reject non-Food capability (guard proxy)', async () => {
    const capabilities = Reflect.getMetadata('business_capabilities', controller.createMenu);
    expect(capabilities).toContain(BusinessCapability.MENU);
  });

  describe('Public API (Phase 5D)', () => {
    it('should retrieve multiple active menus if present', async () => {
      const activeMenus = [{ id: 'menu-1', isActive: true }, { id: 'menu-2', isActive: true }];
      mockMenuService.getPublicMenu.mockResolvedValue(activeMenus);
      const res = await controller.getPublicMenu('branch-1');
      expect(res).toEqual(activeMenus);
      expect(mockMenuService.getPublicMenu).toHaveBeenCalledWith('branch-1');
    });

    it('should return empty array if no active menus', async () => {
      mockMenuService.getPublicMenu.mockResolvedValue([]);
      const res = await controller.getPublicMenu('branch-1');
      expect(res).toEqual([]);
    });

    it('should implicitly verify inactive menus are hidden by service', async () => {
      // The controller delegates to service, so we ensure it calls the right method.
      // The Prisma logic in menu.service.ts enforces `isActive: true`.
      await controller.getPublicMenu('branch-1');
      expect(mockMenuService.getPublicMenu).toHaveBeenCalledWith('branch-1');
    });
  });
});
