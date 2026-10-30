import { drizzle as drizzlePostgres, type PostgresJsDatabase } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

export type DB = PostgresJsDatabase<typeof schema>;

declare global {
  var __pedidosDb: Promise<DB> | undefined;
  var __pedidosFechar: (() => Promise<void>) | undefined;
}

/**
 * Tira da URL os parâmetros que só o libpq entende. O postgres.js repassa ao servidor todo parâmetro
 * que não conhece, e o Postgres recusa a conexão ("unrecognized configuration parameter").
 * O Neon, por exemplo, entrega a URL com "&channel_binding=require".
 */
export function urlParaPostgresJs(bruta: string): string {
  // Aceita também o valor colado como o painel do Neon mostra: com aspas, "psql '...'" ou "DATABASE_URL=...".
  const url = bruta
    .trim()
    .replace(/^DATABASE_URL\s*=\s*/i, "")
    .replace(/^psql\s+/i, "")
    .replace(/^(['"])(.*)\1$/, "$2")
    .trim();
  try {
    const u = new URL(url);
    for (const p of ["channel_binding", "gssencmode", "sslcompression", "connect_timeout_ms"]) u.searchParams.delete(p);
    return u.toString();
  } catch {
    return url;
  }
}

/**
 * Produção: PostgreSQL via DATABASE_URL.
 * Desenvolvimento sem DATABASE_URL: PGlite (Postgres embutido) gravando em PGLITE_DIR.
 */
async function conectar(): Promise<DB> {
  const original = process.env.DATABASE_URL?.trim();
  const url = original && urlParaPostgresJs(original);
  if (url) {
    const postgres = (await import("postgres")).default;
    const sql = postgres(url, {
      max: Number(process.env.DB_POOL_MAX) || 5,
      // Poolers em modo transação (Neon "-pooler", Supabase porta 6543, PgBouncer) não aceitam prepared statements.
      prepare: !/-pooler\.|:6543\b|pgbouncer=true/.test(url),
    });
    globalThis.__pedidosFechar = () => sql.end();
    return drizzlePostgres(sql, { schema });
  }
  if (process.env.NODE_ENV === "production" && process.env.PERMITIR_PGLITE !== "1") {
    // Sem isso, um deploy sem a variável gravaria dados num banco local que some a cada atualização.
    throw new Error("DATABASE_URL não configurada. Em produção o sistema precisa de um PostgreSQL.");
  }
  const { PGlite } = await import("@electric-sql/pglite");
  const { drizzle } = await import("drizzle-orm/pglite");
  const { mkdirSync } = await import("node:fs");
  const { homedir } = await import("node:os");
  const { join } = await import("node:path");
  // Fora da pasta do projeto por padrão, para não ser sincronizado pelo OneDrive/Dropbox.
  const dir = process.env.PGLITE_DIR ?? join(homedir(), ".pedidos-saas", "pglite");
  if (!dir.startsWith("memory://")) mkdirSync(dir, { recursive: true });
  const client = new PGlite(dir);
  globalThis.__pedidosFechar = () => client.close();
  // A API de consulta é a mesma; o tipo de produção é usado em todo o código.
  return drizzle(client, { schema }) as unknown as DB;
}

export function getDb(): Promise<DB> {
  globalThis.__pedidosDb ??= conectar();
  return globalThis.__pedidosDb;
}

/** Fecha a conexão. Scripts devem chamar antes de sair: sem isso o Postgres pula a numeração dos IDs. */
export async function fecharDb() {
  await globalThis.__pedidosFechar?.();
  globalThis.__pedidosDb = undefined;
  globalThis.__pedidosFechar = undefined;
}

export { schema };
