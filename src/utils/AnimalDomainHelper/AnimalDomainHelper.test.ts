import AnimalDomainHelper from './AnimalDomainHelper';
import { expect } from 'chai';
import { DomainTestHelper } from '../testing/DomainTestHelper';
import { eip137Namehash } from '../namehash';

describe('AnimalDomainHelper', () => {
  const helper = new AnimalDomainHelper();

  describe('.resellerAnimalAttributes', () => {
    it('non crypto domain', async () => {
      const domain = await DomainTestHelper.createTestDomain({
        name: 'noncrypto.wallet',
        node: eip137Namehash('noncrypto.wallet'),
      });
      const attributes = helper.resellerAnimalAttributes(domain.name);
      expect(attributes.length).to.equal(1);
      expect(attributes[0]).to.deep.equal({
        trait_type: 'type',
        value: 'standard',
      });
    });

    it('animalDomain with no prefix', async () => {
      const domain = await DomainTestHelper.createTestDomain({
        name: 'lemming.crypto',
        node: eip137Namehash('lemming.crypto'),
      });
      const attributes = helper.resellerAnimalAttributes(domain.name);
      expect(attributes.length).to.equal(2);
      expect(attributes[0]).to.deep.equal({
        trait_type: 'animal',
        value: 'lemming',
      });
      expect(attributes[1]).to.deep.equal({
        trait_type: 'type',
        value: 'animal',
      });
    });

    it('animalDomain with prefix', async () => {
      const domain = await DomainTestHelper.createTestDomain({
        name: 'unstoppablelemming.crypto',
        node: eip137Namehash('unstoppablelemming.crypto'),
      });
      const attributes = helper.resellerAnimalAttributes(domain.name);
      expect(attributes.length).to.equal(3);
      expect(attributes[0]).to.deep.equal({
        trait_type: 'adjective',
        value: 'unstoppable',
      });
      expect(attributes[1]).to.deep.equal({
        trait_type: 'animal',
        value: 'lemming',
      });
      expect(attributes[2]).to.deep.equal({
        trait_type: 'type',
        value: 'animal',
      });
    });

    it('not animal domain', async () => {
      const domain = await DomainTestHelper.createTestDomain({});
      const attributes = helper.resellerAnimalAttributes(domain.name);
      expect(attributes.length).to.equal(1);
      expect(attributes[0]).to.deep.equal({
        trait_type: 'type',
        value: 'standard',
      });
    });
  });
});
