import { beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { schema, type DB } from "@/db";
import { somarDias, hojeISO } from "./formato";
import { lerPlanilha } from "./importacao";
import { importarProdutos } from "./importar-produtos";
import { aplicarPrecosAgendados } from "./precos";
import { bancoDeTeste } from "./test-db";

let db: DB;
let lojaId: number;
let usuarioId: number;

beforeAll(async () => {
  db = await bancoDeTeste("pedidos_teste_importacao");
  const [l] = await db.insert(schema.lojas).values({ slug: "teste", nome: "Loja Teste", whatsapp: "5562900000000", tokenImpressao: "x" }).returning();
  lojaId = l.id;
  const [u] = await db.insert(schema.usuarios).values({ lojaId, nome: "Adm", email: "a@x", senhaHash: "x", perfil: "admin" }).returning();
  usuarioId = u.id;
}, 60_000);

const produtos = () => db.select().from(schema.produtos).where(eq(schema.produtos.lojaId, lojaId)).orderBy(schema.produtos.id);

describe("importação de produtos", () => {
  it("cria produtos e categorias novas", async () => {
    const { linhas } = lerPlanilha([
      ["codigo", "nome", "categoria", "preco", "unidade"],
      ["A1", "Arroz 5kg", "Mercearia", "27,90", "un"],
      ["", "Picanha", "Açougue", "79,90", "kg"],
    ]);
    const r = await importarProdutos(db, lojaId, usuarioId, linhas, null);
    expect(r).toEqual({ criados: 2, atualizados: 0, agendados: 0, categoriasNovas: ["Mercearia", "Açougue"] });
    expect((await produtos()).map((p) => [p.codigo, p.nome, p.preco, p.unidade])).toEqual([
      ["A1", "Arroz 5kg", 27.9, "un"],
      [null, "Picanha", 79.9, "kg"],
    ]);
  });

  it("atualiza pelo código ou, sem código, pelo nome (sem diferenciar acento e maiúscula)", async () => {
    const { linhas } = lerPlanilha([
      ["codigo", "nome", "categoria", "preco", "disponivel"],
      ["A1", "Arroz Tipo 1 5kg", "mercearia", "26,90", "não"],
      ["", "PICANHA", "Açougue", "75", ""],
    ]);
    const r = await importarProdutos(db, lojaId, usuarioId, linhas, null);
    expect(r).toMatchObject({ criados: 0, atualizados: 2, categoriasNovas: [] });
    const [arroz, picanha] = await produtos();
    expect(arroz).toMatchObject({ nome: "Arroz Tipo 1 5kg", preco: 26.9, disponivel: false });
    expect(picanha.preco).toBe(75);
  });

  it("com data futura, agenda o preço novo e aplica na data", async () => {
    const amanha = somarDias(hojeISO(), 1);
    const { linhas } = lerPlanilha([
      ["codigo", "nome", "categoria", "preco", "preco_de"],
      ["A1", "Arroz Tipo 1 5kg", "Mercearia", "22,90", "26,90"],
    ]);
    const r = await importarProdutos(db, lojaId, usuarioId, linhas, amanha);
    expect(r).toMatchObject({ atualizados: 1, agendados: 1 });
    expect((await produtos())[0].preco).toBe(26.9); // ainda o preço de hoje

    expect(await aplicarPrecosAgendados(db, lojaId, amanha)).toBe(1);
    const [arroz] = await produtos();
    expect(arroz).toMatchObject({ preco: 22.9, precoDe: 26.9 });
  });
});
