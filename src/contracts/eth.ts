import { Contract } from 'ethers';
import unsRegistryJson from 'uns/artifacts/UNSRegistry.json';
import cnsRegistryJson from 'uns/artifacts/CNSRegistry.json';
import mintingManagerJson from 'uns/artifacts/MintingManager.json';
import signatureControllerJson from 'uns/artifacts/SignatureController.json';
import whitelistedMinterJson from 'dot-crypto/truffle-artifacts/WhitelistedMinter.json';
import uriPrefixControllerJson from 'uns/artifacts/URIPrefixController.json';
import domainZoneControllerJson from 'uns/artifacts/DomainZoneController.json';
import resolverJson from 'uns/artifacts/Resolver.json';
import proxyReaderJson from 'uns/artifacts/ProxyReader.json';
import NetworkConfig from 'uns/uns-config.json';
import {
  EthereumProvider,
  MaticProvider,
  StaticJsonRpcProvider,
} from '../workers/EthereumProvider';
import { env } from '../env';

const abiMap = {
  UNSRegistry: unsRegistryJson.abi,
  CNSRegistry: cnsRegistryJson.abi,
  MintingManager: mintingManagerJson.abi,
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

export const getEthConfig = (
  networkId: string,
  provider: StaticJsonRpcProvider,
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

export const ETHContracts = getEthConfig(
  env.APPLICATION.ETHEREUM.NETWORK_ID.toString(),
  EthereumProvider,
);
export const MATICContracts = getEthConfig(
  env.APPLICATION.POLYGON.NETWORK_ID.toString(),
  MaticProvider,
);
