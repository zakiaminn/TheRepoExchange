import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";
import { LEGAL } from "@/lib/legal";
import { DocHeader, Clause, L } from "../parts";

export const metadata: Metadata = {
  title: "Disclaimer",
  description: `${SITE_NAME} is a simulation. Nothing on it is a security or financial advice, and it is not affiliated with GitHub.`,
  alternates: { canonical: "/legal/disclaimer" },
};

export default function Disclaimer() {
  return (
    <article>
      <DocHeader
        title="Disclaimer"
        summary={`The essentials, in plain terms. This disclaimer forms part of the Terms of Service and should be read with them.`}
        lastUpdated={LEGAL.lastUpdated}
      />

      <div>
        <Clause title="It is a simulation">
        <p>
          {SITE_NAME} is a simulated market and a game. No securities,
          commodities, derivatives, tokens, or other financial instruments are
          offered, sold, held, or traded on it. Listings are not securities.
          Balances are fictional, have no cash value, and cannot be deposited,
          withdrawn, or redeemed. No real money is ever involved.
        </p>
      </Clause>

      <Clause title="It is not advice">
        <p>
          Nothing on TRX is financial, investment, trading, legal, accounting, or
          tax advice, a recommendation, or a solicitation to do anything. Do not
          make real-world decisions based on it. If you want advice, speak to a
          qualified professional.
        </p>
      </Clause>

      <Clause title="Prices are derived, not valuations">
        <p>
          Prices are computed from public GitHub activity metrics using our own
          formula. They are a game mechanic. They are not a valuation, appraisal,
          rating, or endorsement of any repository, project, company, or person,
          and they do not reflect any real-world worth.
        </p>
      </Clause>

      <Clause title="Not affiliated with GitHub or the projects">
        <p>
          TRX is not affiliated with, endorsed by, or sponsored by GitHub, Inc.,
          Microsoft, or any repository, project, or maintainer that appears here.
          Repository names, logos, and marks belong to their respective owners
          and are used only to identify the public repositories a listing refers
          to. A listing implies no relationship with or endorsement by the people
          behind that repository.
        </p>
      </Clause>

      <Clause title="No warranty and use at your own risk">
        <p>
          The service and its data are provided &quot;as is&quot; and &quot;as
          available&quot;, with no warranty of any kind. Data may be inaccurate,
          delayed, incomplete, or unavailable. You use TRX at your own risk. To
          the extent permitted by law, the operator is not liable for any loss
          arising from your use of it, as set out more fully in the {" "}
          <L href="/legal/terms">Terms of Service</L>.
        </p>
      </Clause>

      <Clause title="Contact">
        <p>
          Questions can be sent to {" "}
          <a href={`mailto:${LEGAL.contactEmail}`} className="link">
            {LEGAL.contactEmail}
          </a>
          .
        </p>
      </Clause>
      </div>
    </article>
  );
}
