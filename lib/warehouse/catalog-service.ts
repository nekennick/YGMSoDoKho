import { getKiotVietConfig } from "@/lib/kiotviet/config";
import { KiotVietHttpClient } from "@/lib/kiotviet/http-client";
import { KiotVietProductCatalogService } from "@/lib/kiotviet/product-catalog";
import { KiotVietTokenProvider } from "@/lib/kiotviet/token-provider";

export function getProductCatalogService(branchId: number): KiotVietProductCatalogService {
  const config = getKiotVietConfig();
  const tokenProvider = new KiotVietTokenProvider(config);
  const client = new KiotVietHttpClient(config, tokenProvider);
  return new KiotVietProductCatalogService(
    client,
    process.env.KIOTVIET_PRODUCTS_PATH ?? "/products",
    branchId,
    Number(process.env.KIOTVIET_PAGE_SIZE ?? 100),
  );
}
