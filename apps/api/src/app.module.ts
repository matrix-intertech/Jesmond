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
import { LocationModule } from './modules/location/location.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { SettingsModule } from './modules/settings/settings.module';
import { RetailModule } from './modules/retail/retail.module';
import { ChatModule } from './modules/chat/chat.module';
import { LeadsModule } from './modules/leads/leads.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';

import { RedisModule } from './modules/redis/redis.module';

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    LocationModule,
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
    SettingsModule,
    RetailModule,
    ChatModule,
    LeadsModule,
    OrganizationsModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
