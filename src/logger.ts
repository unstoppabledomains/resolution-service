import winston from 'winston';
import { BugsnagTransport } from 'winston-3-bugsnag-transport';
import { env } from './env';
import { Blockchain } from './types/common';

const loggerFormat = winston.format.printf(
  ({ level, message, workerNetwork }) => {
    if (workerNetwork) {
      return `${level}:\t[${workerNetwork}]\t${message}`;
    }
    return `${level}:\t${message}`;
  },
);

export const logger = winston.createLogger({
  format: loggerFormat,
  defaultMeta: { service: 'resolution-service' },
  transports: [
    new winston.transports.Console(),
    ...(env.APPLICATION.BUGSNAG_API_KEY
      ? [
          new BugsnagTransport({
            bugsnag: { apiKey: env.APPLICATION.BUGSNAG_API_KEY },
            level: 'error',
          }),
        ]
      : []),
  ],
});

export function WorkerLogger(workerNetwork: Blockchain) {
  return logger.child({
    workerNetwork,
  });
}
