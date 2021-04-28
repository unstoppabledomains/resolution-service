import { IsDate, IsNumber, IsOptional, validate } from "class-validator";
import { logger } from "../logger";
import {
  BaseEntity,
  BeforeInsert,
  BeforeUpdate,
  CreateDateColumn,
  EntityManager,
  getConnection,
  ObjectType,
  PrimaryGeneratedColumn,
  Repository,
  UpdateDateColumn,
  SaveOptions,
} from "typeorm";
import connect from "../connect";
import { Serialization, Serializer, Serialized } from "../services/Serializer";
import { Attribute, Attributes, KeysOfType } from "../types/common";

type ModelConstructor = {
  [P in keyof typeof Model]: typeof Model[P];
};

type Touchable<T> = KeysOfType<T, Date | undefined> & string;

export default abstract class Model extends BaseEntity {
  @PrimaryGeneratedColumn()
  @IsOptional()
  @IsNumber()
  id: number | undefined;

  @CreateDateColumn()
  @IsOptional()
  @IsDate()
  createdAt: Date | undefined;

  @UpdateDateColumn()
  @IsOptional()
  @IsDate()
  updatedAt: Date | undefined;

  static async persist<T extends Model>(
    this: ObjectType<T>,
    attributes: Attributes<T>
  ) {
    return (await (this as any).create(attributes).save()) as T;
  }

  static async findOrBuild<T extends Model>(
    this: ObjectType<T>,
    attributes: Attributes<T>
  ): Promise<T> {
    const that = this as any;
    const where: any = {};
    for (const key of Object.keys(attributes)) {
      const value = await (attributes as any)[key];
      const relation = that.relation(key);
      if (relation) {
        where[
          relation.joinColumns[0].propertyName
        ] = ((await value) as Model).id!;
      } else {
        where[key] = value;
      }
    }
    return ((await that.findOne(where)) || that.create(attributes)) as T;
  }

  static async findOrCreate<T extends Model>(
    this: ObjectType<T>,
    attributes: Attributes<T>
  ): Promise<T> {
    const that = this as any;
    const model = await that.findOrBuild(attributes);
    if (!model.id) {
      await model.save();
    }
    return model;
  }

  static async serializeAll<T extends Model, U extends Serialization<T>>(
    this: ObjectType<T>,
    array: T[],
    ...attributes: U[]
  ): Promise<Serialized<T, U>[]> {
    return Serializer.serializeAll(array, ...attributes) as any;
  }

  static relation<T>(this: ObjectType<T>, name: string) {
    const relations = getConnection().getMetadata(this).relations;
    return relations.find((r) => r.propertyName === name);
  }

  static getRepositoryForManager<T extends Model>(
    this: ObjectType<T> & ModelConstructor,
    entityManager?: EntityManager
  ): Repository<T> {
    const brr = {};
    for (const p in brr) {
      // Test.
    }
    if (entityManager) {
      return entityManager.getRepository(this);
    }
    return this.getRepository();
  }

  static connect() {
    return connect();
  }

  static sqlIn(column: string, options: (string | number)[]): string {
    const sql = options.map((o) => (typeof o === "number" ? o : `'${o}'`));
    return options.length ? `${column} in (${sql.join(", ")})` : "1=1";
  }

  static async groupCount<T extends Model>(
    this: ObjectType<T>,
    column: Attribute<T>,
    {
      operation = "count(*)",
      where = "1=1",
      options = [],
    }: { operation?: string; where?: string; options?: string[] } = {}
  ): Promise<Record<string, number>> {
    const that = this as typeof Model;
    const rows = (await that
      .createQueryBuilder()
      .where(where)
      .andWhere(Model.sqlIn(column, options))
      .groupBy(column)
      .orderBy(column)
      .select(column, "counter")
      .addSelect(operation, "count")
      .getRawMany()) as { counter: string; count: string }[];
    const data = rows.reduce(
      (r, v) => ({ ...r, [v.counter]: parseInt(v.count, 10) }),
      {} as Record<string, number>
    );
    for (const key of options) {
      if (data[key] === undefined) {
        data[key] = 0;
      }
    }
    return data;
  }

  protected async beforeValidate() {
    // Can be overridden in a subclass.
  }

  @BeforeInsert()
  @BeforeUpdate()
  async validateOrReject() {
    const errors = await this.validate();
    if (errors.length) {
      throw new ObjectInvalid(this, errors);
    }
  }

  async validate() {
    await this.beforeValidate();
    return validate(this);
  }

  async errorsOf(field: Attribute<this>) {
    const errors = await this.validate();
    return errors.filter((e) => e.property === field);
  }

  async valid(): Promise<boolean> {
    return (await this.validate()).length === 0;
  }

  attributes<T extends Model = this>(attributes?: Attributes<T>): this {
    if (attributes) {
      for (const [key, value] of Object.entries<any>(attributes)) {
        (this as any)[key] = value === undefined ? null : value;
      }
    }
    return this;
  }

  async serialize<U extends Serialization<this>>(
    ...attributes: U[]
  ): Promise<Serialized<this, U>[]> {
    return Serializer.serialize(this, ...attributes) as any;
  }

  async update<T extends Model = this>(attributes: Attributes<T>) {
    this.attributes<T>(attributes);
    return this.save();
  }

  async touch(timestamp: Touchable<this> = "updatedAt" as any): Promise<this> {
    (this as any)[timestamp] = new Date();
    return await this.save();
  }

  logger(): typeof logger {
    return logger.child({ scope: this.logId() });
  }

  logId(): string {
    return `${this.constructor.name}#${this.id || "new"}`;
  }

  async saveNew(options?: SaveOptions) {
    return this.hasId() ? this : this.save(options);
  }

  private promisify<T>(value: T | Promise<T>): Promise<T> {
    return value instanceof Promise ? value : Promise.resolve(value);
  }
}
