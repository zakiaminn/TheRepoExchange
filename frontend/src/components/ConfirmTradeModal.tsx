"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Drawer } from "vaul";
import { Minus, Plus } from "lucide-react";
import { usd, count } from "@/lib/format";
import { ORDER, LABELS, SECTIONS } from "@/lib/copy";

export type TicketTrade = {
  action: "BUY" | "SELL";
  ticker: string;
  quantity: number;
  price: number;
};

type Props = {
  trade: TicketTrade | null;
  onQuantityChange: (q: number) => void;
  balance: number | null;
  ownedShares?: number;
  processing: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

// wide screens get the ticket from the right edge, next to the prices it's
// about; phones get a bottom sheet you can drag down to dismiss.
const WIDE = "(min-width: 640px)";
function useWide() {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(WIDE);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(WIDE).matches,
    () => true
  );
}

/* the order ticket, and the one place you set quantity. size, cost and the
   cash left over are all decided here, with the arithmetic visible before
   anything is sent.

   it's a Vaul drawer rather than a centred dialog so it can be thrown away:
   drag it, flick it, or press Escape. while it closes it keeps rendering the
   last trade, so the numbers don't blank out halfway through the slide. */
export function ConfirmTradeModal({
  trade,
  onQuantityChange,
  balance,
  ownedShares = 0,
  processing,
  onConfirm,
  onCancel,
}: Props) {
  const wide = useWide();
  const qtyRef = useRef<HTMLInputElement>(null);

  const [last, setLast] = useState(trade);
  const same =
    trade && last &&
    trade.action === last.action && trade.ticker === last.ticker &&
    trade.quantity === last.quantity && trade.price === last.price;
  if (trade && !same) setLast(trade);
  const t = trade ?? last;

  const open = trade !== null;
  const isBuy = t?.action !== "SELL";
  const quantity = t?.quantity ?? 0;
  const price = t?.price ?? 0;
  const total = quantity * price;
  const remaining = balance !== null ? balance - total : null;

  // what, specifically, is stopping this order, stated as a fact rather
  // than a red field with no explanation
  const blocker =
    !Number.isFinite(quantity) || quantity < 1
      ? "Quantity must be at least one share."
      : isBuy && balance !== null && total > balance
        ? ORDER.insufficient
        : !isBuy && quantity > ownedShares
          ? `Position is ${count(ownedShares)} ${LABELS.shares}.`
          : null;

  const canSubmit = open && !blocker && !processing;

  // Enter commits, but only when the order is valid, so hammering Enter on a
  // rejected ticket does nothing. Escape belongs to the drawer.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Enter" && canSubmit) onConfirm();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onConfirm, canSubmit]);

  const row = (term: string, value: React.ReactNode) => (
    <div className="flex items-baseline justify-between gap-4 border-b border-rule py-3">
      <span className="label">{term}</span>
      <span className="text-[13px] text-ink">{value}</span>
    </div>
  );

  return (
    <Drawer.Root
      open={open}
      onOpenChange={(o) => { if (!o) onCancel(); }}
      direction={wide ? "right" : "bottom"}
      dismissible={!processing}
      // vaul's own keyboard handling shoved the sheet up the screen on iOS
      // and left a gap above the keypad; the browser's default keeps the
      // focused field in view without moving the sheet
      repositionInputs={false}
    >
      <Drawer.Portal>
        <Drawer.Overlay className="fixed inset-0 z-50 bg-[var(--scrim)]" />
        <Drawer.Content
          aria-describedby={undefined}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            // with a mouse, the quantity is ready to type into. on a touch
            // screen focusing it would throw up the keyboard over the ticket
            // before you've decided anything, so it waits for a tap (and the
            // − / + buttons cover most changes without one)
            if (window.matchMedia("(pointer: fine)").matches) qtyRef.current?.select();
          }}
          className={
            wide
              ? "fixed inset-y-0 right-0 z-50 flex w-[26rem] max-w-[92vw] flex-col border-l border-rule-2 bg-paper outline-none"
              : "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col border-t border-rule-2 bg-paper pb-[env(safe-area-inset-bottom)] outline-none"
          }
        >
          {/* a flat grab bar rather than Vaul's rounded pill; nothing else here is round */}
          {!wide && <div className="mx-auto mt-2.5 h-1 w-10 shrink-0 bg-rule-2" aria-hidden="true" />}

          <div className="flex items-baseline justify-between gap-3 border-b border-rule-2 px-5 py-4">
            <Drawer.Title className="label label-ink">{SECTIONS.ticket}</Drawer.Title>
            <span className="label">{isBuy ? "Buy at market" : "Sell at market"}</span>
          </div>

          <div className="overflow-y-auto px-5 pt-2">
            {row("Listing", t?.ticker ?? "")}
            {row(LABELS.mark, <span className="figure">{usd(price)}</span>)}

            <div className="flex items-center justify-between gap-4 border-b border-rule py-3">
              <label htmlFor="ticket-qty" className="label">
                {LABELS.quantity}
              </label>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onQuantityChange(Math.max(1, quantity - 1))}
                  disabled={processing || quantity <= 1}
                  aria-label="One fewer share"
                  className="ctl ctl-sm ctl-icon text-ink-2"
                >
                  <Minus size={13} strokeWidth={1.75} aria-hidden="true" />
                </button>
                <input
                  id="ticket-qty"
                  ref={qtyRef}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={Number.isFinite(quantity) ? quantity : ""}
                  onChange={(e) => onQuantityChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
                  disabled={processing}
                  className="field field-figure h-9 w-20 select-text text-[16px] sm:text-[13px]"
                />
                <button
                  type="button"
                  onClick={() => onQuantityChange((Number.isFinite(quantity) ? quantity : 0) + 1)}
                  disabled={processing}
                  aria-label="One more share"
                  className="ctl ctl-sm ctl-icon text-ink-2"
                >
                  <Plus size={13} strokeWidth={1.75} aria-hidden="true" />
                </button>
              </div>
            </div>

            <div className="mt-1 border-t border-rule-2 pt-4">
              <div className="flex items-baseline justify-between gap-4">
                <span className="label label-ink">{isBuy ? LABELS.estimated : LABELS.proceeds}</span>
                <span className="figure text-2xl text-ink">{usd(total)}</span>
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
              <div className="mt-4 border-l-2 border-l-neg pl-3 text-[12px] leading-relaxed text-neg">
                {blocker}
              </div>
            )}
          </div>

          <div className="mt-auto grid grid-cols-2 gap-3 border-t border-rule px-5 py-4">
            <button onClick={onCancel} disabled={processing} className="ctl">
              {ORDER.cancel}
            </button>
            <button
              onClick={onConfirm}
              disabled={!canSubmit}
              className={`ctl ${isBuy ? "ctl-primary" : "ctl-neg"}`}
            >
              {processing ? ORDER.routing : isBuy ? ORDER.confirmBuy : ORDER.confirmSell}
            </button>
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
