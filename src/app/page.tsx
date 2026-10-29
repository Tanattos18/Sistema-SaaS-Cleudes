import Link from "next/link";

export default function Inicio() {
  return (
    <main className="flex min-h-screen items-center justify-center p-4">
      <div className="cartao w-full max-w-sm text-center">
        <h1 className="text-xl font-semibold text-blue-900">Pedidos online</h1>
        <p className="mt-1 mb-6 text-sm text-gray-500">Cada loja tem o seu link de pedidos.</p>
        <Link href="/login" className="botao w-full">Entrar no painel da loja</Link>
      </div>
    </main>
  );
}
