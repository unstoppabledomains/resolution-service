import { expect } from 'chai';
import Domain from './Domain';

describe('Domain', () => {
  describe('constructor()', () => {
    it('should successfully create entity', async () => {
      const domain = Domain.create({
        name: 'test.crypto',
        node:
          '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        location: 'CNS',
      });
      const domainTwo = Domain.create({
        name: 'test1.zil',
        node:
          '0xc0cfff0bacee0844926d425ce027c3d05e09afaa285661aca11c5a97639ef001',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        location: 'ZNS',
      });
      await domain.save();
      await domainTwo.save();
      expect(domain.id).to.be.a('number');
      expect(domainTwo.id).to.be.a('number');
    });

    it('should fail on uppercased ownerAddress', async () => {
      const domain = Domain.create({
        name: 'test.crypto',
        node:
          '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2'.toUpperCase(),
        location: 'CNS',
      });
      await expect(domain.save()).to.be.rejectedWith(
        '- property ownerAddress has failed the following constraints: matches',
      );
    });

    it('should fail validLocation validation', async () => {
      const domain = Domain.create({
        name: 'test.crypto',
        node:
          '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        location: 'SOMEWHERE_BAD',
      });
      await expect(domain.save()).to.be.rejectedWith(
        '- property location has failed the following constraints: isEnum',
      );
    });

    it('should fail nameMatchesNode validation', async () => {
      const domain = Domain.create({
        name: 'test1.crypto',
        node:
          '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        location: 'CNS',
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
        node:
          '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        location: 'CNS',
      });
      expect(domain.label).to.equal('test');
    });
  });

  describe('.extension', () => {
    it('should return extension', async () => {
      const domain = Domain.create({
        name: 'test.crypto',
        node:
          '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        location: 'CNS',
      });
      expect(domain.extension).to.equal('crypto');
    });
  });

  describe('findByNode', () => {
    it('should return a domain by node', async () => {
      const expectedDomain = {
        name: 'test.crypto',
        node:
          '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        location: 'CNS',
      };
      const domain = Domain.create(expectedDomain);
      await domain.save();

      const foundDomain = await Domain.findByNode(expectedDomain.node);

      expect(foundDomain).to.containSubset(expectedDomain);
    });

    it('should return undefined if node is undefined', async () => {
      const node = undefined;
      const foundDomain = await Domain.findByNode(node);
      expect(foundDomain).to.be.undefined;
    });
  });

  describe('normalizeResolver', () => {
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
  describe('findOrCreateByName', () => {
    it('should create a domain', async () => {
      const expectedDomain = {
        name: 'test.crypto',
        node:
          '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
        location: 'CNS',
      };
      await Domain.findOrCreateByName(
        expectedDomain.name,
        expectedDomain.location,
      );
      const foundDomain = await Domain.findOne({ name: expectedDomain.name });

      expect(foundDomain).to.containSubset(expectedDomain);
    });

    it('should find a domain', async () => {
      const expectedDomain = {
        name: 'test.crypto',
        node:
          '0xb72f443a17edf4a55f766cf3c83469e6f96494b16823a41a4acb25800f303103',
        ownerAddress: '0x58ca45e932a88b2e7d0130712b3aa9fb7c5781e2',
        location: 'CNS',
      };
      const domain = Domain.create(expectedDomain);
      await domain.save();

      const foundDomain = await Domain.findOrCreateByName(
        expectedDomain.name,
        expectedDomain.location,
      );

      expect(foundDomain).to.containSubset(expectedDomain);
    });
  });
});
