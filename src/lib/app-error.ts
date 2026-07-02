export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor(
    message: string,
    statusCode: number,
    code: string,
    details?: unknown,
  ) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  constructor(message = "Dados inválidos", details?: unknown) {
    super(message, 400, "VALIDATION_ERROR", details);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Não autenticado") {
    super(message, 401, "UNAUTHORIZED");
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Acesso negado") {
    super(message, 403, "FORBIDDEN");
  }
}

export class ServiceUnavailableError extends AppError {
  constructor(
    message = "Serviço temporariamente indisponível. Tente novamente.",
  ) {
    super(message, 503, "SERVICE_UNAVAILABLE");
  }
}
