import {
  EthereumProvider,
  StaticJsonRpcProvider,
  GetProviderForConfig,
} from '../workers/EthereumProvider';
import { getEthConfig } from '../contracts/eth';
import { env } from '../env';
import WorkerStatus from '../models/WorkerStatus';
import { Blockchain } from '../types/common';
import { Event } from 'ethers';

export const ETHAddressRegex = /^0x[a-fA-F0-9]{40}$/;

export async function getLatestNetworkBlock(
  provider: StaticJsonRpcProvider = EthereumProvider,
): Promise<number> {
  // avoid using `provider.getBlockNumber` because it caches block numbers
  return (await provider.getBlock('latest')).number;
}

export async function queryNewURIEvent(
  token: string,
): Promise<Event | undefined> {
  // after L2 no domain will be bought from CNSRegistry hence only UNSRegistry is used.
  const chains = {
    matic: {
      contract: getEthConfig(
        env.APPLICATION.POLYGON.NETWORK_ID.toString(),
        GetProviderForConfig(env.APPLICATION.POLYGON),
      ).UNSRegistry.getContract(),
      latestMirroredBlock: await WorkerStatus.latestMirroredBlockForWorker(
        Blockchain.MATIC,
      ),
    },
    eth: {
      contract: getEthConfig(
        env.APPLICATION.ETHEREUM.NETWORK_ID.toString(),
        GetProviderForConfig(env.APPLICATION.ETHEREUM),
      ).UNSRegistry.getContract(),
      latestMirroredBlock: await WorkerStatus.latestMirroredBlockForWorker(
        Blockchain.ETH,
      ),
    },
  };

  const events = (
    await Promise.all(
      Object.values(chains).map(async (chain) => {
        const contract = chain.contract;
        const filter = contract.filters.NewURI(token);
        return contract.queryFilter(filter, chain.latestMirroredBlock);
      }),
    )
  )
    .filter((arr) => arr.length !== 0)
    .flat();

  return events[0];
}
