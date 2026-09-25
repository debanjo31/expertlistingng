import {
  Injectable,
  Logger,
  OnApplicationShutdown,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient } from 'redis';

@Injectable()
export class RedisService implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(RedisService.name);
  private readonly client: ReturnType<typeof createClient>;
  private readonly ttlSeconds: number;

  constructor(config: ConfigService) {
    this.ttlSeconds = config.get<number>('CACHE_TTL_SECONDS', 60);
    this.client = createClient({
      url: config.getOrThrow<string>('REDIS_URL'),
      socket: {
        connectTimeout: 1_000,
        reconnectStrategy: false,
      },
    });
    this.client.on('error', (error: Error) => {
      this.logger.warn(`Redis unavailable: ${error.message}`);
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.client.connect();
    } catch {
      this.logger.warn('Starting without Redis caching');
    }
  }

  async onApplicationShutdown(): Promise<void> {
    if (this.client.isOpen) {
      await this.client.quit();
    }
  }

  async getJson<T>(key: string): Promise<T | null> {
    if (!this.client.isReady) {
      return null;
    }

    try {
      const value = await this.client.get(key);
      return value === null ? null : (JSON.parse(value) as T);
    } catch (error) {
      this.logOperationFailure('read', error);
      return null;
    }
  }

  async setJson(key: string, value: unknown): Promise<void> {
    if (!this.client.isReady) {
      return;
    }

    try {
      await this.client.set(key, JSON.stringify(value), {
        EX: this.ttlSeconds,
      });
    } catch (error) {
      this.logOperationFailure('write', error);
    }
  }

  async getSearchVersion(): Promise<string> {
    if (!this.client.isReady) {
      return '0';
    }

    try {
      return (await this.client.get('listings:search:version')) ?? '0';
    } catch (error) {
      this.logOperationFailure('version read', error);
      return '0';
    }
  }

  async incrementSearchVersion(): Promise<void> {
    if (!this.client.isReady) {
      return;
    }

    try {
      await this.client.incr('listings:search:version');
    } catch (error) {
      this.logOperationFailure('version increment', error);
    }
  }

  private logOperationFailure(operation: string, error: unknown): void {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.warn(`Redis ${operation} failed: ${message}`);
  }
}
