import { AppError } from "../utils/AppError.js";

export function validate(schema, source = "body") {
  return (req, res, next) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      return next(
        new AppError(422, "Validation failed", {
          code: "VALIDATION_ERROR",
          details: result.error.flatten(),
        })
      );
    }

    req[source] = result.data;
    next();
  };
}
