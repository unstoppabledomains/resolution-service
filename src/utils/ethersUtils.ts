import {
  EthereumProvider,
  StaticJsonRpcProvider,
} from '../workers/EthereumProvider';

export async function getLatestNetworkBlock(
  provider: StaticJsonRpcProvider = EthereumProvider,
): Promise<number> {
  // avoid using `provider.getBlockNumber` because it caches block numbers
  return (await provider.getBlock('latest')).number;
}
