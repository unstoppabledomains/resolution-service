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
  @ValidateWith<WorkerStatus>('blockNumberIncreases', {
    message: 'the value of lastMirroredBlockNumber should increase',
  })
  lastMirroredBlockNumber = 0;

  @IsOptional()
  @IsNumber()
  @Column({ type: 'int' })
  @ValidateWith<WorkerStatus>('lastAtxuidIncreases', {
    message: 'the value of lastAtxuid should increase',
  })
  lastAtxuid?: number = undefined;

  constructor(attributes?: Attributes<WorkerStatus>) {
    super();
    this.attributes<WorkerStatus>(attributes);
  }

  async blockNumberIncreases(): Promise<boolean> {
    const previousBlock = await WorkerStatus.latestMirroredBlockForWorker(
      this.location,
    );
    return previousBlock <= this.lastMirroredBlockNumber;
  }

  async lastAtxuidIncreases(): Promise<boolean> {
    const previousAtxuid = await WorkerStatus.latestAtxuidForWorker(
      this.location,
    );
    if (previousAtxuid === undefined) {
      return true;
    }
    return this.lastAtxuid === undefined
      ? false
      : previousAtxuid <= this.lastAtxuid;
  }

  static async latestMirroredBlockForWorker(
    location: Location,
  ): Promise<number> {
    const status = await WorkerStatus.findOne({ location });
    return status ? status.lastMirroredBlockNumber : 0;
  }

  static async latestAtxuidForWorker(
    location: Location,
  ): Promise<number | undefined> {
    const status = await WorkerStatus.findOne({ location });
    return status?.lastAtxuid;
  }

  static async saveWorkerStatus(
    location: Location,
    latestBlock: number,
    lastAtxuid?: number,
    repository: Repository<WorkerStatus> = WorkerStatus.getRepository(),
  ): Promise<void> {
    let workerStatus = await repository.findOne({ location });
    if (workerStatus === undefined) {
      workerStatus = new WorkerStatus({
        location,
      });
    }
    workerStatus.lastMirroredBlockNumber = latestBlock;
    workerStatus.lastAtxuid = lastAtxuid;
    await repository.save(workerStatus);
  }
}
