import { expect } from 'chai';
import { getCryptoConfig, CryptoConfig } from './cns';
import NetworkConfig from 'dot-crypto/src/network-config/network-config.json';

describe('cns', () => {
  const contractKeys: (keyof typeof NetworkConfig.networks['1']['contracts'])[] =
    [
      'Registry',
      'SignatureController',
      'WhitelistedMinter',
      'URIPrefixController',
      'DomainZoneController',
      'Resolver',
      'ProxyReader',
    ];

  function compareNetworkConfig(config: CryptoConfig, networkId: '1' | '4') {
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

  it('should return crypto config for mainnet', () => {
    const networkId = '1';
    const config = getCryptoConfig(networkId);
    compareNetworkConfig(config, networkId);
  });

  it('should return crypto config for testnet', () => {
    const networkId = '4';
    const config = getCryptoConfig(networkId);
    compareNetworkConfig(config, networkId);
  });

  it('should return empty config for other networks', async () => {
    const config = getCryptoConfig('99');
    expect(config).to.be.an('object').that.is.empty;
  });
});
