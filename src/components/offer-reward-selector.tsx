// src/components/offer-reward-selector.tsx
"use client";

import { useState, useEffect }      from "react";
import { motion, AnimatePresence }  from "framer-motion";
import { X, Gift, Check, Sparkles } from "lucide-react";
import { useOfferEngine }           from "@/store/offer-engine";
import { formatCurrency }           from "@/lib/utils";
import type { RewardChoice }        from "@/lib/types";

// ─── Component ────────────────────────────────────────────────────────────────

export default function OfferRewardSelector() {
  const showRewardSelector = useOfferEngine((s) => s.showRewardSelector);
  const activeOffer        = useOfferEngine((s) => s.activeOffer);
  const rewardChoices      = useOfferEngine((s) => s.rewardChoices);
  const claimReward        = useOfferEngine((s) => s.claimReward);
  const dismissReward      = useOfferEngine((s) => s.dismissReward);

  const [selected, setSelected] = useState<RewardChoice | null>(null);

  // Reset selection when modal closes or offer changes
  useEffect(() => {
    if (!showRewardSelector) {
      setSelected(null);
    }
  }, [showRewardSelector]);

  const handleClaim = () => {
    if (!selected || !activeOffer) return;
    claimReward(activeOffer.offer.id, selected);
    setSelected(null);
  };

  // AnimatePresence must wrap the conditional render to animate exit correctly
  return (
    <AnimatePresence>
      {showRewardSelector && activeOffer && (
        <motion.div
          key="reward-selector-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] bg-black/60 flex items-end justify-center"
          onClick={dismissReward}
        >
          <motion.div
            key="reward-selector-sheet"
            initial={{ y: "100%" }}
            animate={{ y: 0 }}
            exit={{ y: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg bg-white rounded-t-3xl overflow-hidden"
          >
            {/* Header */}
            <div className="relative bg-gradient-to-r from-orange-500 to-red-500 px-6 py-5">
              <button
                onClick={dismissReward}
                className="absolute top-4 right-4 w-8 h-8 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center"
                aria-label="Dismiss offer"
              >
                <X className="w-4 h-4 text-white" />
              </button>

              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ type: "spring", delay: 0.2 }}
                className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center mb-3"
              >
                <Gift className="w-7 h-7 text-white" />
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="text-xl font-bold text-white"
              >
                🎉 Offer Unlocked!
              </motion.h2>

              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-white/80 text-sm mt-1"
              >
                {activeOffer.offer.title}
              </motion.p>

              {activeOffer.offer.description && (
                <motion.p
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-white/60 text-xs mt-1"
                >
                  {activeOffer.offer.description}
                </motion.p>
              )}
            </div>

            {/* Reward Choices */}
            <div className="p-5 space-y-4">
              <div className="flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-orange-500" />
                <h3 className="text-sm font-bold text-slate-900">
                  Choose your reward
                </h3>
              </div>

              <div className="space-y-2">
                {rewardChoices.map((choice, idx) => {
                  const isSelected = selected?.menuItemId === choice.menuItemId;
                  const savings    = choice.originalPrice - choice.promoPrice;

                  return (
                    <motion.button
                      key={choice.menuItemId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 0.1 * idx }}
                      onClick={() => setSelected(choice)}
                      className={`w-full flex items-center gap-3 p-3 rounded-2xl border-2 transition-all ${
                        isSelected
                          ? "border-orange-500 bg-orange-50 shadow-md"
                          : "border-slate-200 bg-white hover:border-slate-300"
                      }`}
                    >
                      {/* Image */}
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-slate-100 shrink-0">
                        {choice.image ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={choice.image}
                            alt={choice.name}
                            className="w-full h-full object-cover"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-2xl">
                            🍽️
                          </div>
                        )}
                      </div>

                      {/* Info */}
                      <div className="flex-1 text-left">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {choice.isVeg !== undefined && (
                            <span className={`w-3 h-3 rounded-sm border-2 flex items-center justify-center ${
                              choice.isVeg ? "border-green-500" : "border-red-500"
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${
                                choice.isVeg ? "bg-green-500" : "bg-red-500"
                              }`} />
                            </span>
                          )}
                          <h4 className="text-sm font-semibold text-slate-900">
                            {choice.name}
                          </h4>
                        </div>

                        <div className="flex items-center gap-2">
                          <span className="text-xs text-slate-400 line-through">
                            {formatCurrency(choice.originalPrice)}
                          </span>
                          <span className="text-sm font-bold text-green-600">
                            {choice.promoPrice === 0
                              ? "FREE"
                              : formatCurrency(choice.promoPrice)}
                          </span>
                          {savings > 0 && (
                            <span className="bg-green-100 text-green-700 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                              SAVE {formatCurrency(savings)}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Selection Indicator */}
                      <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                        isSelected
                          ? "border-orange-500 bg-orange-500"
                          : "border-slate-300"
                      }`}>
                        {isSelected && <Check className="w-3.5 h-3.5 text-white" />}
                      </div>
                    </motion.button>
                  );
                })}
              </div>

              {/* Claim Button */}
              <motion.button
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 }}
                onClick={handleClaim}
                disabled={!selected}
                className={`w-full rounded-xl font-semibold flex items-center justify-center gap-2 transition-all py-3.5 ${
                  selected
                    ? "bg-orange-500 text-white shadow-lg shadow-orange-200 active:scale-[0.98]"
                    : "bg-slate-200 text-slate-400 cursor-not-allowed"
                }`}
              >
                <Gift className="w-5 h-5" />
                <span>
                  {selected
                    ? `Claim ${
                        selected.promoPrice === 0
                          ? "FREE"
                          : `@ ${formatCurrency(selected.promoPrice)}`
                      }`
                    : "Select a reward"}
                </span>
              </motion.button>

              {/* Skip */}
              <button
                onClick={dismissReward}
                className="w-full text-center text-xs text-slate-400 hover:text-slate-600 transition-colors py-2"
              >
                Skip this offer
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}