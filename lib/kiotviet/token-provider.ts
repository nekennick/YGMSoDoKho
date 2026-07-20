import { z } from "zod";
import type { KiotVietConfig } from "@/lib/kiotviet/config";
import { KiotVietAuthenticationError, KiotVietUnavailableError } from "@/lib/kiotviet/errors";

const tokenResponseSchema = z.object({
  access_token: z.string().min(1),
  expires_in: z.number().positive().optional(),
});

type FetchFunction = typeof fetch;

type CachedToken = {
  value: string;
  expiresAt: number;
};

export class KiotVietTokenProvider {
  private cachedToken: CachedToken | null = null;
  private refreshPromise: Promise<string> | null = null;

  public constructor(
    private readonly config: KiotVietConfig,
    private readonly fetchFunction: FetchFunction = fetch,
    private readonly now: () => number = Date.now,
  ) {}

  public async getAccessToken(): Promise<string> {
    if (this.cachedToken && this.cachedToken.expiresAt > this.now()) {
      return this.cachedToken.value;
    }

    if (!this.refreshPromise) {
      this.refreshPromise = this.refreshToken().finally(() => {
        this.refreshPromise = null;
      });
    }

    return this.refreshPromise;
  }

  public invalidate(): void {
    this.cachedToken = null;
  }

  private async refreshToken(): Promise<string> {
    let response: Response;
    try {
      response = await this.fetchFunction(this.config.tokenUrl, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded", Accept: "application/json" },
        body: new URLSearchParams({
          grant_type: "client_credentials",
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
        }),
      });
    } catch (error) {
      throw new KiotVietUnavailableError("KiotViet token endpoint is unavailable", { cause: error });
    }

    if (!response.ok) {
      throw new KiotVietAuthenticationError(`KiotViet token request failed with status ${response.status}`);
    }

    const parsed = tokenResponseSchema.safeParse(await response.json());
    if (!parsed.success) {
      throw new KiotVietAuthenticationError("KiotViet token response is invalid", { cause: parsed.error });
    }

    const expiresInSeconds = parsed.data.expires_in ?? 3600;
    const safetyWindowMs = Math.min(60_000, Math.max(5_000, expiresInSeconds * 1000 * 0.1));
    this.cachedToken = {
      value: parsed.data.access_token,
      expiresAt: this.now() + expiresInSeconds * 1000 - safetyWindowMs,
    };
    return parsed.data.access_token;
  }
}
