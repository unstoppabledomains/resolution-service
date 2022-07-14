import { env } from '../env';
import { Domain, DomainsResolution, DomainsReverseResolution } from '../models';
import { Blockchain } from '../types/common';
import { ETHAddressRegex } from '../utils/ethersUtils';

export function IsZilDomain(name: string): boolean {
  const tokens = name.split('.');
  const tld = tokens[tokens.length - 1];
  return tld === 'zil';
}

function isNullAddress(address: string | null): boolean {
  return address === null || address === Domain.NullAddress;
}

export function getDomainResolution(domain: Domain): DomainsResolution {
  let resolution: DomainsResolution;
  resolution = domain.getResolution(
    Blockchain.MATIC,
    env.APPLICATION.POLYGON.NETWORK_ID,
  );

  if (isNullAddress(resolution.ownerAddress)) {
    resolution = domain.getResolution(
      Blockchain.ETH,
      env.APPLICATION.ETHEREUM.NETWORK_ID,
    );
  }

  if (isNullAddress(resolution.ownerAddress) && IsZilDomain(domain.name)) {
    resolution = domain.getResolution(
      Blockchain.ZIL,
      env.APPLICATION.ZILLIQA.NETWORK_ID,
    );
  }
  return resolution;
}

export async function getReverseResolution(
  address: string,
): Promise<DomainsReverseResolution | undefined> {
  if (!address.match(ETHAddressRegex)) {
    return undefined;
  }

  let reverse = await DomainsReverseResolution.findOne({
    where: {
      networkId: env.APPLICATION.ETHEREUM.NETWORK_ID,
      blockchain: Blockchain.ETH,
      reverseAddress: address,
    },
    relations: ['domain', 'domain.resolutions'],
  });
  if (!reverse) {
    reverse = await DomainsReverseResolution.findOne({
      where: {
        networkId: env.APPLICATION.POLYGON.NETWORK_ID,
        blockchain: Blockchain.MATIC,
        reverseAddress: address,
      },
      relations: ['domain', 'domain.resolutions'],
    });
  }
  return reverse;
}
