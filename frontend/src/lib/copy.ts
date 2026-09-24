// every word the user reads lives in this one file, so the voice can't drift
// page by page.
//
// the voice: plain, exact English. say what is true and stop. TRX is a real
// piece of software about a simulated market, and it reads that way: no
// exchange-floor vocabulary, no deadpan bit, no cheerleading.
//
// house rules:
//   - state facts. don't congratulate, reassure, or sell.
//   - no exclamation marks, no emoji, none of "just/simply/oops/let's".
//   - no em-dashes. a period or a comma does the same work.
//   - failures say what failed. "Ledger unreachable." not "Something went
//     wrong! Please try again."
//   - sentence case in prose, caps only for labels. never Title Case.
//   - if a sentence can stop sooner, it stops sooner.

export const BRAND = {
  ticker: "TRX",
  name: "The Repo Exchange",
  full: "TRX · The Repo Exchange",
  tagline: "A market in open source.",
} as const;

export const HERO = {
  headline: "A market in open source.",
  // what it is, where the prices come from, and that it isn't real, before
  // anyone has to ask
  dek: "Listings are priced from live GitHub activity. Positions are simulated, and nothing offered here is a security.",
  primary: "Open an account",
  secondary: "Read the mechanics",
} as const;

/** How the market works, one fact per row. */
export const MECHANICS: ReadonlyArray<{ term: string; value: string }> = [
  { term: "Pricing basis", value: "Weighted from live GitHub activity. Stars, forks and watchers lift a listing; open pull requests add and open issues subtract. Polled continuously." },
  { term: "Settlement", value: "Immediate. T+0." },
  { term: "Opening capital", value: "$100,000.00, credited once, non-renewable." },
  { term: "Order types", value: "Market only. Slippage is checked at the ledger and rejected, not absorbed." },
  { term: "Hours", value: "Continuous. The exchange does not close." },
  { term: "Data source", value: "GitHub REST API, backfilled where history exists." },
  { term: "Custody", value: "None. Positions are entries in a ledger, not assets." },
];

/** The three steps, in the order they happen. */
export const CLAUSES: ReadonlyArray<{ title: string; body: string }> = [
  {
    title: "Open an account",
    body: "Sign up with an email address and the account is credited with $100,000 of simulated capital. There is nothing to deposit.",
  },
  {
    title: "Place an order",
    body: "Orders fill at the current price. If the price moves past tolerance between sending and filling, the order is rejected rather than filled at a worse price.",
  },
  {
    title: "Hold or sell",
    body: "Positions are valued against live prices. Profit and loss stays unrealised until you sell.",
  },
];

export const NOTICE = {
  label: "Simulation",
  body: "TRX is a simulation. No securities are offered, sold, or held. Positions give no ownership of, or claim on, any repository or its maintainers. Cash balances are fictional and can't be transferred. Prices come from public activity metrics and are not a valuation of anything.",
} as const;

/** The landing page's sections, top to bottom. */
export const LANDING = {
  fieldNote: "Each line is one listing. Its height is its price; its shape is its last ten prices.",
  index: [
    { word: "Trade", href: "#trade" },
    { word: "Call", href: "#call" },
    { word: "Verify", href: "#verify" },
  ],
  trade: {
    kicker: "Trade",
    title: "Buy and sell in two clicks.",
    body: "Pick a listing, set a size, confirm. The order fills at the published price, or it's rejected if the price moved too far in between. Every account starts with $100,000 of simulated capital.",
    link: "Open an account",
  },
  phone: {
    kicker: "On a phone",
    title: "Works the same in one hand.",
    body: "On a phone the order ticket is a sheet you can drag away. Search, buy and check a position without reaching for the top of the screen.",
  },
  call: {
    kicker: "Call",
    title: "Call a repository's stars.",
    body: "Predict that a repository reaches a star count by a date. It settles automatically against the public count: a correct call returns twice the stake.",
    link: "How calls settle",
  },
  verify: {
    kicker: "Verify",
    title: "Every price shows its working.",
    body: "A price is a published formula over six public GitHub numbers. Each listing page rebuilds it line by line, so you can check it against GitHub in another tab.",
    link: "Read the mechanics",
  },
  morph: "Slowed down: the name you click carries into the page it opens.",
  statement: {
    title: "Priced from public numbers, not a hidden model.",
    body: "Stars, forks, watchers, open pull requests, open issues and the date of the last push. That's the whole input. Anyone can reproduce any listed price from the repository's own page.",
  },
} as const;

export const CTA = {
  headline: "Start with $100,000 of simulated capital.",
  body: "Sign up with an email address. The capital is credited as soon as you confirm it.",
  action: "Open an account",
} as const;

/** What the columns on the listings table mean. The Δ basis is stated
    plainly because the change is measured over a defined window (each listing's
    last ten recorded marks), not a calendar period — and a change column that
    doesn't say what it measures has no business existing. */
export const BOARD = {
  columnsNote: "Mark is the price now. Δ is the move across each listing's last ten recorded marks.",
} as const;

/** Section headings across the product. */
export const SECTIONS = {
  board: "Listings",
  market: "Market",
  listings: "Listings",
  mechanics: "Mechanics",
  clauses: "How it works",
  positions: "Positions",
  holdings: "Holdings",
  account: "Account",
  history: "Price history",
  ticket: "Order ticket",
  summary: "Summary",
  allocation: "Allocation",
  valuation: "Valuation",
  calls: "Your calls",
  newCall: "Open a call",
} as const;

// Repo calls: a prediction that a repository reaches a star target by a date.
// states the mechanic and the settlement rule, never sells it.
export const CALLS = {
  title: "Repo calls",
  intro:
    "A call is a prediction that a repository reaches a star target by a date. It settles even-money against the public star count: a correct call returns twice the stake, a wrong one forfeits it.",
  repo: "Repository",
  repoHint: "owner/repo",
  target: "Target stars",
  now: "Now",
  deadline: "Deadline",
  stake: "Stake",
  open: "Open call",
  opening: "Opening",
  resolvesIn: "Resolves in",
  resolved: "Resolved",
  reached: "Reached",
  needs: "To reach",
  payout: "Payout",
  empty: "No calls yet.",
  status: { open: "Open", won: "Won", lost: "Lost", void: "Void" },
  noticeLabel: "How calls settle",
  noticeBody:
    "Every call resolves automatically at its deadline against the repository's public star count, the same figure the price is built from. Settlement is even-money and simulated. A repository that is delisted before resolution voids the call, and the stake is refunded.",
  targetBelowCurrent: "Target must be above the current star count.",
  overStake: "Stake exceeds purchasing power.",
} as const;

/** Column headers. Short, absolute, never a sentence. */
export const COLUMNS = {
  listing: "Listing",
  mark: "Mark",
  change: "Δ",
  stars: "Stars",
  qty: "Qty",
  avg: "Avg",
  value: "Value",
  weight: "Weight",
  pnl: "P/L",
  action: "",
} as const;

// ── SYSTEM MESSAGES ───────────────────────────────────────────────────────
// the strings people read twenty times a session. present tense, no ellipsis,
// no "please wait", no apologies.

export const STATE = {
  session: "Loading",
  quotes: "Loading prices",
  history: "Loading price history",
  verifying: "Checking listing",
  portfolio: "Loading positions",

  noPositions: "No positions yet.",
  noListings: "No listings returned.",
  noHistory: "No price history for this listing yet.",
  noSuggestions: "No matching listings.",
} as const;

export const ERROR = {
  ledger: "Ledger unreachable. Retrying.",
  ledgerRefused: "Couldn't reach the ledger.",
  engine: "Data engine unavailable.",
  notListed: (ticker: string) =>
    `${ticker} isn't listed. The repository is private, renamed, or doesn't exist.`,
  suspended: "Trading suspended.",
  auth: "Authentication failed.",
  credentials: "Email or password not recognised.",
  unconfirmed: "Email not confirmed. Check your inbox, then sign in.",
  registered: "An account already exists for this email.",
  rateLimit: "Too many attempts. Try again shortly.",
  password: "Password must be at least six characters.",
  unexpected: "Request failed.",
} as const;

export const ORDER = {
  confirmBuy: "Confirm purchase",
  confirmSell: "Confirm sale",
  buy: "Buy",
  sell: "Sell",
  routing: "Sending",
  cancel: "Cancel",
  filled: (action: string, qty: number, ticker: string, price: string) =>
    `${action === "SELL" ? "Sold" : "Bought"} ${qty} ${ticker} at ${price}.`,
  rejected: (reason: string) => `Rejected. ${reason}`,
  insufficient: "Insufficient purchasing power.",
  noPosition: "No position to close.",
} as const;

export const AUTH = {
  signIn: "Sign in",
  signUp: "Open account",
  signOut: "Sign out",
  applyKicker: "New account",
  applyTitle: "Open an account",
  applyBody: "You start with $100,000 of simulated capital. There is nothing to deposit.",
  returnKicker: "Account",
  returnTitle: "Sign in",
  returnBody: "Your positions and balance are tied to your email.",
  divider: "or",
  google: "Continue with Google",
  connecting: "Connecting",
  submitting: "Submitting",
  confirmSent: "Check your email to confirm your address, then sign in.",
  toApply: "No account?",
  toReturn: "Already have an account?",
  email: "Email address",
  password: "Password",
  firstName: "First name",
  lastName: "Last name",
  // ── password recovery ──
  forgotLink: "Forgot your password?",
  forgotKicker: "Password reset",
  forgotTitle: "Reset your password",
  forgotBody: "Enter your email. If it matches an account, a reset link follows.",
  sendReset: "Send reset link",
  sending: "Sending",
  resetSent: "If that email matches an account, a reset link is on its way.",
  backToSignIn: "Back to sign in",
  resetKicker: "Password reset",
  resetTitle: "Set a new password",
  resetBody: "Choose a new password for your account.",
  verifyingLink: "Verifying link",
  linkInvalid: "This reset link is invalid or has expired. Request a new one.",
  newPassword: "New password",
  confirmPassword: "Confirm password",
  updatePassword: "Update password",
  updating: "Updating",
  passwordUpdated: "Password updated. You are signed in.",
  mismatch: "Passwords do not match.",
} as const;

export const ACCOUNT = {
  title: "Account",
  kicker: "Profile",
  body: "Your email is how you sign in, so it can't be changed here.",
  save: "Save changes",
  saving: "Saving",
  saved: "Saved.",
  emailLocked: "Used to sign in",
  details: "Details",
  name: "Name",
  joined: "Joined",
  email: "Email",
  editName: "Edit name",
} as const;

export const NAV = {
  board: "Market",
  positions: "Positions",
  calls: "Calls",
  account: "Account",
  search: "Listing or owner/repo",
  back: "All listings",
  theme: "Toggle theme",
  menu: "Menu",
} as const;

export const LABELS = {
  purchasingPower: "Purchasing power",
  listedValue: "Listed value",
  netWorth: "Net asset value",
  cash: "Cash",
  positionsValue: "Positions",
  unrealised: "Unrealised P/L",
  mark: "Mark",
  position: "Position",
  quantity: "Quantity",
  estimated: "Estimated cost",
  proceeds: "Estimated proceeds",
  total: "Total",
  session: "Session",
  open: "Open",
  live: "Live",
  high: "Period high",
  low: "Period low",
  range: "Range",
  observations: "Observations",
  shares: "shrs",
} as const;

export const FOOTER = {
  colophon:
    "Set in Bricolage Grotesque and Spline Sans Mono. Prices derived from the GitHub REST API. Simulated trading only.",
  rights: (year: number) => `© ${year} ${BRAND.name}`,
} as const;
