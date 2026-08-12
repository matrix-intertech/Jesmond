import { Module } from '@nestjs/common';
import { PropertiesController } from './core/properties.controller';
import { PropertiesService } from './core/properties.service';
import { StorageService } from './core/storage.service';

@Module({
  controllers: [PropertiesController],
  providers: [PropertiesService, StorageService],
  exports: [PropertiesService, StorageService],
})
export class PropertiesModule {}
