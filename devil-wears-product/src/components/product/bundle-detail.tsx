"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import type { FWProduct, FWVariant } from "@/lib/fourthwall/types";
import { useCart } from "@/hooks/use-cart";
import { SATIRE } from "@/lib/constants";
import { getUniqueSizes } from "@/lib/utils";
import { getBundlePrice } from "@/lib/bundles";
import { ProductImages } from "./product-images";
import { VariantSelector } from "./variant-selector";
import { PriceDisplay } from "./price-display";
import { ProductDescription } from "./product-description";
import { AddToCartButton } from "@/components/cart/add-to-cart-button";

interface BundleDetailProps {
  product: FWProduct;
}

interface OfferPick {
  color: string | null;
  size: string | null;
}

// Pick the variant that matches the choices. Options the offer does not have
// (no colors, no sizes) do not need a choice.
function resolveVariant(offer: FWProduct, pick: OfferPick): FWVariant | null {
  const hasColor = offer.variants.some((v) => v.attributes.color);
  const hasSize = offer.variants.some((v) => v.attributes.size);
  if (hasColor && !pick.color) return null;
  if (hasSize && !pick.size) return null;
  return (
    offer.variants.find(
      (v) =>
        (!hasColor || v.attributes.color?.name === pick.color) &&
        (!hasSize || v.attributes.size?.name === pick.size),
    ) ?? null
  );
}

function initialPick(offer: FWProduct): OfferPick {
  const color = offer.variants[0]?.attributes.color?.name ?? null;
  const sizes = getUniqueSizes(offer.variants, color ?? undefined);
  return { color, size: sizes.length === 1 ? sizes[0] : null };
}

export function BundleDetail({ product }: BundleDetailProps) {
  const { addBundle } = useCart();
  const offers = useMemo(
    () => (product.offers ?? []).map((o) => ({ ...o, variants: o.variants ?? [] })),
    [product.offers],
  );
  const [picks, setPicks] = useState<OfferPick[]>(() => offers.map(initialPick));

  const selectedVariants = offers.map((offer, i) => resolveVariant(offer, picks[i]));
  const complete =
    offers.length > 0 && selectedVariants.every((v): v is FWVariant => v !== null);

  const fullPrice = complete
    ? getBundlePrice(selectedVariants.map((v) => v!.unitPrice))
    : product.compareAtPrice;
  const displayPrice = complete
    ? getBundlePrice(
        selectedVariants.map((v) => v!.unitPrice),
        product.pricingStrategy,
      )
    : product.price;

  function updatePick(index: number, next: Partial<OfferPick>) {
    setPicks((prev) => prev.map((p, i) => (i === index ? { ...p, ...next } : p)));
  }

  async function handleAdd() {
    if (!complete) return;
    await addBundle(
      product.id,
      {
        name: product.name,
        slug: product.slug,
        image: product.images[0],
        pricingStrategy: product.pricingStrategy,
      },
      selectedVariants.map((v) => v!.id),
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16">
      <ProductImages images={product.images} productName={product.name} />

      <div className="space-y-8">
        <div>
          <p className="font-mono text-xs uppercase tracking-wider text-pink mb-2">
            {SATIRE.bundle.badge}
          </p>
          <h1 className="font-headline font-bold text-3xl sm:text-4xl text-charcoal mb-4">
            {product.name}
          </h1>
          {displayPrice && (
            <PriceDisplay price={displayPrice} compareAtPrice={fullPrice} size="lg" />
          )}
          <p className="text-sm text-warm-gray mt-3">{SATIRE.bundle.intro}</p>
        </div>

        <ol className="space-y-6">
          {offers.map((offer, i) => (
            <li key={offer.id} className="rounded-xl border border-border p-4 sm:p-5">
              <div className="flex items-center gap-3 mb-4">
                {offer.images[0] && (
                  <div className="w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden bg-cream-dark">
                    <Image
                      src={offer.images[0].url}
                      alt={offer.name}
                      width={48}
                      height={48}
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                <div className="min-w-0">
                  <p className="font-mono text-[10px] uppercase tracking-wider text-muted">
                    {SATIRE.bundle.itemLabel} {i + 1}
                  </p>
                  <p className="font-medium text-charcoal line-clamp-1">{offer.name}</p>
                </div>
              </div>
              <VariantSelector
                variants={offer.variants}
                selectedColor={picks[i]?.color ?? null}
                selectedSize={picks[i]?.size ?? null}
                onColorChange={(color) => {
                  const sizes = getUniqueSizes(offer.variants, color);
                  updatePick(i, { color, size: sizes.length === 1 ? sizes[0] : null });
                }}
                onSizeChange={(size) => updatePick(i, { size })}
              />
            </li>
          ))}
        </ol>

        <div className="space-y-2">
          <AddToCartButton variantId={null} onAdd={handleAdd} ready={complete} />
          {!complete && (
            <p className="text-xs text-muted text-center">{SATIRE.bundle.incomplete}</p>
          )}
        </div>

        {product.description && (
          <div className="pt-4 border-t border-border">
            <ProductDescription html={product.description} />
          </div>
        )}
      </div>
    </div>
  );
}
