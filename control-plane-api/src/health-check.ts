import { Router } from 'express';

interface HealthCheckResponse {
  status: 'ok' | 'error';
  uptime: number;
  timestamp: number;
  services: {
    keycloak: 'ok' | 'error' | 'unknown';
    redis: 'ok' | 'error' | 'unknown';
  };
}

const healthRouter = Router();

healthRouter.get('/', async (_req, res) => {
  const response: HealthCheckResponse = {
    status: 'ok',
    uptime: process.uptime(),
    timestamp: Date.now(),
    services: {
      keycloak: 'unknown',
      redis: 'unknown',
    },
  };

  // try {
  //   // Check Redis
  //   await redisClient.ping();
  //   response.services.redis = 'ok';
  // } catch (error) {
  //   req.log.error(error, 'Redis health check failed');
  //   response.services.redis = 'error';
  //   response.status = 'error';
  // }

  res.status(response.status === 'ok' ? 200 : 503).json(response);
});

export default healthRouter;
