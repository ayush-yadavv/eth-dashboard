export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export function toApiError(error: unknown) {
  if (error instanceof ApiError) {
    return error;
  }
  return new ApiError(500, "Internal server error");
}
