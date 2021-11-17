import { expect } from 'chai';
import { env } from '../env';
import { Blockchain } from '../types/common';
import { EthereumHelper } from '../utils/testing/EthereumTestsHelper';
import {
  getNSConfig,
  LayerTestFixture,
} from '../utils/testing/LayerFixturesHelper';
import Domain from './Domain';
import nock from 'nock';
import { nockConfigure } from '../mochaHooks';

describe('Domain', () => {
  describe('constructor()', () => {
    it('should successfully create entity', async () => {
      const domain = Domain.create({
        name: 'test.crypto',
        node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
      });
      const domainTwo = Domain.create({
        name: 'test1.zil',
        node: '0xc0cfff0bacee0844926d425ce027c3d05e09afaa285661aca11c5a97639ef001',
      });
      const domainThree = Domain.create({
        name: 'test1.x',
        node: '0xd40233894d702a593754963512f52ff891dbe215dd06195717dace1212a03fa7',
      });
      await domain.save();
      await domainTwo.save();
      await domainThree.save();
      expect(domain.id).to.be.a('number');
      expect(domainTwo.id).to.be.a('number');
      expect(domainThree.id).to.be.a('number');
    });

    it('should fail nameMatchesNode validation', async () => {
      const domain = Domain.create({
        name: 'test1.crypto',
        node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
      });
      await expect(domain.save()).to.be.rejectedWith(
        '- property name has failed the following constraints: validate name with nameMatchesNode',
      );
    });
  });

  describe('.label', () => {
    it('should return label', async () => {
      const domain = Domain.create({
        name: 'test.crypto',
        node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
      });
      expect(domain.label).to.equal('test');
    });
  });

  describe('.extension', () => {
    it('should return extension', async () => {
      const domain = Domain.create({
        name: 'test.crypto',
        node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
      });
      expect(domain.extension).to.equal('crypto');
    });
  });

  describe('.findByNode', () => {
    it('should find by node', async () => {
      const domainMetaData = {
        name: 'test.crypto',
        node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
      };
      const domain = Domain.create(domainMetaData);
      await domain.save();

      const foundDomain = await Domain.findByNode(domainMetaData.node);

      expect(foundDomain).to.containSubset(domainMetaData);
    });

    it('should return undefined if node is undefined', async () => {
      const node = undefined;
      const foundDomain = await Domain.findByNode(node);
      expect(foundDomain).to.be.undefined;
    });
  });

  describe('.normalizeResolver', () => {
    it('should normalize the resolver address', () => {
      const resolver = '0xb66DcE2DA6afAAa98F2013446dBCB0f4B0ab2842';
      const expected = '0xb66dce2da6afaaa98f2013446dbcb0f4b0ab2842';
      expect(Domain.normalizeResolver(resolver)).to.be.equal(expected);
    });

    it('should return null for zero address', () => {
      const resolver = Domain.NullAddress;
      expect(Domain.normalizeResolver(resolver)).to.be.null;
    });

    it('should return null for undefined resolver address', () => {
      const resolver = undefined;
      expect(Domain.normalizeResolver(resolver)).to.be.null;
    });
  });

  describe('.findOrCreateByName', () => {
    it('should create a domain', async () => {
      const expectedDomain = {
        name: 'test.crypto',
        node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
      };
      await Domain.findOrCreateByName(expectedDomain.name);
      const foundDomain = await Domain.findOne({ name: expectedDomain.name });

      expect(foundDomain).to.containSubset(expectedDomain);
    });

    it('should find a domain', async () => {
      const expectedDomain = {
        name: 'test.crypto',
        node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
      };
      const domain = Domain.create(expectedDomain);
      await domain.save();

      const foundDomain = await Domain.findOrCreateByName(expectedDomain.name);

      expect(foundDomain).to.containSubset(expectedDomain);
    });
  });

  describe('.findOrBuildByNode', () => {
    it('should find an existed domain', async () => {
      const domainMetaData = {
        name: 'test.crypto',
        node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
      };
      await Domain.create(domainMetaData).save();
      const fromDb = await Domain.findOrBuildByNode(
        '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
      );
      expect(fromDb).to.containSubset(domainMetaData);
    });

    it('should build new domain', async () => {
      const domainFromDb = await Domain.findOrBuildByNode(
        '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303107',
      );
      expect(domainFromDb).to.containSubset({
        node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303107',
      });
    });
  });

  describe('.findOnChainNoSafe', () => {
    const L1Fixture: LayerTestFixture = new LayerTestFixture();
    const L2Fixture: LayerTestFixture = new LayerTestFixture();

    before(async () => {
      // Prepare eth network sandbox
      // need both layers sandbox since the method is looking on both chains
      await EthereumHelper.stopNetwork();
      await L1Fixture.setup(Blockchain.ETH, env.APPLICATION.ETHEREUM, {});
      await L2Fixture.setup(Blockchain.MATIC, env.APPLICATION.POLYGON, {
        network: {
          url: 'http://localhost:7546',
          chainId: 1337,
          dbPath: './.sandboxl2',
        },
      });
    });

    after(async () => {
      // close the eth network
      await L1Fixture.networkHelper.stopNetwork();
      await L2Fixture.networkHelper.stopNetwork();
    });

    it('should find a domain from L1 layer', async () => {
      const uns = getNSConfig('wallet');
      const owner = L1Fixture.networkHelper.owner().address;
      await L1Fixture.prepareService(owner, uns);

      const token = uns.node.toHexString();

      // Fire the method
      const domain = await Domain.findOnChainNoSafe(token);
      expect(domain).to.not.be.undefined;
      // Domain should not be stored in db;
      const domainFromDb = await Domain.findByNode(token);
      expect(domainFromDb).to.be.undefined;
    });

    it('should find a domain from l2 layer', async () => {
      const uns = getNSConfig('dao');
      const owner = L2Fixture.networkHelper.owner().address;
      await L2Fixture.prepareService(owner, uns);

      const token = uns.node.toHexString();
      const domain = await Domain.findOnChainNoSafe(token);
      expect(domain).to.not.be.undefined;
      // Domain should not be stored in db;
      const domainFromDb = await Domain.findByNode(token);
      expect(domainFromDb).to.be.undefined;
    });

    it('should return undefined if some error occur', async () => {
      const uns = getNSConfig('nft');
      const owner = L2Fixture.networkHelper.owner().address;
      await L2Fixture.prepareService(owner, uns);

      const token = uns.node.toHexString();
      // nock will prevent any network queries with an error
      // effectively simulating some random network error that might occur
      nock.disableNetConnect();
      const domain = await Domain.findOnChainNoSafe(token);
      expect(domain).to.be.undefined;
      // make sure to reconfigure nock as it is being used across the test set
      nockConfigure();
    });

    it('should return undefined if domain is not found on any chain', async () => {
      const uns = getNSConfig('x');
      const token = uns.node.toHexString();
      const domain = await Domain.findOnChainNoSafe(token);
      expect(domain).to.be.undefined;
    });
  });

  describe('domain parent', () => {
    it('should fill domain parent', async () => {
      const domainMetaData = {
        name: 'test.crypto',
        node: '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
      };
      await Domain.create(domainMetaData).save();
      const fromDb = await Domain.findByNode(
        '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
      );
      expect(fromDb?.parent?.name).to.equal('crypto');
    });
  });
});
