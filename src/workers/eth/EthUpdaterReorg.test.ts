import { BigNumber, Contract } from 'ethers';
import { randomBytes } from 'crypto';
import { CnsRegistryEvent, Domain, WorkerStatus } from '../../models';
import { EthereumProvider } from '../EthereumProvider';
import { EthereumTestsHelper } from '../../utils/testing/EthereumTestsHelper';
import { EthUpdater } from './EthUpdater';
import * as sinon from 'sinon';
import { expect } from 'chai';
import { eip137Namehash } from '../../utils/namehash';
import { ETHContracts } from '../../contracts';
import { Block } from '@ethersproject/abstract-provider';
import DomainsResolution from '../../models/DomainsResolution';
import { env } from '../../env';

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

describe('EthUpdater handles reorgs', () => {
  let service: EthUpdater;
  let unsRegistry: Contract;
  let mintingManager: Contract;
  let owner: string;
  let recipient: string;
  const sinonSandbox = sinon.createSandbox();
  const ethNetworkId = env.APPLICATION.ETHEREUM.NETWORK_ID;

  type DomainBlockInfo = {
    blockNumber: number;
    blockHash: string;
    txId: string;
    domain: NSConfig;
  };

  let domainAt10: DomainBlockInfo;
  let domainAt20: DomainBlockInfo;
  let oldBlock: Block;

  const mintDomain = async function (): Promise<DomainBlockInfo> {
    const domain = getNSConfig('blockchain');
    const tx = await mintingManager.functions
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
  };

  before(async () => {
    await EthereumTestsHelper.startNetwork();
    await EthereumTestsHelper.resetNetwork();
    owner = EthereumTestsHelper.owner().address;
    recipient = EthereumTestsHelper.getAccount('9').address;
    mintingManager = ETHContracts.MintingManager.getContract().connect(
      EthereumTestsHelper.minter(),
    );
    unsRegistry = ETHContracts.UNSRegistry.getContract().connect(
      EthereumTestsHelper.owner(),
    );
  });

  // Reorgs are simulated by changing worker db records.
  // The following notation is used to describe blockchain timelines:
  //    0--------> - timeline
  //    nb - n empty blocks (e.g. 10b)
  //    dn - nth minted domain event (e.g. d1, d2)
  //    x - reorg start
  // Note: block numbers are not exact since there are always some extra blocks in the blockchain (e.g. contract deployment).

  // Starting timeline:
  // 0----10b----d1----10b----d2----100b---->
  beforeEach(async () => {
    await EthereumTestsHelper.startNetwork();
    await EthereumTestsHelper.resetNetwork();

    await EthereumTestsHelper.mineBlocksForConfirmation(10);
    domainAt10 = await mintDomain();

    await EthereumTestsHelper.mineBlocksForConfirmation(10);
    domainAt20 = await mintDomain();

    await EthereumTestsHelper.mineBlocksForConfirmation(100);
    oldBlock = await EthereumProvider.getBlock(
      await EthUpdater.getLatestNetworkBlock(),
    );

    service = new EthUpdater();
    await service.run();
  });

  afterEach(() => {
    sinonSandbox.restore();
  });

  // Worker timeline:
  // 0----10b----d1----10b----d2----100b---->
  // Reorg timeline:
  // 0----10b----d1----10b----d2----100b----x->
  it('should fix a reorg', async () => {
    await WorkerStatus.saveWorkerStatus('ETH', oldBlock.number, 'incorrect');

    await service.run();

    const workerStatus = await WorkerStatus.findOne({ location: 'ETH' });
    expect(workerStatus).to.exist;
    expect(workerStatus?.lastMirroredBlockNumber).to.eq(oldBlock.number);
    expect(workerStatus?.lastMirroredBlockHash).to.eq(oldBlock.hash);
  });

  // Worker timeline:
  // 0----10b----d1----10b----d2----50b---->
  // Reorg timeline:
  // 0----10b----d1----10b----d2----50b----x----50b---->
  it('should fix a longer reorg', async () => {
    await WorkerStatus.saveWorkerStatus(
      'ETH',
      oldBlock.number - 50,
      'incorrect',
    );

    await service.run();

    const workerStatus = await WorkerStatus.findOne({ location: 'ETH' });
    expect(workerStatus).to.exist;
    expect(workerStatus?.lastMirroredBlockNumber).to.eq(oldBlock.number);
    expect(workerStatus?.lastMirroredBlockHash).to.eq(oldBlock.hash);
  });

  // Worker timeline:
  // 0----10b----d1----10b----d2----100b----100b---->
  // Reorg timeline:
  // 0----10b----d1----10b----d2----100b----x->
  it('should fix a shorter reorg', async () => {
    await WorkerStatus.saveWorkerStatus(
      'ETH',
      oldBlock.number + 100,
      'incorrect',
    );

    await service.run();

    const workerStatus = await WorkerStatus.findOne({ location: 'ETH' });
    expect(workerStatus).to.exist;
    expect(workerStatus?.lastMirroredBlockNumber).to.eq(oldBlock.number);
    expect(workerStatus?.lastMirroredBlockHash).to.eq(oldBlock.hash);
  });

  // Worker timeline:
  // 0----10b----d1----10b---------d2----100b---->
  // Reorg timeline:
  // 0----10b----d1----10b----x----d2----100b---->
  it('should fix a reorg with old events', async () => {
    // todo remove
    await WorkerStatus.saveWorkerStatus('ETH', oldBlock.number, '0xdead');
    const reorgEvents = await CnsRegistryEvent.find({
      blockNumber: domainAt20.blockNumber,
    });
    for (let index = 0; index < reorgEvents.length; index++) {
      const event = reorgEvents[index];
      event.blockHash = '0xdead2';
      event.logIndex = index + 100; // to bypass `logIndexForBlockIncreases` constraint
      await event.save();
    }
    const deleteSpy = sinonSandbox.spy(CnsRegistryEvent, 'cleanUpEvents');

    await service.run();

    expect(deleteSpy).to.be.calledOnceWith(domainAt10.blockNumber); // delete all events starting from the last matching

    const workerStatus = await WorkerStatus.findOne({ location: 'ETH' });
    expect(workerStatus).to.exist;
    expect(workerStatus?.lastMirroredBlockNumber).to.eq(oldBlock.number);
    expect(workerStatus?.lastMirroredBlockHash).to.eq(oldBlock.hash);

    const actualEvents = await CnsRegistryEvent.find({
      blockNumber: domainAt20.blockNumber,
    });
    for (const event of actualEvents) {
      expect(event.blockHash).to.equal(domainAt20.blockHash);
    }
  });

  // Worker timeline:
  // 0----10b----d1----10b---------d2----100b---->
  // Reorg timeline:
  // 0----10b----d1----10b----x----d2----100b----d3----20b---->
  it('should fix a reorg with new events', async () => {
    const domainAt120 = await mintDomain();
    await EthereumTestsHelper.mineBlocksForConfirmation(20);
    const newBlock = await EthereumProvider.getBlock(
      await EthUpdater.getLatestNetworkBlock(),
    );
    await WorkerStatus.saveWorkerStatus('ETH', oldBlock.number, '0xdead');
    const reorgEvents = await CnsRegistryEvent.find({
      blockNumber: domainAt20.blockNumber,
    });
    for (let index = 0; index < reorgEvents.length; index++) {
      const event = reorgEvents[index];
      event.blockHash = '0xdead2';
      event.logIndex = index + 200; // to bypass `logIndexForBlockIncreases` constraint
      await event.save();
    }
    const deleteSpy = sinonSandbox.spy(CnsRegistryEvent, 'cleanUpEvents');

    await service.run();

    expect(deleteSpy).to.be.calledOnceWith(domainAt10.blockNumber); // delete all events starting from the last matching

    const workerStatus = await WorkerStatus.findOne({ location: 'ETH' });
    expect(workerStatus).to.exist;
    expect(workerStatus?.lastMirroredBlockNumber).to.eq(newBlock.number);
    expect(workerStatus?.lastMirroredBlockHash).to.eq(newBlock.hash);

    let actualEvents = await CnsRegistryEvent.find({
      blockNumber: domainAt20.blockNumber,
    });
    for (const event of actualEvents) {
      expect(event.blockHash).to.equal(domainAt20.blockHash);
    }

    actualEvents = await CnsRegistryEvent.find({
      blockNumber: domainAt120.blockNumber,
    });
    for (const event of actualEvents) {
      expect(event.blockHash).to.equal(domainAt120.blockHash);
    }
  });

  // Worker timeline:
  // 0----10b----d1----10b----d2----100b---------d3----20b---->
  // Reorg timeline:
  // 0----10b----d1----10b----d2----100b----x->
  it('should fix a reorg and revert domain changes', async () => {
    await WorkerStatus.saveWorkerStatus('ETH', oldBlock.number + 20, '0xdead');
    const eventAt120 = new CnsRegistryEvent({
      contractAddress: unsRegistry.address,
      type: 'Transfer',
      blockNumber: oldBlock.number,
      blockHash: '0xdead2',
      blockchain: 'ETH',
      networkId: 1337,
      returnValues: { tokenId: domainAt20.domain.tokenId.toHexString() },
    });
    await eventAt120.save();
    const changedDomain = await Domain.findByNode(
      domainAt20.domain.tokenId.toHexString(),
    );
    if (changedDomain) {
      changedDomain.resolutions = [
        new DomainsResolution({
          ownerAddress: '0x000000000000000000000000000000000000dead',
          location: 'CNS',
          blockchain: 'ETH',
          networkId: ethNetworkId,
        }),
      ];
      await changedDomain.save();
    }

    const deleteSpy = sinonSandbox.spy(CnsRegistryEvent, 'cleanUpEvents');

    await service.run();

    expect(deleteSpy).to.be.calledOnceWith(domainAt20.blockNumber); // delete all events starting from the last matching

    const workerStatus = await WorkerStatus.findOne({ location: 'ETH' });
    expect(workerStatus).to.exist;
    expect(workerStatus?.lastMirroredBlockNumber).to.eq(oldBlock.number);
    expect(workerStatus?.lastMirroredBlockHash).to.eq(oldBlock.hash);

    const actualEvents = await CnsRegistryEvent.find({
      blockNumber: eventAt120.blockNumber,
    });
    expect(actualEvents).to.be.empty;

    const actualDomain = await Domain.findByNode(
      domainAt20.domain.tokenId.toHexString(),
    );
    const resolution = actualDomain?.getResolution('ETH', ethNetworkId);
    expect(resolution?.ownerAddress?.toLowerCase()).to.eq(owner.toLowerCase());
  });

  // Worker timeline:
  // 0----10b----d1----10b----d2----100b---------d3----20b---->
  // Reorg timeline:
  // 0----10b----d1----10b----d2----100b----x----d4----20b---->
  it('should fix a reorg and update domains', async () => {
    await WorkerStatus.saveWorkerStatus('ETH', oldBlock.number + 20, '0xdead');
    const eventAt120 = new CnsRegistryEvent({
      contractAddress: unsRegistry.address,
      type: 'Transfer',
      blockNumber: oldBlock.number,
      blockHash: '0xdead2',
      blockchain: 'ETH',
      networkId: 1337,
      returnValues: { tokenId: domainAt20.domain.tokenId.toHexString() },
    });
    await eventAt120.save();
    const changedDomain = await Domain.findByNode(
      domainAt20.domain.tokenId.toHexString(),
    );
    if (changedDomain) {
      changedDomain.resolutions = [
        new DomainsResolution({
          ownerAddress: '0x000000000000000000000000000000000000dead',
          location: 'CNS',
          blockchain: 'ETH',
          networkId: ethNetworkId,
        }),
      ];
      await changedDomain.save();
    }

    const expectedTx = await unsRegistry.functions
      .transferFrom(owner, recipient, domainAt20.domain.tokenId)
      .then((receipt) => {
        return receipt.wait();
      });
    await EthereumTestsHelper.mineBlocksForConfirmation(20);
    const newBlock = await EthereumProvider.getBlock(
      await EthUpdater.getLatestNetworkBlock(),
    );

    const deleteSpy = sinonSandbox.spy(CnsRegistryEvent, 'cleanUpEvents');

    await service.run();

    expect(deleteSpy).to.be.calledOnceWith(domainAt20.blockNumber); // delete all events starting from the last matching

    const workerStatus = await WorkerStatus.findOne({ location: 'ETH' });
    expect(workerStatus).to.exist;
    expect(workerStatus?.lastMirroredBlockNumber).to.eq(newBlock.number);
    expect(workerStatus?.lastMirroredBlockHash).to.eq(newBlock.hash);

    const actualEvents = await CnsRegistryEvent.find({
      blockNumber: expectedTx.blockNumber,
    });
    expect(actualEvents).to.not.be.empty;
    for (const event of actualEvents) {
      expect(event.blockHash).to.equal(expectedTx.blockHash);
    }

    const actualDomain = await Domain.findByNode(
      domainAt20.domain.tokenId.toHexString(),
    );
    const resolution = actualDomain?.getResolution('ETH', ethNetworkId);
    expect(resolution?.ownerAddress?.toLowerCase()).to.eq(
      recipient.toLowerCase(),
    );
  });
});
