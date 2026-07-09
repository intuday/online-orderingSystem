// src/components/unlocked-offers-bar.tsx
"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Gift, ChevronRight, Check, X } from "lucide-react";
import { useOfferEngine } from "@/store/offer-engine";
import { formatCurrency } from "@/lib/utils";

export default function UnlockedOffersBar() {
  const unlockedOffers  = useOfferEngine((s) => s.unlockedOffers);
  const showRewardPicker = useOfferEngine((s) => s.showRewardPicker);
  const removePromoItem = useOfferEngine((s) => s.removePromoItem);
  const promoItems      = useOfferEngine((s) => s.promoItems);

  if (unlockedOffers.length === 0) return null;

  return (
    <div className="px-4 py-2">
      <AnimatePresence>
        {unlockedOffers.map((unlocked) => (
          <motion.div
            key={unlocked.offer.id}
            initial={{ opacity: 0, y: -10, height: 0 }}
            animate={{ opacity: 1, y: 0, height: "auto" }}
            exit={{ opacity: 0, y: -10, height: 0 }}
            className="mb-2"
          >
            <div
              className={`flex items-center gap-3 p-3 rounded-2xl border ${
                unlocked.isClaimed
                  ? "bg-green-50 border-green-200"
                  : "bg-gradient-to-r from-orange-50 to-amber-50 border-orange-200"
              }`}
            >
              {/* Icon */}
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                  unlocked.isClaimed
                    ? "bg-green-100"
                    : "bg-orange-100"
                }`}
              >
                {unlocked.isClaimed ? (
                  <Check className="w-5 h-5 text-green-600" />
                ) : (
                  <Gift className="w-5 h-5 text-orange-600" />
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-slate-900 line-clamp-1">
                  {unlocked.offer.title}
                </h4>
                {unlocked.isClaimed ? (
                  <p className="text-[10px] text-green-600 font-medium">
                    ✓ Reward claimed! Saving{" "}
                    {formatCurrency(
                      (() => {
                        const promo = promoItems.find(
                          (pi) => pi.offerId === unlocked.offer.id
                        );
                        return promo
                          ? (promo.price - promo.promoPrice) * promo.quantity
                          : 0;
                      })()
                    )}
                  </p>
                ) : (
                  <p className="text-[10px] text-orange-600 font-medium">
                    🎁 Tap to choose your reward
                  </p>
                )}
              </div>

              {/* Action */}
              {unlocked.isClaimed ? (
                <button
                  onClick={() => removePromoItem(unlocked.offer.id)}
                  className="w-7 h-7 rounded-lg bg-red-50 text-red-500 flex items-center justify-center shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : (
                <button
                  onClick={() => showRewardPicker(unlocked, [])}
                  className="shrink-0 flex items-center gap-1 bg-orange-500 text-white text-[10px] font-bold px-3 py-1.5 rounded-lg active:scale-95 transition-transform"
                >
                  Claim
                  <ChevronRight className="w-3 h-3" />
                </button>
              )}
            </div>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}