export type HealthStatus = 'ok' | 'error' | 'unknown';

export interface HealthCheckResponse {
  status: HealthStatus;
  uptime: number;
  timestamp: number;
  services: {
    keycloak: HealthStatus;
    redis: HealthStatus;
  };
}
