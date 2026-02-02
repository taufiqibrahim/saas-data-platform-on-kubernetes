import KcAdminClient from '@keycloak/keycloak-admin-client';

import config from '../config/config';
import logger from '../config/logger';

export async function initKeycloakAdminClient(): Promise<KcAdminClient> {
  const kcAdmin = new KcAdminClient({
    baseUrl:
      `${config.keycloakAdmin.protocol}://${config.keycloakAdmin.host}:${config.keycloakAdmin.port}` ||
      'http://localhost:8080',
    realmName: config.keycloakAdmin.realm,
  });

  logger.debug(`Authenticating with Keycloak admin...`);
  await kcAdmin.auth({
    grantType: 'password',
    clientId: 'admin-cli',
    username: config.keycloakAdmin.username || 'kcadmin',
    password: config.keycloakAdmin.password || 'kcadmin',
  });
  logger.debug(`Authenticated.`);

  return kcAdmin;
}
