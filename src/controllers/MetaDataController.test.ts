import supertest, { SuperAgentTest } from 'supertest';
import { api } from '../api';
import { expect } from 'chai';
import { DomainTestHelper } from '../utils/testing/DomainTestHelper';
import { eip137Namehash } from '../utils/namehash';
import { DefaultImageData, BackgroundColor } from '../utils/generalImage';
import nock from 'nock';
import sinon from 'sinon';
import * as socialModule from '../utils/socialPicture/index';
import {
  getNSConfig,
  LayerTestFixture,
} from '../utils/testing/LayerFixturesHelper';
import { EthereumHelper } from '../utils/testing/EthereumTestsHelper';
import { Blockchain } from '../types/common';
import { env } from '../env';
import Domain from '../models/Domain';

describe('MetaDataController', () => {
  const L1Fixture: LayerTestFixture = new LayerTestFixture();
  const L2Fixture: LayerTestFixture = new LayerTestFixture();

  before(async () => {
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
    await L1Fixture.networkHelper.stopNetwork();
    await L2Fixture.networkHelper.stopNetwork();
  });

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
      expect(resWithName.attributes.length).eq(5);
      const correctAttributes = [
        { trait_type: 'domain', value: 'testdomain.crypto' },
        { trait_type: 'level', value: 2 },
        { trait_type: 'length', value: 10 },
        {
          trait_type: 'IPFS Content',
          value: 'QmdyBw5oTgCtTLQ18PbDvPL8iaLoEPhSyzD91q9XmgmAjb',
        },
        { trait_type: 'type', value: 'standard' },
      ];
      expect(resWithName.attributes).to.have.deep.members(correctAttributes);
      const correctProperties = {
        records: {
          'crypto.BTC.address': 'beabbeabbeabeabeabeabeabeabeabeabeabeabeab',
          'crypto.ETH.address': '0xdeadeadeadeadeadeadeadeadeadeadeadeadead',
          'ipfs.html.value': 'QmdyBw5oTgCtTLQ18PbDvPL8iaLoEPhSyzD91q9XmgmAjb',
        },
      };
      expect(resWithName.properties).to.deep.eq(correctProperties);
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
      nock('https://storage.googleapis.com')
        .get('/dot-crypto-metadata-api/images/animals/lemming.svg')
        .twice()
        .reply(200, 'correctImageData');

      const { domain: animalDomain } = await DomainTestHelper.createTestDomain({
        name: 'unstoppablelemming.crypto',
        node:
          '0xccfd2756994b2ea38fcd2deaf3ae2b2a4678fce6e81fbe4f856ceb0cb50dfee9',
        ownerAddress: '0xe7474d07fd2fa286e7e0aa23cd107f8379085037',
        resolution: {
          'crypto.ETH.address': '0xe7474D07fD2FA286e7e0aa23cd107F8379085037',
        },
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

      const correctProperties = {
        records: {
          'crypto.ETH.address': '0xe7474D07fD2FA286e7e0aa23cd107F8379085037',
        },
      };
      expect(response.properties).to.deep.eq(correctProperties);
      expect(response.background_color).to.eq('4C47F7');
      expect(response.image_data).to.eq('correctImageData');
    });

    it('should return branded animal domain metadata', async () => {
      nock('https://storage.googleapis.com')
        .get('/dot-crypto-metadata-api/images/trust/bear.svg')
        .reply(200, '');

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
        properties: {
          records: {},
        },
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
        properties: {
          records: {},
        },
        description: null,
        external_url: null,
        image: null,
        image_data: null,
        attributes: [],
      });
    });

    it('should query the newURI event on the fly to return a freshly minted domain', async () => {
      const uns = getNSConfig('wallet');
      const owner = L2Fixture.networkHelper.owner().address;
      await L2Fixture.prepareService(owner, uns);

      const token = uns.node.toHexString();
      const responseWithNode = await supertest(api)
        .get(`/metadata/${token}`)
        .send()
        .then((r) => r.body);
      expect(responseWithNode).to.deep.eq({
        name: uns.name,
        properties: {
          records: {},
        },
        description:
          'A CNS or UNS blockchain domain. Use it to resolve your cryptocurrency addresses and decentralized websites.',
        external_url: `https://unstoppabledomains.com/search?searchTerm=${uns.name}`,
        image:
          'https://storage.googleapis.com/dot-crypto-metadata-api/images/unstoppabledomains.svg',
        image_data: DefaultImageData({
          label: uns.label,
          tld: uns.tld,
          fontSize: 16,
        }),
        background_color: '4C47F7',
        attributes: [
          { trait_type: 'domain', value: uns.name },
          { trait_type: 'level', value: 2 },
          { trait_type: 'length', value: uns.label.length },
          { trait_type: 'type', value: 'standard' },
        ],
      });

      // domain should not be saved during this call
      const domain = await Domain.findByNode(uns.node.toHexString());
      expect(domain).to.be.undefined;
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

      expect(dwebHashResponse.properties).to.deep.equals({
        records: { 'dweb.ipfs.hash': 'ipfs hash content' },
      });
      expect(htmlValueResponse.properties).to.deep.equals({
        records: { 'ipfs.html.value': 'ipfs hash content' },
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
      expect(response.properties).to.deep.eq({
        records: {
          'dweb.ipfs.hash': 'correct',
          'ipfs.html.value': 'wrong',
        },
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
      nock('https://storage.googleapis.com')
        .get('/dot-crypto-metadata-api/images/animals/lemming.svg')
        .reply(200, 'correct image data');

      const { domain } = await DomainTestHelper.createTestDomain({
        name: 'unstoppablelemming.crypto',
        node: eip137Namehash('unstoppablelemming.crypto'),
      });

      const res = await supertest(api)
        .get(`/image/${domain.name}`)
        .send()
        .then((r) => r.body);

      expect(res.image_data).to.equal('correct image data');
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

    it('should query the newURI event and return image data for default domain if such exists', async () => {
      const uns = getNSConfig('nft');
      const owner = L2Fixture.networkHelper.owner().address;
      await L2Fixture.prepareService(owner, uns);

      const response = await supertest(api)
        .get(`/image/${uns.node.toHexString()}`)
        .send()
        .then((r) => r.body);

      expect(response).to.deep.eq({
        image_data: DefaultImageData({
          label: uns.label,
          tld: uns.tld,
          fontSize: 16,
        }),
      });

      const responseWithName = await supertest(api)
        .get(`/image/${uns.name}`)
        .send()
        .then((r) => r.body);
      expect(responseWithName).to.deep.eq({
        image_data: DefaultImageData({
          label: uns.label,
          tld: uns.tld,
          fontSize: 16,
        }),
      });
    });
  });

  describe('GET /metadata and /image with stubs', () => {
    const sandbox = sinon.createSandbox();
    let isOwnedByAddressStub: sinon.SinonStub;
    let getTokenURIStub: sinon.SinonStub;
    let getImageFromTokenURIStub: sinon.SinonStub;
    let getNFTSocialPictureStub: sinon.SinonStub;
    let agent: SuperAgentTest;

    beforeEach(async () => {
      sandbox.restore();
      isOwnedByAddressStub = sandbox.stub(socialModule, 'isOwnedByAddress');
      isOwnedByAddressStub.resolves(true);

      getTokenURIStub = sandbox.stub(socialModule, 'getTokenURI');
      getTokenURIStub.resolves(
        'https://time.mypinata.cloud/ipfs/QmTfEF7WNLkkD51vGY4Yrj77p3aBjGf15gRcuQzWXMUCC8/3531',
      );

      getImageFromTokenURIStub = sandbox.stub(
        socialModule,
        'getImageURLFromTokenURI',
      );
      getImageFromTokenURIStub.resolves(
        'ipfs://QmYMeZcMhfxt9yvQtHBgudMsAPvLTSb2H2j178orf9ZnNM',
      );

      getNFTSocialPictureStub = sandbox.stub(
        socialModule,
        'getNFTSocialPicture',
      );
      getNFTSocialPictureStub.resolves(['base64Data', 'image/jpeg']);
      const mockedApi = await import('../api');
      agent = supertest.agent(mockedApi.api);
    });

    it('should return the same image regardless of endpoint', async () => {
      const domain = await DomainTestHelper.createTestDomain({
        name: 'matt.crypto',
        node: eip137Namehash('matt.crypto'),
        resolution: {
          'social.picture.value':
            '1/erc721:0x9307edc4f23d87f9783a999f870b728ab9d34fe5/3531',
        },
        ownerAddress: '0xa59C818Ddb801f1253edEbf0Cf08c9E481EA2fE5',
      });

      const metadataResponse = await agent
        .get(`/metadata/${domain.domain.name}`)
        .send()
        .then((r) => r.body);

      const imageResponse = await agent
        .get(`/image/${domain.domain.name}`)
        .send()
        .then((r) => r.body);

      const expectedBase64Data =
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDMwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgICA8ZGVmcz4KICAgICAgICAgIDxwYXR0ZXJuIGlkPSJiYWNrSW1nIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIiB4PSIwIiB5PSIwIiB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCI+CiAgICAgICAgICAgIDxpbWFnZSBocmVmPSJkYXRhOmltYWdlL2pwZWc7YmFzZTY0LGJhc2U2NERhdGEiIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIiAvPgogICAgICAgICAgPC9wYXR0ZXJuPgogICAgICAgICAgPGZpbHRlciBpZD0ic2hhZG93eSI+CiAgICAgICAgICAgIDxmZURpZmZ1c2VMaWdodGluZyBpbj0iU291cmNlR3JhcGhpYyIgcmVzdWx0PSJsaWdodCIKICAgICAgICAgICAgICAgIGxpZ2h0aW5nLWNvbG9yPSJ3aGl0ZSI+CiAgICAgICAgICAgICAgPGZlRGlzdGFudExpZ2h0IGF6aW11dGg9IjI0MCIgZWxldmF0aW9uPSI0MCIvPgogICAgICAgICAgICA8L2ZlRGlmZnVzZUxpZ2h0aW5nPgogICAgICAgICAgICA8ZmVDb21wb3NpdGUgaW49IlNvdXJjZUdyYXBoaWMiIGluMj0ibGlnaHQiCiAgICAgICAgICAgICAgICAgICAgICAgIG9wZXJhdG9yPSJhcml0aG1ldGljIiBrMT0iMSIgazI9IjAiIGszPSIwIiBrND0iMCIvPgogICAgICAgICAgPC9maWx0ZXI+CiAgICA8L2RlZnM+CiAgICA8cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0idXJsKCNiYWNrSW1nKSIgZmlsdGVyPSJ1cmwoI3NoYWRvd3kpIi8+CgogICAgPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTgsMjEpIj4KICAgICAgPHBhdGggeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiBkPSJNMC42NjY2ODcgNDUuMzg5NUwwLjY3MDM1NCA0NS4zODY3TDAuNjc3Njg3IDQ1LjM4MTJMMC42NjY2ODcgNDUuMzg5NUwwLjY4Nzc3IDQ1LjM3MzlMMTEuNzUxMSAzNy4wNTEyQzExLjY5NTMgMzYuNDY2NSAxMS42NjY3IDM1Ljg3MzkgMTEuNjY2NyAzNS4yNzQ2VjIwLjU2MTlMMjIuNjY2NyAxNC40OTNWMjguODM3OEwzNS41IDE5LjE4MjZWNy40MTI0OUw0OC4zMzMzIDAuMzMyMDMxVjkuNTI2NTFMNTkuMzMzMyAxLjI1MTU3VjMuMDkwNjVMNDguMzMzMyAxMS4wMjA4VjEyLjUxNUw1OS4zMzMzIDQuOTI5NzNWNi43Njg4MUw0OC4zMzMzIDE0LjAwOTNWMTUuNTAzNUw1OS4zMzMzIDguNjA3ODlWMTAuNDQ3TDQ4LjMzMzMgMTYuOTk3OFYxOC40OTNMNTkuMzMzMyAxMi4yODYxVjE0LjEyNTFMNDguMzMzMyAxOS45ODcyVjIxLjQ4MDVMNTkuMzMzMyAxNS45NjQyVjE3LjgwMzNMNDguMzMzMyAyMi45NzQ4VjI0LjQ2OUw1OS4zMzMzIDE5LjY0MjRWMjEuNDgxNUw0OC4zMzMzIDI1Ljk2MzNWMzUuMjc0NkM0OC4zMzMzIDQ1LjQzMTUgNDAuMTI1MiA1My42NjU0IDMwIDUzLjY2NTRDMjEuNzE3MiA1My42NjU0IDE0LjcxNzMgNDguMTU1NCAxMi40NDQxIDQwLjU5TDAuNjc0MDIgNDUuMzg1OEwwLjY2NjY4NyA0NS4zODk1Wk0xMi4yNjExIDM5LjkzNzJMMC42ODEzNTQgNDUuMzgxMkwwLjY3Njc3IDQ1LjM4NEwxMi4zNDg5IDQwLjI2MkMxMi4zMTg2IDQwLjE1NDEgMTIuMjg5NCA0MC4wNDU4IDEyLjI2MTEgMzkuOTM3MlpNMTEuODY4OCAzOC4wMTQ4TDAuNjg3NzcgNDUuMzczOUwwLjY3NzY4NyA0NS4zODEyTDExLjkxOTQgMzguMzM0OEMxMS45MDE2IDM4LjIyODQgMTEuODg0NyAzOC4xMjE3IDExLjg2ODggMzguMDE0OFpNMTIuMTA1OSAzOS4yOTQxTDAuNjk2MDIgNDUuMzczOUwxMi4xODAyIDM5LjYxNDZDMTIuMTU0NSAzOS41MDgyIDEyLjEyOTcgMzkuNDAxMyAxMi4xMDU5IDM5LjI5NDFaTTExLjc4NDggMzcuMzczNUwwLjcwMTUyIDQ1LjM2NDdMMTEuODI0IDM3LjY5NDdDMTEuODEgMzcuNTg3OSAxMS43OTY5IDM3LjQ4MDggMTEuNzg0OCAzNy4zNzM1Wk0zNS41IDMxLjE5MzZMMjIuNzYxOCAzNi4zODUxQzIzLjI4NjQgMzkuNDEwOCAyNS45MTcxIDQxLjcxMTMgMjkuMDgzNCA0MS43MTEzQzMyLjYyNzIgNDEuNzExMyAzNS41IDM4LjgyOTUgMzUuNSAzNS4yNzQ2VjMxLjE5MzZaTTM1LjUgMjkuMDA4OEwyMi42NjY3IDM1LjA0MzhWMzUuMjc0NkMyMi42NjY3IDM1LjQyNjUgMjIuNjcxOSAzNS41NzcxIDIyLjY4MjIgMzUuNzI2NEwzNS41IDMwLjEwMTJWMjkuMDA4OFpNMzUuNSAyNi44MjY3TDIyLjY2NjcgMzMuNjY1NFYzNC4zNTQxTDM1LjUgMjcuOTE3M1YyNi44MjY3Wk0zNS41IDI0LjY0MUwyMi42NjY3IDMyLjI4NTFWMzIuOTc1N0wzNS41IDI1LjczNDNWMjQuNjQxWk0zNS41IDIyLjQ1NzFMMjIuNjY2NyAzMC45MDU4VjMxLjU5NTVMMzUuNSAyMy41NDk1VjIyLjQ1NzFaTTM1LjUgMjAuMjc0MUwyMi42NjY3IDI5LjUyNzRWMzAuMjE2MkwzNS41IDIxLjM2NTZWMjAuMjc0MVpNMC42NzY3NyA0NS4zODRMMC42NzQwMiA0NS4zODU4TDAuNjgxMzU0IDQ1LjM4MTJMMTIuMDM3NyAzOC45NzM2QzEyLjAxNiAzOC44NjcyIDExLjk5NTIgMzguNzYwNCAxMS45NzU0IDM4LjY1MzNMMC42Nzc2ODcgNDUuMzgxMkwwLjY3NDAyIDQ1LjM4NThMMC42NzAzNTQgNDUuMzg2N0wwLjY3Njc3IDQ1LjM4NFoiIGZpbGw9IndoaXRlIi8+CiAgICA8L2c+CiAgICA8ZyB0cmFuc2Zvcm09InNjYWxlKDEpIHRyYW5zbGF0ZSgyNTgsIDIxKSI+CiAgICAgIDxwYXRoIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgZD0iTTIyIDExTDE5LjU2IDguMjFMMTkuOSA0LjUyTDE2LjI5IDMuN0wxNC40IDAuNUwxMSAxLjk2TDcuNiAwLjVMNS43MSAzLjY5TDIuMSA0LjVMMi40NCA4LjJMMCAxMUwyLjQ0IDEzLjc5TDIuMSAxNy40OUw1LjcxIDE4LjMxTDcuNiAyMS41TDExIDIwLjAzTDE0LjQgMjEuNDlMMTYuMjkgMTguM0wxOS45IDE3LjQ4TDE5LjU2IDEzLjc5TDIyIDExWk05LjA5IDE1LjcyTDUuMjkgMTEuOTFMNi43NyAxMC40M0w5LjA5IDEyLjc2TDE0Ljk0IDYuODlMMTYuNDIgOC4zN0w5LjA5IDE1LjcyWiIgZmlsbD0id2hpdGUiLz4KICAgIDwvZz4KICAgIDx0ZXh0CiAgICAgIHg9IjIwIgogICAgICB5PSIyNTAiCiAgICAgIGZvbnQtc2l6ZT0iMzJweCIKICAgICAgZm9udC13ZWlnaHQ9ImJvbGQiCiAgICAgIGZpbGw9IiNGRkZGRkYiCiAgICAgIGZvbnQtZmFtaWx5PSJzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgJ1NlZ29lIFVJJywgUm9ib3RvLCBVYnVudHUsICdIZWx2ZXRpY2EgTmV1ZScsIE94eWdlbiwgQ2FudGFyZWxsLCBzYW5zLXNlcmlmIgogICAgICA+CiAgICAgICAgbWF0dAogICAgPC90ZXh0PgogICAgPHRleHQKICAgICAgeD0iMjAiCiAgICAgIHk9IjI4MCIKICAgICAgZm9udC1zaXplPSIyNHB4IgogICAgICBmaWxsPSIjRkZGRkZGIgogICAgICB3ZWlnaHQ9IjQwMCIKICAgICAgZm9udC1mYW1pbHk9InN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCAnU2Vnb2UgVUknLCBSb2JvdG8sIFVidW50dSwgJ0hlbHZldGljYSBOZXVlJywgT3h5Z2VuLCBDYW50YXJlbGwsIHNhbnMtc2VyaWYiCiAgICAgID4KICAgICAgICAuY3J5cHRvCiAgICA8L3RleHQ+CiAgPC9zdmc+';
      expect(metadataResponse.image).to.equal(expectedBase64Data);
      expect(imageResponse.image_data).to.equal(expectedBase64Data);
    });

    it('should be able to return the correct nft image', async () => {
      const domain = await DomainTestHelper.createTestDomain({
        name: 'matt.crypto',
        node: eip137Namehash('matt.crypto'),
        resolution: {
          'social.picture.value':
            '1/erc721:0x9307edc4f23d87f9783a999f870b728ab9d34fe5/3531',
        },
        ownerAddress: '0xa59C818Ddb801f1253edEbf0Cf08c9E481EA2fE5',
      });

      const response = await agent
        .get(`/metadata/${domain.domain.name}`)
        .send()
        .then((r) => r.body);

      expect(isOwnedByAddressStub.calledOnce).to.eq(true);
      expect(getTokenURIStub.calledOnce).to.eq(true);
      expect(getImageFromTokenURIStub.calledOnce).to.eq(true);
      expect(getNFTSocialPictureStub.calledOnce).to.eq(true);

      const expectedBase64Data =
        'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDMwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CiAgICA8ZGVmcz4KICAgICAgICAgIDxwYXR0ZXJuIGlkPSJiYWNrSW1nIiBwYXR0ZXJuVW5pdHM9InVzZXJTcGFjZU9uVXNlIiB4PSIwIiB5PSIwIiB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCI+CiAgICAgICAgICAgIDxpbWFnZSBocmVmPSJkYXRhOmltYWdlL2pwZWc7YmFzZTY0LGJhc2U2NERhdGEiIHdpZHRoPSIzMDAiIGhlaWdodD0iMzAwIiAvPgogICAgICAgICAgPC9wYXR0ZXJuPgogICAgICAgICAgPGZpbHRlciBpZD0ic2hhZG93eSI+CiAgICAgICAgICAgIDxmZURpZmZ1c2VMaWdodGluZyBpbj0iU291cmNlR3JhcGhpYyIgcmVzdWx0PSJsaWdodCIKICAgICAgICAgICAgICAgIGxpZ2h0aW5nLWNvbG9yPSJ3aGl0ZSI+CiAgICAgICAgICAgICAgPGZlRGlzdGFudExpZ2h0IGF6aW11dGg9IjI0MCIgZWxldmF0aW9uPSI0MCIvPgogICAgICAgICAgICA8L2ZlRGlmZnVzZUxpZ2h0aW5nPgogICAgICAgICAgICA8ZmVDb21wb3NpdGUgaW49IlNvdXJjZUdyYXBoaWMiIGluMj0ibGlnaHQiCiAgICAgICAgICAgICAgICAgICAgICAgIG9wZXJhdG9yPSJhcml0aG1ldGljIiBrMT0iMSIgazI9IjAiIGszPSIwIiBrND0iMCIvPgogICAgICAgICAgPC9maWx0ZXI+CiAgICA8L2RlZnM+CiAgICA8cmVjdCB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgZmlsbD0idXJsKCNiYWNrSW1nKSIgZmlsdGVyPSJ1cmwoI3NoYWRvd3kpIi8+CgogICAgPGcgdHJhbnNmb3JtPSJ0cmFuc2xhdGUoMTgsMjEpIj4KICAgICAgPHBhdGggeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIiBkPSJNMC42NjY2ODcgNDUuMzg5NUwwLjY3MDM1NCA0NS4zODY3TDAuNjc3Njg3IDQ1LjM4MTJMMC42NjY2ODcgNDUuMzg5NUwwLjY4Nzc3IDQ1LjM3MzlMMTEuNzUxMSAzNy4wNTEyQzExLjY5NTMgMzYuNDY2NSAxMS42NjY3IDM1Ljg3MzkgMTEuNjY2NyAzNS4yNzQ2VjIwLjU2MTlMMjIuNjY2NyAxNC40OTNWMjguODM3OEwzNS41IDE5LjE4MjZWNy40MTI0OUw0OC4zMzMzIDAuMzMyMDMxVjkuNTI2NTFMNTkuMzMzMyAxLjI1MTU3VjMuMDkwNjVMNDguMzMzMyAxMS4wMjA4VjEyLjUxNUw1OS4zMzMzIDQuOTI5NzNWNi43Njg4MUw0OC4zMzMzIDE0LjAwOTNWMTUuNTAzNUw1OS4zMzMzIDguNjA3ODlWMTAuNDQ3TDQ4LjMzMzMgMTYuOTk3OFYxOC40OTNMNTkuMzMzMyAxMi4yODYxVjE0LjEyNTFMNDguMzMzMyAxOS45ODcyVjIxLjQ4MDVMNTkuMzMzMyAxNS45NjQyVjE3LjgwMzNMNDguMzMzMyAyMi45NzQ4VjI0LjQ2OUw1OS4zMzMzIDE5LjY0MjRWMjEuNDgxNUw0OC4zMzMzIDI1Ljk2MzNWMzUuMjc0NkM0OC4zMzMzIDQ1LjQzMTUgNDAuMTI1MiA1My42NjU0IDMwIDUzLjY2NTRDMjEuNzE3MiA1My42NjU0IDE0LjcxNzMgNDguMTU1NCAxMi40NDQxIDQwLjU5TDAuNjc0MDIgNDUuMzg1OEwwLjY2NjY4NyA0NS4zODk1Wk0xMi4yNjExIDM5LjkzNzJMMC42ODEzNTQgNDUuMzgxMkwwLjY3Njc3IDQ1LjM4NEwxMi4zNDg5IDQwLjI2MkMxMi4zMTg2IDQwLjE1NDEgMTIuMjg5NCA0MC4wNDU4IDEyLjI2MTEgMzkuOTM3MlpNMTEuODY4OCAzOC4wMTQ4TDAuNjg3NzcgNDUuMzczOUwwLjY3NzY4NyA0NS4zODEyTDExLjkxOTQgMzguMzM0OEMxMS45MDE2IDM4LjIyODQgMTEuODg0NyAzOC4xMjE3IDExLjg2ODggMzguMDE0OFpNMTIuMTA1OSAzOS4yOTQxTDAuNjk2MDIgNDUuMzczOUwxMi4xODAyIDM5LjYxNDZDMTIuMTU0NSAzOS41MDgyIDEyLjEyOTcgMzkuNDAxMyAxMi4xMDU5IDM5LjI5NDFaTTExLjc4NDggMzcuMzczNUwwLjcwMTUyIDQ1LjM2NDdMMTEuODI0IDM3LjY5NDdDMTEuODEgMzcuNTg3OSAxMS43OTY5IDM3LjQ4MDggMTEuNzg0OCAzNy4zNzM1Wk0zNS41IDMxLjE5MzZMMjIuNzYxOCAzNi4zODUxQzIzLjI4NjQgMzkuNDEwOCAyNS45MTcxIDQxLjcxMTMgMjkuMDgzNCA0MS43MTEzQzMyLjYyNzIgNDEuNzExMyAzNS41IDM4LjgyOTUgMzUuNSAzNS4yNzQ2VjMxLjE5MzZaTTM1LjUgMjkuMDA4OEwyMi42NjY3IDM1LjA0MzhWMzUuMjc0NkMyMi42NjY3IDM1LjQyNjUgMjIuNjcxOSAzNS41NzcxIDIyLjY4MjIgMzUuNzI2NEwzNS41IDMwLjEwMTJWMjkuMDA4OFpNMzUuNSAyNi44MjY3TDIyLjY2NjcgMzMuNjY1NFYzNC4zNTQxTDM1LjUgMjcuOTE3M1YyNi44MjY3Wk0zNS41IDI0LjY0MUwyMi42NjY3IDMyLjI4NTFWMzIuOTc1N0wzNS41IDI1LjczNDNWMjQuNjQxWk0zNS41IDIyLjQ1NzFMMjIuNjY2NyAzMC45MDU4VjMxLjU5NTVMMzUuNSAyMy41NDk1VjIyLjQ1NzFaTTM1LjUgMjAuMjc0MUwyMi42NjY3IDI5LjUyNzRWMzAuMjE2MkwzNS41IDIxLjM2NTZWMjAuMjc0MVpNMC42NzY3NyA0NS4zODRMMC42NzQwMiA0NS4zODU4TDAuNjgxMzU0IDQ1LjM4MTJMMTIuMDM3NyAzOC45NzM2QzEyLjAxNiAzOC44NjcyIDExLjk5NTIgMzguNzYwNCAxMS45NzU0IDM4LjY1MzNMMC42Nzc2ODcgNDUuMzgxMkwwLjY3NDAyIDQ1LjM4NThMMC42NzAzNTQgNDUuMzg2N0wwLjY3Njc3IDQ1LjM4NFoiIGZpbGw9IndoaXRlIi8+CiAgICA8L2c+CiAgICA8ZyB0cmFuc2Zvcm09InNjYWxlKDEpIHRyYW5zbGF0ZSgyNTgsIDIxKSI+CiAgICAgIDxwYXRoIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyIgZD0iTTIyIDExTDE5LjU2IDguMjFMMTkuOSA0LjUyTDE2LjI5IDMuN0wxNC40IDAuNUwxMSAxLjk2TDcuNiAwLjVMNS43MSAzLjY5TDIuMSA0LjVMMi40NCA4LjJMMCAxMUwyLjQ0IDEzLjc5TDIuMSAxNy40OUw1LjcxIDE4LjMxTDcuNiAyMS41TDExIDIwLjAzTDE0LjQgMjEuNDlMMTYuMjkgMTguM0wxOS45IDE3LjQ4TDE5LjU2IDEzLjc5TDIyIDExWk05LjA5IDE1LjcyTDUuMjkgMTEuOTFMNi43NyAxMC40M0w5LjA5IDEyLjc2TDE0Ljk0IDYuODlMMTYuNDIgOC4zN0w5LjA5IDE1LjcyWiIgZmlsbD0id2hpdGUiLz4KICAgIDwvZz4KICAgIDx0ZXh0CiAgICAgIHg9IjIwIgogICAgICB5PSIyNTAiCiAgICAgIGZvbnQtc2l6ZT0iMzJweCIKICAgICAgZm9udC13ZWlnaHQ9ImJvbGQiCiAgICAgIGZpbGw9IiNGRkZGRkYiCiAgICAgIGZvbnQtZmFtaWx5PSJzeXN0ZW0tdWksIC1hcHBsZS1zeXN0ZW0sIEJsaW5rTWFjU3lzdGVtRm9udCwgJ1NlZ29lIFVJJywgUm9ib3RvLCBVYnVudHUsICdIZWx2ZXRpY2EgTmV1ZScsIE94eWdlbiwgQ2FudGFyZWxsLCBzYW5zLXNlcmlmIgogICAgICA+CiAgICAgICAgbWF0dAogICAgPC90ZXh0PgogICAgPHRleHQKICAgICAgeD0iMjAiCiAgICAgIHk9IjI4MCIKICAgICAgZm9udC1zaXplPSIyNHB4IgogICAgICBmaWxsPSIjRkZGRkZGIgogICAgICB3ZWlnaHQ9IjQwMCIKICAgICAgZm9udC1mYW1pbHk9InN5c3RlbS11aSwgLWFwcGxlLXN5c3RlbSwgQmxpbmtNYWNTeXN0ZW1Gb250LCAnU2Vnb2UgVUknLCBSb2JvdG8sIFVidW50dSwgJ0hlbHZldGljYSBOZXVlJywgT3h5Z2VuLCBDYW50YXJlbGwsIHNhbnMtc2VyaWYiCiAgICAgID4KICAgICAgICAuY3J5cHRvCiAgICA8L3RleHQ+CiAgPC9zdmc+';

      expect(response.image).to.equal(expectedBase64Data);
      expect(response.attributes).to.deep.equal([
        { trait_type: 'domain', value: 'matt.crypto' },
        { trait_type: 'level', value: 2 },
        { trait_type: 'length', value: 4 },
        { trait_type: 'picture', value: 'verified-nft' },
        { trait_type: 'type', value: 'standard' },
      ]);
    });
  });
});
