import { expect } from 'chai';
import WorkerStatus from './WorkerStatus';

type TestStatsType = {
  testStats: string;
};

describe('WorkerStatus', () => {
  it('should successfully create entity', async () => {
    const status = WorkerStatus.create({
      lastMirroredBlockNumber: 11,
      location: 'CNS',
    });
    await status.save();
    expect(status.id).to.be.a('number');
  });

  describe('latestMirroredBlockForWorker', () => {
    it('should return last mirrored block for worker', async () => {
      const expectedBlockNumber = 11;
      const status = WorkerStatus.create({
        lastMirroredBlockNumber: expectedBlockNumber,
        location: 'CNS',
      });
      await status.save();

      const lastBlock = await WorkerStatus.latestMirroredBlockForWorker('CNS');
      expect(lastBlock).to.equal(expectedBlockNumber);
    });

    it('should return zero if no stats are saved', async () => {
      const expectedBlockNumber = 0;
      const lastBlock = await WorkerStatus.latestMirroredBlockForWorker('CNS');
      expect(lastBlock).to.equal(expectedBlockNumber);
    });
  });

  describe('getWorkerStats', () => {
    it('should return worker stats for worker', async () => {
      const expectedWorkerStats = { testStats: 'test' };
      const status = WorkerStatus.create({
        location: 'CNS',
        workerStats: expectedWorkerStats,
        lastMirroredBlockNumber: 11,
      });
      await status.save();

      const actualStats = await WorkerStatus.getWorkerStats<TestStatsType>(
        'CNS',
      );
      expect(actualStats).to.deep.equal(expectedWorkerStats);
    });

    it('should return undefined if no stats are saved', async () => {
      const actualStats = await WorkerStatus.getWorkerStats<TestStatsType>(
        'CNS',
      );
      expect(actualStats).to.be.undefined;
    });
  });

  describe('saveWorkerStatus', () => {
    it('should save stats if entry exists', async () => {
      const status = WorkerStatus.create({
        location: 'CNS',
        workerStats: { testStats: 'test' },
        lastMirroredBlockNumber: 11,
      });
      await status.save();

      const expectedWorkerStats = { testStats: 'updated stats' };
      const expectedBlockNumber = 12;

      await WorkerStatus.saveWorkerStatus(
        'CNS',
        expectedBlockNumber,
        expectedWorkerStats,
      );

      const lastBlock = await WorkerStatus.latestMirroredBlockForWorker('CNS');
      const actualStats = await WorkerStatus.getWorkerStats<TestStatsType>(
        'CNS',
      );
      expect(lastBlock).to.equal(expectedBlockNumber);
      expect(actualStats).to.deep.equal(expectedWorkerStats);
    });

    it('should create and save stats', async () => {
      const expectedWorkerStats = { testStats: 'updated stats' };
      const expectedBlockNumber = 12;

      await WorkerStatus.saveWorkerStatus(
        'CNS',
        expectedBlockNumber,
        expectedWorkerStats,
      );

      const lastBlock = await WorkerStatus.latestMirroredBlockForWorker('CNS');
      const actualStats = await WorkerStatus.getWorkerStats<TestStatsType>(
        'CNS',
      );
      expect(lastBlock).to.equal(expectedBlockNumber);
      expect(actualStats).to.deep.equal(expectedWorkerStats);
    });
  });
});
