const enviroment = process.env.NODE_ENV as 'production' | 'test';

const zilProdConfig = {
  ZNS_REGISTRY_CONTRACT: '0x9611c53be6d1b32058b2747bdececed7e1216793',
  NETWORK: 'mainnet',
  JSON_RPC_API_URL: 'https://api.zilliqa.com/',
  WORKER_INTERVAL: 600000,
};

const zilDevConfig = {
  ZNS_REGISTRY_CONTRACT: '0xB925adD1d5EaF13f40efD43451bF97A22aB3d727',
  NETWORK: 'testnet',
  JSON_RPC_API_URL: 'https://dev-api.zilliqa.com/',
  WORKER_INTERVAL: 5000,
};

const configMap = {
  production: zilProdConfig,
  test: zilDevConfig,
};

export default configMap[enviroment];
