import ZnsTransaction from './ZnsTransaction';
import { expect } from 'chai';

describe('ZnsTransaction', () => {
  it('should successfully create an entity', async () => {
    const ZnsTx = await ZnsTransaction.create({
      hash: '0xfc7b8fa3576fba44527b54264adbe8197c1c9fcc3484e764d54064dfe6be8939',
      blockNumber: 247856,
      atxuid: 0,
      events: [
        {
          name: 'Configured',
          params: {
            node: '0xd81a54e6c75997b2bbd27a0c0d5afa898eae62dbfc3c178964bcceea0c009b3c',
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
    }).save();
    expect(ZnsTx.id).to.be.a('number');
  });

  it('should return latest atxuid', async () => {
    await ZnsTransaction.create({
      hash: '0xfc7b8fa3576fba44527b54264adbe8197c1c9fcc3484e764d54064dfe6be8939',
      blockNumber: 247856,
      atxuid: 0,
      events: [
        {
          name: 'Configured',
          params: {
            node: '0xd81a54e6c75997b2bbd27a0c0d5afa898eae62dbfc3c178964bcceea0c009b3c',
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
    }).save();
    await ZnsTransaction.create({
      hash: '0xfc7b8fa3576fba44527b54264adbe8197c1c9fcc3484e764d54064dfe6be8940',
      blockNumber: 247857,
      atxuid: 1,
      events: [
        {
          name: 'Configured',
          params: {
            node: '0x628ece4569e336250b53b5053c9421fea0b8cfb20f49077b7ec559b4f27817e5',
            owner: 'zil1p3aevv8h2s3u48hm523cd59udgpfyupwt2yaqp',
            resolver: 'zil1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq9yf6pz',
          },
        },
        {
          name: 'NewDomain',
          params: {
            parent:
              '0x9915d0456b878862e822e2361da37232f626a2e47505c8795134a95d36138ed3',
            label: 'test',
          },
        },
      ],
    }).save();
    const atuxid = await ZnsTransaction.latestAtxuid();
    expect(atuxid).to.equal(1);
  });

  it('should return last transaction', async () => {
    await ZnsTransaction.create({
      hash: '0xfc7b8fa3576fba44527b54264adbe8197c1c9fcc3484e764d54064dfe6be8939',
      blockNumber: 247856,
      atxuid: 0,
      events: [
        {
          name: 'Configured',
          params: {
            node: '0xd81a54e6c75997b2bbd27a0c0d5afa898eae62dbfc3c178964bcceea0c009b3c',
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
    }).save();
    const secondZnsTx = await ZnsTransaction.create({
      hash: '0xfc7b8fa3576fba44527b54264adbe8197c1c9fcc3484e764d54064dfe6be8940',
      blockNumber: 247857,
      atxuid: 1,
      events: [
        {
          name: 'Configured',
          params: {
            node: '0x628ece4569e336250b53b5053c9421fea0b8cfb20f49077b7ec559b4f27817e5',
            owner: 'zil1p3aevv8h2s3u48hm523cd59udgpfyupwt2yaqp',
            resolver: 'zil1qqqqqqqqqqqqqqqqqqqqqqqqqqqqqqqq9yf6pz',
          },
        },
        {
          name: 'NewDomain',
          params: {
            parent:
              '0x9915d0456b878862e822e2361da37232f626a2e47505c8795134a95d36138ed3',
            label: 'test',
          },
        },
      ],
    }).save();
    const lastTransaction = await ZnsTransaction.latestTransaction();
    expect(lastTransaction).exist;
    expect(lastTransaction?.id).to.equal(secondZnsTx.id);
  });
});
