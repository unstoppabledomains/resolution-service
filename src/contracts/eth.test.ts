import { expect } from 'chai';
import { getEthConfig, CryptoConfig } from './eth';
import NetworkConfig from 'uns/uns-config.json';
import { EthereumProvider } from '../workers/EthereumProvider';

describe('eth', () => {
  const contractKeys: (keyof typeof NetworkConfig.networks['1']['contracts'])[] =
    [
      'UNSRegistry',
      'CNSRegistry',
      'SignatureController',
      'WhitelistedMinter',
      'URIPrefixController',
      'DomainZoneController',
      'Resolver',
      'ProxyReader',
    ];

  function compareNetworkConfig(
    config: CryptoConfig,
    networkId: '1' | '5' | '1337',
  ) {
    const networkConfig = NetworkConfig.networks[networkId].contracts;

    contractKeys.forEach((contract) => {
      expect(config[contract]).to.not.be.undefined;
      expect(config[contract].address).to.be.equal(
        networkConfig[contract].address,
      );
      expect(config[contract].legacyAddresses).to.be.deep.equal(
        networkConfig[contract].legacyAddresses,
      );
      expect(config[contract].getContract()).to.not.be.undefined;
    });
  }

  it('should return empty config for other networks', async () => {
    const config = getEthConfig('13327', EthereumProvider);
    expect(config).to.be.an('object').that.is.empty;
  });

  it('should return eth config for mainnet', () => {
    const networkId = '1';
    const config = getEthConfig(networkId, EthereumProvider);
    compareNetworkConfig(config, networkId);
  });

  it('should return eth config for testnet', () => {
    const networkId = '5';
    const config = getEthConfig(networkId, EthereumProvider);
    compareNetworkConfig(config, networkId);
  });

  it('should return eth config for sandbox', () => {
    const networkId = '1337';
    const config = getEthConfig(networkId, EthereumProvider);
    compareNetworkConfig(config, networkId);
  });

  it('should return empty config for other networks', async () => {
    const config = getEthConfig('99', EthereumProvider);
    expect(config).to.be.an('object').that.is.empty;
  });
});
