import { BigNumber, Contract } from 'ethers';
import { randomBytes } from 'crypto';
import { env } from '../../env';
import { provider } from '../../utils/provider';
import { EthereumTestsHelper } from '../../utils/testing/EthereumTestsHelper';
import { CryptoSmartContracts } from '../../utils/testing/CryptoSmartContracts';
import { CnsResolver } from './CnsResolver';
import * as sinon from 'sinon';
import { expect } from 'chai';
import { eip137Namehash } from '../../utils/namehash';
import { CnsRegistryEventFactory } from '../../utils/testing/Factories';

describe('CnsResolver', () => {
  let service: CnsResolver;
  let registry: Contract;
  let resolver: Contract;
  let whitelistedMinter: Contract;
  let contracts: CryptoSmartContracts;
  let coinbaseAddress: string;

  let testDomainName: string;
  let testTokenId: BigNumber;
  let testDomainLabel: string;
  let testDomainNode: BigNumber;

  const RecordKeys = [
    'crypto.BCH.address',
    'crypto.BTC.address',
    'crypto.XZC.address',
    'crypto.ETH.address',
    'crypto.LTC.address',
    'crypto.XEM.address',
    'crypto.XRP.address',
    'crypto.BURST.address',
    'crypto.DASH.address',
    'crypto.ATOM.address',
    'crypto.ONG.address',
  ];

  const ResolverValues = [
    'qp3gu0flg7tehyv73ua5nznlw8s040nz3uqnyffrcn',
    'bc1qh3wv4mwgzethhyz76pkct4jwvat3ylrq327am4',
    '',
    '0x461781022A9C2De74f2171EB3c44F27320b13B8c',
    'ltc1qgjhx3jjalu6ypae06nmeclzcwmu8algvn662xm',
    'NA4KUBIZKDCI57A4D62HZQWYSJLU4IJO5SZZTBK4',
    'rhtv69R8EoMuCSJt1fdfwpBgq3dY6C35XX',
    '',
    'XwkTBYxRB3TFYSHYZ9CfpDM4oFBccRwdAH',
    '',
    '',
  ];

  const ExpectedResolverRecords = {
    'crypto.BCH.address': 'qp3gu0flg7tehyv73ua5nznlw8s040nz3uqnyffrcn',
    'crypto.BTC.address': 'bc1qh3wv4mwgzethhyz76pkct4jwvat3ylrq327am4',
    'crypto.ETH.address': '0x461781022A9C2De74f2171EB3c44F27320b13B8c',
    'crypto.LTC.address': 'ltc1qgjhx3jjalu6ypae06nmeclzcwmu8algvn662xm',
    'crypto.XEM.address': 'NA4KUBIZKDCI57A4D62HZQWYSJLU4IJO5SZZTBK4',
    'crypto.XRP.address': 'rhtv69R8EoMuCSJt1fdfwpBgq3dY6C35XX',
    'crypto.DASH.address': 'XwkTBYxRB3TFYSHYZ9CfpDM4oFBccRwdAH',
  };

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
    await EthereumTestsHelper.mineBlocksForConfirmation();
    service = new CnsResolver();
  });

  it('should fetch resolver', async () => {
    const domain = await Domain.findOrCreateByName(testDomainName);
    await service.fetchResolver(domain, Domain.getRepository());
    expect(domain.resolver).to.equal(resolver.address.toLowerCase());
  });

  it('should fetch resolver with domain records', async () => {
    await resolver.functions
      .reconfigure(
        ['crypto.BTC.address', 'crypto.ETH.address'],
        [
          'qp3gu0flg7tehyv73ua5nznlw8s040nz3uqnyffrcn',
          '0x461781022A9C2De74f2171EB3c44F27320b13B8c',
        ],
        testTokenId,
      )
      .then((receipt) => receipt.wait());
    const domain = await Domain.findOrCreateByName(testDomainName);

    await service.fetchResolver(domain, Domain.getRepository());

    expect(domain.resolution).to.deep.equal({
      'crypto.BTC.address': 'qp3gu0flg7tehyv73ua5nznlw8s040nz3uqnyffrcn',
      'crypto.ETH.address': '0x461781022A9C2De74f2171EB3c44F27320b13B8c',
    });
  });

  it('resets records when resolver is unset', async () => {
    await registry.functions
      .resolveTo(AddressZero, testTokenId)
      .then((receipt) => receipt.wait());
    const domain = await Domain.findOrCreateByName(testDomainName);
    await domain.update({
      resolver: resolver.address,
      resolution: { hello: 'world' },
    });

    await service.fetchResolver(domain, Domain.getRepository());

    expect(domain.resolution).to.be.empty;
  });

  it('should get all predefined resolver records', async () => {
    await resolver.functions
      .reconfigure(RecordKeys, ResolverValues, testTokenId)
      .then((receipt) => receipt.wait());
    const resolverRecords = await service.getAllDomainRecords(
      resolver.address,
      testDomainNode,
    );
    expect(resolverRecords).to.deep.equal(ExpectedResolverRecords);
  });

  it('should get all predefined resolver records with pagination', async () => {
    await resolver.functions
      .reconfigure(RecordKeys, ResolverValues, testTokenId)
      .then((receipt) => receipt.wait());
    const spyOnEthereumCall = sinon.spy(service, 'getAllDomainRecords');
    const resolverRecords = await service.getAllDomainRecords(
      resolver.address,
      testDomainNode,
      1,
    );
    RecordKeys.forEach((key, callNumber) => {
      expect(spyOnEthereumCall.getCall(callNumber)).to.be.calledWith(
        resolver.address,
        [key],
        testDomainNode,
      );
    });
    expect(resolverRecords).to.deep.equal(ExpectedResolverRecords);
  });
});
