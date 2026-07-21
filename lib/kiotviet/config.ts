import { z } from "zod";

const kiotVietConfigSchema = z.object({
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  retailer: z.string().min(1),
  tokenUrl: z.string().url(),
  apiBaseUrl: z.string().url(),
});

export type KiotVietConfig = z.infer<typeof kiotVietConfigSchema>;

export function getKiotVietConfig(env: NodeJS.ProcessEnv = process.env): KiotVietConfig {
  return kiotVietConfigSchema.parse({
    clientId: env.KIOTVIET_CLIENT_ID,
    clientSecret: env.KIOTVIET_CLIENT_SECRET,
    retailer: env.KIOTVIET_RETAILER,
    tokenUrl: env.KIOTVIET_TOKEN_URL || env.KIOTVIET_AUTH_URL,
    apiBaseUrl: env.KIOTVIET_API_BASE_URL || env.KIOTVIET_API_URL,
  });
}
