"use client";

import { motion } from "framer-motion";

export default function PageBanner({ title, subtitle, badge = "Raj Biosis" }) {
  return (
    <section className="relative overflow-hidden bg-slate-900 text-white py-16 lg:py-20 border-b border-slate-800">
      {/* Background Subtle Gradient */}
      <div className="pointer-events-none absolute -top-24 -left-20 h-96 w-96 rounded-full bg-slate-800/50 blur-3xl" />
      <div className="pointer-events-none absolute bottom-0 right-0 h-96 w-96 rounded-full bg-slate-800/40 blur-3xl" />

      {/* Grid Overlay */}
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:36px_36px]" />

      <div className="container-custom relative z-10">
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="mx-auto max-w-4xl text-center"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-700 bg-slate-800/90 px-4 py-1.5 text-xs font-bold uppercase tracking-widest text-slate-200 shadow-sm backdrop-blur-sm">
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
            {badge}
          </span>

          <h1 className="mt-5 text-3xl font-black tracking-tight text-white sm:text-4xl lg:text-5xl leading-tight">
            {title}
          </h1>

          {subtitle && (
            <p className="mx-auto mt-4 max-w-2xl text-sm sm:text-base leading-relaxed text-slate-300">
              {subtitle}
            </p>
          )}
        </motion.div>
      </div>
    </section>
  );
}