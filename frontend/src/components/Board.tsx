"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import { LandingPage } from "@/components/LandingPage";
import { Toast, ToastMessage } from "@/components/Toast";
import { ConfirmTradeModal } from "@/components/ConfirmTradeModal";
import { MiniSparkline } from "@/components/MiniSparkline";
import { SectionRule, Empty, Skeleton, SkeletonBoard } from "@/components/ui";
import { ListingMorph } from "@/components/ListingMorph";
import { usd, pct, count, countCompact, change, toneClass, tickerParts, plural, clockTime } from "@/lib/format";
import { SECTIONS, COLUMNS, LABELS, STATE, ERROR, ORDER, BOARD, AUTH } from "@/lib/copy";

type Repository = {
  ticker: string;
  current_price: number;
  description: string;
  category: string;
  raw_stars: number;
  sparkline: number[];
};

type Holding = { ticker: string; shares: number; average_price: number };

type PendingTrade = { ticker: string; quantity: number; price: number } | null;

const POLL_MS = 5000;

// the listings: the market overview, one board per category, then your positions. anyone can
// read it, and trading needs an account. on the home page (`landing`) visitors get the landing
// page instead. each row has one buy button, and quantity gets set in the order ticket
export function Board({ landing = false }: { landing?: boolean }) {
  const [discovery, setDiscovery] = useState<Record<string, Repository[]>>({});
  const [message, setMessage] = useState<ToastMessage>(null);
  const [pending, setPending] = useState<PendingTrade>(null);
  const [processing, setProcessing] = useState(false);
  const [ticketNotice, setTicketNotice] = useState<string | null>(null);
  const [mine, setMine] = useState<Repository[]>([]);

  const [userId, setUserId] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(true);
  const [balance, setBalance] = useState<number | null>(null);
  const [portfolio, setPortfolio] = useState<Holding[]>([]);

  // the tick: last seen mark per listing, so a poll can tell which figures
  // actually moved and flash only those
  const lastMarks = useRef<Record<string, number>>({});
  const [flash, setFlash] = useState<Record<string, "pos" | "neg">>({});

  // when the last poll actually returned prices, and whether the latest one failed
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [feedDown, setFeedDown] = useState(false);

  const supabase = createClient();
  const router = useRouter();

  useEffect(() => {
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUserId(user?.id ?? null);
      setInitializing(false);
    };
    check();
  }, [supabase.auth]);

  const fetchBalance = async () => {
    if (!userId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/balance/${userId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setBalance(Number((await res.json()).balance));
    } catch {
      console.error(ERROR.ledger);
    }
  };

  const fetchPortfolio = async () => {
    if (!userId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/portfolio/${userId}`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setPortfolio((await res.json()).portfolio || []);
    } catch {
      console.error(ERROR.ledger);
    }
  };

  // the listings you added yourself, which only show on your board
  const fetchMine = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/listings/mine`, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setMine((await res.json()).listings || []);
    } catch {
      console.error(ERROR.ledger);
    }
  };

  // the board polls prices every 5 seconds while the tab is visible and catches up as soon
  // as it's shown again. on the home page a visitor sees the landing page, which runs its
  // own feed
  useEffect(() => {
    if (!userId && landing) return;
    if (userId) {
      const loadAccount = async () => {
        await Promise.all([fetchPortfolio(), fetchBalance(), fetchMine()]);
      };
      loadAccount();
    }

    const fetchDiscovery = async () => {
      try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/discovery`);
        if (!res.ok) {
          setFeedDown(true);
          return;
        }
        const data = await res.json();
        setDiscovery(data);
        setUpdatedAt(new Date());
        setFeedDown(false);

        // work out which marks moved on this poll and flash just those. the number
        // itself changes straight away and only the cell animates
        const moved: Record<string, "pos" | "neg"> = {};
        (Object.values(data).flat() as Repository[]).forEach((r) => {
          const prev = lastMarks.current[r.ticker];
          const now = Number(r.current_price);
          if (prev !== undefined && now !== prev) moved[r.ticker] = now > prev ? "pos" : "neg";
          lastMarks.current[r.ticker] = now;
        });
        if (Object.keys(moved).length > 0) {
          setFlash(moved);
          window.setTimeout(() => setFlash({}), 900);
        }
      } catch {
        setFeedDown(true);
        console.error(ERROR.engine);
      }
    };

    fetchDiscovery();
    const interval = setInterval(() => {
      if (!document.hidden) fetchDiscovery();
    }, POLL_MS);
    const onVisible = () => {
      if (!document.hidden) fetchDiscovery();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval); // otherwise it polls forever after unmount
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const openTicket = (trade: NonNullable<PendingTrade>) => {
    setTicketNotice(null);
    setPending(trade);
  };

  const confirmTrade = async () => {
    if (!pending || !userId) return;
    const { ticker, quantity, price } = pending;

    setProcessing(true);
    setMessage(null);
    setTicketNotice(null);
    let keepOpen = false;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("no session");
      const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/buy`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ ticker, shares: quantity, expectedPrice: Number(price) }),
      });
      const result = await res.json();

      if (res.ok) {
        setMessage({ text: ORDER.filled("BUY", quantity, result.ticker ?? ticker, usd(result.price ?? price)), type: "success" });
        fetchBalance();
        fetchPortfolio();
        fetchMine();
      } else if (res.status === 409 && typeof result.price === "number") {
        // the price moved: the ticket stays open at the new price with the reason in it
        keepOpen = true;
        setPending((p) => p && { ...p, price: result.price });
        setTicketNotice(result.error);
      } else {
        setMessage({ text: ORDER.rejected(result.error), type: "error" });
      }
    } catch {
      setMessage({ text: ERROR.ledgerRefused, type: "error" });
    } finally {
      setProcessing(false);
      if (!keepOpen) setPending(null);
    }
  };

  if (initializing) {
    return (
      <div className="flex-1">
        <main className="mx-auto w-full max-w-[76rem] px-5 py-10 sm:px-8 sm:py-12">
          <div className="mb-12 border-b border-rule-2 pb-6">
            <Skeleton className="h-3 w-24" />
            <div className="mt-6 flex flex-wrap items-end justify-between gap-6">
              <div className="space-y-3">
                <Skeleton className="h-10 w-64 max-w-full" />
                <Skeleton className="h-4 w-52" />
              </div>
              <div className="space-y-2 text-right">
                <Skeleton className="ml-auto h-3 w-28" />
                <Skeleton className="ml-auto h-7 w-40" />
              </div>
            </div>
          </div>
          <SkeletonBoard rows={8} />
        </main>
      </div>
    );
  }

  if (!userId && landing) return <LandingPage />;

  // buying needs an account, so a visitor's buy button goes to sign in and comes back here
  const buy = (trade: NonNullable<PendingTrade>) => {
    if (userId) openTicket(trade);
    else router.push(`/login?next=${encodeURIComponent("/listings")}`);
  };

  // dedupe by ticker inside each category, since the feed can return the same repo twice.
  // your own listings go last as their own section
  const sections = Object.entries(discovery);
  if (mine.length > 0) sections.push([BOARD.yours, mine]);
  const categories = sections.map(([cat, repos]) => {
    const seen = new Set<string>();
    const unique = repos.filter((r) => {
      const key = r.ticker.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
    return [cat, unique] as [string, Repository[]];
  });
  const morphed = new Set<string>();
  const totalListings = categories.reduce((n, [, repos]) => n + repos.length, 0);

  // the masthead figures, derived from the same quotes as the board below:
  //   listedValue     every listing's mark, summed
  //   positionsValue  your holdings at the live quote, or at the average paid for
  //                   anything not currently on the feed
  const marks: Record<string, number> = {};
  categories.forEach(([, repos]) => repos.forEach((r) => { marks[r.ticker] = Number(r.current_price); }));
  const listedValue = Object.values(marks).reduce((s, m) => s + m, 0);
  const positionsValue = portfolio.reduce((s, h) => s + h.shares * (marks[h.ticker] ?? h.average_price), 0);

  // the index strip: ruled cells, the market first, then your account when you have one
  const indexCells: { label: string; value: string; sub: string }[] = [
    { label: LABELS.listedValue, value: usd(listedValue), sub: "all prices, summed" },
    { label: SECTIONS.listings, value: count(totalListings), sub: "tracked" },
    ...(userId
      ? [
          { label: LABELS.purchasingPower, value: balance !== null ? usd(balance) : "-", sub: "cash" },
          { label: LABELS.positionsValue, value: usd(positionsValue), sub: portfolio.length ? `${count(portfolio.length)} held` : "none held" },
        ]
      : []),
  ];

  // vertical rules between columns (2-up on mobile, 4-up from lg) plus a top
  // rule under the mobile second row; the <dl>'s own border-y closes the band.
  const indexCellCls = (i: number) =>
    [
      "px-4 py-4 sm:px-5",
      i % 2 === 1 && "border-l border-rule",
      "lg:border-l lg:border-rule",
      i === 0 && "lg:border-l-0",
      i >= 2 && "border-t border-rule lg:border-t-0",
    ]
      .filter(Boolean)
      .join(" ");

  return (
    <div className="flex-1">
      <main className="mx-auto w-full max-w-[76rem] px-5 py-10 sm:px-8 sm:py-12">
        {/* overview: the size of the market, how many listings, what you can spend and
            what you hold, all priced off the same poll as the boards below */}
        <div className="mb-12">
          <SectionRule label={SECTIONS.market} className="mb-5" />
          <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1.5">
            <h1 className="display text-[clamp(1.75rem,3.4vw,2.5rem)] text-ink">
              {SECTIONS.board}
            </h1>
            <p className="text-[13px] text-ink-2" aria-live="off">
              {updatedAt === null ? (
                STATE.quotes
              ) : (
                <>
                  {feedDown ? "Price feed unavailable. Last updated " : "Prices updated "}
                  {/* keyed on the time so each successful poll re-runs the
                      flash on the reading itself */}
                  <time key={updatedAt.getTime()} dateTime={updatedAt.toISOString()} className="figure tick-read text-ink">
                    {clockTime(updatedAt)}
                  </time>
                </>
              )}
            </p>
          </div>

          <dl className={`mt-6 grid grid-cols-2 border-y border-rule-2 ${userId ? "lg:grid-cols-4" : ""}`}>
            {indexCells.map((c, i) => (
              <div key={c.label} className={indexCellCls(i)}>
                <dt className="label mb-2">{c.label}</dt>
                <dd className="figure text-xl leading-none text-ink sm:text-2xl">{c.value}</dd>
                <dd className="ref mt-1.5">{c.sub}</dd>
              </div>
            ))}
          </dl>

          {!userId && (
            <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-3">
              <p className="text-[13px] text-ink-2">{BOARD.visitor}</p>
              <div className="flex items-center gap-2">
                <Link href="/login?mode=signup" className="ctl ctl-primary ctl-sm">
                  {AUTH.signUp}
                </Link>
                <Link href={`/login?next=${encodeURIComponent("/listings")}`} className="ctl ctl-sm">
                  {AUTH.signIn}
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* the columns legend, which says what mark and Δ measure */}
        {categories.length > 0 && (
          <p className="ref mb-6 block">{BOARD.columnsNote}</p>
        )}

        {/* the boards, one per category */}
        {categories.length === 0 ? (
          <SkeletonBoard rows={8} />
        ) : (
          <div className="space-y-14">
            {/* a listing can sit in more than one category. only its first row gets
                the shared morph name, since a name can only be on the page once */}
            {categories.map(([category, repos]) => (
              <section key={category}>
                <SectionRule label={category} meta={plural(repos.length, "listing")} className="mb-5" />
                <div className="overflow-x-auto no-bar">
                  <table className="board min-w-0 sm:min-w-[40rem]">
                    <thead>
                      <tr>
                        <th>{COLUMNS.listing}</th>
                        <th className="text-right">{COLUMNS.mark}</th>
                        <th className="text-right" title="Move across each listing's last ten recorded marks">
                          {COLUMNS.change}
                        </th>
                        <th className="hidden text-right md:table-cell">{COLUMNS.stars}</th>
                        <th className="hidden w-[76px] sm:table-cell" />
                        <th className="w-[64px] sm:w-[92px]" />
                      </tr>
                    </thead>
                    <tbody>
                      {repos.map((repo) => {
                        const { owner, repo: name } = tickerParts(repo.ticker);
                        const delta =
                          repo.sparkline.length > 1
                            ? change(repo.sparkline[0], repo.sparkline[repo.sparkline.length - 1])
                            : null;
                        const tick = flash[repo.ticker];
                        const morph = !morphed.has(repo.ticker);
                        morphed.add(repo.ticker);

                        return (
                          <tr key={repo.ticker}>
                            <td className="max-w-0">
                              {/* one line per listing, with the name and owner inline */}
                              {/* full prefetch so the listing page can render in the
                                  same frame as the click, which is what lets its
                                  name morph out of this row */}
                              <Link
                                href={`/asset/${owner.toLowerCase()}/${name.toLowerCase()}`}
                                prefetch
                                className="group flex min-w-0 items-baseline gap-2"
                              >
                                <ListingMorph ticker={repo.ticker} morph={morph}>
                                  <span className="truncate text-[12px] font-medium uppercase text-ink sig">
                                    {name}
                                  </span>
                                </ListingMorph>
                                <span className="hidden truncate text-[11px] text-ink-3 sm:inline">
                                  {owner}
                                </span>
                              </Link>
                            </td>
                            <td className={`num text-[13px] text-ink ${tick ? `tick-${tick}` : ""}`}>
                              {usd(repo.current_price)}
                            </td>
                            <td className={`num text-[13px] ${toneClass(delta)}`}>
                              {delta === null ? "-" : pct(delta)}
                            </td>
                            <td className="num hidden text-[13px] text-ink-2 md:table-cell">
                              {countCompact(repo.raw_stars)}
                            </td>
                            <td className="hidden pr-3 text-right sm:table-cell">
                              <MiniSparkline
                                data={repo.sparkline}
                                positive={(delta ?? 0) >= 0}
                                className="inline-block align-middle"
                              />
                            </td>
                            <td className="pr-3 text-right">
                              <button
                                onClick={() =>
                                  buy({
                                    ticker: repo.ticker,
                                    quantity: 1,
                                    price: Number(repo.current_price),
                                  })
                                }
                                className="press rounded-full bg-brand px-3.5 py-1.5 text-[12px] font-medium leading-none text-brand-fg hover:brightness-95"
                                aria-label={`Buy ${repo.ticker}`}
                              >
                                {ORDER.buy}
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            ))}
          </div>
        )}

        {/* positions */}
        {userId && (
          <section className="mt-16">
            <SectionRule
              label={SECTIONS.positions}
              meta={<Link href="/portfolio" className="link">All positions</Link>}
              className="mb-5"
            />
            <div className="panel">
              {portfolio.length === 0 ? (
                <Empty>{STATE.noPositions}</Empty>
              ) : (
                <div className="overflow-x-auto no-bar">
                  <table className="board min-w-[28rem]">
                    <thead>
                      <tr>
                        <th>{COLUMNS.listing}</th>
                        <th className="text-right">{COLUMNS.qty}</th>
                        <th className="text-right">{COLUMNS.avg}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {portfolio.map((h) => {
                        const { owner, repo } = tickerParts(h.ticker);
                        return (
                          <tr key={h.ticker}>
                            <td>
                              <Link
                                href={`/asset/${owner.toLowerCase()}/${repo.toLowerCase()}`}
                                className="text-[13px] text-ink sig"
                              >
                                {h.ticker}
                              </Link>
                            </td>
                            <td className="num text-[13px] text-ink">{count(h.shares)}</td>
                            <td className="num text-[13px] text-ink-2">{usd(h.average_price)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>
        )}
      </main>

      <ConfirmTradeModal
        trade={pending && { action: "BUY", ...pending }}
        onQuantityChange={(q) => setPending((p) => p && { ...p, quantity: q })}
        balance={balance}
        processing={processing}
        notice={ticketNotice}
        onConfirm={confirmTrade}
        onCancel={() => setPending(null)}
      />

      <Toast message={message} />
    </div>
  );
}
