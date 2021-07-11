import 'reflect-metadata';
import { api } from './api';
import { env } from './env';
import { logger } from './logger';
import('newrelic');

const runningMode = env.APPLICATION.RUNNING_MODE;
import connect from './database/connect';
import { startWorker as startUnsWorker } from './workers/uns/UnsUpdater';
import { startWorker as startCnsWorker } from './workers/cns/CnsUpdater';
import ZnsUpdater from './workers/ZnsUpdater';
import { loadSnapshot } from './database/loadSnapshot';

connect().then(async () => {
  if (runningMode.includes('LOAD_SNAPSHOT')) {
    logger.info('Loading db snapshot');
    try {
      await loadSnapshot();
    } catch (error) {
      logger.error(error);
      process.exit(1);
    }
    logger.info('Db snapshot loaded');
  }

  if (runningMode.includes('UNS_WORKER')) {
    startUnsWorker();
    logger.info('UNS worker is enabled and running');
  }

  if (runningMode.includes('CNS_WORKER')) {
    startCnsWorker();
    logger.info('CNS worker is enabled and running');
  }

  if (runningMode.includes('ZNS_WORKER')) {
    ZnsUpdater();
    logger.info(`ZNS worker is enabled and running`);
  }

  if (runningMode.includes('API')) {
    api.listen(env.APPLICATION.PORT);
    logger.info(`API is enabled and running on port ${env.APPLICATION.PORT}`);
  }
});
