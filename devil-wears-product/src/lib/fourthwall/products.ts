import { fourthwallGet } from "./api";
import type { FWProduct, FWPaginatedResponse } from "./types";

export async function getProducts(
  collectionSlug: string = "all",
  page: number = 0,
  size: number = 50,
): Promise<FWPaginatedResponse<FWProduct>> {
  return fourthwallGet<FWPaginatedResponse<FWProduct>>(
    `/collections/${collectionSlug}/products`,
    {
      page: page.toString(),
      size: size.toString(),
    },
  );
}

export async function getProduct(slug: string): Promise<FWProduct | null> {
  try {
    return await fourthwallGet<FWProduct>(`/products/${slug}`);
  } catch (error) {
    if (error instanceof Error && "status" in error && (error as any).status === 404) {
      return null;
    }
    throw error;
  }
}

// Fourthwall caps page size, so walk every page until the API says we're done.
export async function getAllProducts(
  collectionSlug: string = "all",
): Promise<FWProduct[]> {
  const PAGE_SIZE = 50;
  const MAX_PAGES = 100; // safety valve against a misbehaving `hasNextPage`
  const allProducts: FWProduct[] = [];

  for (let page = 0; page < MAX_PAGES; page++) {
    const { results, paging } = await getProducts(collectionSlug, page, PAGE_SIZE);
    allProducts.push(...results);

    const reachedTotal =
      typeof paging?.elementsTotal === "number" &&
      allProducts.length >= paging.elementsTotal;
    if (!paging?.hasNextPage || results.length === 0 || reachedTotal) break;
  }

  return allProducts;
}
