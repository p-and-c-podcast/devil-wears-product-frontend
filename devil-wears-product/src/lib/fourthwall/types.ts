// ============================================
// Fourthwall Storefront API Response Types
// ============================================

export interface FWImage {
  id: string;
  url: string;
  width: number;
  height: number;
}

export interface FWPrice {
  value: number;
  currency: string;
}

export interface FWColorAttribute {
  name: string;
  swatch: string;
}

export interface FWSizeAttribute {
  name: string;
}

export interface FWVariantAttributes {
  description: string;
  color: FWColorAttribute;
  size: FWSizeAttribute;
}

export interface FWWeight {
  value: number;
  unit: string;
}

export interface FWDimensions {
  length: number;
  width: number;
  height: number;
  unit: string;
}

export interface FWVariant {
  id: string;
  name: string;
  sku: string;
  unitPrice: FWPrice;
  compareAtPrice: FWPrice | null;
  attributes: FWVariantAttributes;
  stock: {
    type: "UNLIMITED" | "LIMITED";
  };
  weight: FWWeight;
  dimensions: FWDimensions;
  images: FWImage[];
}

export interface FWProduct {
  id: string;
  name: string;
  slug: string;
  description: string;
  state: {
    type: "AVAILABLE" | "SOLD_OUT";
  };
  access: {
    type: "PUBLIC" | "PRIVATE";
  };
  images: FWImage[];
  variants: FWVariant[];
  // Bundles (type "BUNDLE") have no variants. They carry a product-level price
  // and an `offers` list: one child product per bundle slot.
  type?: "PRODUCT" | "BUNDLE";
  price?: FWPrice;
  compareAtPrice?: FWPrice | null;
  pricingStrategy?: FWBundlePricingStrategy;
  offers?: FWProduct[];
  createdAt: string;
  updatedAt: string;
}

export type FWBundlePricingStrategy =
  | { type: "SAME_AS_INDIVIDUAL" }
  | { type: "DISCOUNT_BASED"; discountPercentage: number }
  | { type: "FIXED_PRICE"; price: FWPrice };

export interface FWCollection {
  id: string;
  name: string;
  slug: string;
  description: string;
}

export interface FWShop {
  id: string;
  name: string;
  domain: string;
  publicDomain: string;
}

export interface FWPaging {
  pageNumber: number;
  pageSize: number;
  elementsTotal: number;
  hasNextPage: boolean;
}

export interface FWPaginatedResponse<T> {
  results: T[];
  paging: FWPaging;
}

export interface FWCartItemVariant extends FWVariant {
  product: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface FWCartItemGroupedBy {
  type: "BUNDLE";
  bundleId: string;
  // Identifies one bundle line in the cart (same bundle + same variant picks).
  groupedId: string;
}

export interface FWCartItem {
  variant: FWCartItemVariant;
  quantity: number;
  groupedBy: FWCartItemGroupedBy | null;
}

export interface FWCart {
  id: string;
  items: FWCartItem[];
}
