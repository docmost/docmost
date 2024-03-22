import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { NamingStrategy } from './naming-strategy';
import * as path from 'path';
const envPath = path.resolve(process.cwd(), '..', '..', '.env');

dotenv.config({ path: envPath });

export const AppDataSource: DataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: ['src/**/*.entity.{ts,js}'],
  migrations: ['src/**/migrations/*.{ts,js}'],
  subscribers: [],
  synchronize: false,
  namingStrategy: new NamingStrategy(),
  logging: process.env.NODE_ENV === 'development',
});
