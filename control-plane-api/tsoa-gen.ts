import { generateRoutes, generateSpec, ExtendedRoutesConfig, ExtendedSpecConfig, Swagger } from 'tsoa';
import fs from 'fs';
import YAML from 'yaml';
import config from './src/config/config';

// Define desired tag order
const tagOrder = [
  'Internal',
  'Apps',
  'Cloud Regions',
  'User',
  'Roles',
  'Accounts',
  'Account',
  'Account Invites',
  'Invitations',
  'Account Members',
  'Account Credentials',
  'Account Storages',
  'Account Networks',
  'Workspaces',
  'Workspace Apps',

  'Admin API',
];

/**
 * Reorder OpenAPI paths by tag priority, then by path name.
 *
 * @param paths - The `spec.paths` object from the OpenAPI document.
 * @param tagOrder - Array of tag names, in the desired order of appearance.
 *                   Tags not listed will appear afterward in alphabetical order.
 */
export function reorderPathsByTags(paths: Record<string, any>, tagOrder: string[]): Record<string, any> {
  const entries = Object.entries(paths);

  const sorted = entries.sort(([pathA, opsA], [pathB, opsB]) => {
    // Extract first tag from first operation in the path
    const getFirstTag = (ops: Record<string, any>): string => {
      const firstOp = Object.values(ops)[0];
      if (firstOp && typeof firstOp === 'object' && 'tags' in firstOp && Array.isArray((firstOp as any).tags)) {
        return (firstOp as any).tags[0];
      }
      return '';
    };

    const tagA = getFirstTag(opsA);
    const tagB = getFirstTag(opsB);

    // Sort by explicit tag order first
    const indexA = tagOrder.indexOf(tagA);
    const indexB = tagOrder.indexOf(tagB);

    if (indexA !== -1 && indexB === -1) return -1;
    if (indexB !== -1 && indexA === -1) return 1;
    if (indexA !== -1 && indexB !== -1 && indexA !== indexB) {
      return indexA - indexB;
    }

    // Otherwise, fallback to alphabetical order by tag name
    if (tagA !== tagB) return tagA.localeCompare(tagB);

    // Then by path name alphabetically
    return pathA.localeCompare(pathB);
  });

  return Object.fromEntries(sorted);
}

(async () => {
  // ------------------------
  // OpenAPI / spec generation
  // ------------------------
  // const schemes = [new URL(config.baseUrl).protocol.replace(':', '') as Swagger.Protocol];
  // const servers = [new URL(config.baseUrl).host, "saas-control-plane.localhost"];
  // console.log(`Using baseUrl=${config.baseUrl}`);

  const schemes = [
    "http" as Swagger.Protocol,
    "https" as Swagger.Protocol,
  ]

  const servers = [
    new URL(config.app.baseUrl).host,
  ]

  const specOptions: ExtendedSpecConfig = {
    entryFile: 'src/app.ts',
    noImplicitAdditionalProperties: 'throw-on-extras',
    controllerPathGlobs: ['src/**/*controller.ts'],

    // Servers section
    basePath: '/api/v1',
    schemes,
    servers,

    rootSecurity: [
      { bearerAuth: [] }, // applies bearer token
      { oauth2PasswordSSO: [] }, // applies Password Oauth2
      { pkceSSO: ['openid'] }, // applies PKCE OAuth2 with openid scope
    ],

    securityDefinitions: {
      bearerAuth: {
        type: 'apiKey',
        name: 'Authorization',
        in: 'header',
      },
      // Disabled: Keycloak does not fully enable CORS for password grant token endpoint without Client Secret
      // oauth2PasswordSSO: {
      //   type: 'oauth2',
      //   flows: {
      //     password: {
      //       tokenUrl: 'https://<KEYCLOAK_DOMAIN>/realms/<REALM>/protocol/openid-connect/token',
      //     },
      //   },
      // },
      pkceSSO: {
        type: 'oauth2',
        flows: {
          authorizationCode: {
            authorizationUrl: `${config.keycloak.host}/realms/${config.keycloak.realm}/protocol/openid-connect/auth`,
            tokenUrl: `${config.keycloak.host}/realms/${config.keycloak.realm}/protocol/openid-connect/token`,
            scopes: {
              openid: 'OpenID Connect scope',
              profile: 'Access to your profile information',
              email: 'Access to your email',
            },
          },
        },
      },
    },

    // Spec output
    outputDirectory: 'src/openapi',
    yaml: true,
    specVersion: 3,

    // Info section
    spec: {
      info: {
        title: 'sparqd-control-plane-api',
        description: 'API documentation for the control plane service',
        version: '1.0.0',
        license: {
          name: 'ISC',
        },
      },
      // schemes: ["http"],
      // host: "localhost:3000",
      // basePath: "/api/v1",
    },
  };

  // ------------------------
  // Routes generation
  // ------------------------
  const routeOptions: ExtendedRoutesConfig = {
    bodyCoercion: false,
    noImplicitAdditionalProperties: 'silently-remove-extras',
    controllerPathGlobs: ['src/**/*controller.ts'],
    entryFile: 'src/app.ts',
    routesDir: 'src/generated',
    middleware: 'express',
  };

  // Generate OpenAPI spec (swagger.yaml)
  await generateSpec(specOptions);

  // ------------------------
  // Post-process swagger.yaml
  // ------------------------
  // const swaggerFile = path.resolve("src/openapi/swagger.yaml");

  // Load YAML → JS object
  const swaggerFile = fs.readFileSync('src/openapi/swagger.yaml', 'utf8');
  const spec = YAML.parse(swaggerFile);

  // Reorder by tags
  spec.paths = reorderPathsByTags(spec.paths, tagOrder);

  // Logs the output routes
  for (const [path, methods] of Object.entries(spec.paths)) {
    for (const [method, operation] of Object.entries(methods as Record<string, any>)) {
      const httpMethod = method.toUpperCase()
      const summary = operation.summary ?? ''

      console.log(`"${httpMethod}","${path}","${summary}"`)
    }
  }

  fs.writeFileSync('src/openapi/swagger.yaml', YAML.stringify(spec, null, 2));

  // Generate Express routes
  await generateRoutes(routeOptions);

  console.log('\nTSOA spec and routes generated successfully!');
})();
