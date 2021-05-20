import { expect } from 'chai';
import { getManager } from 'typeorm';
import ZnsWorker from './ZnsWorker';
import ZnsTransaction from '../../models/ZnsTransaction';
import { Domain } from '../../models';

let worker: ZnsWorker;

describe('ZnsWorker', () => {
  beforeEach(() => {
    worker = new ZnsWorker();
  });

  it('should init', async () => {
    expect(worker).exist;
  });

  it('should parse the fake transaction', async () => {
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