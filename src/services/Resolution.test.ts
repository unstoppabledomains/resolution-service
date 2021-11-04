import { expect } from 'chai';
import sinon from 'sinon';
import { env } from '../env';
import { Domain, DomainsResolution } from '../models';
import { Blockchain } from '../types/common';
import { getDomainResolution, IsZilDomain } from './Resolution';

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
        node:
          '0x628ece4569e336250b53b5053c9421fea0b8cfb20f49077b7ec559b4f27817e5',
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
      expect(stub).to.be.calledOnceWith(
        Blockchain.ZIL,
        env.APPLICATION.ZILLIQA.NETWORK_ID,
      );
    });

    it('should return l2 resolution for uns domain', () => {
      const domain = new Domain({
        name: 'test.blockchain',
        node:
          '0x538c042c534bb263cdb433fbb0cdeaef78054682c43bbbb663dc6430fddd5f71',
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
        node:
          '0x538c042c534bb263cdb433fbb0cdeaef78054682c43bbbb663dc6430fddd5f71',
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
});
