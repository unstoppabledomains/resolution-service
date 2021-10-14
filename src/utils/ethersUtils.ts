import { EthereumProvider } from '../workers/EthereumProvider';

export async function getLatestNetworkBlock(): Promise<number> {
  // avoid using `provider.getBlockNumber` because it caches block numbers
  return (await EthereumProvider.getBlock('latest')).number;
}
