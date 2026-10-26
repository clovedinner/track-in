export const publicAppUrl = (
  process.env.NEXT_PUBLIC_APP_URL?.trim() || "http://localhost:3000"
).replace(/\/$/, "");

export const publicLinks = [
  { href: "/features", label: "Features" },
  { href: "/pricing", label: "Pricing" },
  { href: "/docs", label: "Documentation" },
  { href: "/articles", label: "Articles" },
  { href: "/about", label: "About us" },
];
