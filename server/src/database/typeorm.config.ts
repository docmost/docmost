import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();
export const AppDataSource: DataSource = new DataSource({
  type: 'postgres',
  url:
    process.env.DATABASE_URL ||
    'postgresql://postgres:password@localhost:5432/dc?schema=public',
  entities: ['src/**/*.entity.{ts,js}'],
  migrations: ['src/**/migrations/*.{ts,js}'],
  subscribers: [],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development',
});
