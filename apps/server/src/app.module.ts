import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { CoreModule } from './core/core.module';
import { EnvironmentModule } from './integrations/environment/environment.module';
import { CollaborationModule } from './collaboration/collaboration.module';
import { DatabaseModule } from './database/database.module';
import { WsModule } from './ws/ws.module';
import { ServeStaticModule } from '@nestjs/serve-static';
import { join } from 'path';
import { KyselyModule } from 'nestjs-kysely';
import { EnvironmentService } from './integrations/environment/environment.service';
import { PostgresDialect } from 'kysely';
import { Pool } from 'pg';

@Module({
  imports: [
    CoreModule,
    EnvironmentModule,
    DatabaseModule,
    CollaborationModule,
    WsModule,
    ServeStaticModule.forRoot({
      rootPath: join(__dirname, '..', '..', '..', 'client/dist'),
    }),
    KyselyModule.forRootAsync({
      imports: [],
      inject: [EnvironmentService],
      useFactory: (envService: EnvironmentService) => {
        return {
          dialect: new PostgresDialect({
            pool: new Pool({
              connectionString: envService.getDatabaseURL(),
            }) as any,
          }),
        };
      },
    }),
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
