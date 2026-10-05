import { uuidPk } from "./_columns";
import {
  pgTable,
  uuid,
  varchar,
  text,
  smallint,
  integer,
  timestamp,
  jsonb,
  uniqueIndex,
  index,
  type AnyPgColumn,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { mediaRoleEnum, mediaOriginEnum } from "./_enums";
import { questions } from "./question";

/** media_assets — galeri aset (gambar/tikz). */
export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuidPk(),
    /**
     * Kunci kanonik untuk shortcode `{{img:<shortId>}}` (8 char base62).
     * Markdown soal menyimpan ini, BUKAN path storage — sehingga berkas boleh
     * pindah/diganti tanpa menyentuh isi soal.
     */
    shortId: varchar("short_id", { length: 8 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    altText: text("alt_text"),
    caption: text("caption"),
    description: text("description"),
    tags: jsonb("tags").$type<string[]>().default([]).notNull(),

    originalImagePath: varchar("original_image_path", { length: 500 }),
    svgPath: varchar("svg_path", { length: 500 }),
    tikzCode: text("tikz_code"),
    thumbnailPath: varchar("thumbnail_path", { length: 500 }),

    mimeType: varchar("mime_type", { length: 50 }),
    fileSize: integer("file_size"),
    width: integer("width"),
    height: integer("height"),
    contentHash: varchar("content_hash", { length: 64 }),

    parentAssetId: uuid("parent_asset_id").references((): AnyPgColumn => mediaAssets.id, {
      onDelete: "set null",
    }),
    sourceOrigin: mediaOriginEnum("source_origin").default("manual_upload").notNull(),
    uploadedById: text("uploaded_by_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("uq_media_short_id").on(t.shortId),
    uniqueIndex("uq_media_content_hash").on(t.contentHash),
    index("idx_media_parent_asset_id").on(t.parentAssetId),
    index("idx_media_source_origin").on(t.sourceOrigin),
    // PERF-08: galeri mengurutkan `created_at DESC` → indeks menutup urutan itu.
    index("idx_media_created_at").on(t.createdAt),
  ],
);

/** question_media — M:N soal↔aset. media_id RESTRICT (jangan hapus kalau dipakai). */
export const questionMedia = pgTable(
  "question_media",
  {
    id: uuidPk(),
    questionId: uuid("question_id").notNull().references(() => questions.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id").notNull().references(() => mediaAssets.id, { onDelete: "restrict" }),
    role: mediaRoleEnum("role").default("content").notNull(),
    orderIndex: smallint("order_index").default(0).notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [
    uniqueIndex("uq_question_media").on(t.questionId, t.mediaId, t.role, t.orderIndex),
    index("idx_question_media_media").on(t.mediaId),
  ],
);

export const mediaAssetsRelations = relations(mediaAssets, ({ one, many }) => ({
  parent: one(mediaAssets, {
    fields: [mediaAssets.parentAssetId],
    references: [mediaAssets.id],
    relationName: "assetLineage",
  }),
  children: many(mediaAssets, { relationName: "assetLineage" }),
  questionMedia: many(questionMedia),
}));

export const questionMediaRelations = relations(questionMedia, ({ one }) => ({
  question: one(questions, { fields: [questionMedia.questionId], references: [questions.id] }),
  media: one(mediaAssets, { fields: [questionMedia.mediaId], references: [mediaAssets.id] }),
}));

export type MediaAsset = typeof mediaAssets.$inferSelect;
export type QuestionMedia = typeof questionMedia.$inferSelect;