import { EthereumProvider } from '../workers/EthereumProvider';
import { getEthConfig } from '../contracts/eth';
import { env } from '../env';
import WorkerStatus from '../models/WorkerStatus';
import { Blockchain } from '../types/common';
import { Event } from 'ethers';

export async function getLatestNetworkBlock(): Promise<number> {
  // avoid using `provider.getBlockNumber` because it caches block numbers
  return (await EthereumProvider.getBlock('latest')).number;
}

export async function queryNewURIEvent(
  token: string,
): Promise<Event | undefined> {
  // after L2 no domain will be bought from CNSRegistry hence only UNSRegistry is used.
  const chains = {
    matic: {
      contract: getEthConfig(
        env.APPLICATION.POLYGON.NETWORK_ID.toString(),
      ).UNSRegistry.getContract(),
      latestMirroredBlock: await WorkerStatus.latestMirroredBlockForWorker(
        Blockchain.MATIC,
      ),
    },
    eth: {
      contract: getEthConfig(
        env.APPLICATION.ETHEREUM.NETWORK_ID.toString(),
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
