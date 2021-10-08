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
import { ETHContracts } from '../../contracts';
import * as ethersUtils from '../../utils/ethersUtils';

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
  let unsRegistry: Contract;
  let cnsRegistry: Contract;
  let resolver: Contract;
  let mintingManager: Contract;
  let whitelistedMinter: Contract;
  let owner: string;
  let uns: NSConfig;
  let cns: NSConfig;

  before(async () => {
    await EthereumTestsHelper.startNetwork();
    await EthereumTestsHelper.resetNetwork();
    owner = EthereumTestsHelper.owner().address;
    unsRegistry = ETHContracts.UNSRegistry.getContract().connect(
      EthereumTestsHelper.owner(),
    );
    cnsRegistry = ETHContracts.CNSRegistry.getContract().connect(
      EthereumTestsHelper.owner(),
    );
    resolver = ETHContracts.Resolver.getContract().connect(
      EthereumTestsHelper.owner(),
    );
    mintingManager = ETHContracts.MintingManager.getContract().connect(
      EthereumTestsHelper.minter(),
    );
    whitelistedMinter = ETHContracts.WhitelistedMinter.getContract().connect(
      EthereumTestsHelper.minter(),
    );
  });

  after(async () => {
    await EthereumTestsHelper.stopNetwork();
  });

  beforeEach(async () => {
    const block = await EthereumProvider.getBlock('latest');
    sinon
      .stub(env.APPLICATION.ETHEREUM, 'UNS_REGISTRY_EVENTS_STARTING_BLOCK')
      .value(block.number);
    uns = getNSConfig('blockchain');
    cns = getNSConfig('crypto');
    await WorkerStatus.saveWorkerStatus('ETH', block.number, block.hash);

    await mintingManager.functions
      .mintSLD(owner, uns.tldHash, uns.label)
      .then((receipt) => receipt.wait());

    await whitelistedMinter.functions
      .mintSLDToDefaultResolver(owner, cns.label, [], [])
      .then((receipt) => receipt.wait());

    service = new EthUpdater();
  });

  it('should save worker stats', async () => {
    // test domain is created in beforeEach hook
    await EthereumTestsHelper.mineBlocksForConfirmation();

    await service.run();

    const workerStatus = await WorkerStatus.findOne({ location: 'ETH' });
    const netBlockNumber = await ethersUtils.getLatestNetworkBlock();
    const expectedBlock = await EthereumProvider.getBlock(
      netBlockNumber - env.APPLICATION.ETHEREUM.CONFIRMATION_BLOCKS,
    );
    expect(workerStatus).to.exist;
    expect(workerStatus?.lastMirroredBlockNumber).to.eq(expectedBlock.number);
    expect(workerStatus?.lastMirroredBlockHash).to.eq(expectedBlock.hash);
  });

  describe('basic events', () => {
    it('processes a NewUri event', async () => {
      // test domain is created in beforeEach hook
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOne({ name: uns.name });
      expect(domain).to.not.be.undefined;

      expect(await CnsRegistryEvent.groupCount('type')).to.deep.equal({
        NewURI: 2,
        Resolve: 1,
        Transfer: 2,
      });
    });

    it('processes a cns Transfer event', async () => {
      const recipient = await EthereumTestsHelper.createAccount();
      const recipientAddress = await recipient.getAddress();

      await cnsRegistry.functions
        .transferFrom(owner, recipientAddress, cns.tokenId)
        .then((receipt) => receipt.wait());

      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOne({ name: cns.name });
      const resolution = domain?.getResolution(
        service.blockchain,
        service.networkId,
      );
      expect(domain).to.not.be.undefined;
      expect(resolution?.ownerAddress).to.be.equal(
        recipientAddress.toLowerCase(),
      );

      expect(await CnsRegistryEvent.groupCount('type')).to.deep.equal({
        NewURI: 2,
        Resolve: 1,
        Transfer: 3,
      });
    });

    it('processes a uns Transfer event', async () => {
      const recipient = await EthereumTestsHelper.createAccount();
      const recipientAddress = await recipient.getAddress();

      await unsRegistry.functions
        .transferFrom(owner, recipientAddress, uns.tokenId)
        .then((receipt) => receipt.wait());

      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOne({ name: uns.name });
      const resolution = domain?.getResolution(
        service.blockchain,
        service.networkId,
      );
      expect(domain).to.not.be.undefined;
      expect(resolution?.ownerAddress).to.be.equal(
        recipientAddress.toLowerCase(),
      );

      expect(await CnsRegistryEvent.groupCount('type')).to.deep.equal({
        Approval: 1,
        NewURI: 2,
        ResetRecords: 1,
        Transfer: 3,
        Resolve: 1,
      });
    });

    it('processes cns Set events', async () => {
      await cnsRegistry.functions
        .resolveTo(resolver.address, cns.tokenId)
        .then((receipt) => receipt.wait());
      await resolver.functions
        .setMany(
          ['crypto.BTC.address'],
          ['qp3gu0flg7tehyv73ua5nznlw8s040nz3uqnyffrcn'],
          cns.tokenId,
        )
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOne({ name: cns.name });
      const resolution = domain?.getResolution(
        service.blockchain,
        service.networkId,
      );
      expect(domain).to.containSubset({
        name: cns.name,
        location: 'CNS',
      });
      expect(resolution).to.containSubset({
        resolver: resolver.address.toLowerCase(),
        resolution: {
          'crypto.BTC.address': 'qp3gu0flg7tehyv73ua5nznlw8s040nz3uqnyffrcn',
        },
      });

      expect(await CnsRegistryEvent.groupCount('type')).to.deep.equal({
        NewURI: 2,
        Resolve: 2,
        Sync: 1,
        Transfer: 2,
      });
    });

    it('processes uns Set events', async () => {
      await unsRegistry.functions
        .setMany(
          ['crypto.BTC.address'],
          ['qp3gu0flg7tehyv73ua5nznlw8s040nz3uqnyffrcn'],
          uns.tokenId,
        )
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOne({ name: uns.name });
      const resolution = domain?.getResolution(
        service.blockchain,
        service.networkId,
      );
      expect(domain).to.containSubset({
        name: uns.name,
        location: 'UNSL1',
      });
      expect(resolution).to.containSubset({
        resolver: unsRegistry.address.toLowerCase(),
        ownerAddress: owner.toLowerCase(),
        resolution: {
          'crypto.BTC.address': 'qp3gu0flg7tehyv73ua5nznlw8s040nz3uqnyffrcn',
        },
      });

      expect(await CnsRegistryEvent.groupCount('type')).to.deep.equal({
        NewURI: 2,
        Set: 1,
        Resolve: 1,
        Transfer: 2,
      });
    });

    it('processes a cns Burn event', async () => {
      await resolver.functions
        .setMany(
          ['crypto.BTC.address'],
          ['qp3gu0flg7tehyv73ua5nznlw8s040nz3uqnyffrcn'],
          cns.tokenId,
        )
        .then((receipt) => receipt.wait());

      await cnsRegistry.functions
        .burn(cns.tokenId)
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();
      const domain = await Domain.findOne({ name: cns.name });
      const resolution = domain?.getResolution(
        service.blockchain,
        service.networkId,
      );
      expect(domain).to.containSubset({
        name: cns.name,
      });
      expect(resolution).to.containSubset({
        resolution: {},
        resolver: null,
        ownerAddress: null,
      });

      expect(await CnsRegistryEvent.groupCount('type')).to.deep.equal({
        NewURI: 2,
        Transfer: 3,
        Resolve: 1,
        Sync: 1,
      });
    });

    it('processes a uns Burn event', async () => {
      await unsRegistry.functions
        .setMany(
          ['crypto.BTC.address'],
          ['qp3gu0flg7tehyv73ua5nznlw8s040nz3uqnyffrcn'],
          uns.tokenId,
        )
        .then((receipt) => receipt.wait());

      await unsRegistry.functions
        .burn(uns.tokenId)
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();
      const domain = await Domain.findOne({ name: uns.name });
      const resolution = domain?.getResolution(
        service.blockchain,
        service.networkId,
      );
      expect(domain).to.containSubset({
        name: uns.name,
      });
      expect(resolution).to.containSubset({
        resolution: {},
        resolver: null,
        ownerAddress: null,
      });

      expect(await CnsRegistryEvent.groupCount('type')).to.deep.equal({
        Approval: 1,
        NewURI: 2,
        ResetRecords: 1,
        Transfer: 3,
        Resolve: 1,
        Set: 1,
      });
    });

    it('processes an approve event', async () => {
      const recipient = await EthereumTestsHelper.createAccount();
      const recipientAddress = await recipient.getAddress();

      await unsRegistry.functions
        .approve(recipientAddress, uns.tokenId)
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      expect(await CnsRegistryEvent.groupCount('type')).to.deep.equal({
        Approval: 1,
        NewURI: 2,
        Resolve: 1,
        Transfer: 2,
      });
    });
  });

  describe('add new domain', () => {
    it('should add new cns domain', async () => {
      const expectedLabel = randomBytes(16).toString('hex');

      const expectedDomainName = `${expectedLabel}.${cns.tld}`;
      await whitelistedMinter.functions
        .mintSLDToDefaultResolver(owner, expectedLabel, [], [])
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOneOrFail({ name: expectedDomainName });
      expect(domain.label).to.equal(expectedLabel);
    });

    it('should add new uns domain', async () => {
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

    it('should not add cns domain with capital letters', async () => {
      const expectedLabel = `${randomBytes(16).toString('hex')}-AAA`;
      const expectedDomainName = `${expectedLabel}.${cns.tld}`;
      await whitelistedMinter.functions
        .mintSLDToDefaultResolver(owner, expectedLabel, [], [])
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOne({ name: expectedDomainName });
      expect(domain).to.be.undefined;
    });

    it('should not add uns domain with capital letters', async () => {
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

    it('should not add cns domain with spaces', async () => {
      const expectedLabel = `    ${randomBytes(16).toString('hex')}   `;
      const expectedDomainName = `${expectedLabel}.${cns.tld}`;
      await whitelistedMinter.functions
        .mintSLDToDefaultResolver(owner, expectedDomainName, [], [])
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOne({ name: expectedDomainName });
      expect(domain).to.be.undefined;
    });

    it('should not add uns domain with spaces', async () => {
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
    it('should reset cns records if Sync event with zero updateId received', async () => {
      await resolver.functions
        .set('hello', 'world', cns.tokenId)
        .then((receipt) => receipt.wait());

      await resolver.functions
        .reset(cns.tokenId)
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOrCreateByName(cns.name);
      const resolution = domain?.getResolution(
        service.blockchain,
        service.networkId,
      );
      expect(resolution.resolution).to.be.empty;
    });

    it('should reset uns records if Sync event with zero updateId received', async () => {
      await unsRegistry.functions
        .set('hello', 'world', uns.tokenId)
        .then((receipt) => receipt.wait());

      await unsRegistry.functions
        .reset(uns.tokenId)
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOrCreateByName(uns.name);
      const resolution = domain?.getResolution(
        service.blockchain,
        service.networkId,
      );
      expect(resolution.resolution).to.be.empty;
    });

    it('should get all cns domain records when domain was sent via setOwner method', async () => {
      const account = await EthereumTestsHelper.createAccount();
      await resolver.functions
        .reconfigure(
          ['crypto.ETH.address'],
          ['0x829BD824B016326A401d083B33D092293333A830'],
          cns.tokenId,
        )
        .then((receipt) => receipt.wait());
      await cnsRegistry.functions
        .setOwner(account.address, cns.tokenId)
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOrCreateByName(cns.name);
      const resolution = domain?.getResolution(
        service.blockchain,
        service.networkId,
      );
      expect(resolution.resolution).to.deep.equal({
        'crypto.ETH.address': '0x829BD824B016326A401d083B33D092293333A830',
      });
    });

    it('should get all uns domain records when domain was sent via setOwner method', async () => {
      const account = await EthereumTestsHelper.createAccount();
      await unsRegistry.functions
        .set(
          'crypto.ETH.address',
          '0x829BD824B016326A401d083B33D092293333A830',
          uns.tokenId,
        )
        .then((receipt) => receipt.wait());
      await unsRegistry.functions
        .setOwner(account.address, uns.tokenId)
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOrCreateByName(uns.name);
      const resolution = domain?.getResolution(
        service.blockchain,
        service.networkId,
      );
      expect(resolution.resolution).to.deep.equal({
        'crypto.ETH.address': '0x829BD824B016326A401d083B33D092293333A830',
      });
    });
  });

  describe('custom domain records', () => {
    it('should add custom key on Sync event', async () => {
      await resolver.functions
        .set('custom-key', 'value', cns.tokenId)
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOrCreateByName(cns.name);
      const resolution = domain?.getResolution(
        service.blockchain,
        service.networkId,
      );
      expect(resolution.resolution).to.deep.equal({ 'custom-key': 'value' });
    });

    it('should add custom and default key on Sync event', async () => {
      await resolver.functions
        .setMany(
          ['custom-key', 'crypto.ETH.address'],
          ['value', '0x461781022A9C2De74f2171EB3c44F27320b13B8c'],
          cns.tokenId,
        )
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOrCreateByName(cns.name);
      const resolution = domain?.getResolution(
        service.blockchain,
        service.networkId,
      );
      expect(resolution.resolution).to.deep.equal({
        'crypto.ETH.address': '0x461781022A9C2De74f2171EB3c44F27320b13B8c',
        'custom-key': 'value',
      });
    });

    it('should add default key on Sync event', async () => {
      await cnsRegistry.functions
        .resolveTo(resolver.address, cns.tokenId)
        .then((receipt) => receipt.wait());
      await resolver.functions
        .setMany(
          ['custom-key', 'crypto.ETH.address'],
          ['value', '0x461781022A9C2De74f2171EB3c44F27320b13B8c'],
          cns.tokenId,
        )
        .then((receipt) => receipt.wait());

      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOrCreateByName(cns.name);
      const resolution = domain?.getResolution(
        service.blockchain,
        service.networkId,
      );
      expect(resolution.resolution).to.deep.equal({
        'crypto.ETH.address': '0x461781022A9C2De74f2171EB3c44F27320b13B8c',
        'custom-key': 'value',
      });
    });
  });
});
