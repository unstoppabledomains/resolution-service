import { Contract } from 'ethers';
import registryJson from 'dot-crypto/truffle-artifacts/Registry.json';
import resolverJson from 'dot-crypto/truffle-artifacts/Resolver.json';
import whitelistedMinterJson from 'dot-crypto/truffle-artifacts/WhitelistedMinter.json';
import uriPrefixControllerJson from 'dot-crypto/truffle-artifacts/URIPrefixController.json';
import signatureControllerJson from 'dot-crypto/truffle-artifacts/SignatureController.json';
import domainZoneControllerJson from 'dot-crypto/truffle-artifacts/DomainZoneController.json';
import proxyReaderJson from 'dot-crypto/truffle-artifacts/ProxyReader.json';
import NetworkConfig from 'dot-crypto/src/network-config/network-config.json';

import { provider } from '../utils/provider';
import { env } from '../env';

const abiMap = {
  Registry: registryJson.abi,
  SignatureController: signatureControllerJson.abi,
  WhitelistedMinter: whitelistedMinterJson.abi,
  URIPrefixController: uriPrefixControllerJson.abi,
  DomainZoneController: domainZoneControllerJson.abi,
  Resolver: resolverJson.abi,
  ProxyReader: proxyReaderJson.abi,
} as { [key: string]: any };

const cache = {} as { [key: string]: Contract };

export type CryptoConfig = Record<
  string,
  {
    address: string;
    legacyAddresses: ReadonlyArray<string>;
    getContract: () => Contract;
  }
>;

export const getCryptoConfig = (
  networkId: string,
  networks: { [key: string]: { contracts: any } } = NetworkConfig.networks,
): CryptoConfig => {
  const cryptoConfig = {} as CryptoConfig;
  if (Object.keys(networks).includes(networkId)) {
    const { contracts } = networks[networkId];

    Object.keys(contracts).forEach((key) => {
      const data = contracts[key];
      cryptoConfig[key] = {
        ...data,
        getContract: () => {
          if (!abiMap[key]) {
            throw new Error(`ABI for ${key} is not defined`);
          }

          return (
            cache[data.address] ||
            (cache[data.addresss] = new Contract(
              data.address,
              abiMap[key],
              provider,
            ))
          );
        },
      };
    });
  }
  return cryptoConfig;
};

export default getCryptoConfig(env.APPLICATION.ETHEREUM.CHAIN_ID.toString());
