import { ValidationError } from "class-validator";
import * as _ from "lodash";

import BaseError from "./BaseError";

export default class ObjectInvalid<T> extends BaseError {
  readonly object: T;
  readonly errors: ValidationError[];

  constructor(object: T, errors: ValidationError[]) {
    const message =
      JSON.stringify(object) +
      "\n" +
      errors.map((e) => e.toString()).join("\n");
    super(message);
    this.object = object;
    this.errors = errors;
  }

  constraintsErrors(): string {
    return this.errors.reduce<string>((message, error) => {
      const constraints = _.values(error.constraints);
      return `${message}${constraints.join(". ")}. `;
    }, "");
  }
}
