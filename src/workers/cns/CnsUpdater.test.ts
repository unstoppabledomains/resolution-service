import { BigNumber, Contract } from 'ethers';
import { randomBytes } from 'crypto';
import { env } from '../../env';
import { CnsRegistryEvent, Domain } from '../../models';
import { provider } from '../../utils/provider';
import { EthereumTestsHelper } from '../../utils/testing/EthereumTestsHelper';
import { CryptoSmartContracts } from '../../utils/testing/CryptoSmartContracts';
import { CnsUpdater } from './CnsUpdater';
import * as sinon from 'sinon';
import { expect } from 'chai';
import { eip137Namehash } from '../../utils/namehash';
import { CnsRegistryEventFactory } from '../../utils/testing/Factories';

describe('CnsUpdater', () => {
  let service: CnsUpdater;
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
    coinbaseAddress = await provider.getSigner().getAddress();
    registry = contracts.registry;
    resolver = contracts.resolver;
    whitelistedMinter = contracts.whitelistedMinter;
  });

  beforeEach(async () => {
    sinon
      .stub(
        env.APPLICATION.ETHEREUM,
        'CNS_RESOLVER_ADVANCED_EVENTS_STARTING_BLOCK',
      )
      .value(await provider.getBlockNumber());

    testDomainLabel = randomBytes(16).toString('hex');
    testDomainName = `${testDomainLabel}.crypto`;
    testDomainNode = BigNumber.from(eip137Namehash(testDomainName));
    testTokenId = BigNumber.from(testDomainNode);
    await CnsRegistryEventFactory.create({
      blockNumber: await provider.getBlockNumber(),
    });
    await whitelistedMinter?.functions
      .mintSLDToDefaultResolver(coinbaseAddress, testDomainLabel, [], [])
      .then((receipt) => receipt.wait());
    service = new CnsUpdater();
  });

  it('processes an event', async () => {
    const account = provider.getSigner(1);
    const accountAddress = await account.getAddress();
    await EthereumTestsHelper.fundAddress(accountAddress);
    await resolver.functions
      .reset(testTokenId)
      .then((receipt) => receipt.wait());
    await registry.functions
      .transferFrom(coinbaseAddress, accountAddress, testTokenId)
      .then((receipt) => receipt.wait());
    await registry
      .connect(account)
      .functions.resolveTo(resolver.address, testTokenId)
      .then((receipt) => receipt.wait());
    await resolver
      .connect(account)
      .functions.setMany(
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
      ownerAddress: accountAddress.toLowerCase(),
    });

    // Should reset owner and resolution records after burning.
    await registry
      .connect(account)
      .functions.burn(testTokenId)
      .then((receipt) => receipt.wait());
    await EthereumTestsHelper.mineBlocksForConfirmation();

    await service.run();
    await domain?.reload();
    expect(domain).to.containSubset({
      name: testDomainName,
      resolution: {},
      resolver: null,
      ownerAddress: null,
    });

    expect(await CnsRegistryEvent.groupCount('type')).to.deep.equal({
      NewURI: 1,
      Resolve: 2,
      Sync: 2,
      Transfer: 4,
    });
  });

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

  it('should reset records if Sync event with zero updateId received', async () => {
    await resolver.functions
      .reset(testTokenId)
      .then((receipt) => receipt.wait());
    let domain = await Domain.findOrCreateByName(testDomainName);
    await domain.update({
      resolver: resolver.address,
      resolution: { hello: 'world' },
    });
    await service.run();
    domain = await Domain.findOrCreateByName(testDomainName);
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
    await Domain.findOrCreateByName(testDomainName);

    await service.run();

    const domain = await Domain.findOrCreateByName(testDomainName);
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
    await Domain.findOrCreateByName(testDomainName);
    const callSpy = sinon.spy(service.resolver, 'getAllDomainRecords');

    await service.run();

    for (let callNumber = 0; callNumber < 3; callNumber++) {
      callSpy
        .getCall(callNumber)
        .should.have.been.calledWith(
          resolver.address.toLowerCase(),
          testDomainNode,
        );
    }
    const domain = await Domain.findOrCreateByName(testDomainName);
    expect(domain.resolution).to.deep.equal({
      'crypto.ETH.address': '0x829BD824B016326A401d083B33D092293333A830',
    });
  });
});
