import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import type {
  CanonicalIngestBatchInput,
  CanonicalIngestReport,
} from "@/lib/contracts/ingest-canonical";

export interface IngestClientOptions {
  apiUrl?: string;
  apiKey?: string;
  logDir?: string;
}

/**
 * Client untuk mengirim batch soal kanonik ke API MathBank (POST /api/ingest/questions).
 * Otomatis mencatat butir yang ditolak ke file log lokal di logs/ingest/.
 */
export class IngestClient {
  private apiUrl: string;
  private apiKey?: string;
  private logDir: string;

  constructor(options: IngestClientOptions = {}) {
    this.apiUrl = (
      options.apiUrl ||
      process.env.MATHBANK_API_URL ||
      "http://localhost:3002"
    ).replace(/\/$/, "");
    this.apiKey = options.apiKey || process.env.MATHBANK_API_KEY;
    this.logDir = options.logDir || join(process.cwd(), "logs", "ingest");
  }

  async sendBatch(
    batch: CanonicalIngestBatchInput,
  ): Promise<CanonicalIngestReport> {
    const url = `${this.apiUrl}/api/ingest/questions`;
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      "Idempotency-Key": `ingest-${batch.source.name}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    };

    if (this.apiKey) {
      headers["Authorization"] = `Bearer ${this.apiKey}`;
    }

    const res = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(batch),
    });

    if (!res.ok) {
      const errText = await res.text();
      throw new Error(`Ingest HTTP ${res.status}: ${errText}`);
    }

    const json = (await res.json()) as { data: CanonicalIngestReport };
    const report = json.data;

    // Simpan penolakan ke log lokal jika ada butir yang gagal
    if (report.failures && report.failures.length > 0) {
      const savedPath = await this.saveRejections(
        batch.source.name,
        report.failures,
      );
      console.warn(
        `⚠️ ${report.failures.length} butir ditolak. Rincian disimpan di: ${savedPath}`,
      );
    }

    return report;
  }

  async saveRejections(
    source: string,
    failures: unknown[],
  ): Promise<string> {
    await mkdir(this.logDir, { recursive: true });
    const filename = `${source}-rejected-${Date.now()}.json`;
    const filePath = join(this.logDir, filename);
    await writeFile(filePath, JSON.stringify(failures, null, 2), "utf8");
    return filePath;
  }
}
