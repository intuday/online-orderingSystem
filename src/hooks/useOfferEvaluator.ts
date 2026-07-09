// src/hooks/useOfferEvaluator.ts
"use client";

import { useEffect, useRef } from "react";
import { useCartStore } from "@/store/cart";
import { useOfferEngine } from "@/store/offer-engine";
import type { MenuItem } from "@/lib/firebase";

/**
 * This hook watches the cart and re-evaluates
 * offer conditions every time cart changes.
 *
 * Place this in your MenuPage or a layout component.
 */
export function useOfferEvaluator(menuItems: MenuItem[]) {
  const cartItems    = useCartStore((s) => s.items);
  const evaluateCart = useOfferEngine((s) => s.evaluateCart);
  const prevCartRef  = useRef<string>("");

  useEffect(() => {
    // Only re-evaluate if cart actually changed
    const cartKey = JSON.stringify(
      cartItems.map((i) => `${i.menuItemId}:${i.quantity}`)
    );

    if (cartKey === prevCartRef.current) return;
    prevCartRef.current = cartKey;

    // Convert menu items to the format the engine expects
    const menuItemsForEngine = menuItems.map((mi) => ({
      menuItemId: mi.id,
      name:       mi.name,
      price:      mi.price,
      quantity:   0,
      categoryId: mi.categoryId,
      image:      mi.image,
      isVeg:      mi.isVeg,
    }));

    // Convert cart items
    const cartForEngine = cartItems.map((ci) => {
      const menuItem = menuItems.find((mi) => mi.id === ci.menuItemId);
      return {
        menuItemId:    ci.menuItemId,
        name:          ci.name,
        price:         ci.price,
        quantity:      ci.quantity,
        categoryId:    menuItem?.categoryId,
        image:         ci.image,
        isVeg:         menuItem?.isVeg,
        isPromotional: (ci as any).isPromotional || false,
        offerId:       (ci as any).offerId,
      };
    });

    evaluateCart(cartForEngine, menuItemsForEngine);
  }, [cartItems, menuItems, evaluateCart]);
}