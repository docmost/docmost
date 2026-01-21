import { Module } from '@nestjs/common';
import { LoggerModule as PinoLoggerModule } from 'nestjs-pino';
import { createPinoConfig } from './pino.config';

@Module({
  imports: [PinoLoggerModule.forRoot(createPinoConfig())],
  exports: [PinoLoggerModule],
})
export class LoggerModule {}
