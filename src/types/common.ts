export type KeysOfType<T, TProp> = NonNullable<
  {
    [P in keyof T]: T[P] extends TProp ? P : never;
  }[keyof T]
> &
  string &
  keyof T;

export type AnyFunction = (...args: any[]) => any;

// eslint-disable-next-line @typescript-eslint/ban-types
export type Constructed = Pick<Object, 'constructor'>;

export type UnwrapArray<T> = T extends Array<infer U> ? U : T;
export type UnwrapPromise<T> = T extends Promise<infer U> ? U : T;
export type UnwrapFunction<T> = T extends () => any ? ReturnType<T> : T;
export type PossiblePromise<T, U = Promise<T>> = T extends Promise<infer V>
  ? T | V
  : T | U;
export type PossibleFunction<T> = T extends () => any
  ? T | UnwrapFunction<T>
  : T | (() => T);
export type PossibleArray<T> = T extends any[] ? T | UnwrapArray<T> : T | T[];
export type Dictionary<T> = Record<string, T>;
export type NonFunction<T> = T extends AnyFunction ? never : T;

export type Require<T, P extends keyof T> = Partial<T> & Pick<T, P>;

type ValidationBase = boolean | undefined | null;
type ValidationMethod = () => Promise<ValidationBase> | ValidationBase;
export type ValidationProperty<T> = KeysOfType<
  T,
  ValidationMethod | ValidationBase
>;
export type ValidationCallback<T> = (
  object: T,
) => PossiblePromise<ValidationBase>;

export type Attributes<T> = Omit<
  { [P in keyof T]?: UnwrapPromise<T[P]> | T[P] },
  KeysOfType<T, AnyFunction>
>;

export type Attribute<T> = {
  [P in keyof T]: T[P] extends AnyFunction ? never : P;
}[keyof T] &
  string;

export type SerializableBase = boolean | string | number | null | undefined;
export type Serializable = {
  [k: string]: SerializableBase | Serializable | SerializableArray;
};
export type SerializableArray = (SerializableBase | Serializable)[];
export type MetadataImageFontSize = 24 | 20 | 18 | 16;

export enum Blockchain {
  ETH = 'ETH',
  ZIL = 'ZIL',
  MATIC = 'MATIC',
}

enum EvmUnstoppableDomainTlds {
  Crypto = 'crypto',
  Coin = 'coin',
  Wallet = 'wallet',
  Blockchain = 'blockchain',
  Bitcoin = 'bitcoin',
  X = 'x',
  Number888 = '888',
  Nft = 'nft',
  Dao = 'dao',
}

enum ZilliqaUnstoppableDomainTlds {
  Zil = 'zil',
}

export const UnstoppableDomainTlds = {
  ...EvmUnstoppableDomainTlds,
  ...ZilliqaUnstoppableDomainTlds,
};
