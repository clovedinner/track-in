"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { publicAppUrl, publicLinks } from "@/app/public-site-content";

export default function PublicSiteNav() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        document.getElementById("public-menu-toggle")?.focus();
      }
    }
    if (open) window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [open]);

  return (
    <header className="public-header">
      <nav className="public-container public-nav" aria-label="Main navigation">
        <Link
          href="/"
          className="public-brand"
          onClick={() => setOpen(false)}
          aria-label="Trakio home"
        >
          <span aria-hidden="true" className="public-brand-marks">
            <span />
            <span />
            <span />
          </span>
          Trakio
        </Link>
        <button
          id="public-menu-toggle"
          className="public-menu-toggle"
          type="button"
          aria-expanded={open}
          aria-controls="public-navigation"
          onClick={() => setOpen(!open)}
        >
          {open ? "Close menu" : "Menu"}
          <span aria-hidden="true">{open ? "−" : "+"}</span>
        </button>
        <div
          id="public-navigation"
          className={`public-nav-links ${open ? "is-open" : ""}`}
        >
          {publicLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              aria-current={
                pathname === link.href || pathname.startsWith(`${link.href}/`)
                  ? "page"
                  : undefined
              }
              onClick={() => setOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <a href={`${publicAppUrl}/auth/sign-in`} className="public-sign-in">
            Sign in
          </a>
        </div>
      </nav>
    </header>
  );
}
