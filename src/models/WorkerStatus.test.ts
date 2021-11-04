import { expect } from 'chai';
import { Blockchain } from '../types/common';
import WorkerStatus from './WorkerStatus';

describe('WorkerStatus', () => {
  describe('constructor', () => {
    it('should successfully create entity', async () => {
      const status = WorkerStatus.create({
        lastMirroredBlockNumber: 11,
        lastAtxuid: 150,
        location: Blockchain.ETH,
      });
      await status.save();
      expect(status.id).to.be.a('number');
    });

    it('should save entity if lastMirroredBlock decreases', async () => {
      // possible during a reorg
      const status = WorkerStatus.create({
        lastMirroredBlockNumber: 11,
        lastAtxuid: 150,
        location: Blockchain.ETH,
      });
      await status.save();

      status.lastMirroredBlockNumber = 10;

      expect(status.id).to.be.a('number');
    });

    it('should not save entity if lastAtxuid decreases', async () => {
      const status = WorkerStatus.create({
        lastMirroredBlockNumber: 11,
        lastAtxuid: 150,
        location: Blockchain.ETH,
      });
      await status.save();

      status.lastAtxuid = 149;

      await expect(status.save()).to.be.rejectedWith(
        '- property lastAtxuid has failed the following constraints: validate lastAtxuid with lastAtxuidIncreases',
      );
    });
  });

  describe('latestMirroredBlockForWorker', () => {
    it('should return last mirrored block for worker', async () => {
      const expectedBlockNumber = 11;
      const status = WorkerStatus.create({
        lastMirroredBlockNumber: expectedBlockNumber,
        location: Blockchain.ETH,
      });
      await status.save();

      const lastBlock = await WorkerStatus.latestMirroredBlockForWorker(
        Blockchain.ETH,
      );
      expect(lastBlock).to.equal(expectedBlockNumber);
    });

    it('should return zero if no stats are saved', async () => {
      const expectedBlockNumber = 0;
      const lastBlock = await WorkerStatus.latestMirroredBlockForWorker(
        Blockchain.ETH,
      );
      expect(lastBlock).to.equal(expectedBlockNumber);
    });
  });

  describe('latestAtxuidForWorker', () => {
    it('should return last mirrored block for worker', async () => {
      const expectedAtxuid = 150;
      const status = WorkerStatus.create({
        lastMirroredBlockNumber: 0,
        lastAtxuid: expectedAtxuid,
        location: Blockchain.ZIL,
      });
      await status.save();

      const lastAtxuid = await WorkerStatus.latestAtxuidForWorker(
        Blockchain.ZIL,
      );
      expect(lastAtxuid).to.equal(expectedAtxuid);
    });

    it('should return undefined if no stats are saved', async () => {
      const lastAtxuid = await WorkerStatus.latestAtxuidForWorker(
        Blockchain.ZIL,
      );
      expect(lastAtxuid).to.be.undefined;
    });
  });

  describe('saveWorkerStatus', () => {
    it('should save stats if entry exists', async () => {
      const status = WorkerStatus.create({
        location: Blockchain.ETH,
        lastAtxuid: 150,
        lastMirroredBlockNumber: 11,
      });
      await status.save();

      const expectedlastAtxuid = 180;
      const expectedBlockNumber = 15;

      await WorkerStatus.saveWorkerStatus(
        Blockchain.ETH,
        expectedBlockNumber,
        undefined,
        expectedlastAtxuid,
      );

      const lastBlock = await WorkerStatus.latestMirroredBlockForWorker(
        Blockchain.ETH,
      );
      const lastAtxuid = await WorkerStatus.latestAtxuidForWorker(
        Blockchain.ETH,
      );

      expect(lastBlock).to.equal(expectedBlockNumber);
      expect(lastAtxuid).to.deep.equal(expectedlastAtxuid);
    });

    it('should create and save stats', async () => {
      const expectedlastAtxuid = 180;
      const expectedBlockNumber = 15;

      await WorkerStatus.saveWorkerStatus(
        Blockchain.ETH,
        expectedBlockNumber,
        undefined,
        expectedlastAtxuid,
      );

      const lastBlock = await WorkerStatus.latestMirroredBlockForWorker(
        Blockchain.ETH,
      );
      const lastAtxuid = await WorkerStatus.latestAtxuidForWorker(
        Blockchain.ETH,
      );

      expect(lastBlock).to.equal(expectedBlockNumber);
      expect(lastAtxuid).to.deep.equal(expectedlastAtxuid);
    });
  });
});
