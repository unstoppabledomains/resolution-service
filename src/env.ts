import * as path from 'path';

export const env = {
  APPLICATION: {
    PORT: process.env.RESOLUTION_API_PORT || 3000,
    RUNNING_MODE: process.env.RESOLUTION_RUNNING_MODE
      ? process.env.RESOLUTION_RUNNING_MODE.split(',')
      : ['API', 'CNS_WORKER', 'ZNS_WORKER', 'MIGRATIONS'],
    ETHEREUM: {
      CNS_REGISTRY_EVENTS_STARTING_BLOCK: +(
        process.env.CNS_REGISTRY_EVENTS_STARTING_BLOCK || 9080000
      ),
      JSON_RPC_API_URL:
        process.env.ETHEREUM_JSON_RPC_API_URL ||
        'https://mainnet.infura.io/v3/4458cf4d1689497b9a38b1d6bbf05e78',
      CHAIN_ID: +(process.env.ETHEREUM_CHAIN_ID || 1),
      CNS_CONFIRMATION_BLOCKS: +(process.env.CNS_CONFIRMATION_BLOCKS || 3),
      CNS_BLOCK_FETCH_LIMIT: +(process.env.CNS_CONFIRMATION_BLOCKS || 10000),
    },
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
