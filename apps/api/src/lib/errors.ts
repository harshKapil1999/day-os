export class AppError extends Error {
  constructor(public readonly code: string, message: string, public readonly status = 400) { super(message); }
}
export const notFound = (message: string) => new AppError("NOT_FOUND", message, 404);
export const conflict = (message: string) => new AppError("CONFLICT", message, 409);
