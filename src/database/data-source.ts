import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { createDatabaseOptions } from './database.config';

const config = new ConfigService(process.env);

export default new DataSource(createDatabaseOptions(config));
