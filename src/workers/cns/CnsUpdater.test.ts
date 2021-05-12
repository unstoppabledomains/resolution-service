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

describe('CnsUpdater', () => {
  let service: CnsUpdater;
  let registry: Contract;
  let resolver: Contract;
  let whitelistedMinter: Contract;
  let legacyResolver: Contract;
  const ethTestHelper: EthereumTestsHelper = new EthereumTestsHelper();
  let contracts: CryptoSmartContracts;
  let coinbaseAddress: string;

  let testDomainName: string;
  let testTokenId: BigNumber;
  let testDomainLabel: string;
  let testDomainNode: BigNumber;

  before(async () => {
    contracts = await EthereumTestsHelper.initializeContractsAndStub();
    coinbaseAddress = await provider.getSigner().getAddress();
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
      .value(await provider.getBlockNumber());

    testDomainLabel = randomBytes(16).toString('hex');
    testDomainName = `${testDomainLabel}.crypto`;
    testDomainNode = BigNumber.from(eip137Namehash(testDomainName));
    testTokenId = BigNumber.from(testDomainNode);
    // await CryptoRegistryEventFactory.create({
    //   blockNumber: await provider.getBlockNumber(),
    // });
    await whitelistedMinter?.functions
      .mintSLDToDefaultResolver(coinbaseAddress, testDomainLabel, [], [])
      .then((receipt) => receipt.wait());
    service = new CnsUpdater();
  });

  it('processes an event', async () => {
    await Domain.findOrCreateByName(testDomainName);
    const account = await EthereumTestsHelper.createAccount();
    await EthereumTestsHelper.fundAddress(account.address);
    await resolver.functions
      .reset(testTokenId)
      .then((receipt) => receipt.wait());
    await registry.functions
      .transferFrom(coinbaseAddress, account.address, testTokenId)
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

    await service.run();

    const domain = await Domain.findOrCreateByName(testDomainName);
    expect(domain).to.containSubset({
      name: testDomainName,
      resolver: resolver.address.toLowerCase(),
      resolution: {
        'crypto.BTC.address': 'qp3gu0flg7tehyv73ua5nznlw8s040nz3uqnyffrcn',
      },
      ownerAddress: account.address.toLowerCase(),
    });

    // Should reset owner and resolution records after burning.
    await registry
      .connect(account)
      .functions.burn(testTokenId)
      .then((receipt) => receipt.wait());
    await service.run();
    await domain.reload();
    expect(domain).to.containSubset({
      name: testDomainName,
      userId: null,
      resolution: {},
      resolver: null,
      ownerAddress: null,
      status: null,
    });

    expect(await CnsRegistryEvent.groupCount('type')).to.deep.equal({
      NewURI: 1,
      Resolve: 2,
      Sync: 2,
      Transfer: 4,
    });
  });
});
