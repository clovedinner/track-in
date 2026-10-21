import type { Metadata } from "next";
import Link from "next/link";

import { PublicCTA, PublicSiteShell } from "@/app/public-site-shell";

export const metadata: Metadata = {
  title: "About us | Trakio",
  description:
    "Trakio is an ad tracking platform built around a focused idea: you need a simple tracking tool that works.",
  alternates: { canonical: "https://trakio.org/about" },
};

export default function AboutPage() {
  return (
    <PublicSiteShell>
      <section className="public-container public-hero public-about-hero">
        <div>
          <p className="public-kicker">About Trakio</p>
          <h1>You need a simple tracking tool that works.</h1>
        </div>
        <div className="public-hero-aside">
          <p className="public-lead">That is the idea behind Trakio.</p>
          <p>
            You buy traffic to get results. Your tracker should help you see
            those results, understand where they came from, and report them back
            to your traffic source.
          </p>
          <p>We keep the product focused on that job.</p>
        </div>
      </section>
      <section className="public-blue-section">
        <div className="public-container public-editorial">
          <p className="public-kicker">Our point of view</p>
          <div>
            <h2>
              A longer feature list does not make your next campaign better.
            </h2>
            <p>
              Many tracking platforms serve a wide range of businesses. Their
              menus, settings, and subscription plans reflect that. If you run a
              straightforward click-to-conversion workflow, you may end up
              paying for a lot you never use.
            </p>
            <p>
              Trakio takes a narrower approach. We build around campaign
              tracking, conversion attribution, outbound postbacks, and
              reporting you can use to make a decision. Every feature has to
              earn its place in that workflow.
            </p>
          </div>
        </div>
      </section>
      <section className="public-container public-section public-editorial">
        <div>
          <p className="public-kicker">What we build for</p>
          <h2>Your daily campaign decisions.</h2>
        </div>
        <div className="public-principles">
          <article>
            <h3>Follow the actual click.</h3>
            <p>
              We connect a conversion to its recorded click ID. You can trace
              the result back to the campaign that brought the visit.
            </p>
          </article>
          <article>
            <h3>Make the numbers useful.</h3>
            <p>
              Visits and conversions belong together. Campaign, offer, and
              traffic-source views help you understand which parts of your setup
              produce results.
            </p>
          </article>
          <article>
            <h3>Show the work that needs attention.</h3>
            <p>
              A failed postback should have a reason and a path to recovery.
              Delivery health helps you inspect failures and retry them.
            </p>
          </article>
          <article>
            <h3>Keep the scope deliberate.</h3>
            <p>
              Trakio focuses on tracking. We leave out funnel builders, traffic
              rotators, and unrelated tools so the product stays centered on the
              work you came to do.
            </p>
          </article>
        </div>
      </section>
      <section className="public-container public-section public-about-fit">
        <h2>For advertisers who know their workflow.</h2>
        <div>
          <p className="public-lead">
            You have a traffic source, a destination, and conversion events you
            care about. You want to connect them and get on with running
            campaigns.
          </p>
          <p>
            Your site needs to preserve the click ID and report conversions.
            Trakio supports authenticated server-to-server events and a
            Voluum-compatible postback for existing GTM workflows.
          </p>
          <Link href="/features" className="public-text-link">
            See what Trakio includes
          </Link>
        </div>
      </section>
      <PublicCTA />
    </PublicSiteShell>
  );
}
