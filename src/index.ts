import 'reflect-metadata';
import { runWorker } from './services/WorkerRunner';
import { api } from './api';
import { env } from './env';
import path from 'path';
import { logger } from './logger';
import('newrelic');

const runningMode = env.APPLICATION.RUNNING_MODE;
import connect from './database/connect';

connect().then(() => {
  if (runningMode.includes('CNS_WORKER')) {
    runWorker(path.resolve(__dirname, 'workers/cns/CnsUpdater.import.js'));
    logger.info('CNS worker is enabled and running');
  }

  if (runningMode.includes('ZNS_WORKER')) {
    runWorker(path.resolve(__dirname, 'workers/ZnsUpdater.import.js'));
    logger.info(`ZNS worker is enabled and running`);
  }

  if (runningMode.includes('API')) {
    const server = api.listen(env.APPLICATION.PORT);
    process.on('SIGTERM', () => server.close());
    process.on('SIGINT', () => server.close());
    logger.info(`API is enabled and running on port ${env.APPLICATION.PORT}`);
  }
});
