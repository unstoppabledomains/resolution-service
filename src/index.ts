import 'reflect-metadata';
import { api } from './api';
import { env } from './env';
import { logger } from './logger';
import('newrelic');

const runningMode = env.APPLICATION.RUNNING_MODE;
import connect from './database/connect';
import { startWorker as startEthWorker } from './workers/eth/EthUpdater';
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

  if (runningMode.includes('ETH_WORKER')) {
    startEthWorker();
    logger.info('ETH worker is enabled and running');
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
