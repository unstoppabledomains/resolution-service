import { expect } from 'chai';
import sinon from 'sinon';
import { env } from '../env';
import { Domain, DomainsResolution, DomainsReverseResolution } from '../models';
import { Blockchain } from '../types/common';
import {
  getDomainResolution,
  getReverseResolution,
  IsZilDomain,
} from './Resolution';

describe('Resolution service', () => {
  describe('isZilDomain', () => {
    it('should return true for .zil domains', () => {
      expect(IsZilDomain('test.zil')).to.be.true;
      expect(IsZilDomain('test.subdomain.zil')).to.be.true;
    });

    it('should return false for other domains', () => {
      expect(IsZilDomain('test.crypto')).to.be.false;
      expect(IsZilDomain('test.subdomain.crypto')).to.be.false;
      expect(IsZilDomain('test.blockchain')).to.be.false;
      expect(IsZilDomain('test.wallet')).to.be.false;
      expect(IsZilDomain('test.nonexistenttld')).to.be.false;
    });
  });

  describe('getDomainResolution', () => {
    const sinonSandbox = sinon.createSandbox();

    afterEach(() => {
      sinonSandbox.restore();
    });

    it('should return zil resolution for zil domain', () => {
      const domain = new Domain({
        name: 'test.zil',
        node: '0x628ece4569e336250b53b5053c9421fea0b8cfb20f49077b7ec559b4f27817e5',
      });
      const resolution = new DomainsResolution({
        blockchain: Blockchain.ZIL,
        networkId: env.APPLICATION.ZILLIQA.NETWORK_ID,
        resolution: { test: 'zil' },
      });
      const stub = sinonSandbox
        .stub(domain, 'getResolution')
        .returns(resolution);

      expect(getDomainResolution(domain)).to.deep.eq(resolution);
      expect(stub).to.be.calledWith(
        Blockchain.ZIL,
        env.APPLICATION.ZILLIQA.NETWORK_ID,
      );
    });

    it('should return zil resolution for zil domain on uns', () => {
      const domain = new Domain({
        name: 'test.zil',
        node: '0x628ece4569e336250b53b5053c9421fea0b8cfb20f49077b7ec559b4f27817e5',
      });
      const resolution = new DomainsResolution({
        blockchain: Blockchain.MATIC,
        networkId: env.APPLICATION.POLYGON.NETWORK_ID,
        resolution: { test: 'zil' },
      });
      const stub = sinonSandbox
        .stub(domain, 'getResolution')
        .returns(resolution);

      expect(getDomainResolution(domain)).to.deep.eq(resolution);
      expect(stub).to.be.calledWith(
        Blockchain.MATIC,
        env.APPLICATION.POLYGON.NETWORK_ID,
      );
    });

    it('should return l2 resolution for uns domain', () => {
      const domain = new Domain({
        name: 'test.blockchain',
        node: '0x538c042c534bb263cdb433fbb0cdeaef78054682c43bbbb663dc6430fddd5f71',
      });
      const l1resolution = new DomainsResolution({
        ownerAddress: Domain.NullAddress,
        blockchain: Blockchain.ETH,
        networkId: env.APPLICATION.ETHEREUM.NETWORK_ID,
        resolution: { test: 'eth' },
      });
      const l2resolution = new DomainsResolution({
        ownerAddress: '0x8aad44321a86b170879d7a244c1e8d360c99dda8',
        blockchain: Blockchain.MATIC,
        networkId: env.APPLICATION.POLYGON.NETWORK_ID,
        resolution: { test: 'matic' },
      });

      const stub = sinonSandbox.stub(domain, 'getResolution');
      stub
        .withArgs(Blockchain.ETH, env.APPLICATION.ETHEREUM.NETWORK_ID)
        .returns(l1resolution);
      stub
        .withArgs(Blockchain.MATIC, env.APPLICATION.POLYGON.NETWORK_ID)
        .returns(l2resolution);

      expect(getDomainResolution(domain)).to.deep.eq(l2resolution);
      expect(stub).to.be.calledOnceWith(
        Blockchain.MATIC,
        env.APPLICATION.POLYGON.NETWORK_ID,
      );
    });

    it('should return l1 resolution for uns domain', () => {
      const domain = new Domain({
        name: 'test.blockchain',
        node: '0x538c042c534bb263cdb433fbb0cdeaef78054682c43bbbb663dc6430fddd5f71',
      });
      const l1resolution = new DomainsResolution({
        ownerAddress: '0x8aad44321a86b170879d7a244c1e8d360c99dda8',
        blockchain: Blockchain.ETH,
        networkId: env.APPLICATION.ETHEREUM.NETWORK_ID,
        resolution: { test: 'eth' },
      });
      const l2resolution = new DomainsResolution({
        ownerAddress: Domain.NullAddress,
        blockchain: Blockchain.MATIC,
        networkId: env.APPLICATION.POLYGON.NETWORK_ID,
        resolution: { test: 'matic' },
      });

      const stub = sinonSandbox.stub(domain, 'getResolution');
      stub
        .withArgs(Blockchain.ETH, env.APPLICATION.ETHEREUM.NETWORK_ID)
        .returns(l1resolution);
      stub
        .withArgs(Blockchain.MATIC, env.APPLICATION.POLYGON.NETWORK_ID)
        .returns(l2resolution);

      expect(getDomainResolution(domain)).to.deep.eq(l1resolution);
      expect(stub).to.be.calledTwice;
      expect(stub).to.be.calledWith(
        Blockchain.MATIC,
        env.APPLICATION.POLYGON.NETWORK_ID,
      );
      expect(stub).to.be.calledWith(
        Blockchain.ETH,
        env.APPLICATION.ETHEREUM.NETWORK_ID,
      );
    });
  });

  describe('getReverseResolution', () => {
    const l1ReverseAddr = '0x1234512345123451234512345123451234512345';
    const l2ReverseAddr = '0x0000A0000A0000A0000A0000A0000A0000A0000A';
    let l1Domain: Domain;
    let l2Domain: Domain;

    beforeEach(async () => {
      l1Domain = new Domain({
        name: 'test.blockchain',
        node: '0x538c042c534bb263cdb433fbb0cdeaef78054682c43bbbb663dc6430fddd5f71',
      });
      const l1Reverse = new DomainsReverseResolution({
        blockchain: Blockchain.ETH,
        networkId: env.APPLICATION.ETHEREUM.NETWORK_ID,
        reverseAddress: l1ReverseAddr,
      });
      l1Domain.setReverseResolution(l1Reverse);
      await l1Domain.save();

      l2Domain = new Domain({
        name: 'test2.blockchain',
        node: '0xa6c1edadde6513c39db74fe3ee671b9bf5941eea3d316ee1fb5b779bae53a60d',
      });
      const l2Reverse = new DomainsReverseResolution({
        blockchain: Blockchain.MATIC,
        networkId: env.APPLICATION.POLYGON.NETWORK_ID,
        reverseAddress: l2ReverseAddr,
      });
      l2Domain.setReverseResolution(l2Reverse);
      await l2Domain.save();
    });

    it('should return reverse resolution for l1', async () => {
      const reverse = await getReverseResolution(l1ReverseAddr);
      expect(reverse?.domain?.name).to.equal(l1Domain.name);
    });

    it('should return reverse resolution for l2', async () => {
      const reverse = await getReverseResolution(l2ReverseAddr);
      expect(reverse?.domain?.name).to.equal(l2Domain.name);
    });

    it('should prioritize l1 reverse resolution', async () => {
      const l2Reverse = l2Domain.getReverseResolution(
        Blockchain.MATIC,
        env.APPLICATION.POLYGON.NETWORK_ID,
      );
      if (l2Reverse) {
        l2Reverse.reverseAddress = l1ReverseAddr;
        await l2Domain.save();
      }

      const reverse = await getReverseResolution(l1ReverseAddr);
      expect(reverse?.domain?.name).to.equal(l1Domain.name);
    });

    it('should return undefined if no reverse resolution', async () => {
      const removed = l2Domain.removeReverseResolution(
        Blockchain.MATIC,
        env.APPLICATION.POLYGON.NETWORK_ID,
      );
      await l2Domain.save();

      const reverse = await getReverseResolution(l2ReverseAddr);
      expect(reverse).to.be.undefined;
    });

    it('should return undefined for invalid address', async () => {
      const reverse = await getReverseResolution('invalid');
      expect(reverse).to.be.undefined;
    });
  });
});
