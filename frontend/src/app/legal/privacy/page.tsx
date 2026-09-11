import type { Metadata } from "next";
import { SITE_NAME } from "@/lib/site";
import { LEGAL } from "@/lib/legal";
import { DocHeader, Clause, List, L } from "../parts";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: `What data ${SITE_NAME} collects, why, who processes it, and your rights over it.`,
  alternates: { canonical: "/legal/privacy" },
};

export default function Privacy() {
  return (
    <article>
      <DocHeader
        title="Privacy Policy"
        summary={`This policy explains what personal data ${SITE_NAME} collects, why, who processes it, and the rights you have. It applies to the operator, ${LEGAL.operator}, as the controller of that data.`}
        lastUpdated={LEGAL.lastUpdated}
      />

      <div>
        <Clause n="01" title="The short version">
        <p>
          TRX collects as little as it can. To use it you give us an email
          address and a password, and the service records the simulated activity
          you generate. There is no real money on TRX, so we never collect
          payment card, bank, or financial-account details. We do not sell your
          data, and we do not run third-party advertising trackers.
        </p>
      </Clause>

      <Clause n="02" title="What we collect">
        <p>We collect:</p>
        <List
          items={[
            "Account data: the email address you register with and an authentication credential (your password is salted and hashed by our authentication provider; we never see it in plain text).",
            "Activity data: the simulated orders, positions, balances, and \"calls\" you generate, stored against your account so your portfolio persists between sessions.",
            "Technical data: standard server and security logs such as IP address, browser and device type, and timestamps, generated automatically when you use the service.",
          ]}
        />
        <p>
          The repository data shown on TRX (stars, forks, issues, and the like)
          comes from public GitHub sources and is not your personal data.
        </p>
      </Clause>

      <Clause n="03" title="Why we use it">
        <p>We use the data above to:</p>
        <List
          items={[
            "create and secure your account and sign you in;",
            "operate the service, including keeping your simulated portfolio and history;",
            "keep the service safe, detect and prevent abuse, and debug problems;",
            "meet legal obligations that apply to us.",
          ]}
        />
        <p>
          Where the law requires a legal basis, we rely on the performance of our
          contract with you (to provide the service), our legitimate interests
          (to keep the service secure and working), and, where relevant, your
          consent and our legal obligations.
        </p>
      </Clause>

      <Clause n="04" title="Cookies and local storage">
        <p>
          We use cookies and browser storage that are necessary to run the
          service, chiefly to keep you signed in and to remember lightweight
          preferences such as your theme. These are essential to the service and
          are not used for advertising. If we ever add optional or analytics
          cookies, we will ask for consent where the law requires it and update
          this policy.
        </p>
      </Clause>

      <Clause n="05" title="Who processes your data">
        <p>
          We share data only with the service providers that help us run TRX,
          under contracts that require them to protect it and use it only on our
          instructions:
        </p>
        <List
          items={[
            "our authentication and database provider (Supabase), which stores your account and activity data;",
            "our hosting and delivery provider (Vercel), which serves the application and generates security logs.",
          ]}
        />
        <p>
          We may also disclose data where we are legally required to, or to
          protect the rights, safety, and security of the service, our users, or
          the public. We do not sell your personal data.
        </p>
      </Clause>

      <Clause n="06" title="International transfers">
        <p>
          Our providers may process data in countries other than yours. Where
          data is transferred across borders, we rely on our providers&apos;
          safeguards for such transfers, such as standard contractual clauses or
          an equivalent approved mechanism.
        </p>
      </Clause>

      <Clause n="07" title="How long we keep it">
        <p>
          We keep account and activity data for as long as your account is open,
          and for a reasonable period afterwards to meet legal, security, and
          record-keeping needs, after which we delete or anonymise it. Server
          logs are kept for a short period and then rotated out.
        </p>
      </Clause>

      <Clause n="08" title="Your rights">
        <p>
          Depending on where you live, you may have the right to access a copy of
          your data, to correct it, to delete it, to restrict or object to how we
          use it, and to data portability. You can exercise these rights, or ask
          us to delete your account, by contacting us at {" "}
          <a href={`mailto:${LEGAL.contactEmail}`} className="link">
            {LEGAL.contactEmail}
          </a>
          . You also have the right to complain to your local data-protection
          authority.
        </p>
      </Clause>

      <Clause n="09" title="Security">
        <p>
          We rely on established providers and reasonable technical and
          organisational measures to protect your data, including encryption in
          transit and hashed credentials. No method of transmission or storage is
          completely secure, so we cannot guarantee absolute security, but we work
          to protect your data and to respond appropriately to any incident.
        </p>
      </Clause>

      <Clause n="10" title="Children">
        <p>
          TRX is not directed to children and is intended for users who meet the
          age requirement in the {" "}
          <L href="/legal/terms">Terms of Service</L>. We do not knowingly
          collect data from children. If you believe a child has given us
          personal data, contact us and we will delete it.
        </p>
      </Clause>

      <Clause n="11" title="Changes to this policy">
        <p>
          We may update this policy from time to time. We will change the
          effective date at the top of this page and, where changes are material,
          make reasonable efforts to flag them.
        </p>
      </Clause>

      <Clause n="12" title="Contact">
        <p>
          For any privacy question, or to exercise your rights, contact the
          operator at {" "}
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
