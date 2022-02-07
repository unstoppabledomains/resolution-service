import AnimalDomainHelper from './AnimalDomainHelper';
import { expect } from 'chai';

describe('AnimalDomainHelper', () => {
  const helper = new AnimalDomainHelper();

  describe('.resellerAnimalAttributes', () => {
    it('non crypto domain', async () => {
      const attributes = helper.getAnimalAttributes('noncrypto.wallet');
      expect(attributes.length).to.equal(0);
    });

    it('animalDomain with no prefix', async () => {
      const attributes = helper.getAnimalAttributes('lemming.crypto');
      expect(attributes.length).to.equal(1);
      expect(attributes[0]).to.deep.equal({
        trait_type: 'animal',
        value: 'lemming',
      });
    });

    it('should return not animal for premium domain with animal prefix', async () => {
      const attributes = helper.getAnimalAttributes('whale.crypto');
      expect(attributes.length).to.equal(0);
    });

    it('should return not animal for domain with custom image', async () => {
      const attributes = helper.getAnimalAttributes('surf.crypto');
      expect(attributes.length).to.equal(0);
    });

    it('animalDomain with prefix', async () => {
      const attributes = helper.getAnimalAttributes(
        'unstoppablelemming.crypto',
      );
      expect(attributes.length).to.equal(2);
      expect(attributes[0]).to.deep.equal({
        trait_type: 'adjective',
        value: 'unstoppable',
      });
      expect(attributes[1]).to.deep.equal({
        trait_type: 'animal',
        value: 'lemming',
      });
    });

    it('not animal domain', async () => {
      const attributes = helper.getAnimalAttributes('standard.crypto');
      expect(attributes.length).to.equal(0);
    });

    it('should return correct image url for branded animals', async () => {
      expect(BrandedAnimalsDomains.length).to.be.greaterThan(0); // Ensure that we have items to check
      BrandedAnimalsDomains.forEach((domainName: string) => {
        const url = helper.getAnimalImageUrl(domainName);
        const expectedUrl = BrandedAnimalsUrls[domainName];
        expect(url).to.equal(expectedUrl);
      });
    });

    it('should return correct metadata for branded animals', async () => {
      expect(BrandedAnimalsDomains.length).to.be.greaterThan(0); // Ensure that we have items to check
      BrandedAnimalsDomains.forEach((domainName: string) => {
        const attributes = helper.getAnimalAttributes(domainName);
        expect(attributes).to.deep.equal([
          { trait_type: 'animal', value: 'badger' },
        ]);
      });
    });

    it('should return correct image url for default animals', async () => {
      const url = helper.getAnimalImageUrl('fancybear.crypto');
      const expectedUrl =
        'https://storage.googleapis.com/dot-crypto-metadata-api/images/animals/bear.svg';
      expect(url).to.equal(expectedUrl);
    });

    it('should return correct url for brand prefixes', async () => {
      expect(BrandPrefixDomains.length).to.be.greaterThan(0); // Ensure that we have items to check
      BrandPrefixDomains.forEach((domain) => {
        const url = helper.getAnimalImageUrl(domain);
        const expectedUrl = BrandPrefixUrlsMap[domain];
        expect(url).to.be.equal(expectedUrl);
      });
    });
  });
});

const BrandedAnimalsUrls: Record<string, string> = {
  'dchatbadger.crypto':
    'https://storage.googleapis.com/dot-crypto-metadata-api/images/dchat/badger.svg',
  'switcheobadger.crypto':
    'https://storage.googleapis.com/dot-crypto-metadata-api/images/switcheo/badger.svg',
  'equalbadger.crypto':
    'https://storage.googleapis.com/dot-crypto-metadata-api/images/equal/badger.svg',
  'zilliqabadger.crypto':
    'https://storage.googleapis.com/dot-crypto-metadata-api/images/zilliqa/badger.svg',
  'bountybadger.crypto':
    'https://storage.googleapis.com/dot-crypto-metadata-api/images/bounty/badger.svg',
  'btgbadger.crypto':
    'https://storage.googleapis.com/dot-crypto-metadata-api/images/btg/badger.svg',
  'harmonybadger.crypto':
    'https://storage.googleapis.com/dot-crypto-metadata-api/images/harmony/badger.svg',
  'operabadger.crypto':
    'https://storage.googleapis.com/dot-crypto-metadata-api/images/opera/badger.svg',
  'eljabadger.crypto':
    'https://storage.googleapis.com/dot-crypto-metadata-api/images/elja/badger.svg',
  'qtumbadger.crypto':
    'https://storage.googleapis.com/dot-crypto-metadata-api/images/qtum/badger.svg',
  'atomicbadger.crypto':
    'https://storage.googleapis.com/dot-crypto-metadata-api/images/atomic/badger.svg',
  'dappbadger.crypto':
    'https://storage.googleapis.com/dot-crypto-metadata-api/images/dapp/badger.svg',
  'trustbadger.crypto':
    'https://storage.googleapis.com/dot-crypto-metadata-api/images/trust/badger.svg',
};

const BrandedAnimalsDomains: string[] = Object.keys(BrandedAnimalsUrls);

const BrandPrefixUrlsMap: Record<string, string> = {
  'decentralizedbadger.crypto':
    'https://storage.googleapis.com/dot-crypto-metadata-api/images/dchat/badger.svg',
  'awcbadger.crypto':
    'https://storage.googleapis.com/dot-crypto-metadata-api/images/atomic/badger.svg',
  'bntybadger.crypto':
    'https://storage.googleapis.com/dot-crypto-metadata-api/images/bounty/badger.svg',
  'zilbadger.crypto':
    'https://storage.googleapis.com/dot-crypto-metadata-api/images/zilliqa/badger.svg',
  'eqlbadger.crypto':
    'https://storage.googleapis.com/dot-crypto-metadata-api/images/equal/badger.svg',
  'ajoobzbadger.crypto':
    'https://storage.googleapis.com/dot-crypto-metadata-api/images/elja/badger.svg',
  'bitcoingoldbadger.crypto':
    'https://storage.googleapis.com/dot-crypto-metadata-api/images/btg/badger.svg',
};

const BrandPrefixDomains: string[] = Object.keys(BrandPrefixUrlsMap);
