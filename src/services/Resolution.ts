import { env } from '../env';
import { Domain, DomainsResolution, DomainsReverseResolution } from '../models';
import { Blockchain } from '../types/common';

export function IsZilDomain(name: string): boolean {
  const tokens = name.split('.');
  const tld = tokens[tokens.length - 1];
  return tld === 'zil';
}

export function getDomainResolution(domain: Domain): DomainsResolution {
  let resolution: DomainsResolution;
  if (IsZilDomain(domain.name)) {
    resolution = domain.getResolution(
      Blockchain.ZIL,
      env.APPLICATION.ZILLIQA.NETWORK_ID,
    );
  } else {
    resolution = domain.getResolution(
      Blockchain.MATIC,
      env.APPLICATION.POLYGON.NETWORK_ID,
    );
    if (
      resolution.ownerAddress === null ||
      resolution.ownerAddress === Domain.NullAddress
    ) {
      resolution = domain.getResolution(
        Blockchain.ETH,
        env.APPLICATION.ETHEREUM.NETWORK_ID,
      );
    }
  }
  return resolution;
}

export async function getReverseResolution(
  address: string,
): Promise<DomainsReverseResolution | undefined> {
  let reverse = await DomainsReverseResolution.findOne({
    where: {
      networkId: env.APPLICATION.ETHEREUM.NETWORK_ID,
      blockchain: Blockchain.ETH,
      reverseAddress: address,
    },
  });
  if (!reverse) {
    reverse = await DomainsReverseResolution.findOne({
      where: {
        networkId: env.APPLICATION.POLYGON.NETWORK_ID,
        blockchain: Blockchain.MATIC,
        reverseAddress: address,
      },
    });
  }
  return reverse;
}
