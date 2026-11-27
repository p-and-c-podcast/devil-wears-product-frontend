"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import { useCart } from "@/hooks/use-cart";
import { SATIRE } from "@/lib/constants";
import { formatPrice } from "@/lib/utils";
import {
  getBundleLinePrice,
  getStoredBundleInfo,
  type CartBundleLine,
} from "@/lib/bundles";

interface CartBundleItemProps {
  line: CartBundleLine;
}

export function CartBundleItem({ line }: CartBundleItemProps) {
  const { updateBundle, removeBundle, closeCart } = useCart();
  // Bundle changes take one or two API calls; block clicks until they finish
  // so each click works from the real quantity.
  const [busy, setBusy] = useState(false);
  async function run(action: () => Promise<void>) {
    if (busy) return;
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  }
  const info = getStoredBundleInfo(line.bundleId);
  const image = info?.image ?? line.items[0]?.variant.images[0];
  const price = getBundleLinePrice(line);
  const fullPrice = line.items.reduce(
    (sum, item) => sum + item.variant.unitPrice.value,
    0,
  );
  const href = info ? `/products/${info.slug}` : null;
  const name = info?.name ?? SATIRE.cart.bundleLabel;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: "auto" }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="border-b border-border last:border-0"
    >
      <div className="flex gap-4 py-4">
        {image && (
          <div className="flex-shrink-0 w-20 h-20 rounded-lg overflow-hidden bg-cream-dark">
            <Image
              src={image.url}
              alt={name}
              width={80}
              height={80}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        <div className="flex-1 min-w-0">
          <p className="font-mono text-[10px] uppercase tracking-wider text-pink">
            {SATIRE.cart.bundleLabel}
          </p>
          {href ? (
            <Link
              href={href}
              onClick={closeCart}
              className="font-medium text-sm text-charcoal hover:text-pink transition-colors line-clamp-1"
            >
              {name}
            </Link>
          ) : (
            <p className="font-medium text-sm text-charcoal line-clamp-1">{name}</p>
          )}
          <ul className="mt-1 space-y-0.5">
            {line.items.map((item) => (
              <li key={item.variant.id} className="text-xs text-muted line-clamp-1">
                {item.variant.product.name}
                {item.variant.attributes.size?.name
                  ? ` / ${item.variant.attributes.size.name}`
                  : ""}
              </li>
            ))}
          </ul>
          <p className="text-sm font-medium text-charcoal mt-1">
            {formatPrice(price)}
            {fullPrice > price.value && (
              <span className="ml-2 text-xs text-muted line-through">
                {formatPrice({ value: fullPrice, currency: price.currency })}
              </span>
            )}
          </p>

          <div className="flex items-center justify-between mt-2">
            <div className={`flex items-center border border-border rounded-md ${busy ? "opacity-50" : ""}`}>
              <button
                onClick={() => run(() => updateBundle(line.groupedId, line.quantity - 1))}
                disabled={busy}
                className="px-2.5 py-1 text-warm-gray hover:text-charcoal transition-colors text-sm"
                aria-label="Decrease quantity"
              >
                −
              </button>
              <span className="px-2 py-1 text-sm font-medium text-charcoal min-w-[28px] text-center">
                {line.quantity}
              </span>
              <button
                onClick={() => run(() => updateBundle(line.groupedId, line.quantity + 1))}
                disabled={busy}
                className="px-2.5 py-1 text-warm-gray hover:text-charcoal transition-colors text-sm"
                aria-label="Increase quantity"
              >
                +
              </button>
            </div>
            <button
              onClick={() => run(() => removeBundle(line.groupedId))}
              disabled={busy}
              className="text-xs text-muted hover:text-pink transition-colors"
            >
              {SATIRE.cart.removeLabel}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
