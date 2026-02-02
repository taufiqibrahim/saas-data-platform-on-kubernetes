export class HttpError extends Error {
  statusCode: number;
  detail: any;

  constructor(statusCode: number, message: string, detail?: any) {
    super(message);
    this.statusCode = statusCode;
    this.detail = detail;

    // Important for instanceof checks
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}
