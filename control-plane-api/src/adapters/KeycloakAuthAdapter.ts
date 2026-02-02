import KeycloakAdminClient from '@keycloak/keycloak-admin-client';
import crypto from 'crypto';

import { initKeycloakAdminClient } from '@/clients/keycloak-admin.client';
import config from '@/config/config';
import logger from '@/config/logger';
import { AccountProvisionedEmailTemplate } from '@/templates/email.template';

import { AuthProviderProvisioningAdapter } from './AuthProvisioningAdapter';
import { realmDefinition } from './keycloak/declarative-realm-template';

interface RolesMappingJSON {
  [realmRole: string]: {
    [clientId: string]: string[]; // array of client role names
  };
}

export interface CreateClientInput {
  realm: string;
  clientId: string;
  redirectUris: string[];
  webOrigins?: string[];
  publicClient?: boolean;
  rootUrl?: string;
  baseUrl?: string;
  attributes?: Record<string, string>;
  shouldGetPublicKey?: boolean;
}

export interface CreateClientOutput {
  client_id: string;
  client_secret?: string;
  realm: string;
  issuer_url: string;
  oidc_env: Record<string, string>;
  metadata: {
    redirect_uris: string[];
    base_url?: string;
    root_url?: string;
    public_client: boolean;
  };
}

export interface CreatedAdminUser {
  userId: string;
  consoleUrl: string;
  username: string;
  initialPassword: string;
}

export interface CreatedKCUser {
  kcUserId: string;
  kcUsername: string;
  kcInitialPassword: string;
  consoleUrl: string;
}

export class KeycloakAuthAdapter implements AuthProviderProvisioningAdapter {
  async provisionAccount({
    extAccountId,
    accountName,
    ownerEmail,
  }: {
    extAccountId: string;
    accountName: string;
    ownerEmail: string;
    options?: Record<string, unknown>;
  }) {
    const realmName = extAccountId!;
    const kc = await initKeycloakAdminClient();
    const appBaseUrl = `https://${config.app.baseDomain}`;

    const realmDef = {
      ...realmDefinition,
      realmName,
      displayName: accountName,
    };

    await this.ensureRealm(kc, realmName, accountName);

    // Ensuring realm roles (data_engineer, ml_engineer, ...)
    const roleNames = realmDef.realmRoles.map((r) => r.name);
    await this.ensureRealmRoles(kc, realmName, roleNames);

    // Ensuring account level clients
    for (const clientId of Object.keys(realmDef.accountLevelClients)) {
      const clientRoles = realmDef.accountLevelClients[clientId].roles;
      const clientInput = realmDef.accountLevelClients[clientId].client;
      logger.info({ realmName: realmName, clientId }, `Ensuring client ${clientId} and roles...`);
      await this.ensureClient(kc, {
        ...clientInput,
        realm: realmName,
        redirectUris: [`${appBaseUrl}/*`],
        webOrigins: [appBaseUrl],
        rootUrl: appBaseUrl,
        baseUrl: appBaseUrl,
      });

      // Ensuring client roles
      await this.ensureClientRoles(kc, realmName, clientId, clientRoles);
      await this.ensureClientMappers(kc, realmName, clientId);
    }

    // Ensure account owner user
    logger.info('createInitialAccountOwner');
    const kcUserId = await this.ensureUser(kc, realmName, ownerEmail);
    await this.ensureUserRoles(kc, realmName, ownerEmail, ['platform_admin']);
    const kcInitialPassword = await this.ensureResetUserPassword(kc, realmName, kcUserId);

    // Prepare notification email content
    const emailOptions = AccountProvisionedEmailTemplate.render({
      appBaseUrl: config.app.baseUrl,
      initialPassword: kcInitialPassword,
      ownerEmail,
      accountName: extAccountId,
    });

    logger.info(`[provisionNewRealm] Realm [${realmName}] provisioned.`);

    return {
      emailOptions,
    };
  }

  // @ts-expect-error -- not used yet
  async rollbackAccount({ extAccountId }: { extAccountId: string }) {
    await this.deleteRealm(extAccountId);
  }

  private async deleteRealm(realmName: string) {
    logger.info({ realmName }, 'deleteRealm');
  }

  // @ts-expect-error -- not used yet
  private async ensureGlobalBrokerClient(realmName: string) {
    const kc = await initKeycloakAdminClient();

    const clients = await kc.clients.find({ realm: realmName });
    const broker = clients.find((c) => c.clientId === 'broker');
    const keycloakHost = process.env.KEYCLOAK_HOST;

    const payload = {
      clientId: 'broker',
      name: 'Global Broker Client',
      publicClient: true,
      bearerOnly: false,
      standardFlowEnabled: true,
      implicitFlowEnabled: false,
      directAccessGrantsEnabled: true,
      serviceAccountsEnabled: false,
      rootUrl: keycloakHost,
      redirectUris: [`${keycloakHost}/realms/*/broker/global-users/endpoint*`],
      webOrigins: ['*'],
      protocol: 'openid-connect',
      attributes: {
        'pkce.code.challenge.method': 'S256',
      },
      enabled: true,
    };

    if (broker) {
      logger.info('Updating existing broker client...');
      await kc.clients.update({ id: broker.id!, realm: 'global-users' }, payload);
    } else {
      logger.info('Creating new broker client...');
      await kc.clients.create(payload);
    }

    logger.info('Broker client ready in global-users realm');
  }

  /**
   * Create or update the Keycloak realm
   * @param kc
   * @param realmName
   */
  private async ensureRealm(kc: KeycloakAdminClient, realmName: string, displayName?: string) {
    const existingRealm = await kc.realms.findOne({ realm: realmName });

    if (!existingRealm) {
      logger.info(`[ensureRealm] Creating realm: [${realmName}]`);
      await kc.realms.create({
        realm: realmName,
        displayName: displayName || realmName,
        enabled: true,
      });
    } else {
      logger.info(`[ensureRealm] Realm [${realmName}] already exists, only update.`);
      await kc.realms.update({ realm: realmName }, { displayName: displayName || realmName });
    }
  }

  /**
   * Ensure realm-level roles exactly match the provided list (e.g., platform_admin, data_engineer)
   * - Create all roles that don't exist
   * - Delete all roles not in the input list
   * - Idempotent
   * @param kc
   * @param realmName
   * @param roles
   */
  private async ensureRealmRoles(kc: KeycloakAdminClient, realmName: string, roles: string[]) {
    kc.setConfig({ realmName });

    const existing = await kc.roles.find({ realm: realmName });

    // Filter out undefined role names before creating the Set
    const existingNames = new Set(
      existing.map((r) => r.name).filter((n): n is string => typeof n === 'string'),
    );

    const desiredNames = new Set(roles);

    // ---- CREATE missing roles ----
    for (const role of roles) {
      if (!existingNames.has(role)) {
        await kc.roles.create({ name: role });
        logger.info(`[ensureRealmRoles] Realm role '${role}' created`);
      } else {
        logger.debug(`[ensureRealmRoles] Realm role '${role}' already exists`);
      }
    }

    // ---- DELETE roles not desired ----
    for (const role of existingNames) {
      // Skip Keycloak system roles (default-roles-<realm>)
      if (role.startsWith('default-roles')) {
        logger.debug(`[ensureRealmRoles] Skipping protected role: ${role}`);
        continue;
      }

      if (!desiredNames.has(role)) {
        try {
          await kc.roles.delByName({ name: role });
          logger.info(`[ensureRealmRoles] Realm role '${role}' deleted (not in desired list)`);
        } catch (err) {
          logger.error(`[ensureRealmRoles] Failed to delete role '${role}': ${err}`);
        }
      }
    }

    logger.info(`[ensureRealmRoles] Realm roles synchronized for realm '${realmName}'`);
  }

  /**
   * Create a client for your app (e.g., saas-sql, saas-ml)
   * @param kc
   * @param input
   * @returns
   */
  private async ensureClient(
    kc: KeycloakAdminClient,
    input: CreateClientInput,
  ): Promise<CreateClientOutput> {
    kc.setConfig({ realmName: input.realm });

    // Add local development support
    const localRedirects = [
      'http://localhost:5173/*',
      'http://localhost:5000/*',
      'https://oauth.pstmn.io/v1/callback',
      'https://docs.dev.saas.com/*',
    ];
    const localOrigins = [
      'http://localhost:5173',
      'http://localhost:5000',
      'https://docs.dev.saas.com',
    ];

    // Merge existing with local (deduplicated)
    const redirectUris = Array.from(
      new Set([
        ...(input.redirectUris ?? []),
        ...(config.keycloakProvisioningEnableLocalClients ? localRedirects : []),
      ]),
    );

    const webOrigins = Array.from(
      new Set([
        ...(input.webOrigins ?? []),
        ...(config.keycloakProvisioningEnableLocalClients ? localOrigins : []),
      ]),
    );

    // Issuer must be on tenant NOT on global-users
    const issuer = `${kc.baseUrl}/realms/${input.realm}`;

    const existing = await kc.clients.find({
      realm: input.realm,
      clientId: input.clientId,
    });

    let id: string;
    let secret: string | undefined;

    if (existing.length > 0) {
      logger.warn(`ensureClient: existing client ${input.clientId} available`);
      id = existing[0].id!;
      await kc.clients.update(
        { id: id!, realm: input.realm },
        {
          clientId: input.clientId,
          name: input.clientId,
          publicClient: input.publicClient ?? true,
          rootUrl: input.rootUrl,
          baseUrl: input.baseUrl,
          redirectUris: redirectUris,
          webOrigins: webOrigins,
          standardFlowEnabled: true,
          implicitFlowEnabled: true,
          directAccessGrantsEnabled: true,
          attributes: input.attributes,
        },
      );
      const creds = await kc.clients.getClientSecret({
        id: id!,
        realm: input.realm,
      });
      secret = creds.value;
    } else {
      logger.debug('ensureClient: will create client...');

      const client = await kc.clients.create({
        realm: input.realm,
        clientId: input.clientId,
        name: input.clientId,
        publicClient: input.publicClient ?? true,
        rootUrl: input.rootUrl,
        baseUrl: input.baseUrl,
        redirectUris: redirectUris,
        webOrigins: webOrigins,
        standardFlowEnabled: true,
        implicitFlowEnabled: true,
        directAccessGrantsEnabled: true,
        attributes: input.attributes,
      });

      // Fetch client secret
      if (!input.publicClient) {
        const secretResponse = await kc.clients.getClientSecret({
          id: client.id!,
          realm: input.realm,
        });

        if (!secretResponse.value) {
          throw new Error(`Client secret for ${input.clientId} is undefined`);
        }

        secret = secretResponse.value;
      }
    }

    let jwtPublicKey = '';

    if (input.shouldGetPublicKey) {
      jwtPublicKey = await this.getRealmPublicKey(kc, input.realm);
    }

    const oidcEnv = {
      OAUTH2_AUTHORIZE_URL: `${issuer}/protocol/openid-connect/auth`,
      OAUTH2_TOKEN_URL: `${issuer}/protocol/openid-connect/token`,
      OAUTH2_USERDATA_URL: `${issuer}/protocol/openid-connect/userinfo`,
      OAUTH2_CLIENT_ID: input.clientId,
      OAUTH2_CLIENT_SECRET: secret ?? '',
      OAUTH2_REALM: input.realm,
      OAUTH2_ISSUER_URL: issuer,
      JWT_PUBLIC_KEY: jwtPublicKey,
    };

    const result = {
      client_id: input.clientId,
      client_secret: secret,
      realm: input.realm,
      issuer_url: issuer,
      oidc_env: oidcEnv,
      metadata: {
        redirect_uris: redirectUris,
        base_url: input.baseUrl,
        root_url: input.rootUrl,
        public_client: input.publicClient ?? false,
      },
    };

    return result;
  }

  /**
   * Define client-specific roles (e.g., sql_dataset_query, workflow_dag_execute)
   * @param kc
   * @param realmName
   * @param clientId
   * @param roles
   */
  private async ensureClientRoles(
    kc: KeycloakAdminClient,
    realmName: string,
    clientId: string,
    roles: string[],
  ) {
    kc.setConfig({ realmName });

    const clients = await kc.clients.find({ clientId });
    if (clients.length === 0) throw new Error(`Client ${clientId} not found`);
    const client = clients[0];

    const existing = await kc.clients.listRoles({ id: client.id! });
    const existingNames = new Set(existing.map((r) => r.name));

    for (const role of roles) {
      if (!existingNames.has(role)) {
        await kc.clients.createRole({ id: client.id!, name: role });
        logger.info(`Client role '${role}' created`);
      }
    }
  }

  /**
   * Add protocol mappers (to include roles, email, extAccountId in tokens)
   * @param kc
   * @param realmName
   * @param clientId
   */
  private async ensureClientMappers(kc: KeycloakAdminClient, realmName: string, clientId: string) {
    kc.setConfig({ realmName });

    const client = (await kc.clients.find({ clientId }))[0];
    if (!client) throw new Error(`Client ${clientId} not found`);

    const mappers = await kc.clients.listProtocolMappers({ id: client.id! });
    const mapperNames = new Set(mappers.map((m) => m.name));

    const desired = [
      {
        name: 'realm roles',
        protocol: 'openid-connect',
        protocolMapper: 'oidc-usermodel-realm-role-mapper',
        config: { 'claim.name': 'roles' },
      },
      {
        name: 'email',
        protocol: 'openid-connect',
        protocolMapper: 'oidc-usermodel-property-mapper',
        config: { 'user.attribute': 'email' },
      },
      {
        name: 'extAccountId',
        protocol: 'openid-connect',
        protocolMapper: 'oidc-usermodel-attribute-mapper',
        config: { 'user.attribute': 'extAccountId' },
      },
    ];

    for (const m of desired) {
      if (!mapperNames.has(m.name)) {
        await kc.clients.addProtocolMapper({ id: client.id!, realm: realmName }, m);
        logger.info(`Mapper '${m.name}' added`);
      }
    }
  }

  /**
   * Assign client roles to realm roles
   * @param kc
   * @param realmName
   * @param realmRoleName
   * @param clientId
   * @param resolvedRoles
   */
  // @ts-expect-error -- not used yet
  private async ensureClientRolesToRealmRoleMapping(
    kc: KeycloakAdminClient,
    realmName: string,
    realmRoleName: string,
    clientId: string,
    resolvedRoles: string[],
  ) {
    kc.setConfig({ realmName });

    // Find realm role
    const realmRole = await kc.roles.findOneByName({
      realm: realmName,
      name: realmRoleName,
    });
    if (!realmRole) {
      throw new Error(`Realm role '${realmRoleName}' not found`);
    }

    // Find client
    const client = (await kc.clients.find({ clientId }))[0];
    if (!client) throw new Error(`Client ${clientId} not found`);

    // Find client roles to map
    const allClientRoles = await kc.clients.listRoles({ id: client.id! });
    if (!allClientRoles || !allClientRoles.length)
      throw new Error(`No roles found in ${clientId} client`);

    const rolesToMap = allClientRoles.filter((r) => resolvedRoles.includes(r.name!));

    if (rolesToMap.length === 0) {
      logger.warn(`No matching client roles found for '${clientId}' on '${realmRoleName}'`);
      return;
    }

    // Fetch existing composites
    const existingComposites = await kc.roles.getCompositeRoles({
      realm: realmName,
      id: realmRole.id!,
    });

    // Compute missing ones
    const existingIds = new Set(existingComposites.map((r) => r.id));
    const missingRoles = rolesToMap.filter((r) => !existingIds.has(r.id));

    if (missingRoles.length > 0) {
      // Add new composites
      await kc.roles.createComposite(
        { realm: realmName, roleId: realmRole.id! },
        missingRoles.map((r) => ({ id: r.id, name: r.name })),
      );

      logger.info(
        `Added ${missingRoles.length} client role(s) from '${clientId}' to realm role '${realmRoleName}'`,
      );
    } else {
      logger.debug(`All client roles already mapped for realm role '${realmRoleName}'`);
    }
  }

  /**
   * Create or update user (email, username, password)
   * @param kc
   * @param realmName
   * @param email
   * @returns
   */
  private async ensureUser(
    kc: KeycloakAdminClient,
    realmName: string,
    email: string,
  ): Promise<string> {
    const users = await kc.users.find({ realm: realmName, email: email });
    let userId: string;

    if (!users.length) {
      logger.info(`[provisionUser] Creating user: [${email}]`);

      const created = await kc.users.create({
        realm: realmName,
        username: email,
        email: email,
        enabled: true,
        emailVerified: true,
      });

      userId = created.id as string;
      if (!userId) {
        const fetched = await kc.users.find({ realm: realmName, email: email });
        userId = fetched[0].id!;
      }

      logger.info(`[provisionUser] Created user [${email}] with id [${userId}].`);
    } else {
      userId = users[0].id!;
      logger.info(`[provisionUser] User [${email}] already exists.`);
    }

    return userId;
  }

  /**
   * Delete user by email
   * @param kc
   * @param realmName
   * @param email
   * @returns
   */
  // @ts-expect-error -- not used yet
  private async deleteUser(
    kc: KeycloakAdminClient,
    realmName: string,
    email: string,
  ): Promise<void> {
    const users = await kc.users.find({ realm: realmName, email: email });

    if (!users.length) {
      logger.info(`[deleteUser] No user found with email [${email}].`);
      return;
    }

    const userId = users[0].id!;
    await kc.users.del({ realm: realmName, id: userId });
    logger.info(`[deleteUser] Deleted user [${email}] with id [${userId}].`);
  }

  /**
   * Reset user password / enable initial password
   * @param kc
   * @param realmName
   * @param userId
   * @returns
   */
  private async ensureResetUserPassword(
    kc: KeycloakAdminClient,
    realmName: string,
    userId: string,
  ): Promise<string> {
    const initialPassword = crypto.randomBytes(12).toString('base64');
    await kc.users.resetPassword({
      realm: realmName,
      id: userId,
      credential: {
        type: 'password',
        value: initialPassword,
        temporary: true, // forces reset on first login
      },
    });
    return initialPassword;
  }

  /**
   * Sync user realm roles with given role list.
   * - Assign roles listed in `roles`
   * - Remove roles not listed
   * - Skip all roles starting with "default-role"
   * @param kc
   * @param realmName
   * @param username
   * @param roles
   */
  private async ensureUserRoles(
    kc: KeycloakAdminClient,
    realmName: string,
    username: string,
    roles: string[],
  ) {
    kc.setConfig({ realmName });

    const user = (await kc.users.find({ username }))[0];
    if (!user) throw new Error(`User ${username} not found`);
    if (!user.id) throw new Error(`User ${username} has no ID`);

    // All realm roles
    const allRoles = await kc.roles.find({ realm: realmName });

    // Filter roles to exclude default-role*
    const filteredAllRoles = allRoles.filter((r) => !r.name?.startsWith('default-role'));

    // Roles the user should have
    const desiredRoles = filteredAllRoles.filter((r) => roles.includes(r.name!));

    // Current roles the user has
    const currentRoles = await kc.users.listRealmRoleMappings({ id: user.id });
    const filteredCurrentRoles = currentRoles.filter((r) => !r.name?.startsWith('default-role'));

    // Determine roles to add & remove
    const desiredNames = new Set(desiredRoles.map((r) => r.name));
    const currentNames = new Set(filteredCurrentRoles.map((r) => r.name));

    const rolesToAdd = desiredRoles.filter((r) => !currentNames.has(r.name));
    const rolesToRemove = filteredCurrentRoles.filter((r) => !desiredNames.has(r.name));

    // Apply updates
    if (rolesToAdd.length > 0) {
      await kc.users.addRealmRoleMappings({
        id: user.id,
        roles: rolesToAdd.map((r) => ({ id: r.id!, name: r.name! })),
      });
    }

    if (rolesToRemove.length > 0) {
      await kc.users.delRealmRoleMappings({
        id: user.id,
        roles: rolesToRemove.map((r) => ({ id: r.id!, name: r.name! })),
      });
    }

    logger.info(
      `User '${username}' roles synchronized. Added: [${rolesToAdd.map((r) => r.name).join(', ')}], Removed: [${rolesToRemove.map((r) => r.name).join(', ')}]`,
    );
  }

  // @ts-expect-error -- not used yet
  private async ensureIdentityProvider(kc: KeycloakAdminClient, realmName: string) {
    const idps = await kc.identityProviders.find({ realm: realmName });
    const idpExists = idps.some((idp) => idp.alias === 'global-users');

    if (!idpExists) {
      logger.info(`[ensureIdentityProvider] Creating Identity Provider to [global-users]`);
      await kc.identityProviders.create({
        realm: realmName,
        alias: realmName,
        providerId: 'keycloak-oidc',
        enabled: true,
        config: {
          authorizationUrl: `${config.keycloak.issuer}/protocol/openid-connect/auth`,
          tokenUrl: `${config.keycloak.issuer}/protocol/openid-connect/token`,
          logoutUrl: `${config.keycloak.issuer}/protocol/openid-connect/logout`,
          issuer: config.keycloak.issuer,
          clientId: 'broker', // must match what's registered in global-users realm
          syncMode: 'IMPORT',
          useJwksUrl: 'true',
          pkceEnabled: 'true',
          pkceMethod: 'S256',
        },
      });
    } else {
      logger.info(
        `[ensureIdentityProvider] Identity Provider [global-users] already exists in realm [${realmName}], skipping.`,
      );
    }
  }

  // @ts-expect-error -- not used yet
  private async assignRealmAdminRole(kc: KeycloakAdminClient, realmName: string, userId: string) {
    const [realmMgmtClient] = await kc.clients.find({
      realm: realmName,
      clientId: 'realm-management',
    });
    if (!realmMgmtClient?.id) throw new Error('realm-management client not found');
    logger.info(realmMgmtClient, 'realmMgmtClient');

    // List all roles of this client
    const availableRoles = await kc.clients.listRoles({
      realm: realmName,
      id: realmMgmtClient.id,
    });
    if (!availableRoles || !availableRoles.length)
      throw new Error('No roles found in realm-management client');
    logger.info(availableRoles, 'availableRoles');

    // Ensure it's an array and properly shaped
    const realmMgmtRoles = Object.values(availableRoles).map((r) => ({
      id: r.id!,
      name: r.name!,
    }));

    await kc.users.addClientRoleMappings({
      realm: realmName,
      id: userId,
      clientUniqueId: realmMgmtClient.id!,
      roles: realmMgmtRoles,
    });
  }

  // @ts-expect-error -- not used yet
  private async ensureUsernameMapper(kc: KeycloakAdminClient, realmName: string, idpAlias: string) {
    const idp = (await kc.identityProviders.find({ realm: realmName })).find(
      (i) => i.alias === idpAlias,
    );
    if (!idp) {
      logger.warn(`[ensureUsernameMapper] Identity Provider [${idpAlias}] not found.`);
      return;
    }

    const mapperName = 'UsernameMapper';
    const mappers = await kc.identityProviders.findMappers({
      alias: idp.alias!,
    });
    const alreadyExists = mappers.some((m) => m.name === mapperName);

    if (alreadyExists) {
      logger.info(`[ensureUsernameMapper] Mapper [${mapperName}] already exists, skipping.`);
      return;
    }

    logger.info(`[ensureUsernameMapper] Creating UsernameMapper for realm [${realmName}]`);

    await kc.identityProviders.createMapper({
      alias: idp.alias!,
      identityProviderMapper: {
        name: mapperName,
        identityProviderAlias: idp.alias!,
        identityProviderMapper: 'oidc-username-idp-mapper',
        config: {
          syncMode: 'FORCE',
          template: '${ALIAS}.${CLAIM.preferred_username}',
          target: 'LOCAL',
        },
      },
    });
  }

  // @ts-expect-error -- not used yet
  private async disablePasswordLogin(kc: KeycloakAdminClient, realmName: string) {
    kc.setConfig({ realmName });

    // 1. Get the current browser flow
    const flows = await kc.authenticationManagement.getFlows();
    const browserFlow = flows.find((f) => f.alias === 'browser');
    if (!browserFlow) throw new Error('Browser flow not found');

    // 2. Get executions
    if (!browserFlow.id) throw new Error('Browser flow id is undefined');
    const executions = await kc.authenticationManagement.getExecutions({
      flow: browserFlow.id,
    });

    // 3. Disable username-password execution
    for (const exec of executions) {
      if (exec.providerId === 'auth-password-form') {
        await kc.authenticationManagement.updateExecution(
          { flow: browserFlow.id, realm: realmName },
          { requirement: 'DISABLED' }, // disable local password login
        );
        logger.info(`[disablePasswordLogin] Disabled password login in realm ${realmName}`);
      }
    }
  }

  private async getRealmPublicKey(kc: KeycloakAdminClient, realmName: string): Promise<string> {
    const keys = await kc.realms.getKeys({ realm: realmName });
    if (!keys.keys?.length) throw new Error(`No keys found for realm ${realmName}`);

    // pick the RS256 RSA key
    const key = keys.keys.find((k) => k.algorithm === 'RS256' && k.type === 'RSA');
    if (!key) throw new Error(`No RS256 RSA key found for realm ${realmName}`);

    // Wrap in PEM format
    const pem = `-----BEGIN PUBLIC KEY-----\n${key.publicKey}\n-----END PUBLIC KEY-----`;
    return pem;
  }

  // @ts-expect-error -- not used yet
  private async getClientSecret(kc: KeycloakAdminClient, realmName: string, clientId: string) {
    kc.setConfig({ realmName });

    const clients = await kc.clients.find({ realm: realmName, clientId });
    if (!clients || clients.length === 0) throw new Error('KC client not found');

    const client = clients[0];

    const secretResp = await kc.clients.getClientSecret({
      id: client.id!,
      realm: realmName,
    });

    const result = {
      realm: realmName,
      clientId,
      clientSecret: secretResp.value,
    };

    return result;
  }

  /**
   * Get a client for an app (e.g., superset)
   * @param kc
   * @param input
   * @returns
   */
  // @ts-expect-error -- not used yet
  private async getClient(
    kc: KeycloakAdminClient,
    realmName: string,
    clientId: string,
  ): Promise<CreateClientOutput | undefined> {
    kc.setConfig({ realmName });

    let secret: string | undefined;

    const existing = await kc.clients.find({
      realm: realmName,
      clientId: clientId,
    });

    if (existing.length > 0) {
      const client = existing[0];
      const issuer = `${kc.baseUrl}/realms/${realmName}`;

      if (!client.publicClient) {
        const secretResponse = await kc.clients.getClientSecret({
          id: client.id!,
          realm: realmName,
        });
        secret = secretResponse.value;
      }

      const jwtPublicKey = await this.getRealmPublicKey(kc, realmName);

      const oidcEnv = {
        OAUTH2_AUTHORIZE_URL: `${issuer}/protocol/openid-connect/auth`,
        OAUTH2_TOKEN_URL: `${issuer}/protocol/openid-connect/token`,
        OAUTH2_USERDATA_URL: `${issuer}/protocol/openid-connect/userinfo`,
        OAUTH2_CLIENT_ID: clientId,
        OAUTH2_CLIENT_SECRET: secret ?? '',
        OAUTH2_REALM: realmName,
        OAUTH2_ISSUER_URL: issuer,
        JWT_PUBLIC_KEY: jwtPublicKey,
      };

      const result = {
        client_id: clientId,
        client_secret: secret,
        realm: realmName,
        issuer_url: issuer,
        oidc_env: oidcEnv,
        metadata: {
          redirect_uris: client.redirectUris ?? [],
          base_url: client.baseUrl,
          root_url: client.rootUrl,
          public_client: client.publicClient ?? false,
        },
      };

      return result;
    } else {
      logger.error(`Client ${clientId} not found in realm ${realmName}`);
      return undefined;
    }
  }

  private async ensureClientScopeExists(
    kc: KeycloakAdminClient,
    realmName: string,
    scopeName: string,
  ) {
    kc.setConfig({ realmName });
    logger.info(`ensure client scope exists for ${scopeName}`);
    let scope = await kc.clientScopes.findOneByName({ name: scopeName });

    if (!scope) {
      await kc.clientScopes.create({
        name: scopeName,
        protocol: 'openid-connect',
      });
      scope = await kc.clientScopes.findOneByName({ name: scopeName });
    }

    if (!scope || !scope.id) {
      throw new Error(`Client scope '${scopeName}' not found after creation`);
    }

    return scope;
  }

  // @ts-expect-error -- not used yet
  private async ensureClientScopeHasRole(
    kc: KeycloakAdminClient,
    realmName: string,
    scopeName: string,
    targetClientId: string,
    targetRoleName: string,
  ) {
    kc.setConfig({ realmName });

    const scope = await this.ensureClientScopeExists(kc, realmName, scopeName);

    const clients = await kc.clients.find({ clientId: targetClientId });
    if (clients.length === 0) {
      throw new Error(`Target client '${targetClientId}' not found`);
    }
    const targetClient = clients[0];

    const roles = await kc.clients.listRoles({ id: targetClient.id! });
    const targetRole = roles.find((r) => r.name === targetRoleName);
    if (!targetRole) {
      throw new Error(`Role '${targetRoleName}' not found on client '${targetClientId}'`);
    }

    const existing = await kc.clientScopes.listClientScopeMappings({
      id: scope.id!,
      client: targetClient.id!,
    });

    const alreadyMapped = existing.some((r) => r.name === targetRoleName);
    if (alreadyMapped) {
      return { updated: false, status: 'already-present' };
    }

    await kc.clientScopes.addClientScopeMappings(
      {
        id: scope.id!,
        client: targetClient.id!,
      },
      [{ id: targetRole.id, name: targetRole.name }],
    );

    return { updated: true, status: 'role-added' };
  }

  // @ts-expect-error -- not used yet
  private async ensureClientHasScope(
    kc: KeycloakAdminClient,
    realmName: string,
    clientId: string,
    scopeName: string,
    type: 'default' | 'optional',
  ) {
    kc.setConfig({ realmName });

    const scope = await this.ensureClientScopeExists(kc, realmName, scopeName);

    const clients = await kc.clients.find({ clientId });
    if (clients.length === 0) {
      throw new Error(`Client '${clientId}' not found`);
    }

    const client = clients[0];

    if (type === 'default') {
      const defaults = await kc.clients.listDefaultClientScopes({
        id: client.id!,
      });
      const exists = defaults.some((s) => s.id === scope.id);
      if (!exists) {
        await kc.clients.addDefaultClientScope({
          id: client.id!,
          clientScopeId: scope.id!,
        });
      }
      return {
        updated: !exists,
        status: exists ? 'already-default' : 'added-default',
      };
    } else {
      const optional = await kc.clients.listOptionalClientScopes({
        id: client.id!,
      });
      const exists = optional.some((s) => s.id === scope.id);
      if (!exists) {
        await kc.clients.addOptionalClientScope({
          id: client.id!,
          clientScopeId: scope.id!,
        });
      }
      return {
        updated: !exists,
        status: exists ? 'already-optional' : 'added-optional',
      };
    }
  }

  // /**
  //  * Ensure a client scope exists and has a role scope mapping
  //  * from a target client's role.
  //  * As seen in https://www.keycloak.org/securing-apps/token-exchange#_examples
  //  *
  //  * @param {object} kc     - Keycloak Admin client
  //  * @param {string} scopeName   - name of the client scope (ex: "default-scope1")
  //  * @param {string} targetClientId - clientId of the target (ex: "target-client1")
  //  * @param {string} targetRoleName - role name to map (ex: "target-client1-role")
  //  */
  // private async ensureClientScopeHasRole(
  //   kc: KeycloakAdminClient,
  //   realmName: string,
  //   scopeName: string,
  //   targetClientId: string,
  //   targetRoleName: string,
  // ) {

  //   kc.setConfig({ realmName });

  //   // ----------------------------------------------------
  //   // 1. Find or create client scope
  //   // ----------------------------------------------------
  //   let scope = await kc.clientScopes.findOneByName({ name: scopeName });

  //   if (!scope) {
  //     scope = await kc.clientScopes.create({
  //       name: scopeName,
  //       protocol: "openid-connect",
  //     });
  //     // Keycloak returns empty object; we must refetch
  //     scope = await kc.clientScopes.findOneByName({ name: scopeName });
  //   }

  //   if (!scope) { throw new Error(`Scope '${scopeName}' not found`) }

  //   // ----------------------------------------------------
  //   // 2. Locate the target client
  //   // ----------------------------------------------------
  //   const clients = await kc.clients.find({ clientId: targetClientId });
  //   if (clients.length === 0) {
  //     throw new Error(`Target client '${targetClientId}' not found`);
  //   }

  //   const targetClient = clients[0];

  //   // ----------------------------------------------------
  //   // 3. Locate the role on the target client
  //   // ----------------------------------------------------
  //   const roles = await kc.clients.listRoles({ id: targetClient.id! });
  //   const targetRole = roles.find(r => r.name === targetRoleName);

  //   if (!targetRole) {
  //     throw new Error(
  //       `Role '${targetRoleName}' not found on client '${targetClientId}'`
  //     );
  //   }

  //   // ----------------------------------------------------
  //   // 4. Check if mapping already exists (idempotency)
  //   // ----------------------------------------------------
  //   const existing = await kc.clientScopes.listClientScopeMappings({
  //     realm: realmName,
  //     id: scope.id!,
  //     client: targetClient.id!,
  //   });

  //   const alreadyMapped = existing.some(r => r.name === targetRoleName);
  //   if (alreadyMapped) {
  //     return { updated: false, status: "already-present" };
  //   }

  //   // ----------------------------------------------------
  //   // 5. Add missing mapping
  //   // ----------------------------------------------------
  //   await kc.clientScopes.addClientScopeMappings(
  //     {
  //       realm: realmName,
  //       id: scope.id!,
  //       client: targetClient.id!,
  //     },
  //     [{ id: targetRole.id, name: targetRole.name }]
  //   );

  //   return { updated: true, status: "role-added" };
  // }

  /**
   * Ensure a client role is attached as composite to one or more realm roles.
   */
  // @ts-expect-error -- not used yet
  private async ensureClientAttachToRealmRoles(
    kc: KeycloakAdminClient,
    realmName: string,
    clientId: string,
    roleName: string,
    targetRealmRoles: string[],
  ) {
    kc.setConfig({ realmName });

    // Get the client
    const clients = await kc.clients.find({ clientId });
    if (clients.length === 0) {
      throw new Error(`Client '${clientId}' not found`);
    }
    const client = clients[0];

    // Get the client role
    const clientRole = await kc.clients.findRole({
      id: client.id!,
      roleName: roleName,
    });
    if (!clientRole) {
      throw new Error(`Client role '${roleName}' not found`);
    }

    // Loop through target realm roles
    for (const realmRoleName of targetRealmRoles) {
      // Get or create the realm role
      const realmRole = await kc.roles.findOneByName({ name: realmRoleName });
      // if (!realmRole) {
      //   await kc.roles.create({ name: realmRoleName });
      //   realmRole = await kc.roles.findOneByName({ name: realmRoleName });
      // }

      if (!realmRole || !realmRole.id) continue;

      // Get current composites of the realm role
      const composites = await kc.roles.getCompositeRoles({ id: realmRole.id });
      const alreadyComposite = composites.some((r) => r.id === clientRole.id && r.clientRole);

      if (!alreadyComposite) {
        // Add client role as composite
        await kc.roles.createComposite(
          {
            roleId: realmRole.id,
            realm: realmName,
          },
          [{ id: clientRole.id, name: clientRole.name, clientRole: true }],
        );
        logger.info(`Attached client role '${roleName}' to realm role '${realmRoleName}'`);
      } else {
        logger.info(`Client role '${roleName}' already attached to realm role '${realmRoleName}'`);
      }
    }
  }

  // @ts-expect-error -- not used yet
  private async getRealmRoles(kc: KeycloakAdminClient, realmName: string) {
    return kc.roles.find({ realm: realmName });
  }

  // @ts-expect-error -- not used yet
  private async getRolesWithComposites(kc: KeycloakAdminClient, realmName: string) {
    const realmRoles = await kc.roles.find({ realm: realmName });

    const result = [];

    for (const role of realmRoles) {
      if (!role.name) continue;

      // Fetch composite details
      const composites = await kc.roles.getCompositeRoles({
        id: role.id!,
        realm: realmName,
      });

      const realmComposites = composites.filter((c) => !c.clientRole);
      // const clientComposites = composites.filter((c) => c.clientRole);

      // // Group client roles by clientId (containerId)
      // const clientCompositeMap = clientComposites.reduce((acc, r) => {
      //   if (!acc[r.containerId]) acc[r.containerId] = [];
      //   acc[r.containerId].push(r);
      //   return acc;
      // }, {} as Record<string, any[]>);

      result.push({
        ...role,
        composites: {
          realm: realmComposites,
          // client: clientCompositeMap,
        },
      });
    }

    return result;
  }

  /**
   * Attach client roles to realm roles (realm-first, idempotent)
   */
  // @ts-expect-error -- not used yet
  private async syncClientRolesToRealmRoles(
    kc: KeycloakAdminClient,
    realmName: string,
    rolesMapping: RolesMappingJSON,
    clientPrefix?: string,
  ) {
    kc.setConfig({ realmName });

    for (const realmRoleName of Object.keys(rolesMapping)) {
      logger.info(`[syncClientRolesToRealmRoles] Processing realm role '${realmRoleName}'`);

      const realmRole = await kc.roles.findOneByName({ name: realmRoleName });
      if (!realmRole || !realmRole.id) {
        logger.warn(
          `[syncClientRolesToRealmRoles] Realm role '${realmRoleName}' not found, skipping.`,
        );
        continue;
      }

      const clientRolesByClient = rolesMapping[realmRoleName];

      // 1. Collect all desired client role objects for this realm role
      const desiredClientRoles: {
        id: string;
        name: string;
        clientRole: true;
      }[] = [];

      for (const [rawClientId, clientRoles] of Object.entries(clientRolesByClient)) {
        const clientId = rawClientId ? `${clientPrefix}-${rawClientId}` : rawClientId;
        const clients = await kc.clients.find({ clientId });
        if (clients.length === 0) {
          logger.warn(`[syncClientRolesToRealmRoles] Client '${clientId}' not found, skipping.`);
          continue;
        }
        const client = clients[0];

        for (const clientRoleName of clientRoles) {
          const clientRole = await kc.clients.findRole({
            id: client.id!,
            roleName: clientRoleName,
          });
          if (!clientRole) {
            logger.warn(
              `[syncClientRolesToRealmRoles] Client role '${clientRoleName}' not found on client '${clientId}'`,
            );
            continue;
          }
          desiredClientRoles.push({
            id: clientRole.id!,
            name: clientRole.name!,
            clientRole: true,
          });
        }
      }

      // 2. Get current composites of the realm role
      const currentComposites = await kc.roles.getCompositeRoles({
        id: realmRole.id,
      });

      // 3. Determine which client roles to add
      const toAdd = desiredClientRoles.filter(
        (r) => !currentComposites.some((c) => c.id === r.id && c.clientRole),
      );

      // 4. Add missing roles
      if (toAdd.length > 0) {
        await kc.roles.createComposite({ roleId: realmRole.id, realm: realmName }, toAdd);
        logger.info(
          `[syncClientRolesToRealmRoles] Added ${toAdd.length} client roles to '${realmRoleName}'`,
        );
      }

      // // 5. Determine which client roles to remove
      // const toRemove = currentComposites
      //   .filter(c => c.clientRole) // only client roles
      //   .filter(c => !desiredClientRoles.some(r => r.id === c.id));

      // // 6. Remove extra roles
      // for (const r of toRemove) {
      //   await kc.roles.delCompositeRoles({ id: realmRole.id, realm: realmName }, [r]);
      //   logger.info(`[syncClientRolesToRealmRoles] Removed client role '${r.name}' from '${realmRoleName}'`);
      // }

      // if (toAdd.length === 0 && toRemove.length === 0) {
      //   logger.info(`[syncClientRolesToRealmRoles] Realm role '${realmRoleName}' is already in sync`);
      // }
    }
  }
}
