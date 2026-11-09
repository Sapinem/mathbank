export type HeaderCode =
  | "A1" | "A2" | "A3" | "A4"
  | "B1" | "B2" | "B3" | "B4"
  | "C1" | "C2" | "C3" | "C4"
  | "D1" | "D2" | "D3" | "D4"
  | "E1" | "E2" | "E3" | "E4"
  | "F1" | "F2" | "F3" | "F4";

export type FooterCode =
  | "F1" | "F2" | "F3" | "F4" | "F5" | "F6" | "F7" | "F8"
  | "F9" | "F10" | "F11" | "F12" | "F13" | "F14" | "F15" | "F16"
  | "G1" | "G2" | "G3" | "G4" | "G5" | "G6" | "G7" | "G8"
  | "G9" | "G10" | "G11" | "G12" | "G13" | "G14" | "G15" | "G16";

export interface HeaderGroup {
  id: string;
  title: string;
  description: string;
  codes: HeaderCode[];
}

export interface FooterGroup {
  id: string;
  title: string;
  description: string;
  codes: FooterCode[];
}

export interface MathMyIdThemeOptions {
  headerCode?: HeaderCode | string;
  footerCode?: FooterCode | string;
  runningHeader?: boolean;
  logoStyle?: "mi" | "circle";
  watermarkOpacity?: number;
  durationMinutes?: number | null;
  exerciseLabel?: string;
  course?: string;
  is1Line?: boolean;
  pageNumber?: number | string;
}

export const HEADER_CODES: HeaderCode[] = [
  "A1", "A2", "A3", "A4",
  "B1", "B2", "B3", "B4",
  "C1", "C2", "C3", "C4",
  "D1", "D2", "D3", "D4",
  "E1", "E2", "E3", "E4",
  "F1", "F2", "F3", "F4",
];

export const FOOTER_CODES: FooterCode[] = [
  "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8",
  "F9", "F10", "F11", "F12", "F13", "F14", "F15", "F16",
  "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8",
  "G9", "G10", "G11", "G12", "G13", "G14", "G15", "G16",
];

export const HEADER_GROUPS: HeaderGroup[] = [
  {
    id: "A",
    title: "A. Variasi Minimalis (Clean Strip)",
    description: "Desain strip bersih dan presisi dengan aksen baji, garis, dan trapezoid navy-emas.",
    codes: ["A1", "A2", "A3", "A4"],
  },
  {
    id: "B",
    title: "B. Variasi dengan Background Lembut",
    description: "Strip dengan gradien halus dan watermark arch tersembunyi yang elegan.",
    codes: ["B1", "B2", "B3", "B4"],
  },
  {
    id: "C",
    title: "C. Variasi dengan Badge / Label",
    description: "Aksen badge rounded pill, outline emas, atau label gelap pada topik/mapel.",
    codes: ["C1", "C2", "C3", "C4"],
  },
  {
    id: "D",
    title: "D. Variasi dengan Informasi Tambahan",
    description: "Menyertakan durasi ujian, alokasi waktu, atau instruksi ringkas pengerjaan.",
    codes: ["D1", "D2", "D3", "D4"],
  },
  {
    id: "E",
    title: "E. Variasi Elegan (Lebih Ekspresif)",
    description: "Sentuhan ornamen geometris ganda, blok aksen warna penuh, dan strip tebal.",
    codes: ["E1", "E2", "E3", "E4"],
  },
  {
    id: "F",
    title: "F. Variasi Ultra Compact",
    description: "Header setinggi 28–30px (5–6mm) untuk efisiensi ruang butir soal maksimal.",
    codes: ["F1", "F2", "F3", "F4"],
  },
];

export const FOOTER_GROUPS: FooterGroup[] = [
  {
    id: "F",
    title: "Seri F — Clean Minimalist (F1–F16)",
    description: "Garis pembatas halus dengan penomoran halaman dinamis dan tautan media sosial Math My ID.",
    codes: [
      "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8",
      "F9", "F10", "F11", "F12", "F13", "F14", "F15", "F16",
    ],
  },
  {
    id: "G",
    title: "Seri G — Decorative / Aksen Geometris (G1–G16)",
    description: "Footer bergaya modern dengan badge chevron, sudut baji miring emas-navy, dan aksen strip penuh.",
    codes: [
      "G1", "G2", "G3", "G4", "G5", "G6", "G7", "G8",
      "G9", "G10", "G11", "G12", "G13", "G14", "G15", "G16",
    ],
  },
];
