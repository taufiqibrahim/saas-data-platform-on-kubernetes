import config from '@config/config';
import logger from '@config/logger';
import cors from 'cors';
import type { Application } from 'express';

/**
 * Configures CORS middleware for the Express application.
 *
 * @param {Application} app - The Express application instance.
 */
export default function configure(app: Application): void {
  if (config.cors.enabled === false) {
    logger.warn('CORS is disabled');
    return;
  }

  // Log the CORS configuration
  logger.debug(config.cors, 'CORS configured');

  // Use the CORS middleware with the configured options
  const corsInstance = cors(config.cors);
  app.use(corsInstance);
}
