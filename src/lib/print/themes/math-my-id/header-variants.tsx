import type { ReactNode } from "react";
import {
  MathMyIdMiLogo,
  MathMyIdMiLogoLight,
  MathMyIdFullLogo,
} from "@/components/bundles/print/bundle-print-icons";
import type { HeaderCode } from "./types";

export interface HeaderVariantProps {
  title: string;
  course?: string | null;
  exerciseLabel?: string;
  durationMinutes?: number | null;
  brand?: string;
  logoStyle?: "mi" | "circle";
  is1Line?: boolean;
}

// ── Shared Sub-Components ──

function BrandLogo({
  logoStyle = "mi",
  isDarkBg = false,
  isCompact = false,
}: {
  logoStyle?: "mi" | "circle";
  isDarkBg?: boolean;
  isCompact?: boolean;
}) {
  if (logoStyle === "circle") {
    const szClass = isCompact ? "size-4" : "size-5";
    return (
      <span
        className={`inline-flex items-center justify-center shrink-0 ${isDarkBg ? "bg-white rounded-full p-0.5" : ""}`}
      >
        <MathMyIdFullLogo className={szClass} />
      </span>
    );
  }
  const logoH = isCompact ? "h-3.5" : "h-[18px]";
  if (isDarkBg) {
    return <MathMyIdMiLogoLight className={`${logoH} w-auto`} />;
  }
  return <MathMyIdMiLogo className={`${logoH} w-auto`} />;
}

function TopicBlock({
  title,
  course,
  is1Line = false,
}: {
  title: string;
  course?: string | null;
  is1Line?: boolean;
}) {
  if (is1Line || !course) {
    return (
      <span className="font-extrabold text-[#072652] text-[11.5px] tracking-tight truncate max-w-[320px] sm:max-w-[420px]">
        {title}
      </span>
    );
  }
  return (
    <div className="flex flex-col justify-center leading-tight truncate max-w-[320px] sm:max-w-[420px]">
      <span className="font-extrabold text-[#072652] text-[11.5px] tracking-tight truncate">
        {title}
      </span>
      <span className="font-medium text-slate-500 text-[9.5px] truncate">
        {course}
      </span>
    </div>
  );
}

function DiagDivider({
  heightPx = 28,
  c1 = "#072652",
  c2 = "#f5b800",
  w1 = 4,
  w2 = 4,
}: {
  heightPx?: number;
  c1?: string;
  c2?: string;
  w1?: number;
  w2?: number;
}) {
  return (
    <span className="inline-flex items-center gap-[3px] mx-3 shrink-0" aria-hidden="true">
      <span
        className="inline-block -skew-x-[28deg]"
        style={{ width: `${w1}px`, height: `${heightPx}px`, backgroundColor: c1 }}
      />
      <span
        className="inline-block -skew-x-[28deg]"
        style={{ width: `${w2}px`, height: `${heightPx}px`, backgroundColor: c2 }}
      />
    </span>
  );
}

function GoldPipe({ heightPx = 22 }: { heightPx?: number }) {
  return (
    <span
      className="inline-block w-[1.5px] mx-3 shrink-0"
      style={{ height: `${heightPx}px`, backgroundColor: "#f5b800" }}
      aria-hidden="true"
    />
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

function RightNavyTrapBlock({ label, hasChevron = false }: { label: string; hasChevron?: boolean }) {
  return (
    <div className="flex items-stretch h-full shrink-0">
      {hasChevron ? (
        <svg className="w-5 h-full -mr-1.5 z-10" viewBox="0 0 20 36" preserveAspectRatio="none" aria-hidden="true">
          <polygon points="4,0 13,0 20,18 13,36 4,36 11,18" fill="#f5b800" />
        </svg>
      ) : (
        <span className="w-[4px] h-full bg-[#f5b800] -skew-x-[26deg] mr-1" aria-hidden="true" />
      )}
      <div
        className="bg-[#072652] pl-6 pr-3.5 flex items-center justify-center h-full"
        style={{ clipPath: "polygon(14% 0, 100% 0, 100% 100%, 0% 100%)" }}
      >
        <span className="px-3 py-0.5 rounded-full border border-slate-400/60 text-white font-bold text-[10px] tracking-tight">
          {label}
        </span>
      </div>
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

const SOFT_BG_STYLE = {
  background: "linear-gradient(90deg, #ffffff 0%, #f4f8fd 55%, #eef5fc 100%)",
};

// ── Icons for Info D-series ──

function DocIcon() {
  return (
    <svg
      className="size-3.5 text-[#072652] inline-block shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="8" y1="13" x2="16" y2="13" />
      <line x1="8" y1="17" x2="13" y2="17" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg
      className="size-3.5 text-[#072652] inline-block shrink-0"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 15" />
    </svg>
  );
}

function LayersIcon() {
  return (
    <svg
      className="size-4 text-[#072652] inline-block shrink-0"
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M11.99 18.54l-7.37-5.73L3 14.07l9 7 9-7-1.63-1.27zM12 16l7.36-5.73L21 9l-9-7-9 7 1.63 1.27L12 16z" />
    </svg>
  );
}

// ── 24 Header Variation Renderers ──

export const HEADER_VARIANTS: Record<
  HeaderCode,
  (props: HeaderVariantProps) => ReactNode
> = {
  // ── A. VARIASI MINIMALIS (CLEAN STRIP) ──
  A1: ({ title, course, exerciseLabel = "Latihan 1", brand = "Math My ID", logoStyle, is1Line }) => {
    const hClass = is1Line ? "h-[30px]" : "h-[38px]";
    const slashH = is1Line ? 30 : 38;
    return (
      <div className={`mmi-strip ${hClass} bg-white border-b border-slate-200 flex items-center justify-between pl-6 pr-0 w-full select-none`}>
        <div className="flex items-center min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <BrandLogo logoStyle={logoStyle} isCompact={is1Line} />
            <span className="font-extrabold text-[#072652] text-[12px]">{brand}</span>
          </div>
          <DiagDivider heightPx={slashH} />
          <TopicBlock title={title} course={course} is1Line={is1Line} />
        </div>
        <div className="flex items-center h-full gap-2 shrink-0">
          {is1Line ? (
            <>
              <span className="text-slate-300">|</span>
              <span className="font-bold text-[#072652] text-[10.5px] mr-1">{exerciseLabel}</span>
            </>
          ) : (
            <span className="px-3.5 py-0.5 rounded-full border border-slate-300 text-[#072652] font-bold text-[10px] mr-1">
              {exerciseLabel}
            </span>
          )}
          <RightCornerWedge variant="gold-navy" />
        </div>
      </div>
    );
  },

  A2: ({ title, course, exerciseLabel = "Latihan 1", brand = "Math My ID", logoStyle, is1Line }) => {
    const hClass = is1Line ? "h-[30px]" : "h-[38px]";
    const slashH = is1Line ? 30 : 38;
    return (
      <div className={`mmi-strip ${hClass} bg-white border-b-[1.8px] border-b-[#072652] flex items-center justify-between pl-6 pr-0 relative w-full select-none`}>
        <span className="absolute left-[38%] right-36 bottom-0 h-[1.8px] bg-[#f5b800]" aria-hidden="true" />
        <div className="flex items-center min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <BrandLogo logoStyle={logoStyle} isCompact={is1Line} />
            <span className="font-extrabold text-[#072652] text-[12px]">{brand}</span>
          </div>
          <DiagDivider heightPx={slashH} />
          <TopicBlock title={title} course={course} is1Line={is1Line} />
        </div>
        <RightNavyTrapBlock label={exerciseLabel} hasChevron={false} />
      </div>
    );
  },

  A3: ({ title, course, exerciseLabel = "Latihan 1", brand = "Math My ID", logoStyle, is1Line }) => {
    const hClass = is1Line ? "h-[30px]" : "h-[38px]";
    const pipeH = is1Line ? 18 : 24;
    return (
      <div className={`mmi-strip ${hClass} bg-white border-b-[1.8px] border-b-[#072652] flex items-center justify-between pl-6 pr-6 w-full select-none`}>
        <div className="flex items-center min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <BrandLogo logoStyle={logoStyle} isCompact={is1Line} />
            <span className="font-extrabold text-[#072652] text-[12px]">{brand}</span>
          </div>
          <GoldPipe heightPx={pipeH} />
          <TopicBlock title={title} course={course} is1Line={is1Line} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="px-3.5 py-0.5 rounded-full border border-[#f5b800] text-[#072652] font-bold text-[10px]">
            {exerciseLabel}
          </span>
        </div>
      </div>
    );
  },

  A4: ({ title, course, exerciseLabel = "Latihan 1", brand = "Math My ID", logoStyle, is1Line }) => {
    const hClass = is1Line ? "h-[30px]" : "h-[38px]";
    const slashH = is1Line ? 30 : 38;
    return (
      <div className={`mmi-strip ${hClass} bg-white border-b border-slate-200 flex items-center justify-between pl-6 pr-0 w-full select-none`}>
        <div className="flex items-center min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <BrandLogo logoStyle={logoStyle} isCompact={is1Line} />
            <span className="font-extrabold text-[#072652] text-[12px]">{brand}</span>
          </div>
          <DiagDivider heightPx={slashH} />
          <TopicBlock title={title} course={course} is1Line={is1Line} />
        </div>
        <div className="flex items-center h-full gap-2.5 shrink-0">
          <span className="font-bold text-[#072652] text-[10.5px]">{exerciseLabel}</span>
          <RightCornerWedge variant="double-gold-slash" />
        </div>
      </div>
    );
  },

  // ── B. VARIASI DENGAN BACKGROUND LEMBUT ──
  B1: ({ title, course, exerciseLabel = "Latihan 1", brand = "Math My ID", logoStyle, is1Line }) => {
    const hClass = is1Line ? "h-[30px]" : "h-[38px]";
    const slashH = is1Line ? 30 : 38;
    return (
      <div
        className={`mmi-strip ${hClass} border-b border-slate-200 flex items-center justify-between pl-6 pr-0 w-full relative select-none`}
        style={SOFT_BG_STYLE}
      >
        <SoftStripWatermark />
        <div className="flex items-center relative z-10 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <BrandLogo logoStyle={logoStyle} isCompact={is1Line} />
            <span className="font-extrabold text-[#072652] text-[12px]">{brand}</span>
          </div>
          <DiagDivider heightPx={slashH} />
          <TopicBlock title={title} course={course} is1Line={is1Line} />
        </div>
        <div className="flex items-center h-full gap-2 relative z-10 shrink-0">
          <span className="px-3.5 py-0.5 rounded-full bg-white border border-[#f5b800] text-[#072652] font-bold text-[10px] mr-1 shadow-xs">
            {exerciseLabel}
          </span>
          <RightCornerWedge variant="gold-navy" />
        </div>
      </div>
    );
  },

  B2: ({ title, course, exerciseLabel = "Latihan 1", brand = "Math My ID", logoStyle, is1Line }) => {
    const hClass = is1Line ? "h-[30px]" : "h-[38px]";
    const slashH = is1Line ? 30 : 38;
    return (
      <div
        className={`mmi-strip ${hClass} border-b-[1.8px] border-b-[#f5b800] flex items-center justify-between pl-6 pr-0 w-full relative select-none`}
        style={SOFT_BG_STYLE}
      >
        <SoftStripWatermark />
        <div className="flex items-center relative z-10 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <BrandLogo logoStyle={logoStyle} isCompact={is1Line} />
            <span className="font-extrabold text-[#072652] text-[12px]">{brand}</span>
          </div>
          <DiagDivider heightPx={slashH} />
          <TopicBlock title={title} course={course} is1Line={is1Line} />
        </div>
        <div className="relative z-10 h-full shrink-0">
          <RightNavyTrapBlock label={exerciseLabel} hasChevron={false} />
        </div>
      </div>
    );
  },

  B3: ({ title, course, exerciseLabel = "Latihan 1", brand = "Math My ID", logoStyle, is1Line }) => {
    const hClass = is1Line ? "h-[30px]" : "h-[38px]";
    const pipeH = is1Line ? 18 : 24;
    return (
      <div
        className={`mmi-strip ${hClass} border-b-[1.8px] border-b-[#072652] flex items-center justify-between pl-6 pr-6 relative w-full select-none`}
        style={SOFT_BG_STYLE}
      >
        <SoftStripWatermark />
        <span className="absolute right-0 bottom-0 w-44 h-[1.8px] bg-[#f5b800]" aria-hidden="true" />
        <div className="flex items-center relative z-10 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <BrandLogo logoStyle={logoStyle} isCompact={is1Line} />
            <span className="font-extrabold text-[#072652] text-[12px]">{brand}</span>
          </div>
          <GoldPipe heightPx={pipeH} />
          <TopicBlock title={title} course={course} is1Line={is1Line} />
        </div>
        <div className="relative z-10 shrink-0">
          <span className="px-3.5 py-0.5 rounded-sm bg-white border border-slate-400 text-[#072652] font-bold text-[10px] shadow-xs">
            {exerciseLabel}
          </span>
        </div>
      </div>
    );
  },

  B4: ({ title, course, exerciseLabel = "Latihan 1", brand = "Math My ID", logoStyle, is1Line }) => {
    const hClass = is1Line ? "h-[30px]" : "h-[38px]";
    const slashH = is1Line ? 30 : 38;
    return (
      <div
        className={`mmi-strip ${hClass} border-b border-slate-200 flex items-center justify-between pl-6 pr-0 w-full relative select-none`}
        style={SOFT_BG_STYLE}
      >
        <SoftStripWatermark />
        <div className="flex items-center relative z-10 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <BrandLogo logoStyle={logoStyle} isCompact={is1Line} />
            <span className="font-extrabold text-[#072652] text-[12px]">{brand}</span>
          </div>
          {is1Line ? <DiagDivider heightPx={slashH} /> : <GoldPipe heightPx={24} />}
          <TopicBlock title={title} course={course} is1Line={is1Line} />
        </div>
        <div className="flex items-center h-full gap-2.5 relative z-10 shrink-0">
          <span className="font-bold text-[#072652] text-[10.5px]">{exerciseLabel}</span>
          <RightCornerWedge variant="double-gold-slash" />
        </div>
      </div>
    );
  },

  // ── C. VARIASI DENGAN BADGE / LABEL ──
  C1: ({ title, course, exerciseLabel = "Latihan 1", brand = "Math My ID", logoStyle, is1Line }) => {
    const hClass = is1Line ? "h-[30px]" : "h-[38px]";
    const slashH = is1Line ? 30 : 38;
    return (
      <div className={`mmi-strip ${hClass} bg-white border-b border-slate-200 flex items-center justify-between pl-6 pr-6 w-full select-none`}>
        <div className="flex items-center min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <BrandLogo logoStyle={logoStyle} isCompact={is1Line} />
            <span className="font-extrabold text-[#072652] text-[12px]">{brand}</span>
          </div>
          <DiagDivider heightPx={slashH} />
          <TopicBlock title={title} course={course} is1Line={is1Line} />
        </div>
        <span className="px-4 py-1 rounded-full bg-[#f5b800] text-[#072652] font-extrabold text-[10px] shadow-xs shrink-0">
          {exerciseLabel}
        </span>
      </div>
    );
  },

  C2: ({ title, course, exerciseLabel = "Latihan 1", brand = "Math My ID", logoStyle, is1Line }) => {
    const hClass = is1Line ? "h-[30px]" : "h-[38px]";
    const slashH = is1Line ? 30 : 38;
    return (
      <div className={`mmi-strip ${hClass} bg-white border-b border-slate-200 flex items-center justify-between pl-6 pr-0 w-full select-none`}>
        <div className="flex items-center min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <BrandLogo logoStyle={logoStyle} isCompact={is1Line} />
            <span className="font-extrabold text-[#072652] text-[12px]">{brand}</span>
          </div>
          <DiagDivider heightPx={slashH} />
          <TopicBlock title={title} course={course} is1Line={is1Line} />
        </div>
        <RightNavyTrapBlock label={exerciseLabel} hasChevron={true} />
      </div>
    );
  },

  C3: ({ title, course, exerciseLabel = "Latihan 1", brand = "Math My ID", logoStyle, is1Line }) => {
    const hClass = is1Line ? "h-[30px]" : "h-[38px]";
    const slashH = is1Line ? 30 : 38;
    return (
      <div
        className={`mmi-strip ${hClass} border-b border-slate-200 flex items-center justify-between pl-6 pr-6 w-full relative select-none`}
        style={SOFT_BG_STYLE}
      >
        <SoftStripWatermark />
        <div className="flex items-center relative z-10 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <BrandLogo logoStyle={logoStyle} isCompact={is1Line} />
            <span className="font-extrabold text-[#072652] text-[12px]">{brand}</span>
          </div>
          <DiagDivider heightPx={slashH} />
          <TopicBlock title={title} course={course} is1Line={is1Line} />
        </div>
        <span className="relative z-10 px-3.5 py-0.5 rounded-sm bg-white border border-[#072652]/60 text-[#072652] font-bold text-[10px] shadow-xs shrink-0">
          {exerciseLabel}
        </span>
      </div>
    );
  },

  C4: ({ title, course, exerciseLabel = "Latihan 1", brand = "Math My ID", logoStyle, is1Line }) => {
    const hClass = is1Line ? "h-[30px]" : "h-[38px]";
    const slashH = is1Line ? 30 : 38;
    return (
      <div
        className={`mmi-strip ${hClass} border-b-[1.8px] border-b-[#f5b800] flex items-center justify-between pl-6 pr-0 w-full relative select-none`}
        style={SOFT_BG_STYLE}
      >
        <SoftStripWatermark />
        <div className="flex items-center relative z-10 min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <BrandLogo logoStyle={logoStyle} isCompact={is1Line} />
            <span className="font-extrabold text-[#072652] text-[12px]">{brand}</span>
          </div>
          <DiagDivider heightPx={slashH} />
          <TopicBlock title={title} course={course} is1Line={is1Line} />
        </div>
        <div className="relative z-10 h-full shrink-0">
          <RightNavyTrapBlock label={exerciseLabel} hasChevron={false} />
        </div>
      </div>
    );
  },

  // ── D. VARIASI DENGAN INFORMASI TAMBAHAN ──
  D1: ({ title, course, exerciseLabel = "Latihan 1", brand = "Math My ID", logoStyle, is1Line }) => {
    const hClass = is1Line ? "h-[30px]" : "h-[38px]";
    const slashH = is1Line ? 30 : 38;
    return (
      <div className={`mmi-strip ${hClass} bg-white border-b border-slate-200 flex items-center justify-between pl-6 pr-0 w-full select-none`}>
        <div className="flex items-center min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <BrandLogo logoStyle={logoStyle} isCompact={is1Line} />
            <span className="font-extrabold text-[#072652] text-[12px]">{brand}</span>
          </div>
          <DiagDivider heightPx={slashH} />
          <TopicBlock title={title} course={course} is1Line={is1Line} />
        </div>
        <div className="flex items-center h-full gap-3 shrink-0">
          <span className="text-slate-300">|</span>
          <span className="inline-flex items-center gap-1.5 font-bold text-[#072652] text-[10.5px] mr-2">
            <DocIcon />
            <span>{exerciseLabel}</span>
          </span>
          <RightCornerWedge variant="gold-navy" />
        </div>
      </div>
    );
  },

  D2: ({ title, course, exerciseLabel = "Latihan 1", brand = "Math My ID", logoStyle, is1Line }) => {
    const hClass = is1Line ? "h-[30px]" : "h-[38px]";
    const pipeH = is1Line ? 18 : 24;
    return (
      <div className={`mmi-strip ${hClass} bg-white border-b border-slate-200 flex items-center justify-between pl-6 pr-0 w-full select-none`}>
        <div className="flex items-center min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <BrandLogo logoStyle={logoStyle} isCompact={is1Line} />
            <span className="font-extrabold text-[#072652] text-[12px]">{brand}</span>
          </div>
          <GoldPipe heightPx={pipeH} />
          <TopicBlock title={title} course={course} is1Line={is1Line} />
        </div>
        <div className="flex items-center h-full gap-3 shrink-0">
          <span className="text-slate-300">|</span>
          <span className="inline-flex items-center gap-1.5 font-bold text-[#072652] text-[10.5px] mr-2">
            <DocIcon />
            <span>{exerciseLabel}</span>
          </span>
          <RightCornerWedge variant="gold-navy" />
        </div>
      </div>
    );
  },

  D3: ({ title, course, exerciseLabel = "Latihan 1", brand = "Math My ID", logoStyle, is1Line }) => {
    const hClass = is1Line ? "h-[30px]" : "h-[38px]";
    const pipeH = is1Line ? 18 : 24;
    return (
      <div className={`mmi-strip ${hClass} bg-white border-b border-slate-200 flex items-center justify-between pl-6 pr-6 w-full select-none`}>
        <div className="flex items-center min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <BrandLogo logoStyle={logoStyle} isCompact={is1Line} />
            <span className="font-extrabold text-[#072652] text-[12px]">{brand}</span>
          </div>
          <GoldPipe heightPx={pipeH} />
          <TopicBlock title={title} course={course} is1Line={is1Line} />
        </div>
        <div className="flex items-center gap-3 text-[10px] font-bold text-[#072652] shrink-0">
          <span className="text-slate-300">|</span>
          <span className="inline-flex items-center gap-1.5">
            <DocIcon />
            <span>{exerciseLabel}</span>
          </span>
          {course && (
            <>
              <span className="text-slate-300">|</span>
              <span className="inline-flex items-center gap-1.5 leading-tight">
                <LayersIcon />
                <span>{course}</span>
              </span>
            </>
          )}
        </div>
      </div>
    );
  },

  D4: ({ title, course, exerciseLabel = "Latihan 1", durationMinutes = 60, brand = "Math My ID", logoStyle, is1Line }) => {
    const hClass = is1Line ? "h-[30px]" : "h-[38px]";
    const durationLabel = durationMinutes ? `${durationMinutes} menit` : "60 menit";
    return (
      <div className={`mmi-strip ${hClass} bg-white border-b border-slate-200 flex items-center justify-between pr-0 w-full select-none`}>
        <div className="flex items-center h-full min-w-0">
          <div
            className="bg-[#072652] text-white h-full pl-6 pr-6 flex items-center gap-2 shrink-0"
            style={{ clipPath: "polygon(0 0, 89% 0, 100% 100%, 0% 100%)" }}
          >
            <BrandLogo logoStyle={logoStyle} isDarkBg={true} isCompact={is1Line} />
            <span className="font-extrabold text-[12px] tracking-tight">{brand}</span>
          </div>
          <span className="w-[4.5px] h-full bg-[#f5b800] -skew-x-[24deg] -ml-1.5 mr-3 shrink-0" aria-hidden="true" />
          <TopicBlock title={title} course={course} is1Line={is1Line} />
        </div>
        <div className="flex items-center h-full gap-3 shrink-0">
          <span className="text-slate-300">|</span>
          <span className="inline-flex items-center gap-1 font-bold text-[#072652] text-[10px]">
            <DocIcon />
            <span>{exerciseLabel}</span>
          </span>
          <span className="text-slate-300">|</span>
          <span className="inline-flex items-center gap-1 font-bold text-[#072652] text-[10px] mr-1">
            <ClockIcon />
            <span>{durationLabel}</span>
          </span>
          <RightCornerWedge variant="gold-navy" />
        </div>
      </div>
    );
  },

  // ── E. VARIASI ELEGAN (LEBIH EKSPRESIF) ──
  E1: ({ title, course, exerciseLabel = "Latihan 1", brand = "Math My ID", logoStyle, is1Line }) => {
    const hClass = is1Line ? "h-[30px]" : "h-[38px]";
    return (
      <div
        className={`mmi-strip ${hClass} border-b border-slate-200 flex items-center justify-between pl-6 pr-0 w-full relative select-none`}
        style={SOFT_BG_STYLE}
      >
        <SoftStripWatermark />
        <div className="flex items-center h-full relative z-10 min-w-0">
          <div className="flex items-center gap-2 pr-3 shrink-0">
            <BrandLogo logoStyle={logoStyle} isCompact={is1Line} />
            <span className="font-extrabold text-[#072652] text-[12px]">{brand}</span>
          </div>
          <svg className="w-16 h-full shrink-0 mr-2" viewBox="0 0 64 36" preserveAspectRatio="none" aria-hidden="true">
            <path d="M 0 36 Q 18 32 32 0 L 52 0 L 28 36 Z" fill="#072652" />
            <path d="M 55 0 L 62 0 L 38 36 L 31 36 Z" fill="#f5b800" />
          </svg>
          <TopicBlock title={title} course={course} is1Line={is1Line} />
        </div>
        <div className="flex items-center h-full gap-2 relative z-10 shrink-0">
          <span className="px-3.5 py-0.5 rounded-full bg-white border border-[#f5b800] text-[#072652] font-bold text-[10px] mr-1 shadow-xs">
            {exerciseLabel}
          </span>
          <RightCornerWedge variant="gold-navy" />
        </div>
      </div>
    );
  },

  E2: ({ title, course, exerciseLabel = "Latihan 1", brand = "Math My ID", logoStyle, is1Line }) => {
    const hClass = is1Line ? "h-[30px]" : "h-[38px]";
    const pipeH = is1Line ? 18 : 24;
    return (
      <div className={`mmi-strip ${hClass} bg-white border-b border-slate-200 flex items-center justify-between pr-6 relative w-full select-none`}>
        <div className="flex items-center h-full min-w-0">
          <svg className="w-20 h-full shrink-0 mr-2" viewBox="0 0 80 36" preserveAspectRatio="none" aria-hidden="true">
            <path d="M 0 0 L 18 0 Q 45 26 72 36 L 0 36 Z" fill="#072652" />
            <path d="M 20 0 L 28 0 Q 54 26 80 36 L 73 36 Q 46 26 20 0 Z" fill="#f5b800" />
          </svg>
          <div className="flex items-center gap-2 shrink-0">
            <BrandLogo logoStyle={logoStyle} isCompact={is1Line} />
            <span className="font-extrabold text-[#072652] text-[12px]">{brand}</span>
          </div>
          <GoldPipe heightPx={pipeH} />
          <TopicBlock title={title} course={course} is1Line={is1Line} />
        </div>
        <svg className="absolute right-0 bottom-0 w-64 h-3 pointer-events-none" viewBox="0 0 240 12" preserveAspectRatio="none" aria-hidden="true">
          <path d="M 0 12 Q 80 2 160 9 T 240 0 L 240 12 Z" fill="#072652" />
        </svg>
        <span className="relative z-10 px-3.5 py-0.5 rounded-full bg-white border border-[#072652] text-[#072652] font-bold text-[10px] shadow-xs shrink-0">
          {exerciseLabel}
        </span>
      </div>
    );
  },

  E3: ({ title, course, exerciseLabel = "Latihan 1", brand = "Math My ID", logoStyle, is1Line }) => {
    const hClass = is1Line ? "h-[30px]" : "h-[38px]";
    const pipeH = is1Line ? 18 : 24;
    return (
      <div className={`mmi-strip ${hClass} bg-white border-b border-slate-200 flex items-center justify-between pl-6 pr-0 w-full select-none`}>
        <div className="flex items-center min-w-0">
          <div className="flex items-center gap-2 shrink-0">
            <BrandLogo logoStyle={logoStyle} isCompact={is1Line} />
            <span className="font-extrabold text-[#072652] text-[12px]">{brand}</span>
          </div>
          <GoldPipe heightPx={pipeH} />
          <TopicBlock title={title} course={course} is1Line={is1Line} />
        </div>
        <RightNavyTrapBlock label={exerciseLabel} hasChevron={false} />
      </div>
    );
  },

  E4: ({ title, course, exerciseLabel = "Latihan 1", brand = "Math My ID", logoStyle, is1Line }) => {
    const hClass = is1Line ? "h-[30px]" : "h-[38px]";
    const pipeH = is1Line ? 18 : 24;
    return (
      <div className={`mmi-strip ${hClass} bg-white border-b border-slate-200 flex items-center justify-between pr-0 w-full select-none`}>
        <div className="flex items-center h-full min-w-0">
          <svg className="w-20 h-full shrink-0 mr-2" viewBox="0 0 80 36" preserveAspectRatio="none" aria-hidden="true">
            <path d="M 0 0 L 22 0 Q 48 16 72 36 L 0 36 Z" fill="#072652" />
            <path d="M 24 0 L 31 0 Q 56 16 80 36 L 73 36 Z" fill="#f5b800" />
          </svg>
          <div className="flex items-center gap-2 shrink-0">
            <BrandLogo logoStyle={logoStyle} isCompact={is1Line} />
            <span className="font-extrabold text-[#072652] text-[12px]">{brand}</span>
          </div>
          <GoldPipe heightPx={pipeH} />
          <TopicBlock title={title} course={course} is1Line={is1Line} />
        </div>
        <div className="flex items-center h-full gap-2.5 shrink-0">
          <span className="w-[1.5px] h-4 bg-[#f5b800]" aria-hidden="true" />
          <span className="font-bold text-[#072652] text-[10.5px] mr-1">{exerciseLabel}</span>
          <RightCornerWedge variant="gold-navy" />
        </div>
      </div>
    );
  },

  // ── F. VARIASI ULTRA COMPACT (MINIM RUANG) ──
  F1: ({ title, exerciseLabel = "Latihan 1", brand = "Math My ID", logoStyle }) => {
    return (
      <div className="mmi-strip h-[28px] bg-white border-b border-slate-200 flex items-center justify-between pl-6 pr-0 w-full select-none">
        <div className="flex items-center min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <BrandLogo logoStyle={logoStyle} isCompact={true} />
            <span className="font-extrabold text-[#072652] text-[11.5px]">{brand}</span>
          </div>
          <DiagDivider heightPx={28} c1="#072652" c2="#f5b800" w1={3.5} w2={3.5} />
          <TopicBlock title={title} is1Line={true} />
        </div>
        <div className="flex items-center h-full gap-2.5 shrink-0">
          <span className="text-slate-300">|</span>
          <span className="font-bold text-[#072652] text-[10.5px] mr-1">{exerciseLabel}</span>
          <RightCornerWedge variant="double-gold-slash" />
        </div>
      </div>
    );
  },

  F2: ({ title, exerciseLabel = "Latihan 1", brand = "Math My ID", logoStyle }) => {
    return (
      <div className="mmi-strip h-[28px] bg-white border-b border-slate-200 flex items-center justify-between pl-6 pr-6 w-full select-none">
        <div className="flex items-center min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <BrandLogo logoStyle={logoStyle} isCompact={true} />
            <span className="font-extrabold text-[#072652] text-[11.5px]">{brand}</span>
          </div>
          <DiagDivider heightPx={28} c1="#072652" c2="#f5b800" w1={3.5} w2={3.5} />
          <TopicBlock title={title} is1Line={true} />
        </div>
        <div className="flex items-center gap-2.5 shrink-0">
          <span className="text-slate-300">|</span>
          <span className="font-bold text-[#072652] text-[10.5px]">{exerciseLabel}</span>
        </div>
      </div>
    );
  },

  F3: ({ title, exerciseLabel = "Latihan 1", brand = "Math My ID", logoStyle }) => {
    return (
      <div className="mmi-strip h-[28px] bg-white border-b border-slate-200 flex items-center justify-between pl-6 pr-6 w-full select-none">
        <div className="flex items-center min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <BrandLogo logoStyle={logoStyle} isCompact={true} />
            <span className="font-extrabold text-[#072652] text-[11.5px]">{brand}</span>
          </div>
          <span className="text-slate-300 mx-3">|</span>
          <TopicBlock title={title} is1Line={true} />
        </div>
        <div className="flex items-center h-full gap-2 shrink-0">
          <DiagDivider heightPx={28} c1="#072652" c2="#f5b800" w1={3.5} w2={3.5} />
          <span className="font-bold text-[#072652] text-[10.5px]">{exerciseLabel}</span>
        </div>
      </div>
    );
  },

  F4: ({ title, exerciseLabel = "Latihan 1", brand = "Math My ID", logoStyle }) => {
    return (
      <div className="mmi-strip h-[28px] bg-white border-b border-slate-200 flex items-center justify-between pl-6 pr-6 w-full select-none">
        <div className="flex items-center min-w-0">
          <div className="flex items-center gap-1.5 shrink-0">
            <BrandLogo logoStyle={logoStyle} isCompact={true} />
            <span className="font-extrabold text-[#072652] text-[11.5px]">{brand}</span>
          </div>
          <span className="text-slate-300 mx-3">|</span>
          <TopicBlock title={title} is1Line={true} />
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-slate-300">|</span>
          <span className="inline-flex items-center gap-1 font-bold text-[#072652] text-[10.5px]">
            <DocIcon />
            <span>{exerciseLabel}</span>
          </span>
        </div>
      </div>
    );
  },
};
