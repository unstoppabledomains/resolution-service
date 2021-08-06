import { BigNumber, Contract } from 'ethers';
import { randomBytes } from 'crypto';
import { env } from '../../env';
import { CnsRegistryEvent, Domain, WorkerStatus } from '../../models';
import { EthereumProvider } from '../EthereumProvider';
import { EthereumTestsHelper } from '../../utils/testing/EthereumTestsHelper';
import { EthUpdater } from './EthUpdater';
import * as sinon from 'sinon';
import { expect } from 'chai';
import { eip137Namehash } from '../../utils/namehash';
import { EthUpdaterError } from '../../errors/EthUpdaterError';
import { ETHContracts } from '../../contracts';

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

describe('EthUpdater', () => {
  let service: EthUpdater;
  let registry: Contract;
  let resolver: Contract;
  let mintingManager: Contract;
  let owner: string;
  let uns: NSConfig;
  let cns: NSConfig;

  before(async () => {
    await EthereumTestsHelper.startNetwork();
    owner = EthereumTestsHelper.owner().address;
    registry = ETHContracts.UNSRegistry.getContract().connect(
      EthereumTestsHelper.owner(),
    );
    resolver = ETHContracts.UNSRegistry.getContract().connect(
      EthereumTestsHelper.owner(),
    );
    mintingManager = ETHContracts.MintingManager.getContract().connect(
      EthereumTestsHelper.minter(),
    );
  });

  beforeEach(async () => {
    const blocknumber = await EthereumProvider.getBlockNumber();
    sinon
      .stub(env.APPLICATION.ETHEREUM, 'UNS_REGISTRY_EVENTS_STARTING_BLOCK')
      .value(blocknumber);
    uns = getNSConfig('blockchain');
    cns = getNSConfig('crypto');
    await WorkerStatus.saveWorkerStatus('ETH', blocknumber);

    await mintingManager.functions
      .mintSLD(owner, uns.tldHash, uns.label)
      .then((receipt) => receipt.wait());

    service = new EthUpdater();
  });

  it('should throw if sync block is less than mirrored block', async () => {
    await WorkerStatus.saveWorkerStatus(
      'ETH',
      (await EthereumProvider.getBlockNumber()) + 10,
    );
    expect(service.run()).to.be.rejectedWith(EthUpdaterError);
  });

  it('should save worker stats', async () => {
    // test domain is created in beforeEach hook
    await EthereumTestsHelper.mineBlocksForConfirmation();

    await service.run();

    const workerStatus = await WorkerStatus.findOne({ location: 'ETH' });
    const expectedBlockNumber =
      (await EthereumProvider.getBlockNumber()) -
      env.APPLICATION.ETHEREUM.CONFIRMATION_BLOCKS;
    expect(workerStatus).to.exist;
    expect(workerStatus?.lastMirroredBlockNumber).to.eq(expectedBlockNumber);
  });

  describe('basic events', () => {
    it('processes a NewUri event', async () => {
      // test domain is created in beforeEach hook
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOne({ name: uns.name });
      expect(domain).to.not.be.undefined;

      expect(await CnsRegistryEvent.groupCount('type')).to.deep.equal({
        NewURI: 1,
        Transfer: 1,
      });
    });

    it('processes a Transfer event', async () => {
      const recipient = await EthereumTestsHelper.createAccount();
      const recipientAddress = await recipient.getAddress();

      await registry.functions
        .transferFrom(owner, recipientAddress, uns.tokenId)
        .then((receipt) => receipt.wait());

      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOne({ name: uns.name });
      expect(domain).to.not.be.undefined;
      expect(domain?.ownerAddress).to.be.equal(recipientAddress.toLowerCase());

      expect(await CnsRegistryEvent.groupCount('type')).to.deep.equal({
        Approval: 1,
        NewURI: 1,
        ResetRecords: 1,
        Transfer: 2,
      });
    });

    it('processes set events', async () => {
      await registry.functions
        .setMany(
          ['crypto.BTC.address'],
          ['qp3gu0flg7tehyv73ua5nznlw8s040nz3uqnyffrcn'],
          uns.tokenId,
        )
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOne({ name: uns.name });
      expect(domain).to.containSubset({
        name: uns.name,
        location: 'UNSL1',
        resolver: registry.address.toLowerCase(),
        resolution: {
          'crypto.BTC.address': 'qp3gu0flg7tehyv73ua5nznlw8s040nz3uqnyffrcn',
        },
      });

      expect(await CnsRegistryEvent.groupCount('type')).to.deep.equal({
        NewURI: 1,
        Set: 1,
        Transfer: 1,
      });
    });

    it('processes a burn event', async () => {
      await registry.functions
        .setMany(
          ['crypto.BTC.address'],
          ['qp3gu0flg7tehyv73ua5nznlw8s040nz3uqnyffrcn'],
          uns.tokenId,
        )
        .then((receipt) => receipt.wait());

      await registry.functions
        .burn(uns.tokenId)
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();
      const domain = await Domain.findOne({ name: uns.name });
      expect(domain).to.containSubset({
        name: uns.name,
        resolution: {},
        resolver: null,
        ownerAddress: null,
      });

      expect(await CnsRegistryEvent.groupCount('type')).to.deep.equal({
        Approval: 1,
        NewURI: 1,
        ResetRecords: 1,
        Transfer: 2,
      });
    });

    it('processes an approve event', async () => {
      const recipient = await EthereumTestsHelper.createAccount();
      const recipientAddress = await recipient.getAddress();

      await registry.functions
        .approve(recipientAddress, uns.tokenId)
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      expect(await CnsRegistryEvent.groupCount('type')).to.deep.equal({
        Approval: 1,
        NewURI: 1,
        Transfer: 1,
      });
    });
  });

  describe('add new domain', () => {
    it('should add new domain', async () => {
      const expectedLabel = randomBytes(16).toString('hex');

      const expectedDomainName = `${expectedLabel}.${uns.tld}`;
      await mintingManager.functions
        .mintSLD(owner, uns.tldHash, expectedLabel)
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOneOrFail({ name: expectedDomainName });
      expect(domain.label).to.equal(expectedLabel);
    });

    it('should not add domain with capital letters', async () => {
      const expectedLabel = `${randomBytes(16).toString('hex')}-AAA`;
      const expectedDomainName = `${expectedLabel}.${uns.tld}`;
      await mintingManager.functions
        .mintSLD(owner, uns.tldHash, expectedLabel)
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOne({ name: expectedDomainName });
      expect(domain).to.be.undefined;
    });

    it('should not add domain with spaces', async () => {
      const expectedLabel = `    ${randomBytes(16).toString('hex')}   `;
      const expectedDomainName = `${expectedLabel}.${uns.tld}`;
      await mintingManager.functions
        .mintSLD(owner, uns.tldHash, expectedDomainName)
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOne({ name: expectedDomainName });
      expect(domain).to.be.undefined;
    });
  });

  describe('domain records', () => {
    it('should reset records if Sync event with zero updateId received', async () => {
      await registry.functions
        .set('hello', 'world', uns.tokenId)
        .then((receipt) => receipt.wait());

      await registry.functions
        .reset(uns.tokenId)
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOrCreateByName(uns.name, 'UNSL1');
      expect(domain.resolution).to.be.empty;
    });

    it('should get all domain records when domain was sent via setOwner method', async () => {
      const account = await EthereumTestsHelper.createAccount();
      await registry.functions
        .set(
          'crypto.ETH.address',
          '0x829BD824B016326A401d083B33D092293333A830',
          uns.tokenId,
        )
        .then((receipt) => receipt.wait());
      await registry.functions
        .setOwner(account.address, uns.tokenId)
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOrCreateByName(uns.name, 'UNSL1');
      expect(domain.resolution).to.deep.equal({
        'crypto.ETH.address': '0x829BD824B016326A401d083B33D092293333A830',
      });
    });
  });
});
