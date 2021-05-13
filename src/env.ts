import * as path from 'path';

const enviroment = process.env.NODE_ENV as string;

const zilProdConfig = {
  ZNS_REGISTRY_CONTRACT: '0x9611c53be6d1b32058b2747bdececed7e1216793',
  NETWORK: 'mainnet',
  ZNS_API_ENDPOINT: 'https://api.zilliqa.com/',
};

const zilDevConfig = {
  ZNS_REGISTRY_CONTRACT: '0xB925adD1d5EaF13f40efD43451bF97A22aB3d727',
  NETWORK: 'testnet',
  ZNS_API_ENDPOINT: 'https://dev-api.zilliqa.com/',
};

const configMap = {
  production: zilProdConfig,
  test: zilDevConfig,
};

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
    },
    ZILLIQA: {
      ZNS_REGISTRY_CONTRACT: '0xB925adD1d5EaF13f40efD43451bF97A22aB3d727',
      NETWORK: 'testnet',
      ZNS_API_ENDPOINT: 'https://dev-api.zilliqa.com/',
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
