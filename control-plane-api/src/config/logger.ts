import pino from 'pino';

import { getTraceId } from '../utils/trace-context';
import config from './config';

const isProduction = config.app.nodeEnv === 'production';
const isPinoMultiLine = process.env.PINO_MULTILINE === 'true';

const getCallerInfo = () => {
  const stack = new Error().stack;
  if (!stack) return {};

  const lines = stack.split('\n');
  const callerLine = lines.find(
    (line) =>
      !line.includes('node_modules') &&
      !line.includes('node:internal') &&
      !line.includes('logger.ts') &&
      line.includes('at '),
  );

  if (!callerLine) return {};

  const match = callerLine.match(/\((.*)\)|at\s+(.*)$/);
  const fullPath = match ? match[1] || match[2] : '';
  const displayPath = fullPath.replace(process.cwd(), '').replace(/^\//, '');

  return { caller: displayPath };
};

const logger = pino({
  level: config.app.logLevel || 'info',
  customLevels: { metric: 25 },
  useOnlyCustomLevels: false,

  mixin: () => {
    const traceId = getTraceId();

    return {
      ...(isProduction ? {} : getCallerInfo()),
      ...(traceId ? { trace_id: traceId } : {}),
    };
  },

  redact: isProduction
    ? {
        paths: [
          'req.headers.authorization',
          'req.headers.cookie',
          'req.headers["set-cookie"]',
          'res.headers["set-cookie"]',
        ],
        censor: '[REDACTED]',
      }
    : undefined,

  transport: !isProduction
    ? {
        target: 'pino-pretty',
        options: {
          colorize: true,
          singleLine: !isPinoMultiLine,
          translateTime: 'SYS:standard',
          ignore: 'pid,hostname',
          sync: true,
          errorLikeObjectKeys: ['err', 'error'],
        },
      }
    : undefined,
});

export default logger;
