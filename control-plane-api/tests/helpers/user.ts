import * as client from 'openid-client';
import request from 'supertest';

interface UserConfig {
  username: string;
  password: string;
  serverUrl?: string;
  realmName?: string;
  clientId?: string;
  clientSecret?: string;
}

export class User {
  private username: string;
  private password: string;
  private serverUrl: string;
  private realmName: string;
  private clientId: string;
  private clientSecret?: string;
  private config: client.Configuration | null = null;
  private accessToken: string | null = null;
  private refreshTokenValue: string | null = null;
  private expiresAt = 0;

  constructor(config: UserConfig) {
    this.username = config.username;
    this.password = config.password;
    this.serverUrl = config.serverUrl || process.env.OIDC_URL || '';
    this.realmName = config.realmName || process.env.OIDC_REALM || '';
    this.clientId = config.clientId || process.env.OIDC_CLIENT_ID || '';
    this.clientSecret = config.clientSecret;

    if (!this.serverUrl || !this.realmName || !this.clientId) {
      throw new Error('Keycloak URL, realm, and client_id must be set');
    }
    console.log(`AUTH URL=${this.serverUrl}`)
  }

  private async getConfig(): Promise<client.Configuration> {
    if (!this.config) {
      const issuerUrl = new URL(`${this.serverUrl}/realms/${this.realmName}`);
      this.config = await client.discovery(
        issuerUrl,
        this.clientId,
        this.clientSecret,
        undefined,
        { execute: [client.allowInsecureRequests] },
      );
    }
    return this.config;
  }

  private storeToken(response: client.TokenEndpointResponse): void {
    this.accessToken = response.access_token;
    this.refreshTokenValue = response.refresh_token ?? null;
    this.expiresAt = Date.now() + ((response.expires_in || 300) - 10) * 1000;
  }

  private async login(): Promise<void> {
    const config = await this.getConfig();
    const response = await client.genericGrantRequest(config, 'password', {
      username: this.username,
      password: this.password,
    });
    this.storeToken(response);
  }

  private async refresh(): Promise<void> {
    if (!this.refreshTokenValue) {
      throw new Error('No refresh token available');
    }
    const config = await this.getConfig();
    const response = await client.genericGrantRequest(config, 'refresh_token', {
      refresh_token: this.refreshTokenValue,
    });
    this.storeToken(response);
  }

  /**
   * Return a valid access token, refreshing or logging in as needed.
   */
  async getAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.expiresAt) {
      return this.accessToken;
    }
    if (this.refreshTokenValue) {
      await this.refresh();
    } else {
      await this.login();
    }
    return this.accessToken!;
  }

  /**
   * Get user info from the OIDC provider.
   */
  async getUserInfo(): Promise<client.UserInfoResponse> {
    const config = await this.getConfig();
    const token = await this.getAccessToken();
    return client.fetchUserInfo(config, token, client.skipSubjectCheck);
  }

  /**
   * Revoke the current access token.
   */
  async revokeToken(): Promise<void> {
    if (!this.accessToken) return;
    const config = await this.getConfig();
    await client.tokenRevocation(config, this.accessToken, {
      token_type_hint: 'access_token',
    });
    this.accessToken = null;
    this.refreshTokenValue = null;
    this.expiresAt = 0;
  }

  /**
   * Make a SuperTest request.
   * - Default: attaches a valid Bearer token.
   * - `token: null`: sends without any Authorization header.
   * - `token: 'bad'`: sends that exact string as the Bearer value.
   */
  async request(
    app: any,
    method: 'get' | 'post' | 'put' | 'patch' | 'delete',
    path: string,
    options?: { token?: string | null },
  ) {
    const req = request(app)[method](path);
    if (options?.token === null) return req;
    const bearer = options?.token ?? (await this.getAccessToken());
    return req.set('Authorization', `Bearer ${bearer}`);
  }
}
