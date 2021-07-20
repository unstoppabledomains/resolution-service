import { Contract } from 'ethers';
import registryJson from 'uns/artifacts/UNSRegistry.json';
import mintingManagerJson from 'uns/artifacts/MintingManager.json';
import NetworkConfig from 'uns/uns-config.json';
import { EthereumProvider } from '../workers/EthereumProvider';
import { env } from '../env';

const abiMap = {
  UNSRegistry: registryJson.abi,
  MintingManager: mintingManagerJson.abi,
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

export const getUnsConfig = (
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
              EthereumProvider,
            ))
          );
        },
      };
    });
  }
  return cryptoConfig;
};

export default getUnsConfig(env.APPLICATION.ETHEREUM.CHAIN_ID.toString());
