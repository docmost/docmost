import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';
import { EnvironmentModule } from './environment/environment.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppDataSource } from './database/typeorm.config';
import { CollaborationModule } from './collaboration/collaboration.module';

@Module({
  imports: [
    CoreModule,
    EnvironmentModule,
    TypeOrmModule.forRoot({
      ...AppDataSource.options,
      entities: ['dist/src/**/*.entity.{ts,js}'],
      migrations: ['dist/src/**/migrations/*.{ts,js}'],
      autoLoadEntities: true,
    }),
    CollaborationModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
