import winston from 'winston';
import { BugsnagTransport } from 'winston-3-bugsnag-transport';
import { env } from './env';
import { Blockchain } from './types/common';

export const logger = winston.createLogger({
  format: winston.format.cli(),
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
  const logWorkerInfo = winston.format.printf(({ level, message }) => {
    return `${level}:\t[${workerNetwork}]\t${message}`;
  });

  return winston.createLogger({
    format: logWorkerInfo,
    defaultMeta: { service: 'resolution-service' },
    transports: [
      new winston.transports.Console(),
      ...(env.APPLICATION.BUGSNAG_API_KEY
        ? [
            new BugsnagTransport({
              bugsnag: { apiKey: env.APPLICATION.BUGSNAG_API_KEY },
              level: 'error',
              format: logWorkerInfo,
            }),
          ]
        : []),
    ],
  });
}
