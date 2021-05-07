/**
 * Default JS Error requires a lot of boilerplate
 * @see https://stackoverflow.com/questions/42754270/re-throwing-exception-in-nodejs-and-not-losing-stack-trace
 */
export default class BaseError extends Error {
  readonly cause?: Error;
  readonly newStack: string;
  readonly name: string = this.constructor.name;

  constructor(message: string, cause?: Error) {
    super(message);
    this.message = message;
    this.cause = cause;
    const stack = this.stack || '';
    this.newStack = stack;
    if (cause) {
      const lines = (this.message.match(/\n/g) || []).length + 1;
      this.stack =
        stack
          .split('\n')
          .slice(0, lines + 1)
          .join('\n') +
        '\n' +
        (cause.stack || '');
    }
  }
}
