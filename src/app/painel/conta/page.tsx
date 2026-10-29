import { exigirUsuario } from "@/lib/auth";
import { ActionForm } from "@/components/action-form";
import { Cabecalho, Campo } from "@/components/ui";
import { trocarSenha } from "../usuarios/actions";

export const metadata = { title: "Minha senha — Painel" };

export default async function ContaPage() {
  const usuario = await exigirUsuario();
  return (
    <div className="max-w-md">
      <Cabecalho titulo="Minha senha" descricao={usuario.nome} />
      <ActionForm action={trocarSenha} className="cartao" botao="Trocar senha">
        <div className="space-y-4">
          <Campo rotulo="Senha atual"><input name="atual" type="password" className="campo" autoComplete="current-password" required /></Campo>
          <Campo rotulo="Nova senha (mín. 8, com letras e números)"><input name="nova" type="password" minLength={8} className="campo" autoComplete="new-password" required /></Campo>
        </div>
      </ActionForm>
    </div>
  );
}
