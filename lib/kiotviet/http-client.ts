import { z } from "zod";
import type { KiotVietConfig } from "@/lib/kiotviet/config";
import {
  KiotVietAuthenticationError,
  KiotVietInvalidResponseError,
  KiotVietRateLimitError,
  KiotVietUnavailableError,
} from "@/lib/kiotviet/errors";
import { KiotVietTokenProvider } from "@/lib/kiotviet/token-provider";

type FetchFunction = typeof fetch;

export class KiotVietHttpClient {
  public constructor(
    private readonly config: KiotVietConfig,
    private readonly tokenProvider: KiotVietTokenProvider,
    private readonly fetchFunction: FetchFunction = fetch,
    private readonly timeoutMs = 30_000,
    private readonly maxRetries = 2,
  ) {}

  public async get<T>(path: string, schema: z.ZodType<T>): Promise<T> {
    return this.request(path, { method: "GET" }, schema);
  }

  public async request<T>(path: string, init: RequestInit, schema: z.ZodType<T>): Promise<T> {
    const url = new URL(path, this.config.apiBaseUrl).toString();
    let refreshedAfterUnauthorized = false;

    for (let attempt = 0; attempt <= this.maxRetries; attempt += 1) {
      const token = await this.tokenProvider.getAccessToken();
      const response = await this.fetchWithTimeout(url, {
        ...init,
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          "Retailer": this.config.retailer,
          Authorization: `Bearer ${token}`,
          ...init.headers,
        },
      });

      if (response.status === 401 && !refreshedAfterUnauthorized) {
        refreshedAfterUnauthorized = true;
        this.tokenProvider.invalidate();
        continue;
      }

      if (response.ok) {
        const parsed = schema.safeParse(await response.json());
        if (!parsed.success) {
          throw new KiotVietInvalidResponseError("KiotViet API response is invalid", { cause: parsed.error });
        }
        return parsed.data;
      }

      if (!this.isRetryable(response.status) || attempt === this.maxRetries) {
        throw this.toHttpError(response.status);
      }

      await this.wait(this.retryDelay(attempt, response.headers.get("Retry-After")));
    }

    throw new KiotVietUnavailableError("KiotViet request could not be completed");
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchFunction(url, { ...init, signal: controller.signal });
    } catch (error) {
      throw new KiotVietUnavailableError("KiotViet API request failed", { cause: error });
    } finally {
      clearTimeout(timeout);
    }
  }

  private isRetryable(status: number): boolean {
    return status === 429 || status >= 500;
  }

  private toHttpError(status: number): Error {
    if (status === 401 || status === 403) return new KiotVietAuthenticationError(`KiotViet API returned ${status}`);
    if (status === 429) return new KiotVietRateLimitError("KiotViet API rate limit exceeded");
    if (status >= 500) return new KiotVietUnavailableError(`KiotViet API returned ${status}`);
    return new KiotVietInvalidResponseError(`KiotViet API returned ${status}`);
  }

  private retryDelay(attempt: number, retryAfter: string | null): number {
    const retryAfterMs = retryAfter ? Number(retryAfter) * 1000 : Number.NaN;
    if (Number.isFinite(retryAfterMs) && retryAfterMs >= 0) return Math.min(retryAfterMs, 10_000);
    return Math.min(10_000, 250 * 2 ** attempt + Math.floor(Math.random() * 100));
  }

  private async wait(milliseconds: number): Promise<void> {
    await new Promise<void>((resolve) => setTimeout(resolve, milliseconds));
  }
}
