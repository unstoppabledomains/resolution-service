import { BigNumber, Contract } from 'ethers';
import { randomBytes } from 'crypto';
import { env, EthUpdaterConfig } from '../../env';
import { CnsRegistryEvent, Domain, WorkerStatus } from '../../models';
import {
  GetProviderForConfig,
  StaticJsonRpcProvider,
} from '../EthereumProvider';
import {
  EthereumHelper,
  EthereumNetworkHelper,
} from '../../utils/testing/EthereumTestsHelper';
import { EthUpdater } from './EthUpdater';
import * as sinon from 'sinon';
import { eip137Namehash } from '../../utils/namehash';
import { getEthConfig } from '../../contracts';
import * as ethersUtils from '../../utils/ethersUtils';
import { Blockchain } from '../../types/common';
import { getLatestNetworkBlock } from '../../utils/ethersUtils';
import { Block } from '@ethersproject/abstract-provider';
import { expect } from 'chai';

type NSConfig = {
  tld: string;
  tldHash: string;
  name: string;
  label: string;
  node: BigNumber;
  tokenId: BigNumber;
};

const getNSConfig = (tld: string): NSConfig => {
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

class LayerTestFixture {
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

describe('EthUpdater l2 worker', () => {
  const L1Fixture: LayerTestFixture = new LayerTestFixture();
  const L2Fixture: LayerTestFixture = new LayerTestFixture();
  let owner: string;
  let uns: NSConfig;

  before(async () => {
    await EthereumHelper.stopNetwork();
    await L1Fixture.setup(Blockchain.ETH, env.APPLICATION.ETHEREUM, {});
    await L2Fixture.setup(Blockchain.MATIC, env.APPLICATION.POLYGON, {
      network: {
        url: 'http://localhost:7546',
        chainId: 1337,
        dbPath: './.sandboxl2',
      },
    });
  });

  after(async () => {
    await L1Fixture.networkHelper.stopNetwork();
    await L2Fixture.networkHelper.stopNetwork();
  });

  beforeEach(async () => {
    uns = getNSConfig('blockchain');
    owner = L1Fixture.networkHelper.owner().address;
    await L1Fixture.prepareService(owner, uns);
    await L2Fixture.prepareService(owner, uns);
  });

  it('should save both worker stats', async () => {
    // test domain is created in beforeEach hook
    await L1Fixture.networkHelper.mineBlocksForConfirmation();
    await L2Fixture.networkHelper.mineBlocksForConfirmation();

    await L1Fixture.service.run();
    await L2Fixture.service.run();

    const workerStatus = await WorkerStatus.findOne({
      location: Blockchain.ETH,
    });
    const netBlockNumber = await ethersUtils.getLatestNetworkBlock(
      L1Fixture.provider,
    );
    const expectedBlock = await L1Fixture.provider.getBlock(
      netBlockNumber - env.APPLICATION.ETHEREUM.CONFIRMATION_BLOCKS,
    );
    expect(workerStatus).to.exist;
    expect(workerStatus?.lastMirroredBlockNumber).to.eq(expectedBlock.number);
    expect(workerStatus?.lastMirroredBlockHash).to.eq(expectedBlock.hash);

    const workerStatusL2 = await WorkerStatus.findOne({
      location: Blockchain.MATIC,
    });
    const netBlockNumberL2 = await ethersUtils.getLatestNetworkBlock(
      L2Fixture.provider,
    );
    const expectedBlockL2 = await L2Fixture.provider.getBlock(
      netBlockNumberL2 - env.APPLICATION.POLYGON.CONFIRMATION_BLOCKS,
    );
    expect(workerStatusL2).to.exist;
    expect(workerStatusL2?.lastMirroredBlockNumber).to.eq(
      expectedBlockL2.number,
    );
    expect(workerStatusL2?.lastMirroredBlockHash).to.eq(expectedBlockL2.hash);
  });

  it('should add new domain on both layers', async () => {
    // test domain is created in beforeEach hook
    await L1Fixture.networkHelper.mineBlocksForConfirmation();
    await L2Fixture.networkHelper.mineBlocksForConfirmation();

    await L1Fixture.service.run();
    await L2Fixture.service.run();

    const domain = await Domain.findOneOrFail({
      where: { name: uns.name },
      relations: ['resolutions'],
    });
    expect(domain.label).to.equal(uns.label);
    const l1Resolution = domain.getResolution(
      L1Fixture.network,
      L1Fixture.config.NETWORK_ID,
    );
    expect(l1Resolution).to.exist;
    expect(l1Resolution.ownerAddress?.toLowerCase()).to.equal(
      owner.toLowerCase(),
    );

    const l2Resolution = domain.getResolution(
      L2Fixture.network,
      L2Fixture.config.NETWORK_ID,
    );
    expect(l2Resolution).to.exist;
    expect(l2Resolution.ownerAddress?.toLowerCase()).to.equal(
      owner.toLowerCase(),
    );
  });

  it('should set records on L1', async () => {
    await L1Fixture.unsRegistry.functions
      .setMany(
        ['crypto.ETH.address'],
        ['0x829BD824B016326A401d083B33D092293333A830'],
        uns.tokenId,
      )
      .then((receipt) => receipt.wait());

    await L1Fixture.networkHelper.mineBlocksForConfirmation();
    await L2Fixture.networkHelper.mineBlocksForConfirmation();

    await L1Fixture.service.run();
    await L2Fixture.service.run();

    const domain = await Domain.findOneOrFail({
      where: { name: uns.name },
      relations: ['resolutions'],
    });
    const resolution = domain?.getResolution(
      L1Fixture.network,
      L1Fixture.config.NETWORK_ID,
    );
    expect(resolution.resolution).to.deep.equal({
      'crypto.ETH.address': '0x829BD824B016326A401d083B33D092293333A830',
    });
    const resolutionL2 = domain?.getResolution(
      L2Fixture.network,
      L2Fixture.config.NETWORK_ID,
    );
    expect(resolutionL2.resolution).to.be.empty;
  });

  it('should set records on L2', async () => {
    await L2Fixture.unsRegistry.functions
      .setMany(
        ['crypto.ETH.address'],
        ['0x829BD824B016326A401d083B33D092293333A830'],
        uns.tokenId,
      )
      .then((receipt) => receipt.wait());

    await L1Fixture.networkHelper.mineBlocksForConfirmation();
    await L2Fixture.networkHelper.mineBlocksForConfirmation();

    await L1Fixture.service.run();
    await L2Fixture.service.run();

    const domain = await Domain.findOneOrFail({
      where: { name: uns.name },
      relations: ['resolutions'],
    });
    const resolution = domain?.getResolution(
      L1Fixture.network,
      L1Fixture.config.NETWORK_ID,
    );
    expect(resolution.resolution).to.be.empty;

    const resolutionL2 = domain?.getResolution(
      L2Fixture.network,
      L2Fixture.config.NETWORK_ID,
    );
    expect(resolutionL2.resolution).to.deep.equal({
      'crypto.ETH.address': '0x829BD824B016326A401d083B33D092293333A830',
    });
  });

  describe('Handling L2 reorgs', () => {
    type DomainBlockInfo = {
      blockNumber: number;
      blockHash: string;
      txId: string;
      domain: NSConfig;
    };

    async function mintDomain(
      fixture: LayerTestFixture,
      domain: NSConfig,
    ): Promise<DomainBlockInfo> {
      const tx = await fixture.mintingManager.functions
        .mintSLD(owner, domain.tldHash, domain.label)
        .then((receipt) => {
          return receipt.wait();
        });
      return {
        blockNumber: tx.blockNumber,
        blockHash: tx.blockHash,
        txId: tx.transactionHash,
        domain,
      };
    }

    let oldBlock: Block;
    let domain1: NSConfig;
    let domain2: NSConfig;
    let domain3: NSConfig;
    let domain4: NSConfig;
    let domainAt10: DomainBlockInfo;
    let domainAt20: DomainBlockInfo;
    let recipient: string;

    beforeEach(async () => {
      domain1 = getNSConfig('blockchain');
      domain2 = getNSConfig('blockchain');
      domain3 = getNSConfig('blockchain');
      domain4 = getNSConfig('blockchain');
      recipient = L2Fixture.networkHelper.getAccount('9').address;

      // L1
      await L1Fixture.networkHelper.startNetwork();
      await L1Fixture.networkHelper.resetNetwork();

      await L1Fixture.networkHelper.mineBlocksForConfirmation(10);
      await mintDomain(L1Fixture, domain1);

      await L1Fixture.networkHelper.mineBlocksForConfirmation(10);
      await mintDomain(L1Fixture, domain2);

      await L1Fixture.networkHelper.mineBlocksForConfirmation(20);

      // L2
      await L2Fixture.networkHelper.startNetwork();
      await L2Fixture.networkHelper.resetNetwork();

      await L2Fixture.networkHelper.mineBlocksForConfirmation(10);
      domainAt10 = await mintDomain(L2Fixture, domain1);

      await L2Fixture.networkHelper.mineBlocksForConfirmation(10);
      domainAt20 = await mintDomain(L2Fixture, domain2);

      await L2Fixture.networkHelper.mineBlocksForConfirmation(20);

      oldBlock = await L2Fixture.provider.getBlock(
        (await getLatestNetworkBlock(L2Fixture.provider)) -
          L2Fixture.config.CONFIRMATION_BLOCKS,
      );

      await L1Fixture.service.run();
      await L2Fixture.service.run();
    });

    afterEach(() => {
      sinon.restore();
    });

    it('should fix a reorg on L2', async () => {
      await WorkerStatus.saveWorkerStatus(
        Blockchain.MATIC,
        oldBlock.number + 20,
        '0xdead',
      );
      const eventAt40 = new CnsRegistryEvent({
        contractAddress: L2Fixture.unsRegistry.address,
        type: 'Transfer',
        blockNumber: oldBlock.number,
        blockHash: '0xdead2',
        blockchain: L2Fixture.network,
        networkId: L2Fixture.config.NETWORK_ID,
        returnValues: { tokenId: domainAt20.domain.tokenId.toHexString() },
      });
      await eventAt40.save();
      const changedDomain = await Domain.findByNode(
        domainAt20.domain.tokenId.toHexString(),
      );
      if (changedDomain) {
        changedDomain.resolutions[0].ownerAddress =
          '0x000000000000000000000000000000000000dead';
        await changedDomain.save();
      }

      const expectedTx = await L2Fixture.unsRegistry.functions
        .transferFrom(owner, recipient, domainAt20.domain.tokenId)
        .then((receipt) => {
          return receipt.wait();
        });
      await L2Fixture.networkHelper.mineBlocksForConfirmation(20);
      const newBlock = await L2Fixture.provider.getBlock(
        (await getLatestNetworkBlock(L2Fixture.provider)) -
          L2Fixture.config.CONFIRMATION_BLOCKS,
      );

      const deleteSpy = sinon.spy(CnsRegistryEvent, 'cleanUpEvents');

      await L2Fixture.service.run();

      expect(deleteSpy).to.be.calledOnceWith(
        domainAt20.blockNumber,
        L2Fixture.network,
        L2Fixture.config.NETWORK_ID,
        sinon.match.any,
      ); // delete all events starting from the last matching

      const workerStatus = await WorkerStatus.findOne({
        location: L2Fixture.network,
      });
      expect(workerStatus).to.exist;
      expect(workerStatus?.lastMirroredBlockNumber).to.eq(newBlock.number);
      expect(workerStatus?.lastMirroredBlockHash).to.eq(newBlock.hash);

      const actualEvents = await CnsRegistryEvent.find({
        blockNumber: expectedTx.blockNumber,
        blockchain: L2Fixture.network,
        networkId: L2Fixture.config.NETWORK_ID,
      });
      expect(actualEvents).to.not.be.empty;
      for (const event of actualEvents) {
        expect(event.blockHash).to.equal(expectedTx.blockHash);
      }

      const actualDomain = await Domain.findByNode(
        domainAt20.domain.tokenId.toHexString(),
      );
      const resolution = actualDomain?.getResolution(
        L2Fixture.network,
        L2Fixture.config.NETWORK_ID,
      );
      expect(resolution?.ownerAddress?.toLowerCase()).to.eq(
        recipient.toLowerCase(),
      );
    });
  });
});
