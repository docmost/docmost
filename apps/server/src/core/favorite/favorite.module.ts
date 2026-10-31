import { Module } from '@nestjs/common';
import { FavoriteService } from './services/favorite.service.js';
import { FavoriteController } from './favorite.controller.js';

@Module({
  controllers: [FavoriteController],
  providers: [FavoriteService],
  exports: [FavoriteService],
})
export class FavoriteModule {}
