import type { Metadata } from "next";
import { SITE_NAME, SITE_URL } from "@/lib/site";
import { LEGAL } from "@/lib/legal";
import { DocHeader, Clause, List, L } from "../parts";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: `The terms governing your use of ${SITE_NAME}, a simulated market in open-source repositories.`,
  alternates: { canonical: "/legal/terms" },
};

const host = SITE_URL.replace(/^https?:\/\//, "");

export default function Terms() {
  return (
    <article>
      <DocHeader
        title="Terms of Service"
        summary={`These terms are a binding agreement between you and ${LEGAL.operator} ("we", "us", the operator of ${SITE_NAME}). By creating an account or using the service you agree to them. If you do not agree, do not use the service.`}
        lastUpdated={LEGAL.lastUpdated}
      />

      <div>
        <Clause title="What TRX is">
        <p>
          {SITE_NAME} (&quot;TRX&quot;, the &quot;service&quot;) is a simulation. It lets you place
          simulated buy and sell orders on listings that represent public GitHub
          repositories, priced from public GitHub activity. It is a work of
          software and a game of skill, not a financial venue.
        </p>
        <p>
          No securities, commodities, derivatives, tokens, or other financial
          instruments are offered, sold, held, or traded on TRX. Listings are not
          securities. Positions confer no ownership of, claim upon, or goodwill
          toward any repository, its maintainers, or its contributors. Balances
          are fictional and non-transferable, have no cash value, and cannot be
          deposited, withdrawn, redeemed, or exchanged for anything of value.
        </p>
      </Clause>

      <Clause title="Not financial advice">
        <p>
          Nothing on TRX is financial, investment, trading, legal, accounting, or
          tax advice, a recommendation, an offer, or a solicitation to buy or
          sell anything. Prices shown are derived from public activity metrics
          and are not a valuation, appraisal, rating, or endorsement of any
          repository or person. You are solely responsible for how you interpret
          and act on anything you see here.
        </p>
      </Clause>

      <Clause title="Eligibility">
        <p>
          You must be at least 18 years old, or the age of majority where you
          live if that is higher, and legally able to enter into these terms. By
          using the service you represent that you meet these requirements and
          that your use does not break any law that applies to you.
        </p>
      </Clause>

      <Clause title="Your account">
        <p>
          You need an account to use most of the service. You agree to provide
          accurate registration details and to keep your login credentials
          confidential. You are responsible for all activity under your account.
          Tell us promptly at {" "}
          <a href={`mailto:${LEGAL.contactEmail}`} className="link">
            {LEGAL.contactEmail}
          </a>{" "}
          if you believe your account has been accessed without your permission.
        </p>
        <p>
          One account per person. We may refuse, suspend, or close an account at
          our discretion, including where we reasonably believe these terms have
          been broken.
        </p>
      </Clause>

      <Clause title="Acceptable use">
        <p>You agree not to:</p>
        <List
          items={[
            "use the service for any unlawful purpose, or in breach of any applicable law or third-party right;",
            "access the service by any automated means, or scrape, harvest, or bulk-download data from it, except as any published API or robots policy expressly allows;",
            "probe, scan, or test the vulnerability of the service, or breach or circumvent any security or authentication measure;",
            "interfere with, overload, or disrupt the service or the servers and networks behind it;",
            "attempt to manipulate prices, settlement, or the leaderboard, or to gain simulated balances by deceit, exploitation of bugs, or automation;",
            "reverse engineer, decompile, or copy the service except to the limited extent the law does not allow this to be excluded;",
            "impersonate any person or misrepresent your affiliation with any person or organisation.",
          ]}
        />
      </Clause>

      <Clause title="The service can change">
        <p>
          TRX is offered as-is and evolves. We may add, change, suspend, or
          remove listings, prices, features, or the whole service at any time,
          with or without notice. Simulated balances, positions, history, and
          &quot;calls&quot; may be reset, recalculated, corrected, or removed at any time.
          Because nothing here has cash value, you are not entitled to
          compensation for any such change.
        </p>
      </Clause>

      <Clause title="Intellectual property">
        <p>
          The service, including its software, design, text, and the &quot;Bureau&quot;
          visual system, and the TRX name and mark, belong to us or our licensors
          and are protected by law. We grant you a personal, revocable,
          non-exclusive, non-transferable licence to use the service for its
          intended, non-commercial purpose, subject to these terms.
        </p>
        <p>
          Repository names, logos, and content shown on TRX belong to their
          respective owners and are used to identify the public repositories a
          listing refers to. Their appearance here does not imply any
          endorsement, affiliation, or partnership.
        </p>
      </Clause>

      <Clause title="Third-party data and services">
        <p>
          Listings and prices are built from data obtained from third parties,
          including the GitHub REST API, and the service runs on third-party
          infrastructure and tools. TRX is not affiliated with, endorsed by, or
          sponsored by GitHub, Inc., Microsoft, or any repository or maintainer.
        </p>
        <p>
          We do not control third-party data and do not warrant that it is
          accurate, complete, current, or available. Your use of any linked
          third-party site or service is governed by that third party&apos;s own
          terms, not ours.
        </p>
      </Clause>

      <Clause title="Disclaimer of warranties">
        <p>
          To the fullest extent permitted by law, the service is provided
          &quot;as is&quot; and &quot;as available&quot;, without warranties of
          any kind, whether express, implied, or statutory, including any implied
          warranties of merchantability, fitness for a particular purpose,
          accuracy, and non-infringement.
        </p>
        <p>
          We do not warrant that the service will be uninterrupted, timely,
          secure, or error-free, that prices or data will be accurate, or that
          any defect will be corrected. Some jurisdictions do not allow the
          exclusion of certain warranties, so some of the above may not apply to
          you.
        </p>
      </Clause>

      <Clause title="Limitation of liability">
        <p>
          To the fullest extent permitted by law, we and our operators,
          contributors, and suppliers will not be liable for any indirect,
          incidental, special, consequential, exemplary, or punitive damages, or
          for any loss of profits, revenue, data, goodwill, or opportunity,
          arising out of or relating to your use of, or inability to use, the
          service, whether based in contract, tort, negligence, strict liability,
          or otherwise, even if we have been advised of the possibility of such
          damages.
        </p>
        <p>
          Because the service is free and simulated and involves no real money,
          our total aggregate liability to you for all claims relating to the
          service is limited to the greater of the amount you paid us to use the
          service (which is zero) or fifty US dollars (USD 50).
        </p>
        <p>
          Nothing in these terms excludes or limits any liability that cannot be
          excluded or limited by law, such as liability for death or personal
          injury caused by negligence, or for fraud.
        </p>
      </Clause>

      <Clause title="Indemnity">
        <p>
          You agree to indemnify and hold harmless the operator and its
          contributors and suppliers from any claim, demand, loss, or expense
          (including reasonable legal fees) arising out of your use of the
          service, your breach of these terms, or your violation of any law or
          third-party right.
        </p>
      </Clause>

      <Clause title="Suspension and termination">
        <p>
          You may stop using the service and close your account at any time. We
          may suspend or terminate your access at any time, with or without
          notice, including where we reasonably believe you have broken these
          terms or where continuing to offer the service is not viable. Any
          clauses that by their nature should survive termination (including
          those on what TRX is, financial advice, intellectual property,
          disclaimers, limitation of liability, and governing law) will survive.
        </p>
      </Clause>

      <Clause title="Changes to these terms">
        <p>
          We may update these terms from time to time. When we do, we will change
          the effective date at the top of this page, and where changes are
          material we will make reasonable efforts to flag them. Your continued
          use of the service after a change takes effect means you accept the
          updated terms.
        </p>
      </Clause>

      <Clause title="Governing law and disputes">
        <p>
          These terms and any dispute arising out of them or the service are
          governed by the laws of {LEGAL.governingLaw}, without regard to its
          conflict-of-laws rules, and you and we submit to the exclusive
          jurisdiction of the courts of {LEGAL.governingLaw} to resolve them.
        </p>
      </Clause>

      <Clause title="General">
        <p>
          These terms, together with the {" "}
          <L href="/legal/privacy">Privacy Policy</L> and the {" "}
          <L href="/legal/disclaimer">Disclaimer</L>, are the entire agreement
          between you and us about the service. If any provision is found
          unenforceable, the rest stays in force. Our not enforcing a provision
          is not a waiver of it. You may not transfer your rights under these
          terms; we may transfer ours to a successor of the service.
        </p>
      </Clause>

      <Clause title="Contact">
        <p>
          Questions about these terms can be sent to {" "}
          <a href={`mailto:${LEGAL.contactEmail}`} className="link">
            {LEGAL.contactEmail}
          </a>
          , or reach us through {host}.
        </p>
      </Clause>
      </div>
    </article>
  );
}
