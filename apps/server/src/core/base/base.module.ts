import { Module } from '@nestjs/common';
import { BaseController } from './controllers/base.controller';
import { BasePropertyController } from './controllers/base-property.controller';
import { BaseRowController } from './controllers/base-row.controller';
import { BaseViewController } from './controllers/base-view.controller';
import { BaseService } from './services/base.service';
import { BasePropertyService } from './services/base-property.service';
import { BaseRowService } from './services/base-row.service';
import { BaseViewService } from './services/base-view.service';

@Module({
  controllers: [
    BaseController,
    BasePropertyController,
    BaseRowController,
    BaseViewController,
  ],
  providers: [BaseService, BasePropertyService, BaseRowService, BaseViewService],
  exports: [BaseService, BasePropertyService, BaseRowService, BaseViewService],
})
export class BaseModule {}
