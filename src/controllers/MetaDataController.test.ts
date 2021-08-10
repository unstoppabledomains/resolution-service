import supertest from 'supertest';
import { api } from '../api';
import { expect } from 'chai';
import { DomainTestHelper } from '../utils/testing/DomainTestHelper';
import fetch from 'node-fetch';
import { eip137Namehash } from '../utils/namehash';
import { Attribute } from '../types/common';

describe('MetaDataController', () => {
  describe('GET /metadata/:DomainOrToken', () => {
    it('should work', async () => {
      const domain = await DomainTestHelper.createTestDomain({
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
        'https://storage.googleapis.com/dot-crypto-metadata-api/unstoppabledomains_crypto.png',
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
      expect(resWithName.image_data)
        .eq(`<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="250px" height="250px" viewBox="0 0 250 250" version="1.1">
  <!-- Generator: Sketch 61 (89581) - https://sketch.com -->
  <title>unstoppabledomains_dot_crypto-</title>
  <desc>Created with Sketch.</desc>
  <g id="unstoppabledomains" stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">
      <rect fill="#4C47F7" x="0" y="0" width="100%" height="100%"/>
      <g id="Group-6" transform="translate(70.000000, 154.000000)">
          <g id="Group" transform="translate(5.000000, 43.000000)">
          <rect x="${
            domain.extension === 'blockchain' ? -26 : 0
          }" y="0" width="${
        domain.extension === 'blockchain' ? 150 : 100
      }" height="34" stroke="#2FE9FF" stroke-width="2.112px" rx="17"/>
              <text  dominant-baseline="middle" text-anchor="middle" font-size="16" font-weight="bold" fill="#FFFFFF" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Ubuntu, 'Helvetica Neue', Oxygen, Cantarell, sans-serif"> <tspan x="19%" y="20">.${domain.extension.toUpperCase()}</tspan></text>
          </g>
          <text text-anchor="middle" id="domain" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Ubuntu, 'Helvetica Neue', Oxygen, Cantarell, sans-serif" font-size="24" font-weight="bold" fill="#FFFFFF">
              <tspan x="22.5%" y="26">${domain.label}</tspan>
          </text>
      </g>
      <g id="sign" transform="translate(56.000000, 19.000000)">
          <polygon id="Rectangle-Copy-3" fill="#2FE9FF" points="137.000268 2.12559903 137.000268 48.8887777 -2.72848394e-13 104.154352"/>
          <path d="M111.312718,-1.42108539e-14 L111.312718,80.7727631 C111.312718,104.251482 92.1448713,123.284744 68.5001341,123.284744 C44.855397,123.284744 25.6875503,104.251482 25.6875503,80.7727631 L25.6875503,46.7631786 L51.3751006,32.734225 L51.3751006,80.7727631 C51.3751006,88.9903146 58.0838469,95.6519563 66.3595049,95.6519563 C74.6351629,95.6519563 81.3439093,88.9903146 81.3439093,80.7727631 L81.3439093,16.3671125 L111.312718,-1.42108539e-14 Z" id="Path" fill="#FFFFFF"/>
      </g>
  </g>
</svg>`);
      expect(resWithName.background_color).eq('4C47F7');
    });

    it('should work with animal domain', async () => {
      const animalDomain = await DomainTestHelper.createTestDomain({
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
        'https://storage.googleapis.com/dot-crypto-metadata-api/unstoppabledomains_crypto.png',
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
        'https://storage.googleapis.com/dot-crypto-metadata.appspot.com/images/animals/lemming.svg',
      ).then((r) => r.text());
      expect(response.image_data).to.eq(correctImageData);
    });

    it('should return an error with unknown domain/token', async () => {
      const response = await supertest(api)
        .get('/metadata/unknown.crypto')
        .send();
      expect(response.text).to.eq(
        '{"code":"Error","message":"Entity unknown.crypto is not found","errors":[{}]}',
      );
      const token = eip137Namehash('unknown.crypto');
      const responseWithNode = await supertest(api)
        .get(`/metadata/${token}`)
        .send();
      expect(responseWithNode.text).to.eq(
        `{"code":"Error","message":"Entity ${token} is not found","errors":[{}]}`,
      );
    });

    it('should work with special domains', async () => {
      // These domains should contain the correct image in the database after the 1628218575346-AddImageFieldToDomain migration
      const CUSTOM_IMAGE_URL = 'https://storage.googleapis.com/dot-crypto-metadata.appspot.com/images/custom' as const;
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
            image: `${CUSTOM_IMAGE_URL}/${domainsWithCustomImage[domain]}`,
          });
        }),
      );

      for (const domain of specialDomains) {
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
      const domainHtmlValue = await DomainTestHelper.createTestDomain({
        resolution: { 'ipfs.html.value': 'ipfs hash content' },
      });
      const domainDwebHash = await DomainTestHelper.createTestDomain({
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
      const domain = await DomainTestHelper.createTestDomain({
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
});
