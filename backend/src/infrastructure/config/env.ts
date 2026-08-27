export const env = {
  port: Number(process.env.PORT ?? 4000),
  corsOrigin: process.env.CORS_ORIGIN ?? 'http://localhost:5173',
  redisUrl: process.env.REDIS_URL ?? 'redis://redis:6379',
  // First character of every room code this instance mints — lets a reverse proxy route a
  // room's whole lifetime (HTTP and WebSocket) to the instance that owns its in-process state.
  instanceTag: process.env.INSTANCE_TAG ?? 'A',
};
