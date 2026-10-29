import { asc, eq } from "drizzle-orm";
import { getDb, schema } from "@/db";
import { exigirAdmin } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { Cabecalho, Campo } from "@/components/ui";
import { alterarUsuario, criarUsuario, redefinirSenha } from "./actions";

export const metadata = { title: "Usuários — Painel" };

export default async function UsuariosPage() {
  const admin = await exigirAdmin();
  const db = await getDb();
  const usuarios = await db
    .select({ id: schema.usuarios.id, nome: schema.usuarios.nome, email: schema.usuarios.email, perfil: schema.usuarios.perfil, ativo: schema.usuarios.ativo, trocarSenha: schema.usuarios.trocarSenha })
    .from(schema.usuarios)
    .where(eq(schema.usuarios.lojaId, admin.lojaId))
    .orderBy(asc(schema.usuarios.nome));

  return (
    <div className="max-w-4xl">
      <Cabecalho
        titulo="Usuários"
        descricao="Administrador: acesso a tudo, inclusive configurações e usuários. Operador: pedidos, produtos, preços e planilha."
      />

      <ActionForm action={criarUsuario} className="cartao mb-6" botao="Criar usuário">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Campo rotulo="Nome"><input name="nome" className="campo" required maxLength={80} /></Campo>
          <Campo rotulo="E-mail (usado no login)"><input name="email" type="email" className="campo" required /></Campo>
          <Campo rotulo="Senha provisória (8+, letras e números)"><input name="senha" type="text" minLength={8} className="campo" required autoComplete="off" /></Campo>
          <Campo rotulo="Perfil">
            <select name="perfil" className="campo">
              <option value="operador">Operador</option>
              <option value="admin">Administrador</option>
            </select>
          </Campo>
        </div>
      </ActionForm>

      <ul className="space-y-3">
        {usuarios.map((u) => {
          const eu = u.id === admin.uid;
          return (
            <li key={u.id} className={`cartao ${u.ativo ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="font-semibold">{u.nome} {eu && <span className="text-xs font-normal text-gray-500">(você)</span>}</p>
                  <p className="text-sm text-gray-500">{u.email}{u.trocarSenha && " · senha provisória pendente"}</p>
                </div>
                {eu ? (
                  <span className="text-sm text-gray-500">{u.perfil === "admin" ? "Administrador" : "Operador"}</span>
                ) : (
                  <div className="flex flex-wrap items-center gap-2">
                    <form action={alterarUsuario}>
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="perfil" value={u.perfil === "admin" ? "operador" : "admin"} />
                      <button className="botao-sec">{u.perfil === "admin" ? "Administrador → tornar operador" : "Operador → tornar administrador"}</button>
                    </form>
                    <form action={alterarUsuario}>
                      <input type="hidden" name="id" value={u.id} />
                      <input type="hidden" name="ativo" value={String(!u.ativo)} />
                      <button className={u.ativo ? "botao-perigo" : "botao"}>{u.ativo ? "Desativar acesso" : "Reativar acesso"}</button>
                    </form>
                  </div>
                )}
              </div>
              {!eu && (
                <details className="mt-3 text-sm">
                  <summary className="cursor-pointer text-marca-azul">Esqueceu a senha? Definir senha provisória</summary>
                  <ActionForm action={redefinirSenha} botao="Definir senha" botaoClasse="botao-sec" className="mt-2">
                    <input type="hidden" name="id" value={u.id} />
                    <input name="senha" type="text" minLength={8} className="campo max-w-xs" required autoComplete="off" placeholder="Nova senha provisória" aria-label="Nova senha provisória" />
                  </ActionForm>
                </details>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
