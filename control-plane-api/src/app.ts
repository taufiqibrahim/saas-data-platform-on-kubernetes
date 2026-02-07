import config from '@config/config';
import { default as configureCORS } from '@utils/bootstrap/cors';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import express from 'express';
import session from 'express-session';
import fs from 'fs';
import helmet from 'helmet';
import path from 'path';
import swaggerUi from 'swagger-ui-express';
import YAML from 'yaml';

import httpLogger from '@/config/httpLogger';

import { RegisterRoutes } from './generated/routes';
import healthRouter from './health-check';
import { errorHandler } from './middlewares/error-handler';
import { generateBootstrapYAML } from './domains/agent/agent.service';

const app = express();

// Trust reverse proxy (Caddy / nginx ingress) for forwarded headers
app.set('trust proxy', true);

app.use(compression());
app.use(express.json({ limit: config.app.jsonLimit }));
app.use(express.urlencoded({ extended: true }));
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        'script-src': ["'self'", 'https://unpkg.com'],
        'connect-src': ["'self'", 'https://unpkg.com'],
        'worker-src': ["'self'", 'blob:'], // RapiDoc uses web workers
        'img-src': ["'self'", 'data:', 'https://unpkg.com'],
      },
    },
  }),
);
app.use(cookieParser());

// Configure session
const memoryStore = new session.MemoryStore();
app.use(
  session({
    secret: 'mySecret',
    resave: false,
    saveUninitialized: true,
    store: memoryStore,
    cookie: {
      httpOnly: true,
      sameSite: 'lax',
      secure: false,
    },
  }),
);

// HTTP Logger
app.use(httpLogger);

// Health check
app.use('/health', healthRouter);

// CORS
configureCORS(app);

// V1 routes
const tsoaApiV1Router = express.Router();
RegisterRoutes(tsoaApiV1Router);
app.use('/api/v1', tsoaApiV1Router);

/**
 * Serve OpenAPI file from the docs directory
 */
// Load YAML file
const file = fs.readFileSync(path.join(__dirname, 'openapi', 'swagger.yaml'), 'utf8');
const swaggerDocument = YAML.parse(file);

// Mount Swagger UI
app.use('/swagger', swaggerUi.serve, swaggerUi.setup(swaggerDocument));

/**
 * 1. Serve the raw OpenAPI file
 * RapiDoc needs to fetch this to render the UI
 */
app.get('/api-spec', (_req, res) => {
  res.sendFile(path.join(__dirname, 'openapi', 'swagger.yaml'));
});

/**
 * 2. Serve the RapiDoc UI
 */
app.get('/docs', (_req, res) => {
  res.sendFile(path.join(__dirname, 'docs.html'));
});

// Serve the agent bootstrap YAML content
app.get('/bootstrap', async (req, res) => {
  const token = req.query.token as string;
  const yaml = await generateBootstrapYAML(token)
  res.status(200).send(yaml)
});

// General Exception handler
// app.use(handleGeneralExceptions);

// Error handler
app.use(errorHandler);

export default app;
