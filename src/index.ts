import 'reflect-metadata';
import { api } from './api';
import { env } from './env';
import { logger } from './logger';
import('newrelic');

const runningMode = env.APPLICATION.RUNNING_MODE;
import connect from './database/connect';
import CnsUpdater from './workers/CnsUpdater';
import ZnsUpdater from './workers/ZnsUpdater';
import { startWorker } from './workers/cns/CnsUpdater';

connect().then(() => {
  if (runningMode.includes('CNS_WORKER')) {
    startWorker();
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
