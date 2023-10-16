import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppDataSource } from './typeorm.config';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      ...AppDataSource.options,
      entities: ['dist/src/**/*.entity.{ts,js}'],
      migrations: ['dist/src/**/migrations/*.{ts,js}'],
      autoLoadEntities: true,
    }),
  ],
})
export class DatabaseModule {}
