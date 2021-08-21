// A module heavily inspired by https://doc.rust-lang.org/stable/std/option/enum.Option.html#method.expect.

export type Option<T> = T | undefined | null;

export const unwrap = <T>(arg: Option<T>): T => {
  return expect(arg, `Called \`unwrap\` on \`${arg}\` value`);
};

export const expect = <T>(arg: Option<T>, msg: string): T => {
  if (arg === undefined || arg === null) {
    throw new Error(msg);
  }
  return arg;
};
