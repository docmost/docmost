import { IsNotEmpty, IsUrl, validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';

export class EnvironmentVariables {
  @IsNotEmpty()
  @IsUrl({ protocols: ['postgres', 'postgresql'], require_tld: false })
  DATABASE_URL: string;

  @IsNotEmpty()
  APP_SECRET: string;
}

export function validate(config: Record<string, any>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config);

  const errors = validateSync(validatedConfig);
  if (errors.length > 0) {
    errors.map((error) => {
      console.error(error.toString());
    });
    console.log(
      'Please fix the environment variables and try again. Shutting down...',
    );
    process.exit(1);
  }
  return validatedConfig;
}
