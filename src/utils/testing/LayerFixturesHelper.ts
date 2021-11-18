import { randomBytes } from 'crypto';
import { Contract, BigNumber } from 'ethers';
import sinon from 'sinon';
import { getEthConfig } from '../../contracts';
import { EthUpdaterConfig } from '../../env';
import { WorkerStatus } from '../../models';
import { Blockchain } from '../../types/common';
import { EthUpdater } from '../../workers/eth/EthUpdater';
import {
  GetProviderForConfig,
  StaticJsonRpcProvider,
} from '../../workers/EthereumProvider';
import { eip137Namehash } from '../namehash';
import { EthereumNetworkHelper } from './EthereumTestsHelper';

export type NSConfig = {
  tld: string;
  tldHash: string;
  name: string;
  label: string;
  node: BigNumber;
  tokenId: BigNumber;
};

export const getNSConfig = (tld: string): NSConfig => {
  const config = {
    tld,
    tldHash: '',
    name: '',
    label: randomBytes(16).toString('hex'),
    node: BigNumber.from(0),
    tokenId: BigNumber.from(0),
  };
  config.tldHash = eip137Namehash(tld);
  config.name = `${config.label}.${config.tld}`;
  config.node = BigNumber.from(eip137Namehash(config.name));
  config.tokenId = BigNumber.from(config.node);
  return config;
};

export class LayerTestFixture {
  networkHelper: EthereumNetworkHelper;
  service: EthUpdater;
  unsRegistry: Contract;
  mintingManager: Contract;
  provider: StaticJsonRpcProvider;
  config: EthUpdaterConfig;
  network: Blockchain;

  async setup(
    network: Blockchain,
    updaterConfig: EthUpdaterConfig,
    networkConfig: any,
  ) {
    this.network = network;
    this.config = updaterConfig;
    this.provider = GetProviderForConfig(this.config);
    this.networkHelper = new EthereumNetworkHelper(this.provider);
    await this.networkHelper.startNetwork(networkConfig);
    await this.networkHelper.resetNetwork();

    const ethContracts = getEthConfig(
      this.config.NETWORK_ID.toString(),
      this.provider,
    );
    this.unsRegistry = ethContracts.UNSRegistry.getContract().connect(
      this.networkHelper.owner(),
    );
    this.mintingManager = ethContracts.MintingManager.getContract().connect(
      this.networkHelper.minter(),
    );
  }

  async prepareService(owner: string, uns: NSConfig) {
    await this.networkHelper.resetNetwork();

    const block = await this.provider.getBlock('latest');
    sinon
      .stub(this.config, 'UNS_REGISTRY_EVENTS_STARTING_BLOCK')
      .value(block.number);
    await WorkerStatus.saveWorkerStatus(this.network, block.number, block.hash);

    const receipt = await this.mintingManager.functions.mintSLD(
      owner,
      uns.tldHash,
      uns.label,
    );
    await receipt.wait();

    this.service = new EthUpdater(this.network, this.config);
  }
}
