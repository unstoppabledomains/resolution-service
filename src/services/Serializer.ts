import { UnwrapPromise, UnwrapArray } from '../types/common';

type MethodReturnType<T> = T extends () => any ? ReturnType<T> : T;
type UnwrapArgument<T> = UnwrapArray<
  NonNullable<UnwrapPromise<MethodReturnType<ExcludeFunctionsWithParams<T>>>>
>;

type ExcludeFunctionsWithParams<T> = Exclude<
  T,
  (arg: any, ...args: any) => any
>;

type SerializationImpl<T> =
  | (keyof T & string)
  | { readonly [P in keyof T & string]?: Serialization<T[P]> };
export type Serialization<T> = readonly SerializationImpl<UnwrapArgument<T>>[];

type SerializationKeys<T> = (T extends Array<infer U>
  ? U extends string
    ? U
    : keyof U
  : T) &
  string;

export type Serialized<
  T,
  U extends Serialization<T>,
  V extends string = SerializationKeys<U>,
> = {
  // TODO improve typing of any
  [P in V]: any;
};

export class Serializer<T> {
  static async serialize<O, U extends Serialization<O>>(
    object: O,
    ...attributes: U
  ): Promise<Serialized<O, U>> {
    return new Serializer<O>().serialize(object, ...attributes) as any;
  }

  static async serializeAll<O, U extends Serialization<O>>(
    object: O[],
    ...attributes: U
  ): Promise<Serialized<O, U>[]> {
    return new Serializer<O>().serializeAll(object, ...attributes) as any;
  }

  protected async serializeAll<U extends Serialization<T>>(
    object: T[],
    ...attributes: U
  ): Promise<Serialized<T, U>[]> {
    return Promise.all(
      object.map((value) => this.serialize(value, ...attributes)),
    ) as any;
  }

  protected async serialize<U extends Serialization<T>>(
    object: T,
    ...attributes: U
  ): Promise<Serialized<T, U>> {
    const result: { [k: string]: any } = {};

    for (const attribute of attributes as readonly any[]) {
      if (typeof attribute === 'string') {
        result[attribute] = await this.serializedPropertyValue(
          object,
          attribute,
        );
      } else if (attribute instanceof Object) {
        for (const key in attribute) {
          let config: any = attribute[key];
          config = config instanceof Array ? config : [config];
          let value = await this.serializedPropertyValue(object, key);
          if (config && value && typeof value === 'object') {
            value =
              value instanceof Array
                ? await this.serializeAll(value, ...config)
                : await this.serialize(value, ...config);
          }
          result[key] = value === undefined ? null : value;
        }
      }
    }

    return result as any;
  }

  private async serializedPropertyValue(object: any, property: string) {
    let value = object[property as string];
    value =
      typeof value === 'function' ? await value.apply(object) : await value;
    return value === undefined ? null : value;
  }
}
export default Serializer;
