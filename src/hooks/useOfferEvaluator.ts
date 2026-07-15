// src/hooks/useOfferEvaluator.ts
"use client";

import { useEffect, useRef, useMemo } from "react";
import { useCartStore }               from "@/store/cart";
import { useOfferEngine }             from "@/store/offer-engine";
import type { CartItemForEngine }     from "@/store/offer-engine";
import type { MenuItem }              from "@/lib/types";

/**
 * Watches the cart and re-evaluates offer conditions whenever
 * cart contents change.
 *
 * Place this hook in MenuPage or a persistent layout component.
 * It has no return value — read offer state directly from useOfferEngine.
 *
 * Example:
 *   useOfferEvaluator(menuItems);
 *   const unlockedOffers = useOfferEngine((s) => s.unlockedOffers);
 */
export function useOfferEvaluator(menuItems: MenuItem[]): void {
  const cartItems    = useCartStore((s) => s.items);
  const evaluateCart = useOfferEngine((s) => s.evaluateCart);
  const prevCartRef  = useRef<string>("");

  // Memoize menu → engine format conversion.
  // Only recalculates when menuItems reference changes (i.e. actual data reload).
  const menuItemsForEngine = useMemo<CartItemForEngine[]>(
    () =>
      menuItems.map((mi) => ({
        menuItemId: mi.id,
        name:       mi.name,
        price:      mi.price,
        quantity:   0,
        categoryId: mi.categoryId,
        image:      mi.image,
        isVeg:      mi.isVeg,
      })),
    [menuItems]
  );

  useEffect(() => {
    // Cheap change detection — only re-evaluate if cart contents changed.
    // Stringifies only the fields that affect offer conditions (id + quantity).
    const cartKey = cartItems
      .map((i) => `${i.menuItemId}:${i.quantity}`)
      .join(",");

    if (cartKey === prevCartRef.current) return;
    prevCartRef.current = cartKey;

    // Convert cart items to engine format.
    // Regular cart items are never promotional — isPromotional is always false here.
    // Promotional items live in the offer engine's promoItems, not the cart store.
    const cartForEngine: CartItemForEngine[] = cartItems.map((ci) => {
      const menuItem = menuItems.find((mi) => mi.id === ci.menuItemId);
      return {
        menuItemId:    ci.menuItemId,
        name:          ci.name,
        price:         ci.price,
        quantity:      ci.quantity,
        categoryId:    menuItem?.categoryId,
        image:         ci.image,
        isVeg:         menuItem?.isVeg,
        isPromotional: false,
        offerId:       undefined,
      };
    });

    evaluateCart(cartForEngine, menuItemsForEngine);
  }, [cartItems, menuItems, menuItemsForEngine, evaluateCart]);
}