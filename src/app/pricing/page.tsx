import type { Metadata } from "next";

import { publicAppUrl } from "@/app/public-site-content";
import { PublicSiteShell } from "@/app/public-site-shell";

export const metadata: Metadata = {
  title: "Pricing | Trakio",
  description:
    "Trakio plans start at $300 per month. Compare Starter, Operator, and Expanded, with clear payment details and planned plan differences.",
  alternates: { canonical: "https://trakio.org/pricing" },
};

const plans = [
  {
    name: "Starter",
    price: "300",
    description: "Core tracking. Planned allowance: 10 active campaigns.",
    campaigns: "10",
    extra: "Core tracking workflow",
  },
  {
    name: "Operator",
    price: "500",
    description:
      "Core tracking. Planned: 50 active campaigns and a customer API.",
    campaigns: "50",
    extra: "Customer API access",
  },
  {
    name: "Expanded",
    price: "1,000",
    description:
      "Core tracking. Planned: 100 active campaigns, a customer API, and dedicated support.",
    campaigns: "100",
    extra: "Customer API access and dedicated customer service",
  },
];

export default function PricingPage() {
  return (
    <PublicSiteShell>
      <section className="public-container public-hero">
        <p className="public-kicker">Pricing</p>
        <h1>Pay for the tracking you came for.</h1>
        <p className="public-lead public-narrow">
          Choose a paid plan for your campaign setup. Every plan currently
          includes the core click-to-conversion workflow.
        </p>
      </section>
      <section
        className="public-container public-plans"
        aria-label="Current subscription prices"
      >
        {plans.map((plan) => (
          <article key={plan.name} className="public-plan">
            <div>
              <h2>{plan.name}</h2>
              <p>{plan.description}</p>
            </div>
            <p className="public-price">
              ${plan.price}
              <span>USD / month</span>
            </p>
            <a
              href={`${publicAppUrl}/auth/sign-up`}
              className="public-button public-button-blue"
            >
              Choose {plan.name}
            </a>
          </article>
        ))}
        <p className="public-price-note">
          Prices are in USD before applicable payment fees. Create and verify
          your account, then select your plan in the dashboard. Trakio does not
          offer a free plan.
        </p>
      </section>
      <section className="public-container public-section public-editorial">
        <div>
          <p className="public-kicker">Available today</p>
          <h2>The core tracking loop, in every plan.</h2>
        </div>
        <ul className="public-included">
          <li>Campaign click tracking and unique click IDs</li>
          <li>Conversion attribution and duplicate event handling</li>
          <li>Server-to-server conversion intake and compatible postbacks</li>
          <li>Campaign, offer, and traffic-source configuration</li>
          <li>Visits, conversions, conversion rates, and date filters</li>
          <li>Outbound postback delivery health and retries</li>
        </ul>
      </section>
      <section className="public-roadmap">
        <div className="public-container public-section">
          <div className="public-editorial">
            <div>
              <p className="public-kicker">Planned plan differences</p>
              <h2>Where the plans are heading.</h2>
            </div>
            <p>
              These allowances and services are planned. The app does not
              enforce these campaign limits yet. Customer API access and
              dedicated customer service are not included in the current
              release.
            </p>
          </div>
          <div
            className="public-comparison"
            role="region"
            aria-label="Planned plan comparison"
            tabIndex={0}
          >
            <table>
              <caption>
                Planned allowances and services, not currently available
              </caption>
              <thead>
                <tr>
                  <th scope="col">Plan</th>
                  <th scope="col">Active campaigns</th>
                  <th scope="col">Planned scope</th>
                </tr>
              </thead>
              <tbody>
                {plans.map((plan) => (
                  <tr key={plan.name}>
                    <th scope="row">{plan.name}</th>
                    <td>{plan.campaigns}</td>
                    <td>{plan.extra}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="public-price-note">
            The planned customer API is for connecting your own tools. The
            existing conversion intake and outbound postbacks remain part of
            core tracking.
          </p>
        </div>
      </section>
      <section className="public-container public-section public-editorial">
        <div>
          <p className="public-kicker">Payment details</p>
          <h2>
            USDT checkout.
            <br />
            Automatic activation.
          </h2>
        </div>
        <div className="public-principles">
          <article>
            <h3>Pay through NOWPayments.</h3>
            <p>
              Choose a plan in the dashboard and continue to NOWPayments to pay
              with USDT on the TRON network (TRC20).
            </p>
          </article>
          <article>
            <h3>Check the final amount.</h3>
            <p>
              NOWPayments converts the USD price into USDT and adds applicable
              checkout fees for you to pay. Your wallet or exchange may also
              charge a separate transfer fee.
            </p>
          </article>
          <article>
            <h3>Wait for payment confirmation.</h3>
            <p>
              Trakio activates your subscription after the payment provider
              confirms the transfer. The payment return page checks the status
              and gives you a button back to the dashboard.
            </p>
          </article>
        </div>
      </section>
    </PublicSiteShell>
  );
}
