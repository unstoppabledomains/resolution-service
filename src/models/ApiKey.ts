import { Column, Entity, Repository } from 'typeorm';
import { IsString, IsUUID } from 'class-validator';
import { Model } from '.';
import { Attributes } from '../types/common';
import { randomUUID } from 'crypto';

export const DomainLocations = ['CNS', 'ZNS', 'UNSL1', 'UNSL2', 'UNMINTED'];
export type Location = typeof DomainLocations[number];

@Entity({ name: 'apikeys' })
export default class ApiKey extends Model {
  @IsString()
  @Column('text', { unique: true })
  name: string;

  @IsUUID(4)
  @Column('uuid', { unique: true })
  apiKey: string;

  constructor(attributes?: Attributes<ApiKey>) {
    super();
    this.attributes<ApiKey>(attributes);
  }

  static async checkApiKeyExists(
    apiKey: string,
    repository: Repository<ApiKey> = this.getRepository(),
  ): Promise<boolean> {
    return (await repository.findOne({ apiKey })) !== undefined;
  }

  static async queryApiKey(
    apiKey: string,
    repository: Repository<ApiKey> = this.getRepository(),
  ): Promise<ApiKey | undefined> {
    return repository.findOne({ apiKey });
  }

  static async createApiKey(
    name: string,
    repository: Repository<ApiKey> = this.getRepository(),
  ): Promise<ApiKey> {
    const newKey = new ApiKey();
    newKey.attributes({
      name: name,
      apiKey: randomUUID(),
    });
    await repository.save(newKey);
    return newKey;
  }
}
