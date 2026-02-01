import { authConfig } from '@/config/auth';

import { KeycloakAuthAdapter } from './KeycloakAuthAdapter';

// Adding more auth adapter here in the future
// import { Auth0AuthAdapter } from './Auth0AuthAdapter'

export function createAuthProvisioningAdapter() {
  switch (authConfig.provider) {
    case 'keycloak':
      return new KeycloakAuthAdapter();
    default:
      throw new Error(`Unsupported auth provider: ${authConfig.provider}`);
  }
}
