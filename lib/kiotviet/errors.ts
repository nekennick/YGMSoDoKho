export class KiotVietConfigurationError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "KiotVietConfigurationError";
  }
}

export class KiotVietAuthenticationError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "KiotVietAuthenticationError";
  }
}

export class KiotVietRateLimitError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "KiotVietRateLimitError";
  }
}

export class KiotVietUnavailableError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "KiotVietUnavailableError";
  }
}

export class KiotVietInvalidResponseError extends Error {
  public constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "KiotVietInvalidResponseError";
  }
}
