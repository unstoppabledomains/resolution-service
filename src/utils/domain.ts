import { Domain } from '../models';
import { IsZilDomain } from '../services/Resolution';
import { eip137Namehash, znsNamehash } from './namehash';

const normalizeToken = (token: string): string => {
  return '0x' + BigInt(token).toString(16).padStart(64, '0');
};

export const normalizeDomainName = (domainName: string) => {
  return domainName.trim().toLowerCase();
};

export const normalizeDomainOrToken = (domainOrToken: string): string => {
  const domainName = normalizeDomainName(domainOrToken);

  if (domainName.includes('.')) {
    return eip137Namehash(domainName);
  } else if (domainName.replace('0x', '').match(/^[a-fA-F0-9]+$/)) {
    return normalizeToken(domainName);
  }

  return domainName;
};

export const findDomainByNameOrToken = async (
  domainOrToken: string,
): Promise<Domain | undefined> => {
  const tokenName = normalizeDomainOrToken(domainOrToken);
  const domainName = normalizeDomainName(domainOrToken);

  let domain =
    (await Domain.findByNode(tokenName)) ||
    (await Domain.findOnChainNoSafe(tokenName));

  if (!domain && IsZilDomain(domainName)) {
    domain = await Domain.findByNode(znsNamehash(domainName));
  }

  return domain;
};
