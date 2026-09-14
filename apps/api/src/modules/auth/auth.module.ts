import { Module, MiddlewareConsumer, RequestMethod } from '@nestjs/common';
import rateLimit from 'express-rate-limit';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './controllers/auth.controller';
import { AuthService } from './services/auth.service';
import { JwtStrategy } from './strategies/jwt.strategy';
import { PrismaModule } from '../prisma/prisma.module';
import { EmailService } from './services/email.service';

@Module({
  imports: [
    PassportModule,
    PrismaModule,
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET;
        if (process.env.NODE_ENV === 'production' && !secret) {
          throw new Error('JWT_SECRET must be explicitly configured in production environment.');
        }
        return {
          secret: secret || 'fallback-secret-for-dev',
          signOptions: { expiresIn: '7d' },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy, EmailService],
  exports: [AuthService, EmailService],
})
export class AuthModule {
  configure(consumer: MiddlewareConsumer) {
    const authRateLimiter = rateLimit({
      windowMs: 15 * 60 * 1000, // 15 minutes
      max: 5, // 5 requests per 15 minutes per IP
      standardHeaders: true,
      legacyHeaders: true,
      message: 'Too many password reset requests from this IP, please try again after 15 minutes.',
    });

    consumer
      .apply(authRateLimiter)
      .forRoutes(
        { path: 'auth/forgot-password', method: RequestMethod.POST },
        { path: 'auth/verify-reset-otp', method: RequestMethod.POST },
        { path: 'auth/reset-password', method: RequestMethod.POST }
      );
  }
}
