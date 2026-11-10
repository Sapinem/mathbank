import type { PrintTheme } from "../types";
import { FormalExamKop } from "./kop";
import { FormalExamHeader } from "./header";
import { FormalExamFooter } from "./footer";
import { FormalExamOptions } from "./options";

export const formalExamTheme: PrintTheme = {
  id: "formal-exam",
  name: "Ujian Formal (Sekolah/Madrasah)",
  description: "Format ujian formal dengan kop dinas resmi, kolom nomor peserta, dan opsi tanda tangan pengawas.",
  Kop: FormalExamKop,
  Header: FormalExamHeader,
  Footer: FormalExamFooter,
  renderOptions: FormalExamOptions,
  defaultOptions: {
    showSupervisorSignature: false,
    examTypeTitle: "",
  },
};
