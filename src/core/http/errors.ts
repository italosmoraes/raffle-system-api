export class AppError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = new.target.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404);
  }
}

// The request is well-formed but breaks a business rule (e.g. drawAt in the past).
export class BusinessRuleError extends AppError {
  constructor(message: string) {
    super(message, 422);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(message, 401);
  }
}

export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409);
  }
}
