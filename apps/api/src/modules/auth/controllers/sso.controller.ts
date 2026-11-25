import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
  Response,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { SsoService } from '../services/sso.service';
import { SsoAuthorizeDto, SsoExchangeDto, SsoLogoutDto } from '../dtos/sso.dto';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { BusinessPortalGuard } from '../guards/business-portal.guard';

@Controller('auth/sso')
export class SsoController {
  constructor(private readonly ssoService: SsoService) {}

  /**
   * Generates a 60-second single-use authorization code with PKCE challenge.
   * Requires the user to already be authenticated on the issuing portal.
   */
  @UseGuards(JwtAuthGuard)
  @Post('authorize')
  @HttpCode(HttpStatus.OK)
  async authorize(@Request() req: any, @Body() dto: SsoAuthorizeDto) {
    return this.ssoService.generateAuthorizationCode(req.user, dto);
  }

  /**
   * Exchanges an authorization code and PKCE code_verifier for a valid JWT session.
   * Public endpoint invoked by destination portal callback page.
   * Atomically burns code (GETDEL) for replay protection.
   */
  @Post('exchange')
  @HttpCode(HttpStatus.OK)
  async exchange(
    @Request() req: any,
    @Response({ passthrough: true }) res: any,
    @Body() dto: SsoExchangeDto,
  ) {
    const clientInfo = {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };

    const result = await this.ssoService.exchangeAuthorizationCode(
      dto,
      clientInfo,
    );

    const isProd =
      process.env.NODE_ENV === 'production' ||
      process.env.COOKIE_SECURE === 'true';
    const isSecureContext = isProd || req.secure || req.headers['x-forwarded-proto'] === 'https';

    // RFC 6265bis: __Host- prefix STRICTLY requires secure: true.
    // In local non-HTTPS development, use safe fallback cookie name to prevent browser drops.
    const isBusiness = dto.client_id === 'jesmond-business-portal';
    const cookieName = isSecureContext
      ? isBusiness
        ? '__Host-business-session'
        : '__Host-student-session'
      : isBusiness
        ? 'business-session'
        : 'student-session';

    // Set host-only, HttpOnly, SameSite=Lax session cookie
    if (res?.cookie) {
      res.cookie(cookieName, result.access_token, {
        httpOnly: true,
        secure: isSecureContext,
        sameSite: 'lax',
        path: '/',
        maxAge: 7 * 24 * 60 * 60 * 1000,
      });
    }

    return result;
  }

  /**
   * Verifies if the authenticated user has registered/active business organization access.
   */
  @UseGuards(JwtAuthGuard)
  @Get('business-check')
  async checkBusinessAccess(@Request() req: any) {
    const requestedOrgId = req?.headers?.['x-organization-id'] as
      | string
      | undefined;
    return requestedOrgId
      ? this.ssoService.checkBusinessAccess(req.user.id, requestedOrgId)
      : this.ssoService.checkBusinessAccess(req.user.id);
  }

  /**
   * Validates business dashboard entitlement on the backend.
   * Enforced via BusinessPortalGuard.
   */
  @UseGuards(JwtAuthGuard, BusinessPortalGuard)
  @Get('business-verify')
  async verifyBusinessDashboardAccess(@Request() req: any) {
    return {
      allowed: true,
      user: req.user,
      organizationId: req.user.organizationId,
      orgRole: req.user.orgRole,
    };
  }

  /**
   * Revokes the user session across portals and clears host cookies.
   */
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @HttpCode(HttpStatus.OK)
  async logout(
    @Request() req: any,
    @Response({ passthrough: true }) res: any,
    @Body() dto: SsoLogoutDto,
  ) {
    const sessionId = dto.sessionId || req.user.sessionId;
    const result = await this.ssoService.logoutSession(req.user.id, sessionId);

    if (res?.clearCookie) {
      // Clear production __Host- cookies (strictly require path=/ and secure=true under RFC 6265bis)
      res.clearCookie('__Host-business-session', {
        path: '/',
        secure: true,
        sameSite: 'lax',
        httpOnly: true,
      });
      res.clearCookie('__Host-student-session', {
        path: '/',
        secure: true,
        sameSite: 'lax',
        httpOnly: true,
      });
      // Clear development / fallback cookies
      res.clearCookie('business-session', {
        path: '/',
        sameSite: 'lax',
        httpOnly: true,
      });
      res.clearCookie('student-session', {
        path: '/',
        sameSite: 'lax',
        httpOnly: true,
      });
      res.clearCookie('jesmond_session', {
        path: '/',
        sameSite: 'lax',
        httpOnly: true,
      });
      res.clearCookie('jesmond_token', {
        path: '/',
        sameSite: 'lax',
        httpOnly: true,
      });
    }

    return result;
  }
}
