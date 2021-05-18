import * as path from 'path';

export const env = {
  APPLICATION: {
    PORT: process.env.RESOLUTION_API_PORT || 3000,
    RUNNING_MODE: process.env.RESOLUTION_RUNNING_MODE
      ? process.env.RESOLUTION_RUNNING_MODE.split(',')
      : ['API', 'CNS_WORKER', 'ZNS_WORKER', 'MIGRATIONS'],
    ETHEREUM: {
      CNS_REGISTRY_EVENTS_STARTING_BLOCK: Number(
        process.env.CNS_REGISTRY_EVENTS_STARTING_BLOCK || 9080000,
      ),
      JSON_RPC_API_URL: process.env.ETHEREUM_JSON_RPC_API_URL,
      CHAIN_ID: Number(process.env.ETHEREUM_CHAIN_ID || 1),
      CNS_CONFIRMATION_BLOCKS: Number(process.env.CNS_CONFIRMATION_BLOCKS || 3),
      CNS_BLOCK_FETCH_LIMIT: Number(process.env.CNS_BLOCK_FETCH_LIMIT || 1000),
      CNS_RESOLVER_ADVANCED_EVENTS_STARTING_BLOCK: Number(
        process.env.CNS_RESOLVER_ADVANCED_EVENTS_STARTING_BLOCK || 9080000,
      ),
      CNS_RESOLVER_RECORDS_PER_PAGE: Number(
        process.env.CNS_RECORDS_PER_PAGE || 100,
      ),
      CNS_FETCH_INTERVAL: Number(process.env.CNS_FETCH_INTERVAL || 5000),
    },
    NEW_RELIC_LICENSE_KEY: process.env.NEW_RELIC_LICENSE_KEY || '',
    NEW_RELIC_APP_NAME: process.env.NEW_RELIC_APP_NAME || '',
    BUGSNAG_API_KEY: process.env.BUGSNAG_API_KEY || '',
  },
  TYPEORM: {
    LOGGING: {
      colorize: process.env.TYPEORM_LOGGING_COLORIZE || true,
    },
    type: 'postgres' as const,
    url:
      process.env.NODE_ENV === 'test'
        ? 'postgresql://postgres:secret@localhost/resolution_service_test'
        : process.env.RESOLUTION_POSTGRES_URL ||
          'postgresql://postgres:secret@localhost/resolution_service',
    entities: [
      path.join(__dirname, './models/index.ts'),
      path.join(__dirname, './models/index.js'),
    ] as string[],
    migrations: [
      path.join(__dirname, './database/migrations/*.ts'),
      path.join(__dirname, './database/migrations/*.js'),
    ] as string[],
  },
};
