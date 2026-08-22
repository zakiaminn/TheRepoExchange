"use client";

import { useEffect, useRef } from "react";
import { usd, count } from "@/lib/format";
import { ORDER, LABELS, SECTIONS } from "@/lib/copy";

type Props = {
  action: "BUY" | "SELL";
  ticker: string;
  quantity: number;
  onQuantityChange: (q: number) => void;
  price: number;
  balance: number | null;
  ownedShares?: number;
  processing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

/* the buy/sell confirm dialog — and now the ONE place you set quantity.

   that's an actual change, not just paint. before, every card on the board had
   its own qty box, so the number you were committing lived on a different
   surface than the confirm step — plus a stepper on every single row is a ton
   of controls for something most rows never get used for. now a row just says
   "Buy", and size + cost + leftover cash all get decided here, with the maths
   visible before anything fires.

   laid out like a paper ticket: label/value rows, a totals line under a
   heavier rule, and the consequence last. */
export function ConfirmTradeModal({
  action,
  ticker,
  quantity,
  onQuantityChange,
  price,
  balance,
  ownedShares = 0,
  processing,
  onConfirm,
  onCancel,
}: Props) {
  const total = quantity * price;
  const isBuy = action === "BUY";
  const remaining = balance !== null ? balance - total : null;
  const qtyRef = useRef<HTMLInputElement>(null);

  // what, specifically, is stopping this order — stated as a fact rather
  // than surfaced as a red field with no explanation
  const blocker =
    !Number.isFinite(quantity) || quantity < 1
      ? "Quantity must be at least one share."
      : isBuy && balance !== null && total > balance
        ? ORDER.insufficient
        : !isBuy && quantity > ownedShares
          ? `Position is ${count(ownedShares)} ${LABELS.shares}.`
          : null;

  const canSubmit = !blocker && !processing;

  useEffect(() => {
    qtyRef.current?.select();
  }, []);

  // Escape backs out, Enter commits — but only when the order is actually
  // valid, so hammering Enter on a rejected ticket does nothing
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
      if (e.key === "Enter" && canSubmit) onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onConfirm, onCancel, canSubmit]);

  const Row = ({ term, value }: { term: string; value: React.ReactNode }) => (
    <div className="flex items-baseline justify-between gap-4 border-b border-rule py-2.5">
      <span className="label">{term}</span>
      <span className="figure text-[13px] text-ink">{value}</span>
    </div>
  );

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-[var(--ink)]/50 p-4 backdrop-blur-sm sm:items-center"
      onClick={onCancel}
      role="dialog"
      aria-modal="true"
      aria-label={SECTIONS.ticket}
    >
      <div
        className="panel registered reveal w-full max-w-md"
        style={{ background: "var(--paper)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-baseline justify-between gap-3 border-b border-rule-2 px-5 py-3">
          <span className="label label-ink">{SECTIONS.ticket}</span>
          <span className="ref">{isBuy ? "BUY · MKT" : "SELL · MKT"}</span>
        </div>

        <div className="px-5 pb-1 pt-3">
          <Row term="Listing" value={ticker} />
          <Row term={LABELS.mark} value={usd(price)} />

          <div className="flex items-center justify-between gap-4 border-b border-rule py-2.5">
            <label htmlFor="ticket-qty" className="label">
              {LABELS.quantity}
            </label>
            <input
              id="ticket-qty"
              ref={qtyRef}
              type="number"
              min={1}
              step={1}
              value={Number.isFinite(quantity) ? quantity : ""}
              onChange={(e) => onQuantityChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
              disabled={processing}
              className="field field-figure h-8 w-28 text-[13px]"
            />
          </div>

          {/* the totals sit below a heavier rule, the way they do on any
              printed ticket — the eye should stop here */}
          <div className="mt-1 border-t border-rule-2 pt-3">
            <div className="flex items-baseline justify-between gap-4">
              <span className="label label-ink">
                {isBuy ? LABELS.estimated : LABELS.proceeds}
              </span>
              <span className="figure text-xl text-ink">{usd(total)}</span>
            </div>
            {isBuy && remaining !== null && (
              <div className="mt-2 flex items-baseline justify-between gap-4">
                <span className="label">{LABELS.purchasingPower} after</span>
                <span className={`figure text-[12px] ${remaining < 0 ? "text-neg" : "text-ink-2"}`}>
                  {usd(remaining)}
                </span>
              </div>
            )}
            {!isBuy && (
              <div className="mt-2 flex items-baseline justify-between gap-4">
                <span className="label">{LABELS.position} after</span>
                <span className="figure text-[12px] text-ink-2">
                  {count(Math.max(0, ownedShares - quantity))} {LABELS.shares}
                </span>
              </div>
            )}
          </div>

          {blocker && (
            <div className="mt-3 border-l-2 border-l-neg pl-3 text-[12px] leading-relaxed text-neg">
              {blocker}
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-2 gap-px border-t border-rule bg-rule">
          <button onClick={onCancel} className="ctl border-0 bg-[var(--paper)] text-ink-2">
            {ORDER.cancel}
          </button>
          <button
            onClick={onConfirm}
            disabled={!canSubmit}
            className={`ctl border-0 ${isBuy ? "ctl-primary" : "bg-[var(--paper)] text-ink"}`}
          >
            {processing ? ORDER.routing : isBuy ? ORDER.confirmBuy : ORDER.confirmSell}
          </button>
        </div>
      </div>
    </div>
  );
}
