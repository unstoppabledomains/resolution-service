import { env } from '../env';
import { Domain, DomainsResolution } from '../models';
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
