// The facts only you can decide, in one place. Every legal page reads from
// here, so filling these in updates Terms, Privacy, and the Disclaimer at once.
//
// IMPORTANT: these are a starting template, not legal advice. Have a lawyer
// review the wording before you rely on it, especially the governing-law and
// liability clauses, and especially because TRX uses market/exchange framing.
export const LEGAL = {
  // Who operates TRX and is the party to the Terms. Defaults to you as an
  // individual (that means personal liability); change to your company's
  // registered name and number if you incorporate.
  operator: "Zaki Amin Ahmad",

  // REQUIRED, set before publishing. The law that governs the Terms and the
  // place where disputes are handled, e.g. "England & Wales", "the State of
  // Delaware, USA", or "Malaysia". Left as an explicit blank so it can never be
  // silently wrong: the pages render "[ set governing jurisdiction ]" until you
  // fill it, which is your cue.
  governingLaw: "Ontario, Canada",

  // A contact address you actually monitor. Uses the domain rather than a
  // personal inbox, so set up forwarding for it (or change it to one you read).
  contactEmail: "legal@therepo.exchange",

  // Shown on every legal page as the effective / last-updated date.
  lastUpdated: "10 September 2026",
} as const;
