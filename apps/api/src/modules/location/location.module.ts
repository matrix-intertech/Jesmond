import { Module } from '@nestjs/common';
import { LocationController } from './location.controller';
import { LocationService } from './location.service';
import { PhotonProvider } from './providers/photon.provider';
import { NominatimProvider } from './providers/nominatim.provider';
import { RedisModule } from '../redis/redis.module';

import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [RedisModule, PrismaModule],
  controllers: [LocationController],
  providers: [LocationService, PhotonProvider, NominatimProvider],
  exports: [LocationService, NominatimProvider, PhotonProvider],
})
export class LocationModule {}
