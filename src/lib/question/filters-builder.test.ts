import { describe, it, expect } from "vitest";
import { PgDialect } from "drizzle-orm/pg-core";
import { buildFilterFrom } from "./filters-builder";
import type { ListQuestionsQuery } from "@/lib/contracts/question";

const dialect = new PgDialect();

describe("buildFilterFrom — status & archived filter (ADR-0025)", () => {
  it("secara default menyembunyikan status archived dari daftar utama", () => {
    const query: ListQuestionsQuery = {
      includeDeleted: false,
      limit: 20,
      offset: 0,
      mode: "text",
    };
    const filter = buildFilterFrom(query);
    expect(filter.where).toBeDefined();
    const queryObj = dialect.sqlToQuery(filter.where!);
    expect(queryObj.sql).toContain('"questions"."status" <> $1');
    expect(queryObj.params).toContain("archived");
  });

  it("menyaring secara spesifik bila status diminta", () => {
    const query: ListQuestionsQuery = {
      status: "archived",
      includeDeleted: false,
      limit: 20,
      offset: 0,
      mode: "text",
    };
    const filter = buildFilterFrom(query);
    expect(filter.where).toBeDefined();
    const queryObj = dialect.sqlToQuery(filter.where!);
    expect(queryObj.sql).toContain('"questions"."status" = $1');
    expect(queryObj.params).toContain("archived");
  });
});

describe("buildFilterFrom — grade array overlap filter", () => {
  it("membangun kondisi overlap untuk query grade", () => {
    const query: ListQuestionsQuery = {
      grade: ["08", "11"],
      includeDeleted: false,
      limit: 20,
      offset: 0,
      mode: "text",
    };
    const filter = buildFilterFrom(query);
    expect(filter.where).toBeDefined();
  });

  it("tidak menyertakan kondisi grade bila query grade kosong", () => {
    const query: ListQuestionsQuery = {
      includeDeleted: false,
      limit: 20,
      offset: 0,
      mode: "text",
    };
    const filter = buildFilterFrom(query);
    expect(filter.where).toBeDefined();
  });
});
