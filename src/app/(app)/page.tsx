import Link from "next/link";
import {
  BookOpen,
  ClipboardCheck,
  Flag,
  Package,
  Database,
  ArrowRight,
} from "lucide-react";
import { PageHeader } from "@/components/layout/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const STATS = [
  { label: "Total Soal", value: "0", icon: BookOpen },
  { label: "Siap", value: "0", icon: ClipboardCheck },
  { label: "Perlu Telaah", value: "0", icon: ClipboardCheck },
  { label: "Ditandai", value: "0", icon: Flag },
  { label: "Paket Soal", value: "0", icon: Package },
  { label: "Sumber", value: "0", icon: Database },
];

export default function DashboardPage() {
  return (
    <>
      <PageHeader
        title="Dasbor"
        description="Ringkasan bank soal, kurasi, dan aktivitas terbaru."
      />
      <div className="space-y-6 p-6">
        {/* Statistik */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {STATS.map((s) => {
            const Icon = s.icon;
            return (
              <Card key={s.label} className="gap-2 py-4">
                <CardContent className="flex items-center gap-3 px-4">
                  <Icon className="size-5 text-muted-foreground" />
                  <div>
                    <div className="text-2xl font-semibold tracking-tight">
                      {s.value}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {s.label}
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Antrean telaah */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex-row items-center justify-between">
              <CardTitle>Aktivitas Terbaru</CardTitle>
              <Link
                href="/bank-soal"
                className="flex items-center gap-1 text-sm text-brand hover:underline"
              >
                Bank Soal <ArrowRight className="size-3.5" />
              </Link>
            </CardHeader>
            <CardContent>
              <p className="py-8 text-center text-sm text-muted-foreground">
                Belum ada aktivitas. Mulai dengan menambah soal di{" "}
                <Link href="/bank-soal" className="text-brand hover:underline">
                  Bank Soal
                </Link>
                .
              </p>
            </CardContent>
          </Card>

          {/* Antrean */}
          <Card>
            <CardHeader>
              <CardTitle>Antrean Kurasi</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <QueueRow label="Perlu telaah" href="/telaah" value={0} />
              <QueueRow label="Ditandai" href="/telaah" value={0} />
              <QueueRow label="Tanpa topik" href="/telaah" value={0} />
              <div className="pt-2">
                <Badge variant="secondary" className="text-xs">
                  Semua bersih ✓
                </Badge>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Distribusi */}
        <div className="grid gap-6 lg:grid-cols-3">
          <DistCard title="Topik Teratas" />
          <DistCard title="Sebaran Kesulitan" />
          <DistCard title="Sebaran Jenjang" />
        </div>
      </div>
    </>
  );
}

function QueueRow({
  label,
  href,
  value,
}: {
  label: string;
  href: string;
  value: number;
}) {
  return (
    <Link
      href={href}
      className="flex items-center justify-between rounded-md px-2 py-1.5 hover:bg-muted"
    >
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </Link>
  );
}

function DistCard({ title }: { title: string }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="py-6 text-center text-sm text-muted-foreground">
          Belum ada data.
        </p>
      </CardContent>
    </Card>
  );
}
