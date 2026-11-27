"use client";

import {
  createContext,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useState,
} from "react";
import type { FWCart, FWCartItem } from "@/lib/fourthwall/types";
import {
  createCart,
  getCart,
  addToCart as apiAddToCart,
  updateCartItem as apiUpdateCartItem,
  addBundleToCart as apiAddBundleToCart,
  removeBundleFromCart as apiRemoveBundleFromCart,
} from "@/lib/fourthwall/cart";
import {
  getBundleLinePrice,
  saveBundleInfo,
  splitCartItems,
  type CartBundleLine,
  type StoredBundleInfo,
} from "@/lib/bundles";

interface CartState {
  cart: FWCart | null;
  isOpen: boolean;
  isLoading: boolean;
}

type CartAction =
  | { type: "SET_CART"; cart: FWCart }
  | { type: "SET_LOADING"; loading: boolean }
  | { type: "OPEN_CART" }
  | { type: "CLOSE_CART" }
  | { type: "OPTIMISTIC_ADD"; variantId: string; quantity: number }
  | { type: "OPTIMISTIC_REMOVE"; variantId: string }
  | { type: "OPTIMISTIC_REMOVE_BUNDLE"; groupedId: string };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case "SET_CART":
      return { ...state, cart: action.cart, isLoading: false };
    case "SET_LOADING":
      return { ...state, isLoading: action.loading };
    case "OPEN_CART":
      return { ...state, isOpen: true };
    case "CLOSE_CART":
      return { ...state, isOpen: false };
    case "OPTIMISTIC_ADD":
      if (!state.cart) return state;
      const existingItem = state.cart.items.find(
        (item) => item.variant.id === action.variantId && !item.groupedBy,
      );
      if (existingItem) {
        return {
          ...state,
          cart: {
            ...state.cart,
            items: state.cart.items.map((item) =>
              item.variant.id === action.variantId && !item.groupedBy
                ? { ...item, quantity: item.quantity + action.quantity }
                : item,
            ),
          },
        };
      }
      return state;
    case "OPTIMISTIC_REMOVE":
      if (!state.cart) return state;
      return {
        ...state,
        cart: {
          ...state.cart,
          items: state.cart.items.filter(
            (item) => item.variant.id !== action.variantId || item.groupedBy,
          ),
        },
      };
    case "OPTIMISTIC_REMOVE_BUNDLE":
      if (!state.cart) return state;
      return {
        ...state,
        cart: {
          ...state.cart,
          items: state.cart.items.filter(
            (item) => item.groupedBy?.groupedId !== action.groupedId,
          ),
        },
      };
    default:
      return state;
  }
}

interface CartContextType {
  cart: FWCart | null;
  isOpen: boolean;
  isLoading: boolean;
  itemCount: number;
  subtotal: number;
  currency: string;
  openCart: () => void;
  closeCart: () => void;
  addItem: (variantId: string, quantity?: number) => Promise<void>;
  updateItem: (variantId: string, quantity: number) => Promise<void>;
  removeItem: (variantId: string) => Promise<void>;
  addBundle: (
    bundleId: string,
    info: StoredBundleInfo,
    variantIds: string[],
    quantity?: number,
  ) => Promise<void>;
  updateBundle: (groupedId: string, quantity: number) => Promise<void>;
  removeBundle: (groupedId: string) => Promise<void>;
}

export const CartContext = createContext<CartContextType | null>(null);

function getCartIdFromCookie(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|; )cartId=([^;]*)/);
  return match ? decodeURIComponent(match[1]) : null;
}

function setCartIdCookie(cartId: string) {
  const maxAge = 30 * 24 * 60 * 60; // 30 days
  document.cookie = `cartId=${encodeURIComponent(cartId)}; path=/; max-age=${maxAge}; SameSite=Lax`;
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, {
    cart: null,
    isOpen: false,
    isLoading: true,
  });

  // Hydrate cart from cookie on mount
  useEffect(() => {
    async function hydrateCart() {
      const cartId = getCartIdFromCookie();
      if (cartId) {
        const cart = await getCart(cartId);
        if (cart) {
          dispatch({ type: "SET_CART", cart });
          return;
        }
      }
      dispatch({ type: "SET_LOADING", loading: false });
    }
    hydrateCart();
  }, []);

  const ensureCart = useCallback(async (): Promise<string> => {
    if (state.cart?.id) return state.cart.id;
    const newCart = await createCart();
    setCartIdCookie(newCart.id);
    dispatch({ type: "SET_CART", cart: newCart });
    return newCart.id;
  }, [state.cart?.id]);

  const addItem = useCallback(
    async (variantId: string, quantity: number = 1) => {
      const cartId = await ensureCart();
      dispatch({ type: "OPTIMISTIC_ADD", variantId, quantity });
      try {
        const updatedCart = await apiAddToCart(cartId, variantId, quantity);
        dispatch({ type: "SET_CART", cart: updatedCart });
        dispatch({ type: "OPEN_CART" });
      } catch (error) {
        // Revert on error by re-fetching
        const freshCart = await getCart(cartId);
        if (freshCart) dispatch({ type: "SET_CART", cart: freshCart });
        throw error;
      }
    },
    [ensureCart],
  );

  const updateItem = useCallback(
    async (variantId: string, quantity: number) => {
      if (!state.cart?.id) return;
      try {
        const updatedCart = await apiUpdateCartItem(
          state.cart.id,
          variantId,
          quantity,
        );
        dispatch({ type: "SET_CART", cart: updatedCart });
      } catch (error) {
        const freshCart = await getCart(state.cart.id);
        if (freshCart) dispatch({ type: "SET_CART", cart: freshCart });
        throw error;
      }
    },
    [state.cart?.id],
  );

  const removeItem = useCallback(
    async (variantId: string) => {
      if (!state.cart?.id) return;
      const item = state.cart.items.find(
        (i) => i.variant.id === variantId && !i.groupedBy,
      );
      if (!item) return;
      dispatch({ type: "OPTIMISTIC_REMOVE", variantId });
      try {
        // /remove fails with CART_INCOMPLETE_BUNDLE_ERROR when the same
        // variant is also in a bundle; /change to 0 removes only this line.
        const updatedCart = await apiUpdateCartItem(state.cart.id, variantId, 0);
        dispatch({ type: "SET_CART", cart: updatedCart });
      } catch (error) {
        const freshCart = await getCart(state.cart.id);
        if (freshCart) dispatch({ type: "SET_CART", cart: freshCart });
        throw error;
      }
    },
    [state.cart],
  );

  const addBundle = useCallback(
    async (
      bundleId: string,
      info: StoredBundleInfo,
      variantIds: string[],
      quantity: number = 1,
    ) => {
      const cartId = await ensureCart();
      saveBundleInfo(bundleId, info);
      try {
        const updatedCart = await apiAddBundleToCart(
          cartId,
          bundleId,
          variantIds,
          quantity,
        );
        dispatch({ type: "SET_CART", cart: updatedCart });
        dispatch({ type: "OPEN_CART" });
      } catch (error) {
        const freshCart = await getCart(cartId);
        if (freshCart) dispatch({ type: "SET_CART", cart: freshCart });
        throw error;
      }
    },
    [ensureCart],
  );

  // /remove for a bundle also drops plain lines with the same variant.
  // Remove the bundle line, then add any such plain lines back.
  const removeBundleLine = useCallback(
    async (cart: FWCart, line: CartBundleLine): Promise<FWCart> => {
      let updatedCart = await apiRemoveBundleFromCart(
        cart.id,
        line.bundleId,
        line.items.map((i) => ({ variantId: i.variant.id, quantity: i.quantity })),
      );
      const bundleVariantIds = new Set(line.items.map((i) => i.variant.id));
      const remaining = new Set(
        splitCartItems(updatedCart.items).singles.map((i) => i.variant.id),
      );
      for (const single of splitCartItems(cart.items).singles) {
        if (
          bundleVariantIds.has(single.variant.id) &&
          !remaining.has(single.variant.id)
        ) {
          updatedCart = await apiAddToCart(cart.id, single.variant.id, single.quantity);
        }
      }
      return updatedCart;
    },
    [],
  );

  const removeBundle = useCallback(
    async (groupedId: string) => {
      if (!state.cart?.id) return;
      const line = splitCartItems(state.cart.items).bundles.find(
        (b) => b.groupedId === groupedId,
      );
      if (!line) return;
      dispatch({ type: "OPTIMISTIC_REMOVE_BUNDLE", groupedId });
      try {
        const updatedCart = await removeBundleLine(state.cart, line);
        dispatch({ type: "SET_CART", cart: updatedCart });
      } catch (error) {
        const freshCart = await getCart(state.cart.id);
        if (freshCart) dispatch({ type: "SET_CART", cart: freshCart });
        throw error;
      }
    },
    [state.cart, removeBundleLine],
  );

  // The API has no quantity change for bundles: add more sets to go up, or
  // remove the line and add it back with the new quantity to go down.
  const updateBundle = useCallback(
    async (groupedId: string, quantity: number) => {
      if (!state.cart?.id) return;
      if (quantity <= 0) return removeBundle(groupedId);
      const line = splitCartItems(state.cart.items).bundles.find(
        (b) => b.groupedId === groupedId,
      );
      if (!line || quantity === line.quantity) return;
      const cartId = state.cart.id;
      const variantIds = line.items.map((i) => i.variant.id);
      try {
        if (quantity > line.quantity) {
          const updatedCart = await apiAddBundleToCart(
            cartId,
            line.bundleId,
            variantIds,
            quantity - line.quantity,
          );
          dispatch({ type: "SET_CART", cart: updatedCart });
        } else {
          await removeBundleLine(state.cart, line);
          const updatedCart = await apiAddBundleToCart(
            cartId,
            line.bundleId,
            variantIds,
            quantity,
          );
          dispatch({ type: "SET_CART", cart: updatedCart });
        }
      } catch (error) {
        const freshCart = await getCart(cartId);
        if (freshCart) dispatch({ type: "SET_CART", cart: freshCart });
        throw error;
      }
    },
    [state.cart, removeBundle, removeBundleLine],
  );

  const cartLines = useMemo(
    () => splitCartItems(state.cart?.items ?? []),
    [state.cart?.items],
  );

  // A bundle counts as one item per set, the same as Fourthwall checkout.
  const itemCount = useMemo(
    () =>
      cartLines.singles.reduce((sum, item) => sum + item.quantity, 0) +
      cartLines.bundles.reduce((sum, line) => sum + line.quantity, 0),
    [cartLines],
  );

  const subtotal = useMemo(
    () =>
      cartLines.singles.reduce(
        (sum, item) => sum + item.variant.unitPrice.value * item.quantity,
        0,
      ) +
      cartLines.bundles.reduce(
        (sum, line) => sum + getBundleLinePrice(line).value * line.quantity,
        0,
      ),
    [cartLines],
  );

  const currency = state.cart?.items[0]?.variant.unitPrice.currency ?? "USD";

  const value = useMemo(
    () => ({
      cart: state.cart,
      isOpen: state.isOpen,
      isLoading: state.isLoading,
      itemCount,
      subtotal,
      currency,
      openCart: () => dispatch({ type: "OPEN_CART" }),
      closeCart: () => dispatch({ type: "CLOSE_CART" }),
      addItem,
      updateItem,
      removeItem,
      addBundle,
      updateBundle,
      removeBundle,
    }),
    [
      state,
      itemCount,
      subtotal,
      currency,
      addItem,
      updateItem,
      removeItem,
      addBundle,
      updateBundle,
      removeBundle,
    ],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}
