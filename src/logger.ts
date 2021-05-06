import winston from 'winston';
import { BugsnagTransport } from 'winston-3-bugsnag-transport';
import { env } from './env';

export const logger = winston.createLogger({
  levels: {
    trace: 0,
    input: 1,
    verbose: 2,
    prompt: 3,
    debug: 4,
    info: 5,
    data: 6,
    help: 7,
    warn: 8,
    error: 9,
  },
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
