import { ConsoleLogger } from '@nestjs/common';

export class InternalLogFilter extends ConsoleLogger {
  static contextsToIgnore = [
    'InstanceLoader',
    'RoutesResolver',
    'RouterExplorer',
    'WebSocketsController',
  ];

  log(_: any, context?: string): void {
    if (
      process.env.NODE_ENV !== 'production' ||
      !InternalLogFilter.contextsToIgnore.includes(context)
    ) {
      super.log.apply(this, arguments);
    }
  }
}
