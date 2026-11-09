import type { ReactNode } from "react";
import {
  YouTubeIcon,
  InstagramIcon,
  FacebookIcon,
  TelegramIcon,
  TwitterIcon,
} from "@/components/bundles/print/bundle-print-icons";
import type { FooterCode } from "./types";

export interface FooterVariantProps {
  pageNumber?: number | string;
  totalPages?: number | string;
  handle?: string;
  brand?: string;
}

// ── Shared Sub-Components ──

function GlobeIcon() {
  return (
    <svg
      className="size-3.5 text-[#072652] inline-block shrink-0"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
    </svg>
  );
}

function FiveSocials({
  handle = "mathmyid",
  isWhiteText = false,
  hasGoldPipes = false,
}: {
  handle?: string;
  isWhiteText?: boolean;
  hasGoldPipes?: boolean;
}) {
  const txtCol = isWhiteText ? "text-white" : "text-[#072652]";
  const iconCol = isWhiteText ? "text-white" : "text-[#0047b3]";

  return (
    <div className={`flex items-center text-[10px] font-semibold ${txtCol} shrink-0`}>
      <span className="inline-flex items-center gap-1">
        <YouTubeIcon className={`size-3.5 ${iconCol} shrink-0`} />
        <span>{handle}</span>
      </span>
      {hasGoldPipes ? <span className="text-[#f5b800] mx-2 text-[10px]">|</span> : <span className="mx-2" />}

      <span className="inline-flex items-center gap-1">
        <InstagramIcon className={`size-3.5 ${iconCol} shrink-0`} />
        <span>{handle}</span>
      </span>
      {hasGoldPipes ? <span className="text-[#f5b800] mx-2 text-[10px]">|</span> : <span className="mx-2" />}

      <span className="inline-flex items-center gap-1">
        <FacebookIcon className={`size-3.5 ${iconCol} shrink-0`} />
        <span>{handle}</span>
      </span>
      {hasGoldPipes ? <span className="text-[#f5b800] mx-2 text-[10px] hidden sm:inline">|</span> : <span className="mx-2 hidden sm:inline" />}

      <span className="inline-flex items-center gap-1 hidden sm:inline-flex">
        <TelegramIcon className={`size-3.5 ${iconCol} shrink-0`} />
        <span>{handle}</span>
      </span>
      {hasGoldPipes ? <span className="text-[#f5b800] mx-2 text-[10px] hidden md:inline">|</span> : <span className="mx-2 hidden md:inline" />}

      <span className="inline-flex items-center gap-1 hidden md:inline-flex">
        <TwitterIcon className={`size-3.5 ${iconCol} shrink-0`} />
        <span>{handle}</span>
      </span>
    </div>
  );
}

function SoftStripWatermark() {
  return (
    <svg
      className="absolute right-24 top-0 h-full w-48 pointer-events-none opacity-35"
      viewBox="0 0 200 60"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d="M 20 60 A 42 42 0 0 1 104 60" fill="none" stroke="#cbd5e1" strokeWidth="10" />
      <path d="M 85 60 A 38 38 0 0 1 160 60" fill="none" stroke="#fde68a" strokeWidth="10" />
    </svg>
  );
}

function RightCornerWedge({ variant = "gold-navy" }: { variant?: "gold-navy" | "double-gold-slash" | "triple-slash" }) {
  if (variant === "triple-slash") {
    return (
      <div className="flex items-center gap-[3px] pr-2 h-full shrink-0" aria-hidden="true">
        <span className="w-[3.5px] h-full bg-[#072652] -skew-x-[28deg]" />
        <span className="w-[3.5px] h-full bg-[#f5b800] -skew-x-[28deg]" />
        <span className="w-[3px] h-full bg-[#eab308]/70 -skew-x-[28deg]" />
      </div>
    );
  }
  if (variant === "double-gold-slash") {
    return (
      <div className="flex items-center gap-[3px] pr-2.5 h-full shrink-0" aria-hidden="true">
        <span className="w-[4px] h-full bg-[#072652] -skew-x-[28deg]" />
        <span className="w-[4px] h-full bg-[#f5b800] -skew-x-[28deg]" />
      </div>
    );
  }
  return (
    <svg className="w-9 h-full shrink-0 block" viewBox="0 0 36 36" preserveAspectRatio="none" aria-hidden="true">
      <polygon points="14,0 20,0 4,36 0,36" fill="#f5b800" />
      <polygon points="22,0 36,0 36,36 6,36" fill="#072652" />
    </svg>
  );
}

function PageNum({
  pageNumber = 1,
  showTotal = false,
  totalPages,
  className = "",
}: {
  pageNumber?: number | string;
  showTotal?: boolean;
  totalPages?: number | string;
  className?: string;
}) {
  const displayVal = showTotal && totalPages ? `${pageNumber} / ${totalPages}` : pageNumber;
  return (
    <span className={className}>
      <span className="print:hidden">{displayVal}</span>
      <span className="hidden print:inline-block print-page-counter" aria-hidden="true" />
    </span>
  );
}

const SOFT_BG_STYLE = {
  background: "linear-gradient(90deg, #ffffff 0%, #f4f8fd 55%, #eef5fc 100%)",
};

// ── 32 Footer Variation Renderers ──

export const FOOTER_VARIANTS: Record<
  FooterCode,
  (props: FooterVariantProps) => ReactNode
> = {
  // ── SERI F (F1 – F16): Clean Minimalist ──
  F1: ({ pageNumber = 1, handle = "mathmyid" }) => (
    <div className="mmi-strip h-[30px] bg-white border-t border-slate-200 flex flex-col justify-between w-full select-none">
      <svg className="w-full h-[6px] block" viewBox="0 0 756 6" preserveAspectRatio="none" aria-hidden="true">
        <path d="M 0 1.5 L 555 1.5 L 564 5 L 756 5" fill="none" stroke="#072652" strokeWidth="1.6" />
        <path d="M 566 1.5 L 756 1.5" fill="none" stroke="#f5b800" strokeWidth="1.6" />
      </svg>
      <div className="flex items-center justify-between px-6 pb-1">
        <FiveSocials handle={handle} isWhiteText={false} hasGoldPipes={false} />
        <div className="flex items-center gap-2 text-[11px] shrink-0">
          <span className="font-bold text-[#072652]">{handle}</span>
          <span className="text-[#f5b800] font-bold">|</span>
          <PageNum pageNumber={pageNumber} className="font-extrabold text-[#072652]" />
        </div>
      </div>
    </div>
  ),

  F2: ({ pageNumber = 1, handle = "mathmyid" }) => (
    <div className="mmi-strip h-[30px] bg-white border-t border-slate-200 flex items-center justify-between pl-6 pr-0 w-full select-none">
      <FiveSocials handle={handle} isWhiteText={false} hasGoldPipes={false} />
      <div className="flex-1 mx-4 flex items-center min-w-4" aria-hidden="true">
        <span className="w-full h-[1.2px] bg-[#072652]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[#072652] shrink-0" />
      </div>
      <div className="flex items-center h-full gap-2 shrink-0">
        <span className="font-bold text-[#072652] text-[11px]">{handle}</span>
        <span className="text-[#f5b800] font-bold text-[11px]">|</span>
        <PageNum pageNumber={pageNumber} className="font-extrabold text-[#072652] text-[11px] mr-1" />
        <RightCornerWedge variant="gold-navy" />
      </div>
    </div>
  ),

  F3: ({ pageNumber = 1, handle = "mathmyid" }) => (
    <div className="mmi-strip h-[30px] bg-white border-t border-slate-200 flex items-center justify-between pl-6 pr-0 w-full select-none">
      <FiveSocials handle={handle} isWhiteText={false} hasGoldPipes={false} />
      <div className="flex-1 mx-4 flex items-center min-w-4" aria-hidden="true">
        <span className="w-full h-[1.3px] bg-[#f5b800]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[#f5b800] shrink-0" />
      </div>
      <div className="flex items-center h-full gap-2 shrink-0">
        <span className="font-bold text-[#072652] text-[11px]">{handle}</span>
        <span className="text-[#f5b800] font-bold text-[11px]">|</span>
        <PageNum pageNumber={pageNumber} className="font-extrabold text-[#072652] text-[11px] mr-1" />
        <RightCornerWedge variant="triple-slash" />
      </div>
    </div>
  ),

  F4: ({ pageNumber = 1, handle = "mathmyid" }) => (
    <div
      className="mmi-strip h-[30px] border-t border-slate-200 flex items-center justify-between pl-6 pr-0 w-full relative select-none"
      style={SOFT_BG_STYLE}
    >
      <SoftStripWatermark />
      <div className="relative z-10">
        <FiveSocials handle={handle} isWhiteText={false} hasGoldPipes={false} />
      </div>
      <div className="flex items-center h-full gap-2 relative z-10 shrink-0">
        <span className="font-bold text-[#072652] text-[11px]">{handle}</span>
        <span className="text-[#f5b800] font-bold text-[11px]">|</span>
        <PageNum pageNumber={pageNumber} className="font-extrabold text-[#072652] text-[11px] mr-1" />
        <RightCornerWedge variant="gold-navy" />
      </div>
    </div>
  ),

  F5: ({ pageNumber = 1, handle = "mathmyid" }) => (
    <div
      className="mmi-strip h-[30px] border-t border-slate-200 flex items-center justify-between pr-6 w-full relative select-none"
      style={SOFT_BG_STYLE}
    >
      <SoftStripWatermark />
      <div className="flex items-center h-full relative z-10">
        <div
          className="bg-[#072652] h-full pl-6 pr-6 flex items-center"
          style={{ clipPath: "polygon(0 0, 96% 0, 100% 100%, 0% 100%)" }}
        >
          <FiveSocials handle={handle} isWhiteText={true} hasGoldPipes={true} />
        </div>
        <span className="w-[5px] h-full bg-[#f5b800] -skew-x-[26deg] -ml-1 shrink-0" aria-hidden="true" />
      </div>
      <div className="flex items-center gap-2 text-[11px] relative z-10 shrink-0">
        <span className="font-bold text-[#072652]">{handle}</span>
        <span className="text-[#f5b800] font-bold">|</span>
        <PageNum pageNumber={pageNumber} className="font-extrabold text-[#072652]" />
      </div>
    </div>
  ),

  F6: ({ pageNumber = 1, handle = "mathmyid" }) => (
    <div className="mmi-strip h-[30px] bg-white border-t border-slate-200 flex items-center justify-between pl-6 pr-0 w-full select-none">
      <FiveSocials handle={handle} isWhiteText={false} hasGoldPipes={false} />
      <div className="flex-1 mx-4 flex items-center min-w-4" aria-hidden="true">
        <span className="w-full h-[1.2px] bg-[#072652]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[#072652] shrink-0" />
      </div>
      <div className="flex items-center h-full shrink-0">
        <span className="w-[5px] h-full bg-[#f5b800] -skew-x-[26deg] mr-1" aria-hidden="true" />
        <div
          className="bg-[#072652] text-white h-full pl-5 pr-5 flex items-center gap-2 text-[11px]"
          style={{ clipPath: "polygon(12% 0, 100% 0, 100% 100%, 0% 100%)" }}
        >
          <span className="font-bold">{handle}</span>
          <span className="text-[#f5b800] font-bold">|</span>
          <PageNum pageNumber={pageNumber} className="font-extrabold" />
        </div>
      </div>
    </div>
  ),

  F7: ({ pageNumber = 1, totalPages, handle = "mathmyid" }) => (
    <div className="mmi-strip h-[30px] bg-white border-t border-slate-200 flex items-center justify-between pl-6 pr-0 w-full select-none">
      <FiveSocials handle={handle} isWhiteText={false} hasGoldPipes={false} />
      <div className="flex items-center h-full gap-2 shrink-0">
        <span className="font-bold text-[#072652] text-[11px]">{handle}</span>
        <span className="text-[#f5b800] font-bold text-[11px]">|</span>
        <PageNum pageNumber={pageNumber} showTotal={true} totalPages={totalPages} className="font-extrabold text-[#072652] text-[11px] mr-1" />
        <RightCornerWedge variant="triple-slash" />
      </div>
    </div>
  ),

  F8: ({ pageNumber = 1, totalPages, handle = "mathmyid" }) => (
    <div className="mmi-strip h-[30px] bg-white border-t-[1.8px] border-t-[#072652] flex items-center justify-between pl-6 pr-0 relative w-full select-none">
      <span className="absolute left-0 w-44 top-0 h-[1.8px] bg-[#f5b800]" aria-hidden="true" />
      <FiveSocials handle={handle} isWhiteText={false} hasGoldPipes={false} />
      <div className="flex items-center h-full gap-2 shrink-0">
        <span className="font-bold text-[#072652] text-[11px]">{handle}</span>
        <span className="text-[#f5b800] font-bold text-[11px]">|</span>
        <PageNum pageNumber={pageNumber} showTotal={true} totalPages={totalPages} className="font-extrabold text-[#072652] text-[11px] mr-1" />
        <RightCornerWedge variant="gold-navy" />
      </div>
    </div>
  ),

  F9: ({ pageNumber = 1, totalPages, handle = "mathmyid" }) => (
    <div
      className="mmi-strip h-[32px] border-t border-slate-200 flex items-center justify-between px-6 relative w-full select-none"
      style={SOFT_BG_STYLE}
    >
      <SoftStripWatermark />
      <svg className="absolute inset-x-0 bottom-0 w-full h-2.5 pointer-events-none" viewBox="0 0 756 10" preserveAspectRatio="none" aria-hidden="true">
        <path d="M 0 6 Q 60 10 150 9 L 0 10 Z" fill="#f5b800" />
        <path d="M 460 10 Q 580 2 680 7 T 756 0 L 756 10 Z" fill="#072652" />
        <path d="M 650 8 Q 710 6 756 0 L 756 3 Q 710 9 650 10 Z" fill="#f5b800" />
      </svg>
      <div className="relative z-10">
        <FiveSocials handle={handle} isWhiteText={false} hasGoldPipes={false} />
      </div>
      <div className="flex items-center gap-2 text-[11px] relative z-10 pb-0.5 shrink-0">
        <span className="font-bold text-[#072652]">{handle}</span>
        <span className="text-[#f5b800] font-bold">|</span>
        <PageNum pageNumber={pageNumber} showTotal={true} totalPages={totalPages} className="font-extrabold text-[#072652]" />
      </div>
    </div>
  ),

  F10: ({ pageNumber = 1, totalPages, handle = "mathmyid" }) => (
    <div
      className="mmi-strip h-[30px] border-t border-slate-200 flex items-center justify-between pr-0 w-full relative select-none"
      style={SOFT_BG_STYLE}
    >
      <SoftStripWatermark />
      <div
        className="bg-[#072652] h-full pl-6 pr-7 flex items-center relative z-10"
        style={{ clipPath: "polygon(0 0, 94% 0, 100% 100%, 0% 100%)" }}
      >
        <FiveSocials handle={handle} isWhiteText={true} hasGoldPipes={true} />
      </div>
      <div className="flex items-center h-full gap-2 relative z-10 shrink-0">
        <span className="font-bold text-[#072652] text-[11px]">{handle}</span>
        <span className="text-[#f5b800] font-bold text-[11px]">|</span>
        <PageNum pageNumber={pageNumber} showTotal={true} totalPages={totalPages} className="font-extrabold text-[#072652] text-[11px] mr-1" />
        <RightCornerWedge variant="gold-navy" />
      </div>
    </div>
  ),

  F11: ({ pageNumber = 1, handle = "mathmyid" }) => (
    <div className="mmi-strip h-[30px] bg-white border-t border-slate-200 flex items-center justify-between px-6 relative w-full select-none">
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 756 28" preserveAspectRatio="none" aria-hidden="true">
        <path d="M 0 25 L 620 25 Q 635 25 642 15" fill="none" stroke="#f5b800" strokeWidth="1.6" />
        <circle cx="643" cy="14" r="2.2" fill="#f5b800" />
        <polygon points="738,26 756,16 756,26" fill="#f5b800" />
      </svg>
      <div className="relative z-10 pb-0.5">
        <FiveSocials handle={handle} isWhiteText={false} hasGoldPipes={false} />
      </div>
      <div className="flex items-center gap-2 text-[11px] relative z-10 pr-3 pb-0.5 shrink-0">
        <span className="font-bold text-[#072652]">{handle}</span>
        <span className="text-[#f5b800] font-bold">|</span>
        <PageNum pageNumber={pageNumber} className="font-extrabold text-[#072652]" />
      </div>
    </div>
  ),

  F12: ({ pageNumber = 1, totalPages, handle = "mathmyid" }) => (
    <div
      className="mmi-strip h-[32px] border-t border-slate-200 flex items-center justify-between pl-6 pr-0 w-full relative select-none"
      style={SOFT_BG_STYLE}
    >
      <SoftStripWatermark />
      <div className="relative z-10">
        <FiveSocials handle={handle} isWhiteText={false} hasGoldPipes={false} />
      </div>
      <div className="flex items-center h-full relative z-10 shrink-0">
        <span className="w-[5px] h-full bg-[#f5b800] -skew-x-[26deg] mr-1" aria-hidden="true" />
        <div
          className="bg-[#072652] h-full pl-5 pr-4 flex items-center"
          style={{ clipPath: "polygon(12% 0, 100% 0, 100% 100%, 0% 100%)" }}
        >
          <span className="px-3 py-0.5 rounded-full border border-slate-400/60 text-white text-[10px] font-bold flex items-center gap-1.5">
            <span>{handle}</span>
            <span className="text-[#f5b800]">|</span>
            <PageNum pageNumber={pageNumber} showTotal={true} totalPages={totalPages} />
          </span>
        </div>
      </div>
    </div>
  ),

  F13: ({ pageNumber = 1, handle = "mathmyid" }) => (
    <div className="mmi-strip h-[30px] bg-white border-t border-slate-200 flex items-center justify-between pl-6 pr-0 relative w-full select-none">
      <span className="absolute right-10 top-0 w-72 h-[1.5px] bg-[#f5b800]" aria-hidden="true" />
      <FiveSocials handle={handle} isWhiteText={false} hasGoldPipes={false} />
      <div className="flex items-center h-full gap-2 shrink-0">
        <span className="inline-flex items-center gap-1 font-bold text-[#072652] text-[10.5px]">
          <GlobeIcon />
          <span>mathmyid.id</span>
        </span>
        <span className="text-[#f5b800] font-bold text-[11px]">|</span>
        <PageNum pageNumber={pageNumber} className="font-extrabold text-[#072652] text-[11px] mr-1" />
        <RightCornerWedge variant="gold-navy" />
      </div>
    </div>
  ),

  F14: ({ pageNumber = 1, handle = "mathmyid", brand = "Math My ID" }) => (
    <div
      className="mmi-strip h-[30px] border-t border-slate-200 flex items-center justify-between pl-6 pr-0 w-full relative select-none"
      style={SOFT_BG_STYLE}
    >
      <SoftStripWatermark />
      <div className="relative z-10">
        <FiveSocials handle={handle} isWhiteText={false} hasGoldPipes={false} />
      </div>
      <div className="flex items-center h-full gap-2 relative z-10 shrink-0">
        <span className="font-extrabold text-[#072652] text-[11px]">{brand}</span>
        <span className="text-[#f5b800] font-bold text-[11px]">|</span>
        <PageNum pageNumber={pageNumber} className="font-extrabold text-[#072652] text-[11px] mr-1" />
        <RightCornerWedge variant="gold-navy" />
      </div>
    </div>
  ),

  F15: ({ pageNumber = 1, totalPages, handle = "mathmyid" }) => (
    <div className="mmi-strip h-[30px] bg-white border-t border-slate-200 flex items-center justify-between pl-6 pr-0 w-full select-none">
      <FiveSocials handle={handle} isWhiteText={false} hasGoldPipes={false} />
      <div className="flex-1 mx-3 flex items-center min-w-4" aria-hidden="true">
        <span className="w-full h-[1.2px] bg-[#072652]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[#072652] shrink-0" />
      </div>
      <div className="flex items-center h-full gap-2 shrink-0">
        <span className="inline-flex items-center gap-1 font-bold text-[#072652] text-[10.5px]">
          <GlobeIcon />
          <span>mathmyid.id</span>
        </span>
        <span className="text-[#f5b800] font-bold text-[11px]">|</span>
        <PageNum pageNumber={pageNumber} showTotal={true} totalPages={totalPages} className="font-extrabold text-[#072652] text-[11px] mr-1" />
        <RightCornerWedge variant="gold-navy" />
      </div>
    </div>
  ),

  F16: ({ pageNumber = 1, totalPages, handle = "mathmyid", brand = "Math My ID" }) => (
    <div
      className="mmi-strip h-[30px] border-t border-slate-200 flex items-center justify-between pr-6 w-full relative select-none"
      style={SOFT_BG_STYLE}
    >
      <SoftStripWatermark />
      <div className="flex items-center h-full relative z-10">
        <div
          className="bg-[#072652] h-full pl-6 pr-6 flex items-center"
          style={{ clipPath: "polygon(0 0, 96% 0, 100% 100%, 0% 100%)" }}
        >
          <FiveSocials handle={handle} isWhiteText={true} hasGoldPipes={true} />
        </div>
        <span className="w-[5px] h-full bg-[#f5b800] -skew-x-[26deg] -ml-1 shrink-0" aria-hidden="true" />
      </div>
      <div className="flex items-center h-full gap-3 relative z-10 shrink-0">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="font-extrabold text-[#072652]">{brand}</span>
          <span className="text-[#f5b800] font-bold">|</span>
          <PageNum pageNumber={pageNumber} showTotal={true} totalPages={totalPages} className="font-extrabold text-[#072652]" />
        </div>
      </div>
    </div>
  ),

  // ── SERI G (G1 – G16): Decorative / Aksen Geometris ──
  G1: ({ pageNumber = 1, handle = "mathmyid", brand = "Math My ID" }) => (
    <div className="mmi-strip h-[30px] bg-white border-t border-slate-200 flex items-center justify-between pl-6 pr-0 relative w-full select-none">
      <span className="absolute left-[50%] w-24 top-0 h-[1.6px] bg-[#072652]" aria-hidden="true" />
      <span className="absolute left-[63%] w-16 top-0 h-[1.6px] bg-[#f5b800]" aria-hidden="true" />
      <FiveSocials handle={handle} isWhiteText={false} hasGoldPipes={false} />
      <div className="flex items-center h-full gap-2 shrink-0">
        <span className="font-extrabold text-[#072652] text-[11px]">{brand}</span>
        <span className="text-[#f5b800] font-bold text-[11px]">|</span>
        <PageNum pageNumber={pageNumber} className="font-extrabold text-[#072652] text-[11px] mr-1" />
        <RightCornerWedge variant="gold-navy" />
      </div>
    </div>
  ),

  G2: ({ pageNumber = 1, totalPages, handle = "mathmyid" }) => (
    <div
      className="mmi-strip h-[30px] border-t border-slate-200 flex items-center justify-between pl-6 pr-0 w-full relative select-none"
      style={SOFT_BG_STYLE}
    >
      <SoftStripWatermark />
      <div className="relative z-10">
        <FiveSocials handle={handle} isWhiteText={false} hasGoldPipes={false} />
      </div>
      <div className="flex items-center h-full gap-2.5 relative z-10 shrink-0">
        <span className="text-slate-300">|</span>
        <PageNum pageNumber={pageNumber} showTotal={true} totalPages={totalPages} className="font-extrabold text-[#072652] text-[11px] mr-1" />
        <RightCornerWedge variant="gold-navy" />
      </div>
    </div>
  ),

  G3: ({ pageNumber = 1, handle = "mathmyid", brand = "Math My ID" }) => (
    <div className="mmi-strip h-[30px] bg-white border-t border-slate-200 flex items-center justify-between pl-6 pr-0 relative w-full select-none">
      <span className="absolute left-0 top-0 w-[58%] h-[1.6px] bg-[#f5b800]" aria-hidden="true" />
      <FiveSocials handle={handle} isWhiteText={false} hasGoldPipes={false} />
      <div className="flex items-center h-full gap-2 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-[#072652] mr-1" aria-hidden="true" />
        <span className="font-extrabold text-[#072652] text-[11px]">{brand}</span>
        <span className="text-[#f5b800] font-bold text-[11px]">|</span>
        <PageNum pageNumber={pageNumber} className="font-extrabold text-[#072652] text-[11px] mr-1" />
        <RightCornerWedge variant="gold-navy" />
      </div>
    </div>
  ),

  G4: ({ pageNumber = 1, totalPages, handle = "mathmyid" }) => (
    <div className="mmi-strip h-[30px] bg-white border-t border-slate-200 flex items-center justify-between pl-6 pr-0 w-full select-none">
      <FiveSocials handle={handle} isWhiteText={false} hasGoldPipes={false} />
      <span className="w-[4px] h-full bg-[#f5b800] -skew-x-[28deg] shrink-0" aria-hidden="true" />
      <div className="flex items-center h-full gap-2 shrink-0">
        <span className="px-3 py-0.5 rounded-full border border-slate-200 text-[#072652] font-extrabold text-[10.5px]">
          | &nbsp; <PageNum pageNumber={pageNumber} showTotal={true} totalPages={totalPages} />
        </span>
        <RightCornerWedge variant="gold-navy" />
      </div>
    </div>
  ),

  G5: ({ pageNumber = 1, handle = "mathmyid", brand = "Math My ID" }) => (
    <div
      className="mmi-strip h-[30px] border-t border-slate-200 flex items-center justify-between pr-0 w-full relative select-none"
      style={SOFT_BG_STYLE}
    >
      <SoftStripWatermark />
      <div
        className="bg-[#072652] h-full pl-6 pr-7 flex items-center relative z-10"
        style={{ clipPath: "polygon(0 0, 94% 0, 100% 100%, 0% 100%)" }}
      >
        <FiveSocials handle={handle} isWhiteText={true} hasGoldPipes={true} />
      </div>
      <div className="flex items-center h-full gap-2 relative z-10 shrink-0">
        <span className="font-extrabold text-[#072652] text-[11px]">{brand}</span>
        <span className="text-[#f5b800] font-bold text-[11px]">|</span>
        <PageNum pageNumber={pageNumber} className="font-extrabold text-[#072652] text-[11px] mr-1" />
        <RightCornerWedge variant="gold-navy" />
      </div>
    </div>
  ),

  G6: ({ pageNumber = 1, totalPages, handle = "mathmyid" }) => (
    <div className="mmi-strip h-[30px] bg-white border-t border-slate-200 flex items-center justify-between px-6 w-full select-none">
      <div className="flex items-center gap-2 shrink-0">
        <span className="w-1.5 h-1.5 rounded-full bg-[#072652]" aria-hidden="true" />
        <FiveSocials handle={handle} isWhiteText={false} hasGoldPipes={false} />
      </div>
      <div className="flex-1 mx-3 flex items-center min-w-4" aria-hidden="true">
        <span className="w-1.5 h-1.5 rounded-full bg-[#072652] mr-1" />
        <span className="flex-1 border-b border-dashed border-slate-300" />
        <span className="text-[#f5b800] text-[10px] font-black ml-1 tracking-tighter">▸▸▸</span>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <PageNum pageNumber={pageNumber} showTotal={true} totalPages={totalPages} className="font-extrabold text-[#072652] text-[11px]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[#072652]" aria-hidden="true" />
      </div>
    </div>
  ),

  G7: ({ pageNumber = 1, handle = "mathmyid", brand = "Math My ID" }) => (
    <div
      className="mmi-strip h-[32px] border-t border-slate-200 flex items-center justify-between px-6 relative w-full select-none"
      style={SOFT_BG_STYLE}
    >
      <SoftStripWatermark />
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 756 28" preserveAspectRatio="none" aria-hidden="true">
        <path d="M 0 23 Q 180 30 380 25 Q 480 22 550 8 Q 640 -2 756 8 L 756 0 L 580 0 Q 480 18 360 25 L 0 25 Z" fill="#072652" />
        <path d="M 480 20 Q 590 0 756 12" fill="none" stroke="#f5b800" strokeWidth="2" />
      </svg>
      <div className="relative z-10">
        <FiveSocials handle={handle} isWhiteText={false} hasGoldPipes={false} />
      </div>
      <div className="flex items-center gap-2 text-[11px] relative z-10 pt-1 shrink-0">
        <span className="font-extrabold text-[#072652]">{brand}</span>
        <span className="text-[#f5b800] font-bold">|</span>
        <PageNum pageNumber={pageNumber} className="font-extrabold text-[#072652]" />
      </div>
    </div>
  ),

  G8: ({ pageNumber = 1, totalPages, handle = "mathmyid" }) => (
    <div
      className="mmi-strip h-[30px] border-t border-slate-200 flex items-center justify-between pl-6 pr-0 w-full relative select-none"
      style={SOFT_BG_STYLE}
    >
      <SoftStripWatermark />
      <div className="relative z-10">
        <FiveSocials handle={handle} isWhiteText={false} hasGoldPipes={true} />
      </div>
      <div className="flex items-center h-full gap-2 relative z-10 shrink-0">
        <PageNum
          pageNumber={pageNumber}
          showTotal={true}
          totalPages={totalPages}
          className="px-3.5 py-0.5 rounded-full bg-[#fde047] text-[#072652] font-extrabold text-[10.5px] mr-1 shadow-xs inline-block"
        />
        <RightCornerWedge variant="gold-navy" />
      </div>
    </div>
  ),

  G9: ({ pageNumber = 1, handle = "mathmyid", brand = "Math My ID" }) => (
    <div
      className="mmi-strip h-[30px] border-t border-slate-200 flex items-center justify-between pl-6 pr-0 w-full relative select-none"
      style={SOFT_BG_STYLE}
    >
      <SoftStripWatermark />
      <div className="relative z-10">
        <FiveSocials handle={handle} isWhiteText={false} hasGoldPipes={false} />
      </div>
      <div className="flex items-center h-full gap-3 relative z-10 shrink-0">
        <div className="flex items-center gap-2 text-[11px]">
          <span className="font-extrabold text-[#072652]">{brand}</span>
          <span className="text-[#f5b800] font-bold">|</span>
          <PageNum pageNumber={pageNumber} className="font-extrabold text-[#072652]" />
        </div>
        <svg className="w-12 h-full block shrink-0" viewBox="0 0 48 28" preserveAspectRatio="none" aria-hidden="true">
          <polygon points="16,0 24,0 6,28 0,28" fill="#f5b800" />
          <polygon points="26,0 48,0 48,28 8,28" fill="#072652" />
        </svg>
      </div>
    </div>
  ),

  G10: ({ pageNumber = 1, totalPages, handle = "mathmyid" }) => (
    <div className="mmi-strip h-[30px] bg-white border-t border-slate-200 flex items-center justify-between pl-6 pr-0 w-full select-none">
      <FiveSocials handle={handle} isWhiteText={false} hasGoldPipes={false} />
      <div className="flex items-center h-full gap-3 shrink-0">
        <span className="inline-flex items-center gap-1 font-bold text-[#072652] text-[10.5px]">
          <GlobeIcon />
          <span>math.my.id</span>
        </span>
        <span className="text-[#f5b800] font-bold text-[11px]">|</span>
        <PageNum pageNumber={pageNumber} showTotal={true} totalPages={totalPages} className="font-extrabold text-[#072652] text-[11px] mr-1" />
        <RightCornerWedge variant="double-gold-slash" />
      </div>
    </div>
  ),

  G11: ({ pageNumber = 1, totalPages, handle = "mathmyid" }) => (
    <div className="mmi-strip h-[30px] bg-white border-t border-slate-200 flex items-center justify-between pl-6 pr-0 w-full select-none">
      <FiveSocials handle={handle} isWhiteText={false} hasGoldPipes={false} />
      <div className="flex-1 mx-4 flex items-center min-w-4" aria-hidden="true">
        <span className="w-full h-[1.2px] bg-[#072652]" />
        <span className="w-1.5 h-1.5 rounded-full bg-[#072652] shrink-0" />
      </div>
      <div className="flex items-center h-full gap-3 shrink-0">
        <span className="text-slate-300">|</span>
        <PageNum pageNumber={pageNumber} showTotal={true} totalPages={totalPages} className="font-extrabold text-[#072652] text-[11px] mr-1" />
        <RightCornerWedge variant="gold-navy" />
      </div>
    </div>
  ),

  G12: ({ pageNumber = 1, totalPages, handle = "mathmyid" }) => (
    <div
      className="mmi-strip h-[30px] border-t border-slate-200 flex items-center justify-between pr-0 w-full relative select-none"
      style={SOFT_BG_STYLE}
    >
      <SoftStripWatermark />
      <div className="flex items-center h-full relative z-10">
        <div
          className="bg-[#072652] h-full pl-6 pr-8 flex items-center"
          style={{ clipPath: "polygon(0 0, 95% 0, 100% 100%, 0% 100%)" }}
        >
          <FiveSocials handle={handle} isWhiteText={true} hasGoldPipes={false} />
        </div>
        <span className="w-[3px] h-full bg-[#f5b800] -skew-x-[26deg] -ml-1 shrink-0" aria-hidden="true" />
      </div>
      <div className="flex items-center h-full gap-2.5 relative z-10 shrink-0">
        <span className="text-slate-300">|</span>
        <PageNum pageNumber={pageNumber} showTotal={true} totalPages={totalPages} className="font-extrabold text-[#072652] text-[11px] mr-1" />
        <RightCornerWedge variant="gold-navy" />
      </div>
    </div>
  ),

  G13: ({ pageNumber = 1, handle = "mathmyid", brand = "Math My ID" }) => (
    <div className="mmi-strip h-[30px] bg-white border-t border-slate-200 flex items-center justify-between px-6 relative w-full select-none">
      <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 756 28" preserveAspectRatio="none" aria-hidden="true">
        <path d="M 380 27 Q 420 20 560 21" fill="none" stroke="#072652" strokeWidth="1.3" />
        <circle cx="562" cy="21" r="2" fill="#072652" />
        <path d="M 715 28 Q 740 26 756 12 L 756 28 Z" fill="#f5b800" />
      </svg>
      <div className="relative z-10">
        <FiveSocials handle={handle} isWhiteText={false} hasGoldPipes={true} />
      </div>
      <div className="flex items-center gap-2 text-[11px] relative z-10 pr-3 shrink-0">
        <span className="font-extrabold text-[#072652]">{brand}</span>
        <span className="text-[#f5b800] font-bold">|</span>
        <PageNum pageNumber={pageNumber} className="font-extrabold text-[#072652]" />
      </div>
    </div>
  ),

  G14: ({ pageNumber = 1, totalPages, handle = "mathmyid" }) => (
    <div
      className="mmi-strip h-[30px] border-t border-slate-200 flex items-center justify-between pl-6 pr-0 w-full relative select-none"
      style={SOFT_BG_STYLE}
    >
      <SoftStripWatermark />
      <div className="relative z-10">
        <FiveSocials handle={handle} isWhiteText={false} hasGoldPipes={false} />
      </div>
      <div className="flex items-center h-full gap-2.5 relative z-10 shrink-0">
        <span className="inline-flex items-center gap-1 font-bold text-[#072652] text-[10.5px]">
          <GlobeIcon />
          <span>math.my.id</span>
        </span>
        <span className="text-[#f5b800] font-bold text-[11px]">|</span>
        <PageNum pageNumber={pageNumber} showTotal={true} totalPages={totalPages} className="font-extrabold text-[#072652] text-[11px] mr-1" />
        <RightCornerWedge variant="gold-navy" />
      </div>
    </div>
  ),

  G15: ({ pageNumber = 1, handle = "mathmyid", brand = "Math My ID" }) => (
    <div className="mmi-strip h-[30px] bg-white border-t border-slate-200 flex items-center justify-between pl-6 pr-0 w-full select-none">
      <FiveSocials handle={handle} isWhiteText={false} hasGoldPipes={false} />
      <div className="flex-1 mx-4 flex items-center min-w-4" aria-hidden="true">
        <span className="w-full h-[1.2px] bg-[#072652]" />
        <span className="w-2.5 h-2.5 rounded-full border-2 border-[#f5b800] bg-white shrink-0" />
      </div>
      <div className="flex items-center h-full gap-2 shrink-0">
        <span className="font-extrabold text-[#072652] text-[11px]">{brand}</span>
        <span className="text-[#f5b800] font-bold text-[11px]">|</span>
        <PageNum pageNumber={pageNumber} className="font-extrabold text-[#072652] text-[11px] mr-1" />
        <RightCornerWedge variant="gold-navy" />
      </div>
    </div>
  ),

  G16: ({ pageNumber = 1, handle = "mathmyid", brand = "Math My ID" }) => (
    <div
      className="mmi-strip h-[32px] border-t border-slate-200 flex items-center justify-between pr-0 w-full relative select-none"
      style={SOFT_BG_STYLE}
    >
      <SoftStripWatermark />
      <div className="flex items-center h-full relative z-10">
        <svg className="w-16 h-full shrink-0 mr-2" viewBox="0 0 64 29" preserveAspectRatio="none" aria-hidden="true">
          <path d="M 0 0 L 14 0 Q 34 22 58 29 L 0 29 Z" fill="#072652" />
          <path d="M 16 0 L 22 0 Q 42 22 64 29 L 58 29 Z" fill="#f5b800" />
        </svg>
        <FiveSocials handle={handle} isWhiteText={false} hasGoldPipes={false} />
      </div>
      <div className="flex items-center h-full gap-2 relative z-10 shrink-0">
        <span className="font-extrabold text-[#072652] text-[11px]">{brand}</span>
        <span className="text-[#f5b800] font-bold text-[11px]">|</span>
        <PageNum pageNumber={pageNumber} className="font-extrabold text-[#072652] text-[11px] mr-1" />
        <RightCornerWedge variant="gold-navy" />
      </div>
    </div>
  ),
};
