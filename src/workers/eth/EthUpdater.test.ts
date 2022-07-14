import { BigNumber, Contract } from 'ethers';
import { randomBytes } from 'crypto';
import { env } from '../../env';
import { CnsRegistryEvent, Domain, WorkerStatus } from '../../models';
import { EthereumProvider } from '../EthereumProvider';
import { EthereumHelper } from '../../utils/testing/EthereumTestsHelper';
import { EthUpdater } from './EthUpdater';
import * as sinon from 'sinon';
import { expect } from 'chai';
import { eip137Namehash } from '../../utils/namehash';
import { ETHContracts } from '../../contracts';
import * as ethersUtils from '../../utils/ethersUtils';
import { Blockchain } from '../../types/common';

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
  let owner: string;
  let uns: NSConfig;
  let cns: NSConfig;

  before(async () => {
    await EthereumHelper.startNetwork();
    await EthereumHelper.resetNetwork();
    owner = EthereumHelper.owner().address;
    unsRegistry = ETHContracts.UNSRegistry.getContract().connect(
      EthereumHelper.owner(),
    );
    cnsRegistry = ETHContracts.CNSRegistry.getContract().connect(
      EthereumHelper.owner(),
    );
    resolver = ETHContracts.Resolver.getContract().connect(
      EthereumHelper.owner(),
    );
    mintingManager = ETHContracts.MintingManager.getContract().connect(
      EthereumHelper.minter(),
    );
  });

  after(async () => {
    await EthereumHelper.stopNetwork();
  });

  beforeEach(async () => {
    const block = await EthereumProvider.getBlock('latest');
    sinon
      .stub(env.APPLICATION.ETHEREUM, 'UNS_REGISTRY_EVENTS_STARTING_BLOCK')
      .value(block.number);
    uns = getNSConfig('blockchain');
    cns = getNSConfig('crypto');
    await WorkerStatus.saveWorkerStatus(
      Blockchain.ETH,
      block.number,
      block.hash,
    );

    await mintingManager.functions
      .mintSLD(owner, uns.tldHash, uns.label)
      .then((receipt) => receipt.wait());

    await mintingManager.functions
      .mintSLD(owner, cns.tldHash, cns.label)
      .then((receipt) => receipt.wait());

    service = new EthUpdater(Blockchain.ETH, env.APPLICATION.ETHEREUM);
  });

  it('should save worker stats', async () => {
    // test domain is created in beforeEach hook
    await EthereumHelper.mineBlocksForConfirmation();

    await service.run();

    const workerStatus = await WorkerStatus.findOne({
      location: Blockchain.ETH,
    });
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
      await EthereumHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOne({
        where: { name: uns.name },
        relations: ['resolutions'],
      });
      expect(domain).to.not.be.undefined;

      expect(await CnsRegistryEvent.groupCount('type')).to.deep.equal({
        NewURI: 2,
        Transfer: 2,
        Resolve: 1,
      });
    });

    it('processes a cns Transfer event', async () => {
      const recipient = await EthereumHelper.createAccount();
      const recipientAddress = await recipient.getAddress();

      await cnsRegistry.functions
        .transferFrom(owner, recipientAddress, cns.tokenId)
        .then((receipt) => receipt.wait());

      await EthereumHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOne({
        where: { name: cns.name },
        relations: ['resolutions'],
      });
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
      const recipient = await EthereumHelper.createAccount();
      const recipientAddress = await recipient.getAddress();

      await unsRegistry.functions
        .transferFrom(owner, recipientAddress, uns.tokenId)
        .then((receipt) => receipt.wait());

      await EthereumHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOne({
        where: { name: uns.name },
        relations: ['resolutions'],
      });
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
      await EthereumHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOne({
        where: { name: cns.name },
        relations: ['resolutions'],
      });
      const resolution = domain?.getResolution(
        service.blockchain,
        service.networkId,
      );
      expect(domain).to.containSubset({
        name: cns.name,
      });

      expect(resolution).to.containSubset({
        blockchain: 'ETH',
        networkId: 1337,
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
      await EthereumHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOne({
        where: { name: uns.name },
        relations: ['resolutions'],
      });
      const resolution = domain?.getResolution(
        service.blockchain,
        service.networkId,
      );
      expect(domain).to.containSubset({
        name: uns.name,
      });
      expect(resolution).to.containSubset({
        blockchain: 'ETH',
        networkId: 1337,
        resolver: unsRegistry.address.toLowerCase(),
        registry: unsRegistry.address.toLowerCase(),
        ownerAddress: owner.toLowerCase(),
        resolution: {
          'crypto.BTC.address': 'qp3gu0flg7tehyv73ua5nznlw8s040nz3uqnyffrcn',
        },
      });

      expect(await CnsRegistryEvent.groupCount('type')).to.deep.equal({
        NewURI: 2,
        Set: 1,
        NewKey: 1,
        Transfer: 2,
        Resolve: 1,
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
      await EthereumHelper.mineBlocksForConfirmation();

      await service.run();
      const domain = await Domain.findOne({
        where: { name: cns.name },
        relations: ['resolutions'],
      });
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
        ownerAddress: Domain.NullAddress,
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
      await EthereumHelper.mineBlocksForConfirmation();

      await service.run();
      const domain = await Domain.findOne({
        where: { name: uns.name },
        relations: ['resolutions'],
      });
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
        ownerAddress: Domain.NullAddress,
      });

      expect(await CnsRegistryEvent.groupCount('type')).to.deep.equal({
        Approval: 1,
        NewURI: 2,
        ResetRecords: 1,
        Transfer: 3,
        Set: 1,
        NewKey: 1,
        Resolve: 1,
      });
    });

    it('processes an approve event', async () => {
      const recipient = await EthereumHelper.createAccount();
      const recipientAddress = await recipient.getAddress();

      await unsRegistry.functions
        .approve(recipientAddress, uns.tokenId)
        .then((receipt) => receipt.wait());
      await EthereumHelper.mineBlocksForConfirmation();

      await service.run();

      expect(await CnsRegistryEvent.groupCount('type')).to.deep.equal({
        Approval: 1,
        NewURI: 2,
        Transfer: 2,
        Resolve: 1,
      });
    });

    it('processes a set reverse event', async () => {
      await unsRegistry.functions
        .setReverse(uns.tokenId)
        .then((receipt) => receipt.wait());
      await EthereumHelper.mineBlocksForConfirmation();

      await service.run();

      expect(await CnsRegistryEvent.groupCount('type')).to.deep.equal({
        SetReverse: 1,
        NewURI: 2,
        Resolve: 1,
        Transfer: 2,
      });
    });

    it('processes a remove reverse event', async () => {
      await unsRegistry.functions
        .setReverse(uns.tokenId)
        .then((receipt) => receipt.wait());
      await EthereumHelper.mineBlocksForConfirmation();
      await service.run();

      await unsRegistry.functions
        .removeReverse()
        .then((receipt) => receipt.wait());
      await EthereumHelper.mineBlocksForConfirmation();

      await service.run();

      expect(await CnsRegistryEvent.groupCount('type')).to.deep.equal({
        SetReverse: 1,
        RemoveReverse: 1,
        NewURI: 2,
        Resolve: 1,
        Transfer: 2,
      });
    });

    it('processes an unknown event', async () => {
      await unsRegistry.functions.set('keyhash-gas', 'value', uns.tokenId); // causes a 'NewKey' event which is not in EventType enum

      await EthereumHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOne({
        where: { name: uns.name },
        relations: ['resolutions'],
      });
      expect(domain).to.not.be.undefined;

      expect(await CnsRegistryEvent.groupCount('type')).to.deep.equal({
        NewURI: 2,
        Set: 1,
        NewKey: 1,
        Transfer: 2,
        Resolve: 1,
      });
    });
  });

  describe('add new domain', () => {
    it('should add new cns domain', async () => {
      const expectedLabel = randomBytes(16).toString('hex');

      const expectedDomainName = `${expectedLabel}.${cns.tld}`;
      await mintingManager.functions
        .mintSLD(owner, cns.tldHash, expectedLabel)
        .then((receipt) => receipt.wait());
      await EthereumHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOneOrFail({
        where: { name: expectedDomainName },
        relations: ['resolutions'],
      });
      expect(domain.label).to.equal(expectedLabel);
      expect(domain.resolutions[0].registry).to.equal(cnsRegistry.address);
      expect(domain.extension).to.equal(cns.tld);
    });

    it('should add new uns domain', async () => {
      const expectedLabel = randomBytes(16).toString('hex');

      const expectedDomainName = `${expectedLabel}.${uns.tld}`;
      await mintingManager.functions
        .mintSLD(owner, uns.tldHash, expectedLabel)
        .then((receipt) => receipt.wait());
      await EthereumHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOneOrFail({
        where: { name: expectedDomainName },
        relations: ['resolutions'],
      });
      expect(domain.label).to.equal(expectedLabel);
    });

    it('should not add cns domain with capital letters', async () => {
      const expectedLabel = `${randomBytes(16).toString('hex')}-AAA`;
      const expectedDomainName = `${expectedLabel}.${cns.tld}`;
      await mintingManager.functions
        .mintSLD(owner, cns.tldHash, expectedLabel)
        .then((receipt) => receipt.wait());
      await EthereumHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOne({
        where: { name: expectedDomainName },
        relations: ['resolutions'],
      });
      expect(domain).to.be.undefined;
    });

    it('should not add uns domain with capital letters', async () => {
      const expectedLabel = `${randomBytes(16).toString('hex')}-AAA`;
      const expectedDomainName = `${expectedLabel}.${uns.tld}`;
      await mintingManager.functions
        .mintSLD(owner, uns.tldHash, expectedLabel)
        .then((receipt) => receipt.wait());
      await EthereumHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOne({
        where: { name: expectedDomainName },
        relations: ['resolutions'],
      });
      expect(domain).to.be.undefined;
    });

    it.skip('should not add cns domain with spaces', async () => {
      // for some reason minting manager can actually mint a domain like this
      const expectedLabel = `   ${randomBytes(16).toString('hex')}   `;
      const expectedDomainName = `${expectedLabel}.${cns.tld}`;
      await mintingManager.functions
        .mintSLD(owner, cns.tldHash, expectedLabel)
        .then((receipt) => receipt.wait());
      await EthereumHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOne({
        where: { name: expectedDomainName },
        relations: ['resolutions'],
      });
      expect(domain).to.be.undefined;
    });

    it('should not add uns domain with spaces', async () => {
      const expectedLabel = `    ${randomBytes(16).toString('hex')}   `;
      const expectedDomainName = `${expectedLabel}.${uns.tld}`;
      await mintingManager.functions
        .mintSLD(owner, uns.tldHash, expectedDomainName)
        .then((receipt) => receipt.wait());
      await EthereumHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOne({
        where: { name: expectedDomainName },
        relations: ['resolutions'],
      });
      expect(domain).to.be.undefined;
    });

    it('should add new zil domain on uns', async () => {
      const zil = getNSConfig('zil');
      const expectedLabel = randomBytes(16).toString('hex');

      const expectedDomainName = `${expectedLabel}.${zil.tld}`;

      // add zil in case sandbox doesn't have it
      const mintingManagerOwner =
        ETHContracts.MintingManager.getContract().connect(
          EthereumHelper.owner(),
        );
      await mintingManagerOwner.functions.addTld('zil');

      await mintingManager.functions
        .mintSLD(owner, zil.tldHash, expectedLabel)
        .then((receipt) => receipt.wait());
      await EthereumHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOneOrFail({
        where: { name: expectedDomainName },
        relations: ['resolutions'],
      });
      expect(domain.label).to.equal(expectedLabel);
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
      await EthereumHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOrCreateByName(cns.name, Blockchain.ETH);
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
      await EthereumHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOrCreateByName(uns.name, Blockchain.ETH);
      const resolution = domain?.getResolution(
        service.blockchain,
        service.networkId,
      );
      expect(resolution.resolution).to.be.empty;
    });

    it('should get all cns domain records when domain was sent via setOwner method', async () => {
      const account = await EthereumHelper.createAccount();
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
      await EthereumHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOrCreateByName(cns.name, Blockchain.ETH);
      const resolution = domain?.getResolution(
        service.blockchain,
        service.networkId,
      );
      expect(resolution.resolution).to.deep.equal({
        'crypto.ETH.address': '0x829BD824B016326A401d083B33D092293333A830',
      });
    });

    it('should get all uns domain records when domain was sent via setOwner method', async () => {
      const account = await EthereumHelper.createAccount();
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
      await EthereumHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOrCreateByName(uns.name, Blockchain.ETH);
      const resolution = domain?.getResolution(
        service.blockchain,
        service.networkId,
      );
      expect(resolution.resolution).to.deep.equal({
        'crypto.ETH.address': '0x829BD824B016326A401d083B33D092293333A830',
      });
    });

    it('should set reverse resolution', async () => {
      await unsRegistry.functions
        .setReverse(uns.tokenId)
        .then((receipt) => receipt.wait());
      await EthereumHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOrCreateByName(uns.name, Blockchain.ETH);
      expect(domain.reverseResolutions.length).to.eq(1);
      expect(domain.reverseResolutions[0]).to.containSubset({
        reverseAddress: owner.toLowerCase(),
        blockchain: Blockchain.ETH,
        networkId: env.APPLICATION.ETHEREUM.NETWORK_ID,
      });
    });

    it('processes a remove reverse event', async () => {
      await unsRegistry.functions
        .setReverse(uns.tokenId)
        .then((receipt) => receipt.wait());
      await EthereumHelper.mineBlocksForConfirmation();
      await service.run();

      let domain = await Domain.findOrCreateByName(uns.name, Blockchain.ETH);
      expect(domain.reverseResolutions.length).to.eq(1);

      await unsRegistry.functions
        .removeReverse()
        .then((receipt) => receipt.wait());
      await EthereumHelper.mineBlocksForConfirmation();
      await service.run();

      domain = await Domain.findOrCreateByName(uns.name, Blockchain.ETH);
      expect(domain.reverseResolutions.length).to.eq(0);
    });
  });

  describe('custom domain records', () => {
    it('should add custom key on Sync event', async () => {
      await resolver.functions
        .set('custom-key', 'value', cns.tokenId)
        .then((receipt) => receipt.wait());
      await EthereumHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOrCreateByName(cns.name, Blockchain.ETH);
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
      await EthereumHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOrCreateByName(cns.name, Blockchain.ETH);
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

      await EthereumHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOne({
        where: { name: cns.name },
        relations: ['resolutions'],
      });
      const resolution = domain?.getResolution(
        service.blockchain,
        service.networkId,
      );
      expect(resolution?.resolution).to.deep.equal({
        'crypto.ETH.address': '0x461781022A9C2De74f2171EB3c44F27320b13B8c',
        'custom-key': 'value',
      });
    });
  });

  describe('resync', () => {
    it('should reset events on resync', async () => {
      await EthereumHelper.mineBlocksForConfirmation();

      await service.run();

      expect(await CnsRegistryEvent.count()).to.equal(5);

      const resyncConfig = {
        ...env.APPLICATION.ETHEREUM,
        RESYNC_FROM: 0,
      };
      service = new EthUpdater(Blockchain.ETH, resyncConfig);
      await service.resync();

      expect(await CnsRegistryEvent.count()).to.equal(0);
    });
  });
});
