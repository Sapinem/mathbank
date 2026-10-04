# UX Improvements Gelombang 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Menuntaskan cacat UX kritis integritas data dan keamanan interaksi pada MathBank: melestarikan catatan penelaah saat penolakan soal ([CRIT-01]), mengeliminasi tautan 404 profil pengguna ([CRIT-02]), dan menambahkan dialog konfirmasi proteksi aksi merusak massal & butir paket ([CRIT-04]).

**Architecture:** Memperluas kontrak transisi status FSM dengan field `notes`, meneruskan payload ke database `questions.flag_notes` dan `audit_logs`, memperbarui menu dropdown pengguna ke rute yang valid (`/change-password`), serta memasang `Dialog` konfirmasi Base UI/shadcn sebelum mutasi destruktif di Bank Soal dan Bundle Builder.

**Tech Stack:** Next.js 16 (App Router), React 19, Drizzle ORM, Zod, TanStack React Query, Base UI / shadcn/ui.

**Spec:** [`docs/superpowers/specs/2026-10-04-ux-improvements-gelombang-1-design.md`](file:///home/hari/projects/mathbank/docs/superpowers/specs/2026-10-04-ux-improvements-gelombang-1-design.md)

## Global Constraints

- Zero type errors (`pnpm typecheck` wajib exit 0).
- Zero lint errors (`pnpm lint` wajib exit 0).
- Coverage ≥ 85% statements pada file logika yang diskop (`pnpm test:coverage`).
- Dilarang `useMemo`/`useCallback` di luar vendor `src/components/ui/` (CONSTRAINTS #6).
- Dilarang `space-y-*` — wajib `flex flex-col gap-*` (CONSTRAINTS #7).
- Dilarang manual `z-index` (CONSTRAINTS #8).
- Bahasa komentar & UI: Indonesia; identifier teknis & nama rute: Inggris (CONSTRAINTS #28 & #28b).

---

### Task 1: Kontrak, Route & Service Layer Pelestarian Catatan Penolakan ([CRIT-01] Backend)

**Files:**
- Modify: `src/lib/contracts/question.ts:180-184`
- Modify: `src/app/api/questions/[id]/status/route.ts:15-21`
- Modify: `src/lib/services/question-status.ts:18-76`
- Test: `src/lib/services/question-service.db.test.ts`

**Interfaces:**
- Consumes: `Actor` dari `@/lib/auth/actor`, `QuestionStatus` dari `@/lib/fsm/question-fsm`.
- Produces: `changeQuestionStatus(id: string, to: QuestionStatus, actor: Actor, notes?: string | null): Promise<PublicQuestion>` dan `changeStatusSchema` dengan field `notes`.

- [ ] **Step 1: Tulis tes integrasi database yang gagal**

Di `src/lib/services/question-service.db.test.ts`, tambahkan blok tes untuk memverifikasi penyimpanan catatan penolakan:

```typescript
it("menyimpan catatan penolakan pada flag_notes dan audit_logs saat tolak ke draft", async () => {
  const q = await createQuestion(sampleQuestion({ status: "review" }), teacher);
  const rejectNotes = "Kunci jawaban salah pada opsi C, perbaiki pembahasannya.";
  
  const rejected = await changeQuestionStatus(q.id, "draft", reviewer, rejectNotes);

  expect(rejected.status).toBe("draft");
  expect(rejected.flagNotes).toBe(rejectNotes);

  // Verifikasi tabel audit_logs mencatat catatan penolakan
  const audits = await db
    .select()
    .from(auditLogs)
    .where(eq(auditLogs.entityId, q.id));
  const statusAudit = audits.find((a) => a.action === "status_change");
  expect(statusAudit?.changeSummary).toContain(rejectNotes);
});
```

- [ ] **Step 2: Jalankan tes untuk memastikan gagal**

Jalankan: `pnpm vitest run src/lib/services/question-service.db.test.ts -t "menyimpan catatan penolakan"`  
Ekspektasi: Gagal karena `changeQuestionStatus` belum menerima dan menyimpan `notes`.

- [ ] **Step 3: Implementasikan pembaruan kontrak, route, dan service**

1. Di `src/lib/contracts/question.ts`:
```typescript
export const changeStatusSchema = z.object({
  status: questionStatusSchema,
  notes: z.string().max(1000).nullable().optional(),
});
```

2. Di `src/app/api/questions/[id]/status/route.ts`:
```typescript
export const PATCH = wrapRoute({
  rateLimit: { capacity: 30, refillPerSec: 1 },
  body: changeStatusSchema,
  handler: async ({ params, body, actor }) =>
    changeQuestionStatus(params.id, body.status, actor, body.notes),
});
```

3. Di `src/lib/services/question-status.ts`:
```typescript
export async function changeQuestionStatus(
  id: string,
  to: QuestionStatus,
  actor: Actor,
  notes?: string | null,
): Promise<PublicQuestion> {
  const existing = await getQuestionInternal(id);
  if (!existing) throw new NotFoundError("Soal tidak ditemukan.");

  const from = existing.status as QuestionStatus;
  if (from === to) return existing;

  transition(from, to);

  if (to === "ready") {
    assertCan(actor, "question:setReady");
    assertReady({
      questionType: existing.questionType,
      answerKey: existing.answerKey,
    });
  } else if (to === "archived") {
    assertCan(actor, "question:archive");
  } else {
    assertCan(actor, "question:edit", { ownerId: existing.authorId });
  }

  const updated_rows = await db
    .update(questions)
    .set({
      status: to,
      lastReviewedAt: to === "ready" ? new Date() : existing.lastReviewedAt,
      ...(notes !== undefined ? { flagNotes: notes } : {}),
    })
    .where(and(eq(questions.id, id), eq(questions.status, from)))
    .returning({ id: questions.id });

  if (updated_rows.length === 0) {
    throw new ConflictError(
      "Status soal sudah berubah oleh permintaan lain. Muat ulang lalu coba lagi.",
    );
  }

  await recordAudit({
    entityType: "question",
    entityId: id,
    action: "status_change",
    actor,
    changeSummary: notes
      ? `Status ${from} → ${to}: ${notes}`
      : `Status ${from} → ${to}`,
  });

  const updated = await getQuestion(id, { viewer: actor });
  if (!updated) throw new NotFoundError();
  return updated;
}
```

- [ ] **Step 4: Jalankan tes untuk memastikan lulus**

Jalankan: `pnpm vitest run src/lib/services/question-service.db.test.ts -t "menyimpan catatan penolakan"`  
Ekspektasi: LULUS (PASS).

- [ ] **Step 5: Commit perubahan**

```bash
git add src/lib/contracts/question.ts src/app/api/questions/\[id\]/status/route.ts src/lib/services/question-status.ts src/lib/services/question-service.db.test.ts
git commit -m "fix(service): simpan catatan penolakan pada flag_notes dan audit trail (CRIT-01)"
```

---

### Task 2: Hook Klien & Integrasi Dialog Antrean Telaah ([CRIT-01] Frontend)

**Files:**
- Modify: `src/lib/hooks/use-questions.ts:100-111`
- Modify: `src/components/questions/review-view.tsx:350-375`

**Interfaces:**
- Consumes: `useChangeQuestionStatus` dengan signature baru.
- Produces: UI penolakan di `ReviewRow` yang mengirim catatan penelaah ke backend.

- [ ] **Step 1: Perbarui hook `useChangeQuestionStatus`**

Di `src/lib/hooks/use-questions.ts`:
```typescript
export type ChangeStatusInput =
  | QuestionStatus
  | { status: QuestionStatus; notes?: string | null };

export function useChangeQuestionStatus(id: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: ChangeStatusInput) => {
      const body = typeof input === "string" ? { status: input } : input;
      return apiFetch<PublicQuestion>(`/api/questions/${id}/status`, {
        method: "PATCH",
        body: JSON.stringify(body),
      });
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: questionKeys.all }),
  });
}
```

- [ ] **Step 2: Sambungkan `notes` di dialog penolakan `ReviewRow`**

Di `src/components/questions/review-view.tsx`:
```tsx
<Dialog open={rejectOpen} onOpenChange={setRejectOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Tolak soal ini?</DialogTitle>
      <DialogDescription>
        Soal dikembalikan ke <strong>Draf</strong> agar penyusun memperbaiki.
      </DialogDescription>
    </DialogHeader>
    <Textarea
      value={notes}
      onChange={(e) => setNotes(e.target.value)}
      placeholder="Catatan untuk penyusun (opsional)…"
      rows={3}
      aria-label="Catatan penolakan"
    />
    <DialogFooter>
      <Button variant="outline" onClick={() => setRejectOpen(false)}>
        Batal
      </Button>
      <Button
        variant="destructive"
        disabled={status.isPending}
        onClick={() => {
          status.mutate(
            { status: "draft", notes: notes.trim() || null },
            {
              onSuccess: () => {
                setRejectOpen(false);
                setNotes("");
              },
            },
          );
        }}
      >
        Tolak ke Draf
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 3: Jalankan typecheck & unit test**

Jalankan: `pnpm typecheck && pnpm vitest run src/components/questions/review-view.rapid.test.tsx`  
Ekspektasi: Exit code 0.

- [ ] **Step 4: Commit perubahan**

```bash
git add src/lib/hooks/use-questions.ts src/components/questions/review-view.tsx
git commit -m "fix(ui): teruskan catatan penelaah dari dialog tolak ke mutasi (CRIT-01)"
```

---

### Task 3: Eliminasi Dead Link 404 Profil di Menu Pengguna ([CRIT-02])

**Files:**
- Modify: `src/components/layout/sidebar-user.tsx:90-96`
- Modify/Test: `src/components/layout/sidebar-user.test.tsx`

**Interfaces:**
- Consumes: `<KeyRound>` dari `lucide-react`, rute `/change-password`.
- Produces: Dropdown pengguna tanpa broken link `/system/profile`.

- [ ] **Step 1: Periksa & sesuaikan tes sidebar-user**

Buka `src/components/layout/sidebar-user.test.tsx`, cari referensi `/system/profile` dan ubah ekspektasi ke `/change-password`:
```typescript
expect(screen.getByRole("menuitem", { name: /ganti kata sandi/i })).toHaveAttribute("href", "/change-password");
```

- [ ] **Step 2: Jalankan tes untuk melihat kegagalan**

Jalankan: `pnpm vitest run src/components/layout/sidebar-user.test.tsx`  
Ekspektasi: Gagal karena menu masih merender "Profil" `/system/profile`.

- [ ] **Step 3: Ganti tautan di `sidebar-user.tsx`**

Di `src/components/layout/sidebar-user.tsx`, ganti item menu Profil dengan:
```tsx
import {
  ChevronsUpDown,
  LogOut,
  Settings,
  KeyRound,
  RefreshCw,
} from "lucide-react";
...
<DropdownMenuItem
  render={
    <Link href="/change-password" onClick={handleNavClick} />
  }
>
  <KeyRound /> Ganti Kata Sandi
</DropdownMenuItem>
```

- [ ] **Step 4: Jalankan tes untuk memastikan lulus**

Jalankan: `pnpm vitest run src/components/layout/sidebar-user.test.tsx`  
Ekspektasi: LULUS (PASS).

- [ ] **Step 5: Commit perubahan**

```bash
git add src/components/layout/sidebar-user.tsx src/components/layout/sidebar-user.test.tsx
git commit -m "fix(ui): ganti dead link /system/profile dengan /change-password (CRIT-02)"
```

---

### Task 4: Dialog Konfirmasi Aksi Merusak Massal & Hapus Butir Paket ([CRIT-04])

**Files:**
- Modify: `src/components/questions/question-bank-view.tsx:238-275`
- Modify: `src/components/bundles/bundle-builder.tsx:31-85`
- Test: `src/components/questions/question-bank-view.bulk.test.tsx`

**Interfaces:**
- Consumes: Dialog primitive shadcn (`Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogDescription`, `DialogFooter`).
- Produces: Konfirmasi proteksi sebelum eksekusi `runBulk("archive")` dan `removeItem.mutate(id)`.

- [ ] **Step 1: Pasang dialog konfirmasi Bulk Archive di `QuestionBankView`**

Di `src/components/questions/question-bank-view.tsx`:
1. Tambahkan state `const [confirmArchiveOpen, setConfirmArchiveOpen] = useState(false);`.
2. Ubah tombol "Arsipkan":
```tsx
<Button
  variant="outline"
  size="sm"
  disabled={bulk.isPending}
  onClick={() => setConfirmArchiveOpen(true)}
>
  Arsipkan
</Button>
```
3. Tambahkan komponen Dialog:
```tsx
<Dialog open={confirmArchiveOpen} onOpenChange={setConfirmArchiveOpen}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Arsipkan {selected.size} butir soal?</DialogTitle>
      <DialogDescription>
        Soal yang diarsipkan akan disembunyikan dari daftar utama dan hanya
        bisa dilihat kembali melalui filter status &ldquo;Arsip&rdquo;.
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setConfirmArchiveOpen(false)}>
        Batal
      </Button>
      <Button
        variant="destructive"
        disabled={bulk.isPending}
        onClick={() => {
          setConfirmArchiveOpen(false);
          runBulk("archive");
        }}
      >
        Ya, Arsipkan
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 2: Pasang dialog konfirmasi pengeluaran butir di `BundleBuilder`**

Di `src/components/bundles/bundle-builder.tsx`:
Tambahkan dialog konfirmasi saat tombol `X` diklik:
1. Simpan state `const [confirmRemoveItem, setConfirmRemoveItem] = useState<{ id: string; nomor: number } | null>(null);`.
2. Saat tombol `X` diklik, panggil `setConfirmRemoveItem({ id: item.item.id, nomor })`.
3. Tampilkan dialog:
```tsx
<Dialog open={!!confirmRemoveItem} onOpenChange={(o) => !o && setConfirmRemoveItem(null)}>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>Keluarkan soal nomor {confirmRemoveItem?.nomor}?</DialogTitle>
      <DialogDescription>
        Soal akan dikeluarkan dari susunan paket ujian ini (soal tidak terhapus dari bank soal).
      </DialogDescription>
    </DialogHeader>
    <DialogFooter>
      <Button variant="outline" onClick={() => setConfirmRemoveItem(null)}>
        Batal
      </Button>
      <Button
        variant="destructive"
        disabled={removeItem.isPending}
        onClick={() => {
          if (confirmRemoveItem) {
            removeItem.mutate(confirmRemoveItem.id, {
              onSuccess: () => setConfirmRemoveItem(null),
            });
          }
        }}
      >
        Keluarkan
      </Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```

- [ ] **Step 3: Jalankan verifikasi linting, typecheck, dan tes**

Jalankan: `pnpm check`  
Ekspektasi: Exit code 0 (Semua linting, typecheck, dan coverage lulus).

- [ ] **Step 4: Commit perubahan**

```bash
git add src/components/questions/question-bank-view.tsx src/components/bundles/bundle-builder.tsx
git commit -m "fix(ui): tambah dialog konfirmasi proteksi aksi arsip massal & hapus butir (CRIT-04)"
```

---

## Self-Review Checklist

1. **Spec Coverage:**
   - [x] CRIT-01: Catatan penolakan tersimpan di `flag_notes`, audit log, dan dikirim dari UI (Task 1 & Task 2).
   - [x] CRIT-02: Tautan buntu `/system/profile` diganti dengan `/change-password` (Task 3).
   - [x] CRIT-04: Dialog konfirmasi bulk archive & bundle item removal (Task 4).
2. **Placeholder Scan:** Bebas dari "TBD", "TODO", atau kode semu.
3. **Type Consistency:** Tipe `changeStatusSchema`, `ChangeStatusInput`, dan `changeQuestionStatus` konsisten.
