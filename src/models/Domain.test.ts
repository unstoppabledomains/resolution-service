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
      await domain.save();
      expect(domain.id).to.be.a('number');
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
        '- property location has failed the following constraints: validate location with validLocation',
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
});
