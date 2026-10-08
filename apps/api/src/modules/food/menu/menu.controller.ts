import { 
  Controller, 
  Get, 
  Post, 
  Patch, 
  Body, 
  Param, 
  UseGuards,
  Request,
  ForbiddenException
} from '@nestjs/common';
import { MenuService } from './menu.service';
import { 
  CreateFoodMenuDto, 
  UpdateFoodMenuDto, 
  CreateFoodMenuCategoryDto, 
  UpdateFoodMenuCategoryDto, 
  CreateFoodMenuItemDto, 
  UpdateFoodMenuItemDto 
} from './dtos/menu.dto';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { BusinessCapabilityGuard } from '../../auth/guards/business-capability.guard';
import { RequireCapability } from '../../auth/decorators/require-capability.decorator';
import { BusinessCapability } from '../../auth/business-capabilities';

@Controller('food/menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  private getOrgId(req: any): string {
    if (!req.user || !req.user.orgId) {
      if (req.user && req.user.organizationId) {
        return req.user.organizationId;
      }
      throw new ForbiddenException('Organization context is required');
    }
    return req.user.orgId;
  }

  // ==========================================
  // MANAGEMENT APIs (Authenticated)
  // ==========================================

  @UseGuards(JwtAuthGuard, BusinessCapabilityGuard)
  @RequireCapability(BusinessCapability.MENU)
  @Get()
  getMenus(@Request() req: any) {
    return this.menuService.getMenus(this.getOrgId(req));
  }

  @UseGuards(JwtAuthGuard, BusinessCapabilityGuard)
  @RequireCapability(BusinessCapability.MENU)
  @Get(':id')
  getMenuById(
    @Request() req: any,
    @Param('id') id: string,
  ) {
    return this.menuService.getMenuById(this.getOrgId(req), id);
  }

  @UseGuards(JwtAuthGuard, BusinessCapabilityGuard)
  @RequireCapability(BusinessCapability.MENU)
  @Post()
  createMenu(
    @Request() req: any,
    @Body() dto: CreateFoodMenuDto,
  ) {
    return this.menuService.createMenu(this.getOrgId(req), dto);
  }

  @UseGuards(JwtAuthGuard, BusinessCapabilityGuard)
  @RequireCapability(BusinessCapability.MENU)
  @Patch(':id')
  updateMenu(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateFoodMenuDto,
  ) {
    return this.menuService.updateMenu(this.getOrgId(req), id, dto);
  }

  // ==========================================
  // CATEGORIES
  // ==========================================

  @UseGuards(JwtAuthGuard, BusinessCapabilityGuard)
  @RequireCapability(BusinessCapability.MENU)
  @Post('categories')
  createCategory(
    @Request() req: any,
    @Body() dto: CreateFoodMenuCategoryDto,
  ) {
    return this.menuService.createCategory(this.getOrgId(req), dto);
  }

  @UseGuards(JwtAuthGuard, BusinessCapabilityGuard)
  @RequireCapability(BusinessCapability.MENU)
  @Patch('categories/:id')
  updateCategory(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateFoodMenuCategoryDto,
  ) {
    return this.menuService.updateCategory(this.getOrgId(req), id, dto);
  }

  // ==========================================
  // MENU ITEMS
  // ==========================================

  @UseGuards(JwtAuthGuard, BusinessCapabilityGuard)
  @RequireCapability(BusinessCapability.MENU)
  @Post('items')
  createMenuItem(
    @Request() req: any,
    @Body() dto: CreateFoodMenuItemDto,
  ) {
    return this.menuService.createMenuItem(this.getOrgId(req), dto);
  }

  @UseGuards(JwtAuthGuard, BusinessCapabilityGuard)
  @RequireCapability(BusinessCapability.MENU)
  @Patch('items/:id')
  updateMenuItem(
    @Request() req: any,
    @Param('id') id: string,
    @Body() dto: UpdateFoodMenuItemDto,
  ) {
    return this.menuService.updateMenuItem(this.getOrgId(req), id, dto);
  }

  // ==========================================
  // PUBLIC API
  // ==========================================

  @Get('public/:branchId')
  getPublicMenu(@Param('branchId') branchId: string) {
    return this.menuService.getPublicMenu(branchId);
  }
}
