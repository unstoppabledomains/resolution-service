import { BigNumber, Contract } from 'ethers';
import { randomBytes } from 'crypto';
import { env } from '../../env';
import { EthereumProvider } from '../EthereumProvider';
import { Domain, WorkerStatus } from '../../models';
import { EthereumTestsHelper } from '../../utils/testing/EthereumTestsHelper';
import { CryptoSmartContracts } from '../../utils/testing/CryptoSmartContracts';
import { CnsResolver } from './CnsResolver';
import * as sinon from 'sinon';
import { expect } from 'chai';
import { eip137Namehash } from '../../utils/namehash';
import supportedKeysJson from 'dot-crypto/src/supported-keys/supported-keys.json';

describe('CnsResolver', () => {
  let service: CnsResolver;
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
  const sinonSandbox = sinon.createSandbox();
  const PredefinedRecordKeys = Object.keys(supportedKeysJson.keys);

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
    coinbaseAddress = await EthereumProvider.getSigner().getAddress();
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
      .value(await EthereumProvider.getBlockNumber());

    testDomainLabel = randomBytes(16).toString('hex');
    testDomainName = `${testDomainLabel}.crypto`;
    testDomainNode = BigNumber.from(eip137Namehash(testDomainName));
    testTokenId = BigNumber.from(testDomainNode);

    await WorkerStatus.saveWorkerStatus(
      'CNS',
      await EthereumProvider.getBlockNumber(),
    );

    await whitelistedMinter.functions
      .mintSLDToDefaultResolver(coinbaseAddress, testDomainLabel, [], [])
      .then((receipt) => receipt.wait());
    await EthereumTestsHelper.mineBlocksForConfirmation();

    service = new CnsResolver();
  });

  afterEach(() => {
    sinonSandbox.restore();
  });

  describe('basic domain records', () => {
    it('should fetch resolver', async () => {
      const domain = await Domain.findOrCreateByName(testDomainName, 'CNS');
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
      const domain = await Domain.findOrCreateByName(testDomainName, 'CNS');

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
      const domain = await Domain.findOrCreateByName(testDomainName, 'CNS');
      await domain.update({
        resolver: resolver.address.toLowerCase(),
        resolution: { hello: 'world' },
      });

      await service.fetchResolver(domain, Domain.getRepository());

      expect(domain.resolution).to.be.empty;
    });

    it('should get all predefined resolver records', async () => {
      await resolver.functions
        .reconfigure(RecordKeys, ResolverValues, testTokenId)
        .then((receipt) => receipt.wait());
      const resolverRecords = await service._getAllDomainRecords(
        resolver.address,
        testDomainNode,
      );
      expect(resolverRecords).to.deep.equal(ExpectedResolverRecords);
    });

    it('should get all predefined resolver records with pagination', async () => {
      await resolver.functions
        .reconfigure(RecordKeys, ResolverValues, testTokenId)
        .then((receipt) => receipt.wait());
      const ethereumCallSpy = sinonSandbox.spy(
        service,
        '_getManyDomainRecords',
      );
      const resolverRecords = await service._getAllDomainRecords(
        resolver.address,
        testDomainNode,
        1,
      );
      RecordKeys.forEach((key, callNumber) => {
        expect(ethereumCallSpy.getCall(callNumber)).to.be.calledWith(
          resolver.address,
          [key],
          testDomainNode,
        );
      });
      expect(resolverRecords).to.deep.equal(ExpectedResolverRecords);
      ethereumCallSpy.restore();
    });
  });
  describe('custom domain records', () => {
    it('should get all custom records', async () => {
      await resolver.functions
        .reconfigure(['custom-key'], ['custom-value'], testTokenId)
        .then((receipt) => receipt.wait());

      const customRecords = await service._getAllDomainRecords(
        resolver.address,
        testTokenId,
      );
      expect(customRecords).to.deep.equal({ 'custom-key': 'custom-value' });
    });

    it('should filter keys duplicates from NewKey events', async () => {
      await resolver.functions
        .reconfigure(
          ['custom-key', 'custom-key', 'custom-key', 'custom-key'],
          [
            'custom-value',
            'custom-value-1',
            'custom-value-2',
            'this-is-the-value',
          ],
          testTokenId,
        )
        .then((receipt) => receipt.wait());

      const customRecords = await service._getAllDomainRecords(
        resolver.address,
        testTokenId,
      );
      expect(customRecords).to.deep.equal({
        'custom-key': 'this-is-the-value',
      });
    });

    it('should fallback to predefined keys set if Resolver does not have NewKey events', async () => {
      await registry.functions
        .resolveTo(legacyResolver.address, testTokenId)
        .then((receipt) => receipt.wait());
      await legacyResolver.functions
        .setMany(
          ['custom-key', 'crypto.BTC.address'],
          ['custom-value', 'bc1qj5jdpvg0u73qxgvwulc2nkcrjvwvhvm0fnyy85'],
          testTokenId,
        )
        .then((receipt) => receipt.wait());

      const records = await service._getAllDomainRecords(
        legacyResolver.address,
        testDomainNode,
      );
      expect(records).to.deep.equal({
        'crypto.BTC.address': 'bc1qj5jdpvg0u73qxgvwulc2nkcrjvwvhvm0fnyy85',
      });
    });

    it('should search new keys starting from last ResetRecords event', async () => {
      await resolver.functions
        .setMany(
          ['crypto.BTC.address', 'crypto.ETH.address'],
          [
            'bc1qj5jdpvg0u73qxgvwulc2nkcrjvwvhvm0fnyy85',
            '0xBDF21E8383Acb9d1364A6ed940dfCbDF42A86f75',
          ],
          testTokenId,
        )
        .then((receipt) => receipt.wait());
      await resolver.functions
        .reconfigure(['custom-key'], ['custom-value'], testTokenId)
        .then((receipt) => receipt.wait());
      const resetRecordsBlockNumber = await EthereumProvider.getBlockNumber();
      const ethereumCallSpy = sinonSandbox.spy(service, '_getResolverEvents');
      const domainRecords = await service._getAllDomainRecords(
        resolver.address,
        testDomainNode,
      );
      expect(ethereumCallSpy.firstCall).to.be.calledWith(
        sinonSandbox.match.any,
        {
          address: resolver.address,
          topics: [
            '0x185c30856dadb58bf097c1f665a52ada7029752dbcad008ea3fefc73bee8c9fe', // signature of ResetRecords event
            testDomainNode.toHexString(),
          ],
        },
        env.APPLICATION.ETHEREUM.CNS_RESOLVER_ADVANCED_EVENTS_STARTING_BLOCK,
      );
      expect(ethereumCallSpy.secondCall).to.be.calledWith(
        sinonSandbox.match.any,
        {
          address: resolver.address,
          topics: [
            '0x7ae4f661958fbecc2f77be6b0eb280d2a6f604b29e1e7221c82b9da0c4af7f86', // signature of NewKey event
            testDomainNode.toHexString(),
          ],
        },
        resetRecordsBlockNumber,
      );
      expect(domainRecords).to.deep.equal({ 'custom-key': 'custom-value' });
    });

    it('should fallback to predefined keys and start block if use legacy resolver', async () => {
      await registry.functions
        .resolveTo(legacyResolver.address, testTokenId)
        .then((receipt) => receipt.wait());
      const ethereumCallSpy = sinonSandbox.spy(
        service,
        '_getManyDomainRecords',
      );
      await service._getAllDomainRecords(
        legacyResolver.address,
        testDomainNode,
        200,
      );
      expect(ethereumCallSpy).to.be.calledWith(
        legacyResolver.address,
        PredefinedRecordKeys,
        testDomainNode,
      );
    });
  });
});
