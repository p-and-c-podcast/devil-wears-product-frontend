import type {
  FWBundlePricingStrategy,
  FWCartItem,
  FWImage,
  FWPrice,
} from "@/lib/fourthwall/types";

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

// Same rule Fourthwall checkout uses: the strategy applies to the sum of the
// picked child variant prices.
export function getBundlePrice(
  componentPrices: FWPrice[],
  strategy?: FWBundlePricingStrategy,
): FWPrice {
  const currency = componentPrices[0]?.currency ?? "USD";
  const sum = componentPrices.reduce((total, price) => total + price.value, 0);

  switch (strategy?.type) {
    case "DISCOUNT_BASED":
      return {
        value: roundMoney(sum * (1 - strategy.discountPercentage / 100)),
        currency,
      };
    case "FIXED_PRICE":
      return strategy.price;
    default:
      return { value: roundMoney(sum), currency };
  }
}

// The cart API returns only child variants for a bundle, so we keep the
// bundle's own name, link, image and pricing rule in the browser.
export interface StoredBundleInfo {
  name: string;
  slug: string;
  image?: FWImage;
  pricingStrategy?: FWBundlePricingStrategy;
}

const STORAGE_KEY = "dwp-bundles";

function readAll(): Record<string, StoredBundleInfo> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? "{}");
  } catch {
    return {};
  }
}

export function getStoredBundleInfo(bundleId: string): StoredBundleInfo | null {
  return readAll()[bundleId] ?? null;
}

export function saveBundleInfo(bundleId: string, info: StoredBundleInfo) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ ...readAll(), [bundleId]: info }),
    );
  } catch {
    // Storage full or blocked: the cart still works, just with less detail.
  }
}

export interface CartBundleLine {
  groupedId: string;
  bundleId: string;
  quantity: number;
  items: FWCartItem[];
}

export function splitCartItems(items: FWCartItem[]): {
  singles: FWCartItem[];
  bundles: CartBundleLine[];
} {
  const singles: FWCartItem[] = [];
  const bundles = new Map<string, CartBundleLine>();

  for (const item of items) {
    const group = item.groupedBy;
    if (group?.type !== "BUNDLE") {
      singles.push(item);
      continue;
    }
    const line = bundles.get(group.groupedId);
    if (line) {
      line.items.push(item);
    } else {
      bundles.set(group.groupedId, {
        groupedId: group.groupedId,
        bundleId: group.bundleId,
        quantity: item.quantity,
        items: [item],
      });
    }
  }

  return { singles, bundles: [...bundles.values()] };
}

export function getBundleLinePrice(line: CartBundleLine): FWPrice {
  const info = getStoredBundleInfo(line.bundleId);
  return getBundlePrice(
    line.items.map((item) => item.variant.unitPrice),
    info?.pricingStrategy,
  );
}
