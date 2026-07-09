"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { OrderItem, Addon } from "@/lib/firebase";

interface CartState {
  items:         OrderItem[];
  tableId:       string | null;
  customerId:    string | null;
  customerName:  string;
  customerPhone: string;
  couponCode:    string | null;
  discount:      number;
  couponMinOrder: number;  // ✅ Min order value store karo
  tip:           number;
  notes:         string;
  restaurantId:  string;

  setTable:        (id: string) => void;
  setCustomer:     (id: string, name: string, phone: string) => void;
  setRestaurant:   (id: string) => void;
  addItem:         (item: OrderItem) => void;
  removeItem:      (menuItemId: string, variant?: string) => void;
  updateQuantity:  (menuItemId: string, quantity: number, variant?: string) => void;
  setCoupon:       (code: string | null, discount: number, minOrder?: number) => void;
  setTip:          (amount: number) => void;
  setNotes:        (notes: string) => void;
  clearCart:        () => void;
  getSubtotal:     () => number;
  getItemCount:    () => number;
  getValidDiscount: () => number;  // ✅ Validated discount
}

export const useCartStore = create<CartState>()(
  persist(
    (set, get) => ({
      items:          [],
      tableId:        null,
      customerId:     null,
      customerName:   "",
      customerPhone:  "",
      couponCode:     null,
      discount:       0,
      couponMinOrder: 0,
      tip:            0,
      notes:          "",
      restaurantId:   "a0000000-0000-0000-0000-000000000001",

      setTable:      (id) => set({ tableId: id }),
      setCustomer:   (id, name, phone) => set({ customerId: id, customerName: name, customerPhone: phone }),
      setRestaurant: (id) => set({ restaurantId: id }),

      addItem: (item) =>
        set((state) => {
          const key = `${item.menuItemId}-${item.variant || ""}`;
          const existing = state.items.find(
            (i) => `${i.menuItemId}-${i.variant || ""}` === key
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                `${i.menuItemId}-${i.variant || ""}` === key
                  ? { ...i, quantity: i.quantity + item.quantity }
                  : i
              ),
            };
          }
          return { items: [...state.items, item] };
        }),

      removeItem: (menuItemId, variant) =>
        set((state) => {
          const newItems = state.items.filter(
            (i) => !(i.menuItemId === menuItemId && (i.variant || "") === (variant || ""))
          );

          // ✅ Item remove hone pe coupon re-check
          const newSubtotal = newItems.reduce((sum, item) => {
            const addonTotal = (item.addons || []).reduce((a: number, b: Addon) => a + b.price, 0);
            return sum + (item.price + addonTotal) * item.quantity;
          }, 0);

          // Agar subtotal min order se neeche ya 0 ho gaya → coupon remove
          if (state.couponCode && (newSubtotal < state.couponMinOrder || newSubtotal <= 0)) {
            return {
              items:      newItems,
              couponCode: null,
              discount:   0,
              couponMinOrder: 0,
            };
          }

          // Agar discount subtotal se zyada ho gaya → cap karo
          if (state.discount > newSubtotal) {
            return {
              items:    newItems,
              discount: Math.min(state.discount, newSubtotal),
            };
          }

          return { items: newItems };
        }),

      updateQuantity: (menuItemId, quantity, variant) =>
        set((state) => {
          let newItems: OrderItem[];

          if (quantity <= 0) {
            newItems = state.items.filter(
              (i) => !(i.menuItemId === menuItemId && (i.variant || "") === (variant || ""))
            );
          } else {
            newItems = state.items.map((i) =>
              i.menuItemId === menuItemId && (i.variant || "") === (variant || "")
                ? { ...i, quantity }
                : i
            );
          }

          // ✅ Quantity change hone pe coupon re-check
          const newSubtotal = newItems.reduce((sum, item) => {
            const addonTotal = (item.addons || []).reduce((a: number, b: Addon) => a + b.price, 0);
            return sum + (item.price + addonTotal) * item.quantity;
          }, 0);

          // Subtotal min order se neeche → coupon remove
          if (state.couponCode && (newSubtotal < state.couponMinOrder || newSubtotal <= 0)) {
            return {
              items:      newItems,
              couponCode: null,
              discount:   0,
              couponMinOrder: 0,
            };
          }

          // Discount subtotal se zyada → cap karo
          if (state.discount > newSubtotal) {
            return {
              items:    newItems,
              discount: Math.min(state.discount, newSubtotal),
            };
          }

          return { items: newItems };
        }),

      // ✅ setCoupon ab minOrder bhi store karta hai
      setCoupon: (code, discount, minOrder = 0) =>
        set({
          couponCode:     code,
          discount:       code ? discount : 0,
          couponMinOrder: code ? minOrder  : 0,
        }),

      setTip:   (amount) => set({ tip: amount }),
      setNotes: (notes)  => set({ notes }),

      clearCart: () =>
        set({
          items:          [],
          couponCode:     null,
          discount:       0,
          couponMinOrder: 0,
          tip:            0,
          notes:          "",
        }),

      getSubtotal: () => {
        const { items } = get();
        return items.reduce((sum, item) => {
          const addonTotal = (item.addons || []).reduce((a: number, b: Addon) => a + b.price, 0);
          return sum + (item.price + addonTotal) * item.quantity;
        }, 0);
      },

      getItemCount: () => {
        const { items } = get();
        return items.reduce((sum, item) => sum + item.quantity, 0);
      },

      // ✅ Validated discount - subtotal se zyada nahi hoga
      getValidDiscount: () => {
        const { discount, couponCode, couponMinOrder } = get();
        if (!couponCode) return 0;

        const subtotal = get().getSubtotal();

        // Subtotal min order se kam → no discount
        if (couponMinOrder > 0 && subtotal < couponMinOrder) return 0;

        // Discount ko subtotal pe cap karo
        return Math.min(discount, subtotal);
      },
    }),
    { name: "restaurant-cart" }
  )
);