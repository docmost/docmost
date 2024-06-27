import { IsNotEmpty, IsNotIn, IsUrl, validateSync } from 'class-validator';
import { plainToInstance } from 'class-transformer';

export class EnvironmentVariables {
  @IsNotEmpty()
  @IsUrl(
    { protocols: ['postgres', 'postgresql'], require_tld: false },
    { message: 'DATABASE_URL must be a valid postgres connection string' },
  )
  DATABASE_URL: string;

  @IsNotEmpty()
  @IsNotIn(['REPLACE_WITH_LONG_SECRET'])
  APP_SECRET: string;
}

export function validate(config: Record<string, any>) {
  const validatedConfig = plainToInstance(EnvironmentVariables, config);

  const errors = validateSync(validatedConfig);

  console.error(
    'The EnvironmentVariables has failed the following validations:',
  );

  if (errors.length > 0) {
    errors.map((error) => {
      console.log(JSON.stringify(error.constraints));
    });

    console.log(
      'Please fix the environment variables and try again. Shutting down...',
    );
    process.exit(1);
  }

  return validatedConfig;
}
