import dotenv from 'dotenv';

const env = dotenv.config();

import http from 'http';
import prexit from 'prexit';

// import redisClient from './clients/redis.client';
import logger from './config/logger';

console.log(`-------------------------------------------------------------------------------------------
`);

if (env.error) {
  if ('code' in env.error && env.error.code === 'ENOENT') {
    logger.info('No .env file found, using environment variables from system');
  } else {
    logger.error({ err: env.error }, 'Error loading .env file: %o', env.error);
    throw new Error(`Failed to load environment variables: ${env.error.message}`);
  }
} else {
  logger.info('.env file loaded successfully');
}

import config from '@/config/config';

import app from './app';

// TLS is terminated by the reverse proxy (Caddy for local dev, nginx ingress for K8s).
// Express serves plain HTTP; mTLS identity is passed via headers.
const server = http.createServer(app);

server.listen(config.app.listenPort);

// const welcomeMessage = `

// ********************************************************************
// 🛰️   SaaS Control Plane
// --------------------------------------------------------------------
// 📦  Environment   : ${process.env.NODE_ENV || 'development'}
// 🔧  Log Level     : ${process.env.LOG_LEVEL || 'info'}
// 🔧  HTTP logging  : ${process.env.HTTP_LOGGING_ENABLED || 'false'}
// 🌐  Listening on  : ${config.app.baseUrl}
// 🛡️   CORS options:
//         Enabled         : ${config.cors.enabled}
//         Allowed headers : ${config.cors.allowedHeaders}
//         Exposed headers : ${config.cors.exposedHeaders}
//         Origins         : ${config.cors.origin}
//         Methods         : ${config.cors.methods}

// 📅  Started at    : ${new Date().toLocaleString()}
// ********************************************************************
// `;
// logger.info(welcomeMessage);
logger.info(`HTTP server listening on ${config.app.baseUrl}`);

// handle graceful shutdown
prexit(async () => {
  // Close the main Redis connection
  // redisClient.disconnect();
  // logger.info('Redis connection closed');

  // Close HTTP server
  await new Promise((r) => server.close(r));
  logger.info('HTTP Server closed');
  logger.info('Closing clients.');
});
