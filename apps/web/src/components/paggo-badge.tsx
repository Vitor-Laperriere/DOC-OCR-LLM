"use client";

import Image from "next/image";

type PaggoBadgeProps = {
  label: string;
};

export function PaggoBadge({ label }: PaggoBadgeProps) {
  return (
    <div className="inline-flex items-center gap-3 rounded-full border border-[#f2c94c]/30 bg-white/5 px-4 py-2 text-sm font-medium text-white/80 shadow-[0_0_20px_rgba(242,201,76,0.25)]">
      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-[#f2c94c]/50 bg-gradient-to-br from-[#1f2937] via-[#111827] to-[#1f2937] p-2 shadow-inner">
        <Image
          src="/credit-card.svg"
          alt="Paggo logo"
          width={32}
          height={32}
          className="h-full w-full drop-shadow-[0_0_6px_rgba(242,201,76,0.6)]"
          priority
        />
      </span>
      <span className="tracking-wide">{label}</span>
    </div>
  );
}
