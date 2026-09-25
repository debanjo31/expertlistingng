type Environment = Record<string, unknown>;

function integer(value: unknown, name: string, defaultValue: number): number {
  const parsed = Number(value ?? defaultValue);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${name} must be a positive integer`);
  }
  return parsed;
}

export function validateEnvironment(config: Environment): Environment {
  const result = {
    ...config,
    PORT: integer(config.PORT, 'PORT', 3000),
    DB_HOST: String(config.DB_HOST ?? 'localhost'),
    DB_PORT: integer(config.DB_PORT, 'DB_PORT', 5432),
    DB_USERNAME: String(config.DB_USERNAME ?? 'postgres'),
    DB_PASSWORD: String(config.DB_PASSWORD ?? 'postgres'),
    DB_NAME: String(config.DB_NAME ?? 'expert_listings'),
    REDIS_URL: String(config.REDIS_URL ?? 'redis://localhost:6379'),
    CACHE_TTL_SECONDS: integer(
      config.CACHE_TTL_SECONDS,
      'CACHE_TTL_SECONDS',
      60,
    ),
  };

  if (!result.DB_HOST || !result.DB_USERNAME || !result.DB_NAME) {
    throw new Error('Database configuration values cannot be empty');
  }

  try {
    new URL(result.REDIS_URL);
  } catch {
    throw new Error('REDIS_URL must be a valid URL');
  }

  return result;
}
