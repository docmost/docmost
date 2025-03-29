import { Module } from '@nestjs/common';
import { ImagesService } from './images.service';
import { ImagesController } from './images.controller';

@Module({
  providers: [ImagesService],
  controllers: [ImagesController],
  exports: [ImagesService],
  imports: [],
})
export class ImagesModule {}
