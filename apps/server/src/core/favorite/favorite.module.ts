import { Module } from '@nestjs/common';
import { FavoriteService } from './services/favorite.service';
import { FavoriteController } from './favorite.controller';

@Module({
  controllers: [FavoriteController],
  providers: [FavoriteService],
  exports: [FavoriteService],
})
export class FavoriteModule {}
