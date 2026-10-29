import { ActionForm } from "@/components/action-form";
import { Campo } from "@/components/ui";
import { entrar } from "./actions";

export const metadata = { title: "Área do lojista" };

export default function LoginPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-marca-amarelo p-4">
      <div className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-xl">
        <span className="grid size-12 place-items-center rounded-2xl bg-marca-azul font-titulos text-3xl font-extrabold text-marca-amarelo">C</span>
        <h1 className="mt-4 font-titulos text-3xl font-extrabold text-marca-azul-escuro">Área do lojista</h1>
        <p className="mb-6 text-sm text-gray-500">Pedidos, produtos, preços, promoções e configurações da loja.</p>
        <ActionForm action={entrar} botao="Entrar" botaoClasse="botao w-full py-3 text-base">
          <div className="space-y-4">
            <Campo rotulo="E-mail">
              <input name="email" type="email" className="campo" autoComplete="username" required />
            </Campo>
            <Campo rotulo="Senha">
              <input name="senha" type="password" className="campo" autoComplete="current-password" required />
            </Campo>
          </div>
        </ActionForm>
      </div>
    </main>
  );
}
