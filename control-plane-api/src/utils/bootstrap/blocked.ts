import blocked from 'blocked-at';

import { default as parentLogger } from '../../config/logger';

const logger = parentLogger.child({ module: 'block-detection' });

function setupBlockDetection() {
  logger.debug('Setting up block detection');
  blocked(
    (time, stack, { type, resource }) => {
      logger.warn(`Blocked for ${time}ms, operation started here: %s`, stack);
      if (type === 'HTTPPARSER' && resource) {
        logger.warn(`URL related to blocking operation: ${resource.resource.incoming.url}`);
      }
    },
    { resourcesCap: 100, threshold: 200 },
  );

  return;
}

export default setupBlockDetection;
