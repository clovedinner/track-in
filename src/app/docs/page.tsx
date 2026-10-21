import type { Metadata } from "next";
import Link from "next/link";

import { publicAppUrl } from "@/app/public-site-content";
import { PublicSiteShell } from "@/app/public-site-shell";

export const metadata: Metadata = {
  title: "Documentation | Trakio",
  description:
    "Set up a Trakio campaign, preserve the click ID, send conversion events, and verify outbound postbacks with this practical integration guide.",
  alternates: { canonical: "https://trakio.org/docs" },
};

const topics = [
  ["before-you-start", "Before you start"],
  ["campaign", "Create a campaign"],
  ["click-id", "Preserve the click ID"],
  ["conversions", "Send conversions"],
  ["postback", "GTM and postbacks"],
  ["verify", "Verify the full loop"],
  ["troubleshooting", "Troubleshooting"],
  ["billing", "Account and billing"],
  ["customer-api", "Customer API"],
] as const;

export default function DocsPage() {
  return (
    <PublicSiteShell>
      <section className="public-container public-docs-hero">
        <p className="public-kicker">Documentation</p>
        <h1>Your first tracked conversion.</h1>
        <p className="public-lead">
          A practical guide to connecting your traffic source, your site, and
          the events you want to measure.
        </p>
      </section>
      <div className="public-container public-docs-layout">
        <aside className="public-docs-nav">
          <nav aria-label="Documentation topics">
            <p>On this page</p>
            {topics.map(([id, title]) => (
              <a href={`#${id}`} key={id}>
                {title}
              </a>
            ))}
          </nav>
        </aside>
        <div className="public-docs-body">
          <section id="before-you-start">
            <p className="public-kicker">Start here</p>
            <h2>Before you start</h2>
            <p>
              You need a verified Trakio account with an active subscription, a
              traffic source, and a destination website where you can preserve a
              click ID and report conversions.
            </p>
            <p>
              Trakio records the ad click and sends the visitor to your site
              with <code>cid</code> in the URL. Your site must keep that value
              and send it back when a conversion happens. Trakio uses it to
              attribute the event to the original campaign visit.
            </p>
            <a
              href={`${publicAppUrl}/auth/sign-in`}
              className="public-text-link"
            >
              Sign in to your dashboard
            </a>
          </section>
          <section id="campaign">
            <h2>Create a campaign</h2>
            <ol>
              <li>
                Add your traffic source and configure the source tokens and
                outbound postback settings you need.
              </li>
              <li>
                Create an offer for your destination site, then create a
                campaign using that offer and traffic source.
              </li>
              <li>
                Open the campaign setup and copy the generated tracking URL. Use
                the exact URL and macros shown there in your ad platform.
              </li>
              <li>Run the setup test before sending paid traffic.</li>
            </ol>
            <p>
              Use the tracking hostname shown in your campaign setup. The public
              site and dashboard addresses are not replacements for that
              generated campaign link.
            </p>
          </section>
          <section id="click-id">
            <h2>Preserve the click ID</h2>
            <p>
              When the visitor arrives, read <code>cid</code> from the
              destination URL. Keep it with the registration or order on your
              site so it survives until the conversion event.
            </p>
            <pre>
              <code>{`https://your-site.example/offer?cid=CLICK_ID_FROM_TRAKIO`}</code>
            </pre>
            <p>
              If your site redirects again, carries the visitor through a signup
              flow, or completes the purchase later, make sure the same click ID
              remains available. Never replace it with an ad-platform click
              token or an order ID.
            </p>
          </section>
          <section id="conversions">
            <h2>Send conversions from your server</h2>
            <p>
              Use authenticated server-to-server conversion intake when you
              control the site backend. Your Trakio operator must provision the
              conversion webhook secret. Keep it on your server, never in
              browser JavaScript or GTM.
            </p>
            <pre>
              <code>{`POST https://trakio.org/api/conversions
Authorization: Bearer YOUR_CONVERSION_WEBHOOK_SECRET
Content-Type: application/json

{
  "cid": "CLICK_ID_FROM_TRAKIO",
  "event_id": "order-1042-purchase",
  "event_type": "purchase",
  "occurred_at": "2026-10-21T10:30:00Z",
  "value_minor": 1299,
  "currency": "USD"
}`}</code>
            </pre>
            <p>
              This example uses placeholders. Replace the click ID, secret,
              event ID, timestamp, and values with the real event details. Send
              an ISO 8601 timestamp with an explicit timezone, preferably UTC.
            </p>
            <dl className="public-docs-fields">
              <div>
                <dt>cid</dt>
                <dd>The original click ID passed to your site.</dd>
              </div>
              <div>
                <dt>event_id</dt>
                <dd>
                  A stable, unique identifier for this event. Reuse it when
                  retrying the same conversion. Use a different value for
                  another event.
                </dd>
              </div>
              <div>
                <dt>event_type</dt>
                <dd>
                  The event name you configured, such as purchase, reg, or ftd.
                </dd>
              </div>
              <div>
                <dt>value_minor / currency</dt>
                <dd>
                  An integer amount in the currency’s minor units, plus its
                  currency code. Here 1299 USD minor units means $12.99.
                </dd>
              </div>
            </dl>
            <p>
              An accepted event returns <code>status: accepted</code> with a
              conversion ID. A recognized retry returns{" "}
              <code>status: duplicate</code>. Check the response when your
              backend sends an event.
            </p>
          </section>
          <section id="postback">
            <h2>Use an existing GTM postback workflow</h2>
            <p>
              For a Voluum-compatible browser or GTM integration, the public
              postback endpoint accepts the recorded click ID as{" "}
              <code>cid</code> and the event type as <code>et</code>. Include a
              unique <code>txid</code> to distinguish transactions.
            </p>
            <pre>
              <code>{`https://trakio.org/postback?cid=CLICK_ID_FROM_TRAKIO&et=reg&txid=registration-1042`}</code>
            </pre>
            <p>
              Use the integration snippet in your campaign setup and replace the
              placeholders with the values from your site. URL-encode parameter
              values. This endpoint is public; it does not use the server-side
              bearer secret. Unknown click IDs are rejected.
            </p>
            <p>
              Keep transaction identifiers stable for retries and unique for
              later transactions. Configure your conversion definitions to match
              the event values your site sends.
            </p>
          </section>
          <section id="verify">
            <h2>Verify the full loop</h2>
            <ol>
              <li>
                Open the campaign tracking link and confirm that your site
                receives <code>cid</code>.
              </li>
              <li>
                Complete a controlled conversion on your site using that click
                ID.
              </li>
              <li>
                Check the campaign’s recent conversions for the expected event.
              </li>
              <li>Check delivery health for the outbound postback result.</li>
              <li>
                Retry the same event with the same event identifier and confirm
                it does not increase the conversion count.
              </li>
            </ol>
            <p>
              Check both attribution in Trakio and receipt at the traffic
              source. A recorded conversion and a delivered postback are
              separate outcomes.
            </p>
          </section>
          <section id="troubleshooting">
            <h2>When a result is missing</h2>
            <div className="public-principles">
              <article>
                <h3>The click ID is missing.</h3>
                <p>
                  Check each redirect and signup step on your site. Confirm that
                  your event uses the exact <code>cid</code> received from the
                  tracking link.
                </p>
              </article>
              <article>
                <h3>The event was rejected.</h3>
                <p>
                  Inspect the response. Check the secret for server requests,
                  the required event fields, and whether the click ID exists. Do
                  not send secrets in support screenshots.
                </p>
              </article>
              <article>
                <h3>The event exists, but the total looks wrong.</h3>
                <p>
                  Check the selected campaign, date range, reporting timezone,
                  and event filter. Compare those filters with the timestamp and
                  event on the individual record.
                </p>
              </article>
              <article>
                <h3>The ad platform did not receive the event.</h3>
                <p>
                  Open delivery health. Check whether a postback was queued, its
                  failure reason, and the traffic source’s external click token.
                  Retry after correcting the configuration.
                </p>
              </article>
            </div>
          </section>
          <section id="billing">
            <h2>Account and billing</h2>
            <p>
              After signup, confirm your email before signing in. Choose a paid
              plan in the dashboard and continue to NOWPayments for USDT on
              TRC20.
            </p>
            <p>
              Pay the amount shown by NOWPayments on the specified network. Its
              checkout includes applicable provider fees; your wallet or
              exchange may charge a separate transfer fee. Trakio activates the
              subscription after the provider confirms payment.
            </p>
            <p>
              The payment return page checks your invoice status. If it still
              shows pending, allow the provider to finish confirming the
              transfer before trying another payment.
            </p>
            <Link href="/pricing" className="public-text-link">
              Review plans and payment details
            </Link>
          </section>
          <section id="customer-api">
            <h2>Connect your tools with the Customer API</h2>
            <p>
              Operator and Expanded accounts can create API keys from Dashboard → Profile. Choose read-only access for reporting agents or read and write access when a tool must change workspace settings. You can revoke a key at any time. Trakio shows the key only once, so store it in your server’s secret manager.
            </p>
            <pre><code>{`Base URL: https://app.trakio.org/api/v1
Authorization: Bearer YOUR_TRAKIO_API_KEY`}</code></pre>
            <p>Do not put API keys in browser code, public repositories, prompts shared outside your account, or client-side tracking tags. Send requests over HTTPS and keep one key per integration so you can revoke access independently.</p>
            <h3>Available endpoints</h3>
            <dl className="public-docs-fields">
              <div><dt>GET /me</dt><dd>Read the account ID, email, and timezone.</dd></div>
              <div><dt>GET /overview</dt><dd>Read dashboard metrics. Accepts from, to, campaign, source, and event filters.</dd></div>
              <div><dt>GET /campaigns</dt><dd>List campaign configuration and performance. POST /campaigns creates a campaign. Resource lists accept limit (default 50, maximum 100) and offset (maximum 10000).</dd></div>
              <div><dt>PATCH /campaigns/{"{id}"}</dt><dd>Change campaign status. POST /campaigns/{"{id}"}/setup-test creates a test click.</dd></div>
              <div><dt>GET /campaigns/{"{id}"}/report</dt><dd>Read campaign metrics, daily totals, recent clicks and conversions, and delivery failures.</dd></div>
              <div><dt>GET /activity/clicks</dt><dd>Read click activity. GET /activity/conversions reads conversion activity. Both accept limit and cursor; limit is capped at 100.</dd></div>
              <div><dt>POST /conversions</dt><dd>Send an authenticated server-to-server conversion using the same click ID, stable event ID, event type, timestamp, value, and currency fields described above. A repeated event ID returns the original accepted result.</dd></div>
              <div><dt>GET, POST /offers</dt><dd>List offers and performance, or create one. PATCH /offers/{"{id}"} updates an offer. Lists accept limit and offset.</dd></div>
              <div><dt>GET, POST /traffic-sources</dt><dd>List and create sources. PUT /traffic-sources/{"{id}"} updates a source. Responses omit credential values. Lists accept limit and offset.</dd></div>
              <div><dt>GET /traffic-sources/{"{id}"}/report</dt><dd>Read all-time visits, conversions, and event counts for an owned traffic source.</dd></div>
              <div><dt>GET, POST /custom-conversions</dt><dd>List and create conversion rules. PATCH or DELETE /custom-conversions/{"{id}"} updates or removes a rule. Lists accept limit and offset.</dd></div>
              <div><dt>GET /delivery-health</dt><dd>Read delivery status using limit and cursor. POST /delivery-health/{"{id}"}/retry retries an eligible failed postback.</dd></div>
              <div><dt>PATCH /profile/timezone</dt><dd>Update the account reporting timezone.</dd></div>
            </dl>
            <h3>Example</h3>
            <pre><code>{`curl https://app.trakio.org/api/v1/overview \\
  -H "Authorization: Bearer $TRAKIO_API_KEY"`}</code></pre>
            <p>Read-only keys can call GET endpoints. Read and write keys can also create or change resources, send conversion events, update the timezone, run a campaign setup test, and retry eligible deliveries. Requests are always limited to the account that owns the key. Each key is limited to 120 requests per minute; a limit response uses HTTP 429 and includes <code>Retry-After</code>. Responses include an <code>x-request-id</code> for support and troubleshooting.</p>
            <p>The existing authenticated <code>POST /api/conversions</code> contract above remains available to sites using the separately provisioned webhook secret. You can use either that endpoint or <code>POST /api/v1/conversions</code> with an API key for a given integration. Never send either credential from browser JavaScript.</p>
          </section>
        </div>
      </div>
    </PublicSiteShell>
  );
}
