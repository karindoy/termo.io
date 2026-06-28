export const env = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  redisUrl: process.env.REDIS_URL ?? 'redis://redis:6379',
};
