import DomainsResolution, { Location } from '../models/DomainsResolution';

export function LocationFromDomainName(name: string): Location {
  const tokens = name.split('.');
  const tld = tokens[tokens.length - 1];
  switch (tld) {
    case 'zil':
      return 'ZNS';
    case 'crypto':
      return 'CNS';
    default:
      return 'UNS';
  }
}

// todo Don't prefill domain registry. Set domain registry from incoming ETH events only.
export function getRegistryAddressFromLocation(location: string): string {
  switch (location) {
    case 'CNS':
      return '0xd1e5b0ff1287aa9f9a268759062e4ab08b9dacbe';
    case 'ZNS':
      return '0x9611c53be6d1b32058b2747bdececed7e1216793';
    case 'UNSL1':
      return '0x049aba7510f45ba5b64ea9e658e342f904db358d';
    default:
      return DomainsResolution.NullAddress;
  }
}
