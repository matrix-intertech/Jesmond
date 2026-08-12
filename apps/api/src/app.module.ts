import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import { TerminusModule } from '@nestjs/terminus';
// BullMQ requires configuration, we'll import it but set it up minimally
import { BullModule } from '@nestjs/bullmq';
import { PropertiesModule } from './modules/properties/properties.module';
import { PrismaModule } from './modules/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { LocationsModule } from './modules/locations/locations.module';
import { AdminModule } from './modules/admin/admin.module';
import { StudentActionsModule } from './modules/student-actions/student-actions.module';
import { ApplicationsModule } from './modules/applications/applications.module';
import { PaymentsModule } from './modules/payments/payments.module';

@Module({
  imports: [
    PrismaModule,
    // 1. Configuration Module (Global)
    ConfigModule.forRoot({
      isGlobal: true,
      // We will plug Zod validation here later
    }),

    // 2. Logging Module (Pino)
    LoggerModule.forRoot({
      pinoHttp: {
        transport: {
          target: 'pino-pretty',
          options: {
            singleLine: true,
          },
        },
      },
    }),

    // 3. Health Checks
    TerminusModule,

    // 4. Background Jobs (Redis required)
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),

    // 5. Feature Modules
    LocationsModule,
    PropertiesModule,
    AdminModule,
    AuthModule,
    StudentActionsModule,
    ApplicationsModule,
    PaymentsModule,
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
