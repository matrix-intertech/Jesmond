import {
  Module,
  MiddlewareConsumer,
  RequestMethod,
  NestModule,
} from '@nestjs/common';
import rateLimit from 'express-rate-limit';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './controllers/auth.controller';
import { SsoController } from './controllers/sso.controller';
import { AuthService } from './services/auth.service';
import { SsoService } from './services/sso.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { BusinessPortalGuard } from './guards/business-portal.guard';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailService } from './services/email.service';
import { WhatsAppModule } from '../whatsapp/whatsapp.module';
import { WhatsAppAuthOtpService } from './services/whatsapp-auth-otp.service';

@Module({
  imports: [
    PassportModule,
    PrismaModule,
    WhatsAppModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (process.env.NODE_ENV === 'production' && !secret) {
          throw new Error(
            'JWT_SECRET must be explicitly configured in production environment.',
          );
        }
        return {
          secret: secret || 'fallback-secret-for-dev',
          signOptions: { expiresIn: '7d' },
        };
      },
    }),
  ],
  controllers: [AuthController, SsoController],
  providers: [
    AuthService,
    SsoService,
    JwtStrategy,
    BusinessPortalGuard,
    EmailService,
    WhatsAppAuthOtpService,
  ],
  exports: [AuthService, SsoService, BusinessPortalGuard, EmailService],
})
export class AuthModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    const authRateLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 requests per 15 minutes per IP
      standardHeaders: true,
      legacyHeaders: true,
      message:
        'Too many requests from this IP, please try again after 15 minutes.',
    });

    const ssoExchangeLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: process.env.NODE_ENV === 'test' ? 1000 : 30, // 30 code exchange attempts per 15 min per IP
      standardHeaders: true,
      legacyHeaders: true,
      message:
        'Too many SSO code exchange attempts from this IP, please try again after 15 minutes.',
    });

    consumer
      .apply(authRateLimiter)
      .forRoutes(
        { path: 'auth/forgot-password', method: RequestMethod.POST },
        { path: 'auth/verify-reset-otp', method: RequestMethod.POST },
        { path: 'auth/reset-password', method: RequestMethod.POST },
        { path: 'auth/request-login-otp', method: RequestMethod.POST },
        { path: 'auth/verify-login-otp', method: RequestMethod.POST },
      );

    consumer
      .apply(ssoExchangeLimiter)
      .forRoutes(
        { path: 'auth/sso/exchange', method: RequestMethod.POST },
      );
  }
}
