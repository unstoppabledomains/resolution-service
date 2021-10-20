import { ethers } from 'ethers';
import { logger } from '../logger';
import { env } from '../env';

export class StaticJsonRpcProvider extends ethers.providers.JsonRpcProvider {
  async getNetwork(): Promise<ethers.providers.Network> {
    if (this._network) {
      return Promise.resolve(this._network);
    }
    return super.getNetwork();
  }

  async perform(method: string, params: any): Promise<any> {
    logger.debug(`ETH RPC ${method} ${JSON.stringify(params)}`);
    return super.perform(method, params);
  }
}

export const EthereumProvider = new StaticJsonRpcProvider(
  env.APPLICATION.ETHEREUM.JSON_RPC_API_URL,
  {
    name: '',
    chainId: Number(env.APPLICATION.ETHEREUM.NETWORK_ID),
  },
);
