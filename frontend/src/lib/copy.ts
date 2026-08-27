// every word the user reads lives in this one file. that's on purpose — the
// second you spread copy across components, the tone drifts and you end up
// sounding like a serious exchange on one page and a peppy onboarding wizard
// on the next.
//
// the voice: deadpan. TRX talks like an old clearing house that has never once
// been told it's trading GitHub repos. the whole joke is the gap between how
// seriously it talks and the fact that the "asset" is a JS runtime — so the
// moment the copy winks at the joke, the joke's dead.
//
// house rules:
//   - state facts. don't cheer the user on, congratulate them, or reassure.
//   - no exclamation marks, no emoji, none of "just/simply/oops/let's".
//   - failures are notices, not apologies. "Ledger unreachable." not
//     "Something went wrong! Please try again."
//   - empty states are about the record, not the person. "No positions of
//     record." not "You don't have any positions yet!"
//   - sentence case in prose, caps only for labels. never Title Case.
//   - if a sentence can stop sooner, it stops sooner.

export const BRAND = {
  ticker: "TRX",
  name: "The Repo Exchange",
  full: "TRX · The Repo Exchange",
  est: "EST. MMXXV",
  tagline: "A market in open source.",
} as const;

export const HERO = {
  kicker: "Continuous session · Simulated settlement",
  headline: "A market in open source.",
  // The dek does three jobs in two sentences: says what it is, says where the
  // prices come from, and admits it isn't real — before anyone has to ask.
  dek: "Listings are priced from live GitHub activity. Positions are simulated, settlement is immediate, and nothing offered here is a security.",
  primary: "Open an account",
  secondary: "Read the mechanics",
} as const;

/** The board's own explanation of itself. Deadpan works because it's true. */
export const MECHANICS: ReadonlyArray<{ term: string; value: string }> = [
  { term: "Pricing basis", value: "GitHub stars, polled continuously. One star, one cent." },
  { term: "Settlement", value: "Immediate. T+0." },
  { term: "Opening capital", value: "$100,000.00, credited once, non-renewable." },
  { term: "Order types", value: "Market only. Slippage is checked at the ledger and rejected, not absorbed." },
  { term: "Hours", value: "Continuous. The exchange does not close." },
  { term: "Data source", value: "GitHub REST API, backfilled where history exists." },
  { term: "Custody", value: "None. There is nothing to hold." },
];

/** The three clauses. Set as a document, numbered as a document. */
export const CLAUSES: ReadonlyArray<{ n: string; title: string; body: string }> = [
  {
    n: "01",
    title: "Admission",
    body: "An account is opened on registration and credited with one hundred thousand dollars of simulated capital. No deposit is required, and none can be accepted.",
  },
  {
    n: "02",
    title: "Execution",
    body: "Orders are routed to the ledger and filled at the prevailing mark. An order that drifts beyond tolerance between submission and fill is rejected rather than slipped.",
  },
  {
    n: "03",
    title: "Position",
    body: "Holdings are marked continuously against live activity. Profit and loss remains unrealised until the position is closed, at which point it remains equally imaginary.",
  },
];

// The disclaimer is the best joke on the site and it is not written as a joke.
// Every clause in it is literally true, which is what makes it land.
export const NOTICE = {
  label: "Notice to participants",
  body: "TRX is a simulation. No securities are offered, sold, or held. Positions confer no ownership of, claim upon, or goodwill toward any repository, its maintainers, or its contributors. Cash balances are fictional and non-transferable. Prices are derived from public activity metrics and are not a valuation of anything.",
} as const;

export const CTA = {
  kicker: "Admission",
  headline: "Accounts open continuously.",
  body: "Registration takes an email address. Capital is credited on admission.",
  action: "Open an account",
} as const;

/** Section headings across the product. */
export const SECTIONS = {
  board: "The board",
  listings: "Listings",
  mechanics: "Mechanics",
  clauses: "Procedure",
  positions: "Positions of record",
  holdings: "Holdings",
  account: "Account",
  history: "Price history",
  ticket: "Order ticket",
  summary: "Summary",
  allocation: "Allocation",
  valuation: "Valuation",
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
  pnl: "P/L",
  action: "",
} as const;

// ── SYSTEM MESSAGES ───────────────────────────────────────────────────────
// The whole voice lives or dies here. These are the strings a user reads
// twenty times a session, and they are where every product eventually starts
// apologising.

export const STATE = {
  // Loading. Present tense, no ellipsis theatre, no "Please wait".
  session: "Establishing session",
  quotes: "Requesting quotes",
  history: "Retrieving price history",
  verifying: "Verifying listing",
  portfolio: "Reconciling positions",

  // Empty. Describes the record, not the person reading it.
  noPositions: "No positions of record.",
  noListings: "No listings returned.",
  noHistory: "No price history on file for this listing.",
  noSuggestions: "No matching listings.",
} as const;

export const ERROR = {
  ledger: "Ledger unreachable. Retrying.",
  ledgerRefused: "Connection refused by the ledger.",
  engine: "Data engine unavailable.",
  // "Not listed" rather than "not found" — the exchange's framing, not the
  // filesystem's. A repository that doesn't exist simply isn't admitted.
  notListed: (ticker: string) =>
    `${ticker} is not admitted for trading. The repository is private, renamed, or does not exist.`,
  suspended: "Trading suspended.",
  auth: "Authentication failed.",
  credentials: "Email or password not recognised.",
  unconfirmed: "Address not confirmed. Check your email before signing in.",
  registered: "An account already exists for this address.",
  rateLimit: "Too many attempts. Try again shortly.",
  password: "Password must be at least six characters.",
  unexpected: "Request failed.",
} as const;

export const ORDER = {
  confirmBuy: "Confirm purchase",
  confirmSell: "Confirm sale",
  buy: "Buy",
  sell: "Sell",
  routing: "Routing",
  cancel: "Cancel",
  // A fill is a statement of fact, in the order a broker would state it.
  filled: (action: string, qty: number, ticker: string, price: string) =>
    `Filled. ${action} ${qty} ${ticker} at ${price}.`,
  rejected: (reason: string) => `Rejected. ${reason}`,
  insufficient: "Insufficient purchasing power.",
  noPosition: "No position to close.",
} as const;

export const AUTH = {
  signIn: "Sign in",
  signUp: "Open account",
  signOut: "Sign out",
  applyKicker: "Account application",
  applyTitle: "Open an account",
  applyBody: "Capital is credited on admission. No deposit is required.",
  returnKicker: "Member access",
  returnTitle: "Sign in",
  returnBody: "Your positions and balance are held against this address.",
  divider: "or",
  google: "Continue with Google",
  connecting: "Connecting",
  submitting: "Submitting",
  confirmSent: "Application received. Confirm your address by email to complete admission.",
  toApply: "No account?",
  toReturn: "Already admitted?",
  email: "Email address",
  password: "Password",
  firstName: "First name",
  lastName: "Last name",
  // ── password recovery ──
  forgotLink: "Forgot your password?",
  forgotKicker: "Credential recovery",
  forgotTitle: "Reset your password",
  forgotBody: "Enter your address. If it is on file, a reset link follows.",
  sendReset: "Send reset link",
  sending: "Sending",
  resetSent: "If that address is on file, a reset link is on its way. Check your email.",
  backToSignIn: "Back to sign in",
  resetKicker: "Set new credential",
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
  title: "Account record",
  kicker: "Member file",
  body: "Your address is bound to your credentials and cannot be amended here.",
  save: "Amend record",
  saving: "Amending",
  saved: "Record amended.",
  emailLocked: "Bound to credentials",
} as const;

export const NAV = {
  board: "Board",
  positions: "Positions",
  account: "Account",
  search: "Listing or owner/repo",
  back: "Back to the board",
  theme: "Toggle theme",
  menu: "Menu",
} as const;

export const LABELS = {
  purchasingPower: "Purchasing power",
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
    "Set in Newsreader, Public Sans, and IBM Plex Mono. Prices derived from the GitHub REST API. No part of this exchange is real.",
  rights: (year: number) => `© ${year} ${BRAND.name}`,
} as const;
