import { BigNumber, Contract } from 'ethers';
import { randomBytes } from 'crypto';
import { env } from '../../env';
import { UnsRegistryEvent, Domain, WorkerStatus } from '../../models';
import { UnsProvider } from './UnsProvider';
import { EthereumTestsHelper } from '../../utils/testing/EthereumTestsHelper';
import { CryptoSmartContracts } from '../../utils/testing/CryptoSmartContracts';
import { UnsUpdater } from './UnsUpdater';
import * as sinon from 'sinon';
import { expect } from 'chai';
import { eip137Namehash } from '../../utils/namehash';
import { UnsUpdaterError } from '../../errors/UnsUpdaterError';

describe('UnsUpdater', () => {
  let service: UnsUpdater;
  let registry: Contract;
  let resolver: Contract;
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
    coinbaseAddress = await UnsProvider.getSigner().getAddress();
    registry = contracts.registry;
    resolver = contracts.resolver;
    whitelistedMinter = contracts.whitelistedMinter;
  });

  beforeEach(async () => {
    const blocknumber = await UnsProvider.getBlockNumber();
    sinon
      .stub(env.APPLICATION.ETHEREUM, 'UNS_REGISTRY_EVENTS_STARTING_BLOCK')
      .value(blocknumber);

    testDomainLabel = randomBytes(16).toString('hex');
    testDomainName = `${testDomainLabel}.blockchain`;
    testDomainNode = BigNumber.from(eip137Namehash(testDomainName));
    testTokenId = BigNumber.from(testDomainNode);
    await WorkerStatus.saveWorkerStatus('UNS', blocknumber);

    await whitelistedMinter.functions
      .mintSLDToDefaultResolver(coinbaseAddress, testDomainLabel, [], [])
      .then((receipt) => receipt.wait());

    service = new UnsUpdater();
  });

  it('should throw if sync block is less than mirrored block', async () => {
    await WorkerStatus.saveWorkerStatus(
      'UNS',
      (await UnsProvider.getBlockNumber()) + 10,
    );
    expect(service.run()).to.be.rejectedWith(UnsUpdaterError);
  });

  it('should save worker stats', async () => {
    // test domain is created in beforeEach hook
    await EthereumTestsHelper.mineBlocksForConfirmation();

    await service.run();

    const workerStatus = await WorkerStatus.findOne({ location: 'UNS' });
    const expectedBlockNumber =
      (await UnsProvider.getBlockNumber()) -
      env.APPLICATION.ETHEREUM.UNS_CONFIRMATION_BLOCKS;
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

      expect(await UnsRegistryEvent.groupCount('type')).to.deep.equal({
        NewURI: 1,
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

      expect(await UnsRegistryEvent.groupCount('type')).to.deep.equal({
        NewURI: 1,
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

      expect(await UnsRegistryEvent.groupCount('type')).to.deep.equal({
        NewURI: 1,
        Transfer: 1,
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

      expect(await UnsRegistryEvent.groupCount('type')).to.deep.equal({
        NewURI: 1,
        Transfer: 2,
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

      expect(await UnsRegistryEvent.groupCount('type')).to.deep.equal({
        NewURI: 1,
        Transfer: 1,
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
      const expectedDomainName = `${expectedLabel}.blockchain`;
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

      const domain = await Domain.findOrCreateByName(testDomainName, 'UNS');
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

      const domain = await Domain.findOrCreateByName(testDomainName, 'UNS');
      expect(domain.resolution).to.deep.equal({
        'crypto.ETH.address': '0x829BD824B016326A401d083B33D092293333A830',
      });
    });
  });
});
