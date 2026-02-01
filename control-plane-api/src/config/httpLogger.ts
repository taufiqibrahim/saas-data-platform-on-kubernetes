import { randomUUID } from 'crypto';
import { RequestHandler } from 'express';
import pino from 'pino';
import pinoHttp from 'pino-http';

import { enterTraceContext } from '@/utils/trace-context';

// import config from './config';
import logger from './logger';

const enableHttpLogging = process.env.HTTP_LOGGING_ENABLED === 'true';
// const isProduction = config.nodeEnv === 'production' || process.env.PINO_MULTILINE === 'false';

if (enableHttpLogging) {
  logger.info('HTTP Logging enabled');
} else {
  logger.info('HTTP Logging disabled');
}

// const transport = !isProduction
//   ? {
//     target: 'pino-pretty',
//     options: {
//       colorize: true,
//       singleLine: true, // stack traces flattened for console
//       translateTime: 'SYS:standard',
//       ignore: 'pid,hostname',
//       sync: true,
//       errorLikeObjectKeys: ['err', 'error'],
//     },
//   }
//   : undefined;

// export const baseLogger = pino({
//   level: config.logLevel || 'info',
//   formatters: {
//     level: (label: string) => ({ level: label }), // converts numeric -> name
//   },
//   customLevels: { metric: 25 },
//   useOnlyCustomLevels: false,
//   serializers: {
//     err: (err) => {
//       // flatten stack for single-line logging
//       if (!err) return err;
//       return {
//         type: err.name,
//         message: err.message,
//         code: (err as any).code,
//         stack: err.stack?.replace(/\n\s*/g, ' ⏎ '), // <-- flattened
//       };
//     },
//   },
//   redact: {
//     paths: ['req.headers.authorization', 'req.headers.cookie', 'req.headers["set-cookie"]', 'res.headers["set-cookie"]'],
//     censor: '[REDACTED]',
//   },
//   transport,
// }) as unknown as pino.Logger;

const httpLogger: RequestHandler = enableHttpLogging
  ? pinoHttp({
      genReqId: () => randomUUID(), // each request gets its own traceId
      customProps(req) {
        // ENTER ALS HERE — ONCE
        enterTraceContext(req.id as string);
        return { trace_id: req.id };
      },
      serializers: {
        err: pino.stdSerializers.err,
        req: (req) => {
          return {
            method: req.method,
            url: req.url,
            // headers: req.headers, <--- Simply don't include this
          };
        },
        // res: pino.stdSerializers.res,
        res: (res) => {
          return {
            statusCode: res.statusCode,
            // headers: res.headers, <--- Simply don't include this
          };
        },
      },
      logger: logger,
      autoLogging: {
        ignore: (req) => req.url === '/health',
      },
      customSuccessMessage: (req, res) => `${req.method} ${req.originalUrl} ${res.statusCode}`,
      customErrorMessage: (req, res, err) =>
        `${req.method} ${req.originalUrl} ${res.statusCode} - ${err.message}`,
    })
  : (_req, _res, next) => next(); // No-op

export default httpLogger;
