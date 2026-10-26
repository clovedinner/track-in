import Link from "next/link";
import type { ReactNode } from "react";

import PublicSiteNav from "@/app/public-site-nav";
import PublicSiteTagManager from "@/app/public-site-tag-manager";
import { publicAppUrl, publicLinks } from "@/app/public-site-content";

export function PublicSiteShell({ children }: { children: ReactNode }) {
  return (
    <div className="public-site">
      <PublicSiteTagManager />
      <a className="public-skip-link" href="#main-content">
        Skip to content
      </a>
      <PublicSiteNav />
      <main id="main-content" tabIndex={-1}>{children}</main>
      <PublicSiteFooter />
    </div>
  );
}

export function PublicSiteFooter() {
  return (
    <footer className="public-footer">
      <div className="public-container public-footer-top">
        <div>
          <Link href="/" className="public-footer-brand">
            Trakio
          </Link>
          <p>Simple tracking that works.</p>
        </div>
        <nav aria-label="Footer navigation">
          {publicLinks.map((link) => (
            <Link key={link.href} href={link.href}>
              {link.label}
            </Link>
          ))}
          <a href={`${publicAppUrl}/auth/sign-in`}>Sign in</a>
        </nav>
      </div>
      <div className="public-container public-footer-bottom">
        <p>Built for the work of running paid traffic.</p>
        <p>Click tracking. Conversion attribution. Clear reporting.</p>
      </div>
    </footer>
  );
}

export function PublicCTA({
  title = "Put your next campaign on track.",
  text = "See the plans, check the setup, and choose the tracking workflow that fits your campaigns.",
}: {
  title?: string;
  text?: string;
}) {
  return (
    <section className="public-cta">
      <div className="public-container public-cta-inner">
        <div>
          <h2>{title}</h2>
          <p>{text}</p>
        </div>
        <Link href="/pricing" className="public-button public-button-dark">
          View pricing
        </Link>
      </div>
    </section>
  );
}
