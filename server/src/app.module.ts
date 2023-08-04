import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';
import { EnvironmentModule } from './environment/environment.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppDataSource } from './database/typeorm.config';

@Module({
  imports: [
    CoreModule,
    EnvironmentModule,
    TypeOrmModule.forRoot({
      ...AppDataSource.options,
      entities: ['dist/src/**/*.entity.ts'],
      migrations: ['dist/src/**/migrations/*.{ts,js}'],
      autoLoadEntities: true,
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
