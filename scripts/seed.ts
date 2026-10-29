import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { fecharDb, getDb, schema } from "../src/db";

/**
 * Carga inicial: a loja Caixeta (primeiro assinante), horário, bairros de exemplo
 * e o usuário administrador dela. Pode ser executado mais de uma vez sem duplicar dados.
 */
async function main() {
  const db = await getDb();

  let [loja] = await db.select().from(schema.lojas).where(eq(schema.lojas.slug, "caixeta"));
  if (!loja) {
    [loja] = await db
      .insert(schema.lojas)
      .values({
        slug: "caixeta",
        nome: "Supermercado Caixeta",
        whatsapp: "5562981779460",
        endereco: "Caixeta Gás e Distribuidora de Bebidas",
        mensagemBoasVindas: "Açougue, padaria, supermercado, gás e bebidas. Entregamos na sua casa!",
        pedidoMinimo: 40,
        modoTaxa: "fixa",
        taxaFixa: 5,
        freteGratisAcima: 150,
        formasPagamento: ["entrega_pix", "entrega_credito", "entrega_debito", "entrega_vr", "entrega_dinheiro"],
        tokenImpressao: randomBytes(24).toString("base64url"),
      })
      .returning();
    await db.insert(schema.horarios).values([
      { lojaId: loja.id, diaSemana: 0, abre: "06:00", fecha: "11:00" },
      ...[1, 2, 3, 4, 5, 6].map((diaSemana) => ({ lojaId: loja.id, diaSemana, abre: "06:00", fecha: "20:00" })),
    ]);
    // Exemplo para o modo "taxa por bairro"; os reais vêm do lojista.
    await db.insert(schema.bairros).values([
      { lojaId: loja.id, nome: "Centro", taxa: 5 },
      { lojaId: loja.id, nome: "Setor Norte", taxa: 7 },
      { lojaId: loja.id, nome: "Setor Sul", taxa: 8 },
    ]);
    console.log(`Loja criada: /${loja.slug}`);
  }

  const usuarios = await db.select({ id: schema.usuarios.id }).from(schema.usuarios).where(eq(schema.usuarios.lojaId, loja.id)).limit(1);
  if (usuarios.length === 0) {
    const email = process.env.ADMIN_EMAIL ?? "admin@caixeta.local";
    const senha = process.env.ADMIN_PASSWORD ?? randomBytes(9).toString("base64url");
    await db.insert(schema.usuarios).values({
      lojaId: loja.id,
      nome: "Administrador",
      email,
      senhaHash: await bcrypt.hash(senha, 10),
      perfil: "admin",
      // Senha gerada aqui é provisória; a informada no .env é escolha de quem instala.
      trocarSenha: !process.env.ADMIN_PASSWORD,
    });
    console.log(`Administrador criado: ${email}`);
    if (!process.env.ADMIN_PASSWORD) console.log(`Senha gerada (troque após o primeiro acesso): ${senha}`);
  }

  console.log("Carga inicial concluída.");
  await fecharDb();
  process.exit(0);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
