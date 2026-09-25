import { ConfigService } from '@nestjs/config';
import { TypeOrmModuleOptions } from '@nestjs/typeorm';
import { DataSourceOptions } from 'typeorm';
import { Listing } from '../modules/listings/entities/listing.entity';
import { InitialSchema1727200000000 } from './migrations/1727200000000-initial-schema';

export function createDatabaseOptions(
  config: Pick<ConfigService, 'getOrThrow'>,
): DataSourceOptions {
  return {
    type: 'postgres',
    host: config.getOrThrow<string>('DB_HOST'),
    port: config.getOrThrow<number>('DB_PORT'),
    username: config.getOrThrow<string>('DB_USERNAME'),
    password: config.getOrThrow<string>('DB_PASSWORD'),
    database: config.getOrThrow<string>('DB_NAME'),
    entities: [Listing],
    migrations: [InitialSchema1727200000000],
    synchronize: false,
  };
}

export function databaseOptions(config: ConfigService): TypeOrmModuleOptions {
  return {
    ...createDatabaseOptions(config),
    autoLoadEntities: true,
  };
}
