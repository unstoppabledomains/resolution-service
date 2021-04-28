import {
  IsEnum,
  IsNumber,
  IsObject,
  IsString,
  Matches,
  Min,
  ValidateIf,
  IsOptional,
} from "class-validator";
import { Column, Entity, Index, MoreThan, Not } from "typeorm";
import { BigNumber } from "ethers";
import ValidateWith from "../services/ValidateWith";
import { Attributes } from "../types/common";
import Model from "./Model";
import { env } from "../env";

const DomainOperationTypes = ["Transfer", "Resolve", "NewURI", "Sync"] as const;
const EventTypes = [
  ...DomainOperationTypes,
  "Approval",
  "ApprovalForAll",
  "NewURIPrefix",
  "FakeUpdateStatus",
] as const;
type EventType = typeof EventTypes[any];

@Entity({ name: "cns_registry_events" })
@Index(["blockNumber", "logIndex"], { unique: true })
export default class CNSEvent extends Model {
  static EventTypes = EventTypes;
  static DomainOperationTypes = DomainOperationTypes;
  static InitialBlock =
    env.APPLICATION.ETHEREUM.CNS_REGISTRY_EVENTS_STARTING_BLOCK;

  @IsEnum(EventTypes)
  @Column({ type: "text" })
  type: EventType;

  @IsOptional()
  @IsString()
  @Column({ type: "text", nullable: true })
  blockchainId: string | null = null;

  @IsNumber()
  @ValidateWith<CNSEvent>("blockNumberIncreases")
  @Column({ type: "int" })
  @Index()
  blockNumber: number = 0;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @ValidateWith<CNSEvent>("logIndexForBlockIncreases")
  @Column({ type: "int", nullable: true })
  logIndex: number | null = null;

  @IsOptional()
  @IsString()
  @Matches(/0x[0-9a-f]+/)
  @ValidateWith<CNSEvent>("consistentBlockNumberForHash")
  @Column({ type: "text", nullable: true })
  transactionHash: string | null = null;

  @IsObject()
  @Column({ type: "json" })
  returnValues: Record<string, string> = {};

  @IsOptional()
  @ValidateIf((e) => e.domainOperation())
  @IsString()
  @Matches(/0x[0-9a-f]+/)
  @Column({ type: "text", nullable: true })
  @Index()
  node: string | null = null;

  static async latestBlock(): Promise<number> {
    const event = await CNSEvent.findOne({
      order: { blockNumber: "DESC" },
    });
    return event ? event.blockNumber : CNSEvent.InitialBlock;
  }

  static tokenIdToNode(tokenId: BigNumber): string {
    const node = tokenId.toHexString().replace(/^(0x)?/, "");
    return "0x" + node.padStart(64, "0");
  }

  constructor(attributes?: Attributes<CNSEvent>) {
    super();
    this.attributes<CNSEvent>(attributes);
  }

  async blockNumberIncreases(): Promise<boolean> {
    if (this.hasId()) {
      return true;
    }
    return !(await CNSEvent.findOne({
      blockNumber: MoreThan(this.blockNumber),
    }));
  }

  async logIndexForBlockIncreases(): Promise<boolean> {
    return !(await CNSEvent.findOne({
      blockNumber: this.blockNumber,
      logIndex: MoreThan(this.logIndex),
    }));
  }

  domainOperation() {
    return this.type in DomainOperationTypes;
  }

  tokenId(): string | undefined {
    return this.returnValues.tokenId;
  }

  async beforeValidate() {
    const tokenId = this.tokenId();
    this.node = tokenId
      ? CNSEvent.tokenIdToNode(BigNumber.from(tokenId))
      : null;
  }

  async consistentBlockNumberForHash(): Promise<boolean> {
    const inconsistentEvent = await CNSEvent.findOne({
      transactionHash: this.transactionHash,
      blockNumber: Not(this.blockNumber),
    });
    return !inconsistentEvent;
  }
}
