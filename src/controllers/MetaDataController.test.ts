import supertest from 'supertest';
import { api } from '../api';
import { expect } from 'chai';
import { DomainTestHelper } from '../utils/testing/DomainTestHelper';
import fetch from 'node-fetch';
import { eip137Namehash } from '../utils/namehash';
import { DefaultImageData, BackgroundColor } from '../utils/generalImage';
import { Domain } from '../models';

describe('MetaDataController', () => {
  describe('GET /metadata/:DomainOrToken', () => {
    it('should work', async () => {
      const { domain } = await DomainTestHelper.createTestDomain({
        resolution: {
          'crypto.BTC.address': 'beabbeabbeabeabeabeabeabeabeabeabeabeabeab',
          'crypto.ETH.address': '0xdeadeadeadeadeadeadeadeadeadeadeadeadead',
          'ipfs.html.value': 'QmdyBw5oTgCtTLQ18PbDvPL8iaLoEPhSyzD91q9XmgmAjb',
        },
      });
      const resWithName = await supertest(api)
        .get(`/metadata/${domain.name}`)
        .send()
        .then((r) => r.body);

      const resWithToken = await supertest(api)
        .get(`/metadata/${domain.node}`)
        .send()
        .then((r) => r.body);

      expect(resWithName).to.be.deep.equal(resWithToken);
      expect(resWithName.name).eq(domain.name);
      expect(resWithName.description).eq(
        'A CNS or UNS blockchain domain. Use it to resolve your cryptocurrency addresses and decentralized websites.\nhttps://gateway.pinata.cloud/ipfs/QmdyBw5oTgCtTLQ18PbDvPL8iaLoEPhSyzD91q9XmgmAjb',
      );
      expect(resWithName.external_url).eq(
        'https://unstoppabledomains.com/search?searchTerm=testdomain.crypto',
      );
      expect(resWithName.image).eq(
        'https://storage.googleapis.com/dot-crypto-metadata-api/images/unstoppabledomains.svg',
      );
      expect(resWithName.attributes.length).eq(7);
      const correctAttributes = [
        { trait_type: 'domain', value: 'testdomain.crypto' },
        { trait_type: 'level', value: 2 },
        { trait_type: 'length', value: 10 },
        {
          trait_type: 'BTC',
          value: 'beabbeabbeabeabeabeabeabeabeabeabeabeabeab',
        },
        {
          trait_type: 'ETH',
          value: '0xdeadeadeadeadeadeadeadeadeadeadeadeadead',
        },
        {
          trait_type: 'IPFS Content',
          value: 'QmdyBw5oTgCtTLQ18PbDvPL8iaLoEPhSyzD91q9XmgmAjb',
        },
        { trait_type: 'type', value: 'standard' },
      ];
      expect(resWithName.attributes).to.have.deep.members(correctAttributes);
      expect(resWithName.image_data).eq(
        DefaultImageData({
          label: domain.label,
          tld: domain.extension,
          fontSize: 24,
        }),
      );
      expect(resWithName.background_color).eq(BackgroundColor);
    });

    it('should work with animal domain', async () => {
      const { domain: animalDomain } = await DomainTestHelper.createTestDomain({
        name: 'unstoppablelemming.crypto',
        node:
          '0xccfd2756994b2ea38fcd2deaf3ae2b2a4678fce6e81fbe4f856ceb0cb50dfee9',
        ownerAddress: '0xe7474d07fd2fa286e7e0aa23cd107f8379085037',
        resolver: '0x878bc2f3f717766ab69c0a5f9a6144931e61aed3',
        resolution: {
          'crypto.ETH.address': '0xe7474D07fD2FA286e7e0aa23cd107F8379085037',
        },
        location: 'CNS',
      });

      const response = await supertest(api)
        .get(`/metadata/${animalDomain.name}`)
        .send()
        .then((r) => r.body);

      const responseWithToken = await supertest(api)
        .get(`/metadata/${animalDomain.node}`)
        .send()
        .then((r) => r.body);

      expect(response).to.deep.eq(responseWithToken);
      expect(response.name).to.eq(animalDomain.name);
      expect(response.description).to.eq(
        'A CNS or UNS blockchain domain. Use it to resolve your cryptocurrency addresses and decentralized websites.',
      );
      expect(response.external_url).to.eq(
        'https://unstoppabledomains.com/search?searchTerm=unstoppablelemming.crypto',
      );
      expect(response.image).to.eq(
        'https://storage.googleapis.com/dot-crypto-metadata-api/images/animals/lemming.svg',
      );

      const correctAttributes = [
        {
          trait_type: 'domain',
          value: 'unstoppablelemming.crypto',
        },
        {
          trait_type: 'level',
          value: 2,
        },
        {
          trait_type: 'length',
          value: 18,
        },
        {
          trait_type: 'ETH',
          value: '0xe7474D07fD2FA286e7e0aa23cd107F8379085037',
        },
        {
          trait_type: 'adjective',
          value: 'unstoppable',
        },
        {
          trait_type: 'animal',
          value: 'lemming',
        },
        {
          trait_type: 'type',
          value: 'animal',
        },
      ];
      expect(response.attributes.length).to.eq(correctAttributes.length);
      expect(response.attributes).to.have.deep.members(correctAttributes);
      expect(response.background_color).to.eq('4C47F7');
      const correctImageData = await fetch(
        'https://storage.googleapis.com/dot-crypto-metadata-api/images/animals/lemming.svg',
      ).then((r) => r.text());
      expect(response.image_data).to.eq(correctImageData);
    });

    it('should return branded animal domain metadata', async () => {
      const { domain: animalDomain } = await DomainTestHelper.createTestDomain({
        name: 'trustbear.crypto',
        node:
          '0x329b868d34359c1961358088be9bfbd21e65eb8ab95e90b21e50d99c02b34c72',
      });
      const expectedImageUrl =
        'https://storage.googleapis.com/dot-crypto-metadata-api/images/trust/bear.svg';
      const response = await supertest(api)
        .get(`/metadata/${animalDomain.name}`)
        .send()
        .then((r) => r.body);
      expect(response.image).to.equal(expectedImageUrl);
      expect(response.attributes).to.deep.equal([
        { trait_type: 'domain', value: 'trustbear.crypto' },
        { trait_type: 'level', value: 2 },
        { trait_type: 'length', value: 9 },
        { trait_type: 'animal', value: 'bear' },
        { trait_type: 'type', value: 'animal' },
      ]);
    });

    it('should return default response for unknown domain/token', async () => {
      const response = await supertest(api)
        .get('/metadata/unknown.crypto')
        .send()
        .then((r) => r.body);
      expect(response).to.deep.eq({
        name: 'unknown.crypto',
        description:
          'A CNS or UNS blockchain domain. Use it to resolve your cryptocurrency addresses and decentralized websites.',
        external_url:
          'https://unstoppabledomains.com/search?searchTerm=unknown.crypto',
        image:
          'https://storage.googleapis.com/dot-crypto-metadata-api/images/unstoppabledomains.svg',
        image_data: DefaultImageData({
          label: 'unknown',
          tld: 'crypto',
          fontSize: 24,
        }),
        attributes: [
          { trait_type: 'domain', value: 'unknown.crypto' },
          { trait_type: 'level', value: 2 },
          { trait_type: 'length', value: 7 },
          { trait_type: 'type', value: 'standard' },
        ],
      });
      const token = eip137Namehash('unknown.crypto');
      const responseWithNode = await supertest(api)
        .get(`/metadata/${token}`)
        .send()
        .then((r) => r.body);
      expect(responseWithNode).to.deep.eq({
        name: null,
        description: null,
        external_url: null,
        image: null,
        image_data: null,
        attributes: [],
      });
    });

    it('should work with special domains', async () => {
      const CUSTOM_IMAGE_URL = 'https://storage.googleapis.com/dot-crypto-metadata-api/images/custom' as const;
      const domainsWithCustomImage: Record<string, string> = {
        'code.crypto': 'code.svg',
        'web3.crypto': 'web3.svg',
        'privacy.crypto': 'privacy.svg',
        'surf.crypto': 'surf.svg',
        'hosting.crypto': 'hosting.svg',
        'india.crypto': 'india.jpg',
      };
      const specialLabels = [
        'code',
        'web3',
        'privacy',
        'surf',
        'hosting',
        'india',
      ];
      const specialDomains = await Promise.all(
        specialLabels.map((label) => {
          const domain = `${label}.crypto`;

          return DomainTestHelper.createTestDomain({
            name: domain,
            node: eip137Namehash(domain),
            resolution:
              label === 'india'
                ? {
                    'ipfs.html.value':
                      'QmQq1ydvSmzrZPkr4CJJtetNSb9eSBucqQ4QoNmiRdMHzM',
                  }
                : {},
          });
        }),
      );

      for (const { domain } of specialDomains) {
        const response = await supertest(api)
          .get(`/metadata/${domain.name}`)
          .send()
          .then((r) => r.body);

        expect(response.name).to.eq(domain.name);
        if (domain.name === 'india.crypto') {
          expect(response.description).to.eq(
            'This exclusive art piece by Amrit Pal Singh features hands of different skin tones spelling out the word HOPE in sign language. Hope embodies people coming together and having compassion for others in a way that transcends geographical borders. This art is a reminder that, while one individual can’t uplift humanity on their own, collective and inclusive efforts give rise to meaningful change.\nhttps://gateway.pinata.cloud/ipfs/QmQq1ydvSmzrZPkr4CJJtetNSb9eSBucqQ4QoNmiRdMHzM',
          );
        } else {
          expect(response.description).to.eq(
            'A CNS or UNS blockchain domain. Use it to resolve your cryptocurrency addresses and decentralized websites.',
          );
        }
        expect(response.external_url).to.eq(
          `https://unstoppabledomains.com/search?searchTerm=${domain.name}`,
        );
        expect(response.image).to.eq(
          `${CUSTOM_IMAGE_URL}/${domainsWithCustomImage[domain.name]}`,
        );
        const correctAttributes = [
          {
            trait_type: 'domain',
            value: domain.name,
          },
          {
            trait_type: 'level',
            value: 2,
          },
          {
            trait_type: 'length',
            value: domain.label.length,
          },
          {
            trait_type: 'type',
            value: 'standard',
          },
        ];
        if (domain.label === 'india') {
          correctAttributes.push({
            trait_type: 'IPFS Content',
            value: 'QmQq1ydvSmzrZPkr4CJJtetNSb9eSBucqQ4QoNmiRdMHzM',
          });
        }
        expect(response.attributes.length).to.eq(correctAttributes.length);
        expect(response.attributes).to.have.deep.members(correctAttributes);
      }
    });

    it('should return the same attributes regardless of what record key is used for ipfs', async () => {
      const {
        domain: domainHtmlValue,
      } = await DomainTestHelper.createTestDomain({
        resolution: { 'ipfs.html.value': 'ipfs hash content' },
      });
      const {
        domain: domainDwebHash,
      } = await DomainTestHelper.createTestDomain({
        name: 'testdomain2.crypto',
        node: eip137Namehash('testdomain2.crypto'),
        resolution: { 'dweb.ipfs.hash': 'ipfs hash content' },
      });

      const htmlValueResponse = await supertest(api)
        .get(`/metadata/${domainHtmlValue.name}`)
        .send()
        .then((r) => r.body);

      const dwebHashResponse = await supertest(api)
        .get(`/metadata/${domainDwebHash.name}`)
        .send()
        .then((r) => r.body);

      expect(dwebHashResponse.attributes).to.deep.contain({
        trait_type: 'IPFS Content',
        value: 'ipfs hash content',
      });

      expect(htmlValueResponse.attributes).to.deep.contain({
        trait_type: 'IPFS Content',
        value: 'ipfs hash content',
      });
    });

    it('should return the dweb.ipfs.hash record when ipfs.html.value is also set', async () => {
      const { domain } = await DomainTestHelper.createTestDomain({
        resolution: { 'dweb.ipfs.hash': 'correct', 'ipfs.html.value': 'wrong' },
      });
      const response = await supertest(api)
        .get(`/metadata/${domain.name}`)
        .send()
        .then((r) => r.body);
      expect(response.attributes).to.deep.contain({
        trait_type: 'IPFS Content',
        value: 'correct',
      });
    });
  });

  describe('GET /image/:domainOrToken', () => {
    it('should resolve image_data with provided domain', async () => {
      const { domain } = await DomainTestHelper.createTestDomain({});
      const res = await supertest(api)
        .get(`/image/${domain.name}`)
        .send()
        .then((r) => r.body);
      const defaultImageData = DefaultImageData({
        label: domain.label,
        tld: domain.extension,
        fontSize: 24,
      });
      expect(res.image_data).to.equal(defaultImageData);
    });

    it('should resolve image_data with provided tokenId', async () => {
      const { domain } = await DomainTestHelper.createTestDomain({});
      const res = await supertest(api)
        .get(`/image/${domain.node}`)
        .send()
        .then((r) => r.body);
      const defaultImageData = DefaultImageData({
        label: domain.label,
        tld: domain.extension,
        fontSize: 24,
      });
      expect(res.image_data).to.equal(defaultImageData);
    });

    it(`should resolve image_data as animal domain`, async () => {
      const { domain } = await DomainTestHelper.createTestDomain({
        name: 'unstoppablelemming.crypto',
        node: eip137Namehash('unstoppablelemming.crypto'),
      });

      const res = await supertest(api)
        .get(`/image/${domain.name}`)
        .send()
        .then((r) => r.body);

      const correctImageData = await fetch(
        'https://storage.googleapis.com/dot-crypto-metadata-api/images/animals/lemming.svg',
      ).then((r) => r.text());
      expect(res.image_data).to.equal(correctImageData);
    });

    it('should return null value when no domain is found', async () => {
      const response = await supertest(api)
        .get('/image/unknown.crypto')
        .send()
        .then((r) => r.body);
      expect(response).to.deep.eq({
        image_data: DefaultImageData({
          label: 'unknown',
          tld: 'crypto',
          fontSize: 24,
        }),
      });
      const token = eip137Namehash('unknown.crypto');
      const responseWithNode = await supertest(api)
        .get(`/image/${token}`)
        .send()
        .then((r) => r.body);
      expect(responseWithNode).to.deep.eq({
        image_data: '',
      });
    });
  });
});
