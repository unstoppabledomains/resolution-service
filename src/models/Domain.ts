import {
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  Repository,
} from 'typeorm';
import {
  IsIn,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  Matches,
  NotEquals,
} from 'class-validator';
import ValidateWith from '../services/ValidateWith';
import * as _ from 'lodash';
import { Model } from '.';
import { eip137Namehash, znsNamehash } from '../utils/namehash';
import { Attributes } from '../types/common';
import punycode from 'punycode';
import DomainsResolution, { BlockchainName } from './DomainsResolution';

@Entity({ name: 'domains' })
export default class Domain extends Model {
  static AddressRegex = /^0x[a-fA-F0-9]{40}$/;
  static NullAddress = '0x0000000000000000000000000000000000000000';

  @IsString()
  @ValidateWith<Domain>('nameMatchesNode', {
    message: "Node doesn't match the name",
  })
  @Index({ unique: true })
  @Column('text')
  name: string;

  @Matches(/^0x[a-f0-9]{64}$/)
  @Index({ unique: true })
  @Column('text')
  node: string;

  @IsOptional()
  @Index()
  @ManyToOne((type) => Domain, { nullable: true })
  @JoinColumn()
  parent: Promise<Domain | null>;

  @OneToMany((type) => Domain, (domain) => domain.parent)
  @JoinColumn({ name: 'parent_id' })
  children: Promise<Domain[]>;

  @OneToMany(
    (type) => DomainsResolution,
    (domainResolution) => domainResolution.domain,
    {
      cascade: ['insert', 'update', 'remove'],
    },
  )
  resolutions: DomainsResolution[];

  constructor(attributes?: Attributes<Domain>) {
    super();
    this.attributes<Domain>(attributes);
  }

  nameMatchesNode(): boolean {
    return this.correctNode() === this.node;
  }

  get label(): string {
    const splittedName = this.getSplittedName();
    splittedName.pop();
    return splittedName.join('.');
  }

  get extension(): string {
    return this.getSplittedName().pop() || '';
  }

  get unicodeName(): string {
    return punycode.toUnicode(this.name);
  }

  get isUnicodeName(): boolean {
    // eslint-disable-next-line no-control-regex
    return /[^\u0000-\u00ff]/.test(this.name);
  }

  static async findByNode(
    node?: string,
    repository: Repository<Domain> = this.getRepository(),
  ): Promise<Domain | undefined> {
    return node
      ? await repository.findOne({
          where: { node },
          relations: ['resolutions'],
        })
      : undefined;
  }

  static async findOrBuildByNode(
    node: string,
    repository: Repository<Domain> = this.getRepository(),
  ): Promise<Domain> {
    return (
      (await repository.findOne({
        where: { node },
        relations: ['resolutions'],
      })) || new Domain({ node })
    );
  }

  private getSplittedName(): string[] {
    return this.name ? this.name.split('.') : [];
  }

  private correctNode(): string | undefined {
    if (!this.name || this.name !== this.name.toLowerCase()) {
      return undefined;
    }
    if (this.name.endsWith('zil')) {
      return znsNamehash(this.name);
    }
    return eip137Namehash(this.name);
  }

  public getResolution(
    blockchain: BlockchainName,
    networkId: number,
  ): DomainsResolution {
    let resolution = this.resolutions?.filter(
      (res) => res.blockchain === blockchain && res.networkId === networkId,
    )[0];
    if (resolution == undefined) {
      resolution = new DomainsResolution({
        blockchain,
        networkId,
      });
    }
    return resolution;
  }

  public setResolution(resolution: DomainsResolution): void {
    const otherResolutions = this.resolutions?.filter(
      (res) =>
        res.blockchain != resolution.blockchain &&
        res.networkId != resolution.networkId,
    );
    if (otherResolutions) {
      this.resolutions = [resolution, ...otherResolutions];
    } else {
      this.resolutions = [resolution];
    }
  }

  static normalizeResolver(resolver: string | null | undefined): string | null {
    if (!resolver) {
      return null;
    }
    resolver = resolver.toLowerCase();
    return resolver === Domain.NullAddress ? null : resolver;
  }

  static async findOrCreateByName(
    name: string,
    repository: Repository<Domain> = this.getRepository(),
  ): Promise<Domain> {
    const domain = await repository.findOne({
      where: { name },
      relations: ['resolutions'],
    });
    if (domain) {
      return domain;
    }

    let node = eip137Namehash(name);
    if (name.endsWith('zil')) {
      node = znsNamehash(this.name);
    }

    const newDomain = new Domain();
    newDomain.attributes({
      name: name,
      node: node,
    });
    await repository.save(newDomain);
    return newDomain;
  }
}
