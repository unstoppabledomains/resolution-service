import { IsEnum, IsNumber, Min, IsOptional } from 'class-validator';
import ValidateWith from '../services/ValidateWith';
import { Column, Entity, Index, Repository, Unique } from 'typeorm';
import { Attributes } from '../types/common';
import Model from './Model';
import { BlockchainName, Blockchains } from './DomainsResolution';

@Entity({ name: 'resolution_worker_status' })
@Unique(['location'])
export default class WorkerStatus extends Model {
  @IsEnum(Blockchains)
  @Column('text')
  @Index()
  location: BlockchainName;

  @IsNumber()
  @Min(0)
  @Column({ type: 'int' })
  lastMirroredBlockNumber = 0;

  @IsOptional()
  @Column({ type: 'text', nullable: true })
  lastMirroredBlockHash?: string = undefined;

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
    location: BlockchainName,
  ): Promise<number> {
    const status = await WorkerStatus.findOne({ location });
    return status ? status.lastMirroredBlockNumber : 0;
  }

  static async latestMirroredBlockHashForWorker(
    location: BlockchainName,
  ): Promise<string | undefined> {
    const status = await WorkerStatus.findOne({ location });
    return status?.lastMirroredBlockHash;
  }

  static async latestAtxuidForWorker(
    location: BlockchainName,
  ): Promise<number | undefined> {
    const status = await WorkerStatus.findOne({ location });
    return status?.lastAtxuid;
  }

  static async saveWorkerStatus(
    location: BlockchainName,
    latestBlock: number,
    latestBlockHash?: string,
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
    workerStatus.lastMirroredBlockHash = latestBlockHash;
    workerStatus.lastAtxuid = lastAtxuid;
    await repository.save(workerStatus);
  }
}
