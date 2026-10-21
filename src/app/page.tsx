import type { Metadata } from "next";
import Link from "next/link";

import { PublicCTA, PublicSiteShell } from "@/app/public-site-shell";

export const metadata: Metadata = {
  title: "Trakio | Simple ad tracking that works",
  description:
    "Connect paid traffic to real conversions. Trakio keeps campaign tracking, attribution, postbacks, and reporting focused on the work you actually do.",
  alternates: { canonical: "https://trakio.org" },
  verification: { google: "obVQKKtMBP4VD1iMNQDyzwFZOrIVivavfi_RkATWzsU" }
};

export default function Home() {
  return (
    <PublicSiteShell>
      <section className="public-container public-hero public-home-hero">
        <div>
          <p className="public-kicker">Ad tracking, with a clear purpose</p>
          <h1>
            Simple tracking.
            <br />
            <span className="public-blue-text">Useful answers.</span>
          </h1>
          <p className="public-lead">
            See which ads bring conversions. Trakio connects your campaign
            clicks to the results on your site, then reports those results back
            to your traffic source.
          </p>
          <div className="public-actions">
            <Link href="/pricing" className="public-button public-button-blue">
              Compare plans
            </Link>
            <Link href="/features" className="public-text-link">
              See the tracking workflow
            </Link>
          </div>
        </div>
        <aside
          className="public-flow"
          aria-label="How Trakio connects a click to a conversion"
        >
          <p className="public-flow-title">Follow the click</p>
          <ol>
            <li>
              <span>Ad campaign</span>
              <small>Your tracking URL captures the visit.</small>
            </li>
            <li>
              <span>Click ID</span>
              <small>Trakio passes cid to your site.</small>
            </li>
            <li>
              <span>Conversion event</span>
              <small>Your site returns the original cid.</small>
            </li>
            <li>
              <span>Attributed result</span>
              <small>Review the conversion and outbound postback.</small>
            </li>
          </ol>
          <Link href="/docs">Read the integration guide</Link>
        </aside>
      </section>
      <section className="public-blue-section">
        <div className="public-container public-editorial">
          <p className="public-kicker">Why Trakio</p>
          <div>
            <h2>You need a simple tracking tool that works.</h2>
            <p>
              Your tracker should help you decide where to spend your next
              advertising dollar. Trakio focuses on the click-to-conversion
              workflow, with reporting you can inspect and postbacks you can
              follow.
            </p>
            <p>
              You should not have to work around a collection of tools you never
              asked for just to see whether a campaign converts.
            </p>
            <Link href="/about" className="public-text-link">
              Read our approach
            </Link>
          </div>
        </div>
      </section>
      <section className="public-container public-section public-editorial">
        <div>
          <p className="public-kicker">Built around the campaign</p>
          <h2>The work you need your tracker to do.</h2>
          <Link href="/features" className="public-text-link">
            View all features
          </Link>
        </div>
        <div className="public-principles">
          <article>
            <h3>Connect the visit to the result.</h3>
            <p>
              Record campaign visits and match registrations, purchases,
              deposits, or other configured events to their original click IDs.
            </p>
          </article>
          <article>
            <h3>Give your traffic source the signal.</h3>
            <p>
              Send outbound conversion postbacks through a durable delivery
              queue. Inspect failures and retry them from the dashboard.
            </p>
          </article>
          <article>
            <h3>Keep reporting close to the facts.</h3>
            <p>
              Review visits, conversions, and conversion rates by campaign. Use
              date and event filters, then inspect individual records when you
              need detail.
            </p>
          </article>
        </div>
      </section>
      <section className="public-container public-section public-start-section">
        <div>
          <p className="public-kicker">Before your first campaign</p>
          <h2>
            Check the setup.
            <br />
            Choose your plan.
          </h2>
        </div>
        <div>
          <p>
            Start with the documentation to see how your site will keep the
            click ID and send conversions. Then choose a paid plan in your
            account.
          </p>
          <div className="public-actions">
            <Link href="/docs" className="public-button public-button-outline">
              Read documentation
            </Link>
            <Link href="/pricing" className="public-text-link">
              Plans from $300/month
            </Link>
          </div>
        </div>
      </section>
      <PublicCTA />
    </PublicSiteShell>
  );
}
