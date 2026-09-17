import { Module } from '@nestjs/common';
import { CatalogService } from './catalog.service';
import { CatalogController } from './catalog.controller';
import { PropertiesModule } from '../../properties/properties.module';

@Module({
  imports: [PropertiesModule],
  providers: [CatalogService],
  controllers: [CatalogController]
})
export class CatalogModule {}
