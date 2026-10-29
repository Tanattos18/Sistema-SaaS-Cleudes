import creditos from "../../../public/produtos/creditos.json";

export const metadata = { title: "Créditos das imagens" };

type Credito = { arquivo: string; autor: string; licenca: string; pagina: string };

/** Atribuição exigida pelas licenças livres das fotos de demonstração (Wikimedia Commons). */
export default function CreditosPage() {
  const lista = Object.entries(creditos as Record<string, Credito>).sort(([a], [b]) => a.localeCompare(b));
  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      <h1 className="font-titulos text-3xl font-extrabold text-marca-azul-escuro">Créditos das imagens</h1>
      <p className="mt-2 text-sm text-gray-600">
        As fotos dos produtos de demonstração vêm do Wikimedia Commons, com licenças livres. Clique no arquivo para ver a
        página original, o autor e os termos da licença.
      </p>
      <div className="mt-6 overflow-x-auto rounded-2xl bg-white shadow-sm ring-1 ring-black/5">
        <table className="tabela">
          <thead>
            <tr><th>Foto</th><th>Arquivo</th><th>Autor</th><th>Licença</th></tr>
          </thead>
          <tbody>
            {lista.map(([slug, c]) => (
              <tr key={slug}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <td><img src={`/produtos/${slug}.webp`} alt="" width={64} height={48} loading="lazy" className="rounded-md object-cover" /></td>
                <td><a href={c.pagina} target="_blank" rel="noopener noreferrer" className="link break-all">{c.arquivo}</a></td>
                <td className="max-w-56 text-xs">{c.autor}</td>
                <td className="text-xs whitespace-nowrap">{c.licenca}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
