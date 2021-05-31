import { IsEnum, IsNumber, Min, IsOptional, IsObject } from 'class-validator';
import ValidateWith from '../services/ValidateWith';
import { Column, Entity, Index, Repository, Unique } from 'typeorm';
import { Attributes } from '../types/common';
import Model from './Model';
import { Location, DomainLocations } from './Domain';

@Entity({ name: 'resolution_worker_status' })
@Unique(['location'])
export default class WorkerStatus extends Model {
  @IsEnum(DomainLocations)
  @Column('text')
  @Index()
  location: Location;

  @IsNumber()
  @Min(0)
  @Column({ type: 'int' })
  lastMirroredBlockNumber = 0;

  @IsOptional()
  @IsObject()
  @Column('jsonb', { default: {} })
  workerStats?: Record<string, string | number> = undefined;

  constructor(attributes?: Attributes<WorkerStatus>) {
    super();
    this.attributes<WorkerStatus>(attributes);
  }

  static async latestMirroredBlockForWorker(
    location: Location,
  ): Promise<number> {
    const status = await WorkerStatus.findOne({ location });
    return status ? status.lastMirroredBlockNumber : 0;
  }

  static async getWorkerStats<StatsType>(
    location: Location,
  ): Promise<StatsType | undefined> {
    const status = await WorkerStatus.findOne({ location });
    return status
      ? Object.assign({} as StatsType, status.workerStats)
      : undefined;
  }

  static async saveWorkerStatus(
    location: Location,
    latestBlock: number,
    workerStats?: Record<string, string | number>,
    repository: Repository<WorkerStatus> = WorkerStatus.getRepository(),
  ): Promise<void> {
    let workerStatus = await repository.findOne({ location });
    if (workerStatus === undefined) {
      workerStatus = new WorkerStatus({
        location,
      });
    }
    workerStatus.lastMirroredBlockNumber = latestBlock;
    workerStatus.workerStats = workerStats;
    await repository.save(workerStatus);
  }
}
