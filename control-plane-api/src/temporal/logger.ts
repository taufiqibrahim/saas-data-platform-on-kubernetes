import pino from 'pino';

const transport = {
  target: 'pino-pretty',
  options: {
    colorize: true,
    singleLine: true,
    translateTime: 'SYS:standard',
    ignore: 'pid,hostname',
    sync: true, // <-- flush logs immediately
    errorLikeObjectKeys: ['err', 'error'],
  },
};

const logLevel = (process.env.TEMPORAL_WORKER_LOG_LEVEL?.toLowerCase() ??
  'info') as pino.LevelWithSilent;

const logger = pino({
  level: logLevel,
  transport,
});

export default logger;
