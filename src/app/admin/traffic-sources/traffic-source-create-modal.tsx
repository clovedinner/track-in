"use client";

import { useState } from "react";
import TrafficSourceForm from "./traffic-source-form";

export default function TrafficSourceCreateModal() {
  const [open, setOpen] = useState(false);
  return <>
    <button type="button" onClick={() => setOpen(true)} className="bg-[#314d8b] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[#243968] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#314d8b]">New traffic source +</button>
    {open ? <section className="fixed inset-0 z-20 flex items-start justify-center overflow-y-auto bg-[#17202a]/35 p-3 sm:p-8" role="dialog" aria-modal="true" aria-labelledby="new-traffic-source-title"><div className="my-4 w-full max-w-[900px] border border-[#bfc7d4] bg-white shadow-2xl sm:my-8"><header className="flex items-center justify-between border-b border-[#bfc7d4] px-5 py-4 sm:px-7"><h2 id="new-traffic-source-title" className="text-xl font-semibold text-[#17202a] sm:text-2xl">Add traffic source</h2><button type="button" onClick={() => setOpen(false)} aria-label="Close new traffic source" className="text-2xl leading-none text-[#314d8b] hover:text-[#17202a] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#314d8b]">×</button></header><div className="px-5 py-7 sm:px-7"><TrafficSourceForm /></div></div></section> : null}
  </>;
}
