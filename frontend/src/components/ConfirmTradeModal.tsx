"use client";

import { useEffect } from "react";

type ConfirmTradeModalProps = {
  action: "BUY" | "SELL";
  ticker: string;
  quantity: number;
  price: number;
  processing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// this is the "are you sure" step that was completely missing before - one click used
// to fire off a real trade with no confirmation at all. now every buy/sell (from the
// discovery cards and the asset page) routes through here first so people can actually
// see what they're about to do before it happens
export function ConfirmTradeModal({ action, ticker, quantity, price, processing, onConfirm, onCancel }: ConfirmTradeModalProps) {
  const total = quantity * price;

  // escape cancels, enter confirms - so it doesn't feel like it's blocking you, just a
  // quick "yep, go" or "nope, back out" instead of forcing a mouse click
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter") onConfirm();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [onConfirm, onCancel]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm p-4"
      onClick={onCancel} // clicking the backdrop backs out, same as escape
    >
      <div
        className="w-full max-w-sm bg-card border-2 border-edge shadow-brutal p-6"
        onClick={(e) => e.stopPropagation()} // don't let clicks inside the card bubble up and close it
      >
        <p className="text-[11px] uppercase tracking-[0.2em] text-ink-muted mb-5">
          Confirm {action === "BUY" ? "Purchase" : "Sale"}
        </p>

        <div className="mb-6 space-y-3">
          <div className="flex justify-between text-sm">
            <span className="text-ink-muted">Ticker</span>
            <span className="font-bold text-ink">{ticker}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-ink-muted">Quantity</span>
            <span className="text-ink tabular-nums">{quantity} shares</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-ink-muted">Est. Price</span>
            <span className="text-ink tabular-nums">${price.toFixed(2)}</span>
          </div>
          <div className="flex justify-between items-center pt-3 border-t-2 border-edge">
            <span className="font-bold text-ink">Total</span>
            <span className="font-display font-bold text-xl text-ink tabular-nums">${total.toFixed(2)}</span>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="flex-1 h-10 border-2 border-edge text-xs font-bold tracking-widest uppercase text-ink-muted hover:bg-card-alt press-brutal shadow-brutal-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={processing}
            autoFocus
            className="flex-1 h-10 border-2 border-edge bg-accent text-accent-foreground text-xs font-bold tracking-widest uppercase press-brutal shadow-brutal-sm transition-all disabled:opacity-50"
          >
            {processing ? "Routing..." : `Confirm ${action}`}
          </button>
        </div>
      </div>
    </div>
  );
}
