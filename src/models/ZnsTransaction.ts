import { Column, Entity, Index, MoreThan, IsNull, Not } from "typeorm";
import { IsInt, Matches, Min, IsNumber, IsOptional } from "class-validator";
import Model from "./Model";
import ValidateWith from "../services/ValidateWith";
import { Attributes } from "../types/common";

interface UnknownEvent {
  name: string;
  params: Record<string, string | undefined>;
}

export interface ConfiguredEvent {
  name: "Configured";
  params: {
    owner: string;
    node: string;
    resolver: string;
  };
}

export interface NewDomainEvent {
  name: "NewDomain";
  params: {
    parent: string;
    label: string;
  };
}

export type ZnsTransactionEvent =
  | NewDomainEvent
  | ConfiguredEvent
  | UnknownEvent;

@Entity({ name: "zns_transactions" })
@Index(["atxuid"], { unique: true })
@Index(["hash"], { unique: true })
export default class ZnsTransaction extends Model {
  static readonly InitialBlock = 165700;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Column({ type: "int", nullable: true })
  @ValidateWith<ZnsTransaction>("atxuidIncreasesSequentially")
  atxuid: number | null = null;

  @IsOptional()
  @Matches(/^0x[0-9a-f]{64}$/)
  @Column({ type: "varchar", length: 66, nullable: true })
  hash: string | null = null;

  @Column("json")
  events: ZnsTransactionEvent[];

  @IsInt()
  @Min(ZnsTransaction.InitialBlock)
  @ValidateWith<ZnsTransaction>("blockNumberIncreases")
  @Column({ type: "int", nullable: true })
  @Index()
  blockNumber: number | null = null;

  constructor(attributes?: Attributes<ZnsTransaction>) {
    super();
    this.attributes<ZnsTransaction>(attributes);
  }

  async blockNumberIncreases(): Promise<boolean> {
    if (this.hasId() || !this.blockNumber) {
      return true;
    }
    return !(await ZnsTransaction.findOne({
      blockNumber: MoreThan(this.blockNumber),
    }));
  }

  static async latestBlock(): Promise<number> {
    const transaction = await ZnsTransaction.findOne({
      where: { blockNumber: Not(IsNull()) },
      order: { blockNumber: "DESC" },
    });

    return transaction?.blockNumber || ZnsTransaction.InitialBlock;
  }

  async atxuidIncreasesSequentially() {
    if (this.id || !this.atxuid || this.atxuid === 0) {
      return true;
    }
    return (
      !!(await ZnsTransaction.findOne({ atxuid: this.atxuid - 1 })) ||
      !(await ZnsTransaction.findOne())
    );
  }
}
