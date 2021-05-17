import { expect } from 'chai';
import { getManager } from 'typeorm';
import ZnsProvider from './ZnsProvider';
import ZnsWorker from './ZnsWorker';
import ZnsTransaction from '../../models/ZnsTransaction';
import { Domain } from '../../models';

let worker: ZnsWorker;
let provider: ZnsProvider;

describe('ZnsWorker', () => {
  beforeEach(() => {
    worker = new ZnsWorker();
  });

  it('should init', async () => {
    expect(worker).exist;
  });

  it.only('should parse the fake transaction', async () => {
    const manager = getManager();
    const fakeTransaction = {
      hash:
        '0xfc7b8fa3576fba44527b54264adbe8197c1c9fcc3484e764d54064dfe6be8939',
      blockNumber: 247856,
      atxuid: 0,
      events: [
        {
          name: 'Configured',
          params: {
            node:
              '0xd81a54e6c75997b2bbd27a0c0d5afa898eae62dbfc3c178964bcceea0c009b3c',
            owner: 'zil1p3aevv8h2s3u48hm523cd59udgpfyupwt2yaqp',
            resolver: 'zil1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq9yf6pz',
          },
        },
        {
          name: 'NewDomain',
          params: {
            parent:
              '0x9915d0456b878862e822e2361da37232f626a2e47505c8795134a95d36138ed3',
            label: 'activating',
          },
        },
      ],
    };
    await worker['processTransaction'](fakeTransaction as any, manager);
    const txFromDb = await ZnsTransaction.findOne({
      hash: fakeTransaction.hash,
    });
    expect(txFromDb).exist;
    expect(txFromDb?.atxuid).eq(0);
    expect(txFromDb?.events.length).eq(2);
    expect(txFromDb?.blockNumber).eq(247856);
    const domainFromDb = await Domain.findOne({ name: 'activating.zil' });
    expect(domainFromDb).exist;
    expect(domainFromDb?.ownerAddress).eq(
      '0x0c7b9630f75423ca9efba2a386d0bc6a0292702e',
    );
    expect(domainFromDb?.resolver).eq(null);
    expect(domainFromDb?.node).eq(
      '0xd81a54e6c75997b2bbd27a0c0d5afa898eae62dbfc3c178964bcceea0c009b3c',
    );
    expect(domainFromDb?.location).eq('ZNS');
  });
});

describe('ZnsProvider', () => {
  beforeEach(() => {
    provider = new ZnsProvider();
  });

  it('should init', async () => {
    expect(provider).exist;
  });

  it('should return first 2 transactions', async () => {
    const transactions = await provider.getLatestTransactions(0, 1);
    const firstTx = {
      hash:
        '0x8ddd3f31d79c2c40f03a38e5fc645df945419c8679064e05bc50f08e23dec5be',
      blockNumber: 2566938,
      atxuid: 0,
      events: [],
    };
    const secondTx = {
      hash:
        '0x47e5d1f098d00c46341e92c6cfc052cecf80c4bb6a69405911bd406b6d56d069',
      blockNumber: 2566944,
      atxuid: 1,
      events: [
        {
          address: 'zil1hyj6m5w4atcn7s806s69r0uh5g4t84e8gp6nps',
          name: 'AdminSet',
          details: 'AdminSet (ByStr20 address, Bool isApproved)',
          params: {
            address: 'zil1qs2epy722w8wm07svl8uuwqrdlqya6gt5xpdc4',
            isApproved: 'True',
          },
        },
      ],
    };
    expect(transactions.length).eq(2);
    expect(transactions[0]).deep.eq(firstTx);
    expect(transactions[1]).deep.eq(secondTx);
  });

  it('should return records for the domain', async () => {
    const resolverAddress = '0xaec2202caff6b5b637c18ecf7fdf4959a48c7914'; // flowers.zil
    const records = await provider.requestZilliqaResolutionFor(resolverAddress);
    const answer = {
      'crypto.ZIL.address': '0x2fbe7652d33bfaf72e50f0ea926c42c8c89344f4',
    };
    expect(records).deep.eq(answer);
  });
});
