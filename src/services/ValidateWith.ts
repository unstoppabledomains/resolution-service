import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from "class-validator";
import {
  ValidationProperty,
  ValidationCallback,
  Constructed,
} from "../types/common";

export default function ValidateWith<T extends Constructed>(
  method: ValidationCallback<T> | ValidationProperty<T>,
  validationOptions?: ValidationOptions
) {
  return (object: T, propertyName: string) => {
    registerDecorator({
      name: `validate ${propertyName} with ${method}`,
      target: object.constructor,
      propertyName,
      constraints: [method],
      options: validationOptions,
      validator: {
        validate(value: any, args: ValidationArguments) {
          return typeof method === "string"
            ? (args.object as any)[method as string]()
            : (method as ValidationCallback<T>)(object);
        },
      },
    });
  };
}
