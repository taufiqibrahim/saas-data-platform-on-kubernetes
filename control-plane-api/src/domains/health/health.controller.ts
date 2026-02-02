import { Controller, Get, Response, Route, Tags } from 'tsoa';

import { HealthCheckResponse, HealthStatus } from './health.type';

@Route('health')
@Tags('Health')
export class HealthController extends Controller {
  /**
   * Retrieves the API health checks.
   * @summary API Health Checks
   */
  @Get('/')
  @Response<{ message: string }>(500, 'Internal Server Error')
  public async getHealthCheck(): Promise<HealthCheckResponse> {
    const response = {
      status: 'ok' as HealthStatus,
      uptime: process.uptime(),
      timestamp: Date.now(),
      services: {
        keycloak: 'unknown' as HealthStatus,
        redis: 'unknown' as HealthStatus,
      },
    };
    return response;
  }
}
