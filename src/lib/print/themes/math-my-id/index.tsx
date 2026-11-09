import type { PrintTheme } from "../types";
import { MathMyIdKop } from "./kop";
import { MathMyIdHeader } from "./header";
import { MathMyIdFooter } from "./footer";
import { MathMyIdOptions } from "./options";

export const mathMyIdTheme: PrintTheme = {
  id: "math-my-id",
  name: "Standar MathBank",
  description: "Tata letak naskah resmi Math My ID dengan 24 variasi header A1–F4 dan 32 variasi footer F1–G16.",
  Kop: MathMyIdKop,
  Header: MathMyIdHeader,
  Footer: MathMyIdFooter,
  renderOptions: MathMyIdOptions,
  defaultOptions: {
    headerCode: "A1",
    footerCode: "F1",
    logoStyle: "mi",
    runningHeader: true,
    watermarkOpacity: 0.08,
  },
};
