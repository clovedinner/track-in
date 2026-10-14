"use client";

import { useState } from "react";
import type { ReactNode } from "react";

export default function SetupModalTrigger({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="border-2 border-[#121212] bg-[#1040C0] px-4 py-2 text-sm font-semibold text-white hover:bg-[#D02020] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]">
        Open campaign setup
      </button>
      {open ? <section className="fixed inset-0 z-30 flex items-start justify-center overflow-y-auto bg-[#121212]/45 p-3 sm:p-8" role="dialog" aria-modal="true" aria-labelledby="campaign-setup-dialog-title">
        <div className="my-2 flex h-[calc(100vh-1rem)] w-full max-w-6xl flex-col border-2 border-[#121212] bg-[#F0F0F0] shadow-2xl sm:my-4 sm:h-[calc(100vh-2rem)]">
          <header className="flex shrink-0 items-center justify-between border-b-2 border-[#121212] bg-white px-5 py-4 sm:px-7">
            <div><p className="text-xs font-bold uppercase tracking-[0.16em] text-[#D02020]">Campaign workspace</p><h2 id="campaign-setup-dialog-title" className="mt-1 text-xl font-semibold text-[#121212] sm:text-2xl">Setup and tracking instructions</h2></div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Close campaign setup" className="min-h-11 min-w-11 border-2 border-[#121212] bg-white text-2xl leading-none text-[#1040C0] shadow-[3px_3px_0_#121212] hover:bg-[#F0C020] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1040C0]">×</button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto text-left">{children}</div>
        </div>
      </section> : null}
    </>
  );
}
