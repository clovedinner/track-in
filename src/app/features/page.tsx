import type { Metadata } from "next";
import Link from "next/link";

import { PublicCTA, PublicSiteShell } from "@/app/public-site-shell";

export const metadata: Metadata = {
  title: "Ad tracking features | Trakio",
  description:
    "Track campaign clicks, attribute conversions, send postbacks, and inspect delivery failures in one focused ad tracking platform.",
  alternates: { canonical: "https://trakio.org/features" },
};

const workflow = [
  {
    title: "Capture the campaign visit",
    text: "Use a campaign tracking URL in your ads. Trakio records the visit, saves the configured traffic-source tokens, and creates a unique click ID.",
    detail: "Your visitor continues to the destination with cid attached.",
  },
  {
    title: "Attribute the conversion",
    text: "Your site keeps that click ID and returns it when a registration, purchase, first deposit, or another configured event happens.",
    detail: "Stable event IDs let Trakio recognize duplicate requests.",
  },
  {
    title: "Report back to the traffic source",
    text: "Trakio queues the outbound postback separately from the conversion request. A slow provider does not need to hold up conversion intake.",
    detail: "Transient delivery failures retry through the durable outbox.",
  },
  {
    title: "Make the next campaign decision",
    text: "Review campaign visits, conversions, and conversion rates. Filter by date and event to understand the results you are comparing.",
    detail: "Inspect recent events when a total needs a closer look.",
  },
];

export default function FeaturesPage() {
  return (
    <PublicSiteShell>
      <section className="public-container public-hero">
        <p className="public-kicker">Features</p>
        <h1>Know which traffic turns into results.</h1>
        <p className="public-lead public-narrow">
          Trakio brings the tracking loop into one place, from the first
          campaign visit to the conversion you report back.
        </p>
        <Link href="/docs" className="public-button public-button-blue">
          Read the setup guide
        </Link>
      </section>
      <section
        className="public-container public-feature-workflow"
        aria-label="The tracking workflow"
      >
        {workflow.map((item, index) => (
          <article key={item.title}>
            <span className="public-step-number" aria-hidden="true">
              0{index + 1}
            </span>
            <div>
              <h2>{item.title}</h2>
              <p>{item.text}</p>
              <p className="public-feature-detail">{item.detail}</p>
            </div>
          </article>
        ))}
      </section>
      <section className="public-blue-section">
        <div className="public-container public-section public-editorial">
          <div>
            <p className="public-kicker">Your setup, connected</p>
            <h2>Keep the workflow you already use.</h2>
          </div>
          <div className="public-principles">
            <article>
              <h3>Server-to-server conversions</h3>
              <p>
                Send authenticated events from your site backend. Include the
                original click ID, a stable event ID, and the event details you
                want to report.
              </p>
            </article>
            <article>
              <h3>Voluum-compatible postbacks</h3>
              <p>
                Connect an existing GTM workflow through the public postback
                endpoint using cid, et, and transaction identifiers.
              </p>
            </article>
            <article>
              <h3>Traffic-source configuration</h3>
              <p>
                Map the external click token and accepted campaign parameters.
                Configure a postback template for the destination your traffic
                source expects.
              </p>
            </article>
          </div>
        </div>
      </section>
      <section className="public-container public-section">
        <div className="public-editorial">
          <div>
            <p className="public-kicker">Useful visibility</p>
            <h2>Find the result. Follow the record.</h2>
          </div>
          <p className="public-lead">
            The dashboard gives you a campaign view and the underlying events,
            so you can check what happened when a number needs explaining.
          </p>
        </div>
        <dl className="public-feature-list">
          <div>
            <dt>Campaign reporting</dt>
            <dd>
              Compare visits, conversions, and conversion rates with date and
              event filters.
            </dd>
          </div>
          <div>
            <dt>Reusable offers</dt>
            <dd>
              Keep destination offer settings together and see results across
              their campaigns.
            </dd>
          </div>
          <div>
            <dt>Custom conversions</dt>
            <dd>
              Define the event values that count toward the conversions you want
              to follow.
            </dd>
          </div>
          <div>
            <dt>Delivery health</dt>
            <dd>
              Inspect queued, retrying, and failed outbound postbacks. Retry
              failed deliveries from the dashboard.
            </dd>
          </div>
        </dl>
      </section>
      <PublicCTA
        title="Keep your tracking focused."
        text="Choose a plan for the campaign workflow you actually use."
      />
    </PublicSiteShell>
  );
}
