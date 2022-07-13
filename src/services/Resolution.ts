import { env } from '../env';
import { Domain, DomainsResolution } from '../models';
import { Blockchain } from '../types/common';

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
