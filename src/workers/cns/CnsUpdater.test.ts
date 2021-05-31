import { BigNumber, Contract } from 'ethers';
import { randomBytes } from 'crypto';
import { env } from '../../env';
import { CnsRegistryEvent, Domain, WorkerStatus } from '../../models';
import { CnsProvider } from './CnsProvider';
import { EthereumTestsHelper } from '../../utils/testing/EthereumTestsHelper';
import { CryptoSmartContracts } from '../../utils/testing/CryptoSmartContracts';
import { CnsUpdater } from './CnsUpdater';
import * as sinon from 'sinon';
import { expect } from 'chai';
import { eip137Namehash } from '../../utils/namehash';
import { CnsRegistryEventFactory } from '../../utils/testing/Factories';
import { CnsUpdaterError } from '../../errors/CnsUpdaterError';

describe('CnsUpdater', () => {
  let service: CnsUpdater;
  let registry: Contract;
  let resolver: Contract;
  let legacyResolver: Contract;
  let whitelistedMinter: Contract;
  let contracts: CryptoSmartContracts;
  let coinbaseAddress: string;

  let testDomainName: string;
  let testTokenId: BigNumber;
  let testDomainLabel: string;
  let testDomainNode: BigNumber;

  const AddressZero = '0x0000000000000000000000000000000000000000';

  before(async () => {
    contracts = await EthereumTestsHelper.initializeContractsAndStub();
    coinbaseAddress = await CnsProvider.getSigner().getAddress();
    registry = contracts.registry;
    resolver = contracts.resolver;
    whitelistedMinter = contracts.whitelistedMinter;
    legacyResolver = contracts.legacyResolver;
  });

  beforeEach(async () => {
    sinon
      .stub(
        env.APPLICATION.ETHEREUM,
        'CNS_RESOLVER_ADVANCED_EVENTS_STARTING_BLOCK',
      )
      .value(await CnsProvider.getBlockNumber());
    sinon
      .stub(env.APPLICATION.ETHEREUM, 'CNS_REGISTRY_EVENTS_STARTING_BLOCK')
      .value(await CnsProvider.getBlockNumber());

    testDomainLabel = randomBytes(16).toString('hex');
    testDomainName = `${testDomainLabel}.crypto`;
    testDomainNode = BigNumber.from(eip137Namehash(testDomainName));
    testTokenId = BigNumber.from(testDomainNode);
    await WorkerStatus.saveWorkerStatus(
      'CNS',
      await CnsProvider.getBlockNumber(),
    );

    await whitelistedMinter.functions
      .mintSLDToDefaultResolver(coinbaseAddress, testDomainLabel, [], [])
      .then((receipt) => receipt.wait());

    service = new CnsUpdater();
  });

  it('should throw if sync block is less than mirrored block', async () => {
    await WorkerStatus.saveWorkerStatus(
      'CNS',
      (await CnsProvider.getBlockNumber()) + 10,
    );
    expect(service.run()).to.be.rejectedWith(CnsUpdaterError);
  });

  it('should save worker stats', async () => {
    // test domain is created in beforeEach hook
    await EthereumTestsHelper.mineBlocksForConfirmation();

    await service.run();

    const workerStatus = await WorkerStatus.findOne({ location: 'CNS' });
    const expectedBlockNumber =
      (await CnsProvider.getBlockNumber()) -
      env.APPLICATION.ETHEREUM.CNS_CONFIRMATION_BLOCKS;
    expect(workerStatus).to.exist;
    expect(workerStatus?.lastMirroredBlockNumber).to.eq(expectedBlockNumber);
  });

  describe('basic events', () => {
    it('processes a NewUri event', async () => {
      // test domain is created in beforeEach hook
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOne({ name: testDomainName });
      expect(domain).to.not.be.undefined;

      expect(await CnsRegistryEvent.groupCount('type')).to.deep.equal({
        NewURI: 1,
        Resolve: 1,
        Transfer: 1,
      });
    });

    it('processes a Transfer event', async () => {
      const recipient = await EthereumTestsHelper.createAccount();
      const recipientAddress = await recipient.getAddress();

      await registry.functions
        .transferFrom(coinbaseAddress, recipientAddress, testTokenId)
        .then((receipt) => receipt.wait());

      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOne({ name: testDomainName });
      expect(domain).to.not.be.undefined;
      expect(domain?.ownerAddress).to.be.equal(recipientAddress.toLowerCase());

      expect(await CnsRegistryEvent.groupCount('type')).to.deep.equal({
        NewURI: 1,
        Resolve: 1,
        Transfer: 2,
      });
    });

    it('processes resolution events', async () => {
      await registry.functions
        .resolveTo(resolver.address, testTokenId)
        .then((receipt) => receipt.wait());
      await resolver.functions
        .setMany(
          ['crypto.BTC.address'],
          ['qp3gu0flg7tehyv73ua5nznlw8s040nz3uqnyffrcn'],
          testTokenId,
        )
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOne({ name: testDomainName });
      expect(domain).to.containSubset({
        name: testDomainName,
        resolver: resolver.address.toLowerCase(),
        resolution: {
          'crypto.BTC.address': 'qp3gu0flg7tehyv73ua5nznlw8s040nz3uqnyffrcn',
        },
      });

      expect(await CnsRegistryEvent.groupCount('type')).to.deep.equal({
        NewURI: 1,
        Resolve: 2,
        Transfer: 1,
        Sync: 1,
      });
    });

    it('processes a burn event', async () => {
      await resolver.functions
        .setMany(
          ['crypto.BTC.address'],
          ['qp3gu0flg7tehyv73ua5nznlw8s040nz3uqnyffrcn'],
          testTokenId,
        )
        .then((receipt) => receipt.wait());

      await registry.functions
        .burn(testTokenId)
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();
      const domain = await Domain.findOne({ name: testDomainName });
      expect(domain).to.containSubset({
        name: testDomainName,
        resolution: {},
        resolver: null,
        ownerAddress: null,
      });

      expect(await CnsRegistryEvent.groupCount('type')).to.deep.equal({
        NewURI: 1,
        Resolve: 1,
        Transfer: 2,
        Sync: 1,
      });
    });

    it('processes an approve event', async () => {
      const recipient = await EthereumTestsHelper.createAccount();
      const recipientAddress = await recipient.getAddress();

      await registry.functions
        .approve(recipientAddress, testTokenId)
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      expect(await CnsRegistryEvent.groupCount('type')).to.deep.equal({
        NewURI: 1,
        Resolve: 1,
        Transfer: 1,
        Approval: 1,
      });
    });
  });

  describe('add new domain', () => {
    it('should add new domain', async () => {
      const expectedLabel = randomBytes(16).toString('hex');

      const expectedDomainName = `${expectedLabel}.crypto`;
      await whitelistedMinter.functions
        .mintSLDToDefaultResolver(coinbaseAddress, expectedLabel, [], [])
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOneOrFail({ name: expectedDomainName });
      expect(domain.label).to.equal(expectedLabel);
    });

    it('should not add domain with capital letters', async () => {
      const expectedLabel = `${randomBytes(16).toString('hex')}-AAA`;
      const expectedDomainName = `${expectedLabel}.crypto`;
      await whitelistedMinter.functions
        .mintSLDToDefaultResolver(coinbaseAddress, expectedLabel, [], [])
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOne({ name: expectedDomainName });
      expect(domain).to.be.undefined;
    });

    it('should not add domain with spaces', async () => {
      const expectedLabel = `    ${randomBytes(16).toString('hex')}   `;
      const expectedDomainName = `${expectedLabel}.crypto`;
      await whitelistedMinter.functions
        .mintSLDToDefaultResolver(coinbaseAddress, expectedDomainName, [], [])
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOne({ name: expectedDomainName });
      expect(domain).to.be.undefined;
    });
  });

  describe('domain records', () => {
    it('should reset records if Sync event with zero updateId received', async () => {
      await resolver.functions
        .set('hello', 'world', testTokenId)
        .then((receipt) => receipt.wait());

      await resolver.functions
        .reset(testTokenId)
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOrCreateByName(testDomainName, 'CNS');
      expect(domain.resolution).to.be.empty;
    });

    it('should get all domain records when domain was sent via setOwner method', async () => {
      const account = await EthereumTestsHelper.createAccount();
      await resolver.functions
        .reconfigure(
          ['crypto.ETH.address'],
          ['0x829BD824B016326A401d083B33D092293333A830'],
          testTokenId,
        )
        .then((receipt) => receipt.wait());
      await registry.functions
        .setOwner(account.address, testTokenId)
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOrCreateByName(testDomainName, 'CNS');
      expect(domain.resolution).to.deep.equal({
        'crypto.ETH.address': '0x829BD824B016326A401d083B33D092293333A830',
      });
    });

    it('should get actual domain records for an old Resolve event', async () => {
      await resolver.functions
        .reconfigure(
          ['crypto.ETH.address'],
          ['0x829BD824B016326A401d083B33D092293333A830'],
          testTokenId,
        )
        .then((receipt) => receipt.wait());
      for (const resolveTo of [
        AddressZero,
        resolver.address,
        AddressZero,
        resolver.address,
      ]) {
        await registry.functions
          .resolveTo(resolveTo, testTokenId)
          .then((receipt) => receipt.wait());
      }
      await EthereumTestsHelper.mineBlocksForConfirmation();

      const callSpy = sinon.spy(service.resolver, '_getAllDomainRecords');

      await service.run();

      expect(callSpy).to.be.calledOnce;
      expect(callSpy).to.be.calledWith(
        resolver.address.toLowerCase(),
        testDomainNode,
      );

      const domain = await Domain.findOrCreateByName(testDomainName, 'CNS');
      expect(domain.resolution).to.deep.equal({
        'crypto.ETH.address': '0x829BD824B016326A401d083B33D092293333A830',
      });
    });
  });

  describe('custom domain records', () => {
    it('should add custom key on Sync event', async () => {
      await resolver.functions
        .set('custom-key', 'value', testTokenId)
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOrCreateByName(testDomainName, 'CNS');
      expect(domain.resolution).to.deep.equal({ 'custom-key': 'value' });
    });

    it('should add custom and default key on Sync event', async () => {
      await resolver.functions
        .setMany(
          ['custom-key', 'crypto.ETH.address'],
          ['value', '0x461781022A9C2De74f2171EB3c44F27320b13B8c'],
          testTokenId,
        )
        .then((receipt) => receipt.wait());
      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOrCreateByName(testDomainName, 'CNS');
      expect(domain.resolution).to.deep.equal({
        'crypto.ETH.address': '0x461781022A9C2De74f2171EB3c44F27320b13B8c',
        'custom-key': 'value',
      });
    });

    it('should add default key on Sync event', async () => {
      await registry.functions
        .resolveTo(legacyResolver.address, testTokenId)
        .then((receipt) => receipt.wait());
      await legacyResolver.functions
        .setMany(
          ['custom-key', 'crypto.ETH.address'],
          ['value', '0x461781022A9C2De74f2171EB3c44F27320b13B8c'],
          testTokenId,
        )
        .then((receipt) => receipt.wait());

      await EthereumTestsHelper.mineBlocksForConfirmation();

      await service.run();

      const domain = await Domain.findOrCreateByName(testDomainName, 'CNS');
      expect(domain.resolution).to.deep.equal({
        'crypto.ETH.address': '0x461781022A9C2De74f2171EB3c44F27320b13B8c',
      });
    });
  });
});
