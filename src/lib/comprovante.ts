import { ROTULO_PAGAMENTO, quilos, telefoneBR } from "./dominio";
import { centavos, moeda } from "./formato";
import type { PedidoCompleto } from "./consultas";

/** Bobina de 80 mm na Epson TM-T88V: 48 caracteres na fonte normal, 24 em letra dupla. */
export const COLUNAS = 48;

/**
 * Uma linha do comprovante. O programa de impressão traduz para comandos ESC/POS; o painel, para HTML.
 * `grande`: letra dupla (largura e altura), cabe metade das colunas.
 */
export type LinhaComprovante = { texto: string; negrito?: boolean; grande?: boolean; centro?: boolean };

const SEPARADOR: LinhaComprovante = { texto: "-".repeat(COLUNAS) };

/** Quebra o texto em linhas de até `largura` letras, sem cortar palavras quando possível. */
export function quebrar(texto: string, largura: number, recuo = ""): string[] {
  const linhas: string[] = [];
  let atual = "";
  for (const palavra of texto.replace(/\s+/g, " ").trim().split(" ")) {
    const candidato = atual ? `${atual} ${palavra}` : linhas.length ? recuo + palavra : palavra;
    if (candidato.length <= largura) {
      atual = candidato;
      continue;
    }
    if (atual) {
      linhas.push(atual);
      atual = recuo + palavra;
    } else {
      atual = candidato;
    }
    // Palavra maior que a linha: corta.
    while (atual.length > largura) {
      linhas.push(atual.slice(0, largura));
      atual = recuo + atual.slice(largura);
    }
  }
  if (atual || !linhas.length) linhas.push(atual);
  return linhas;
}

/** Texto à esquerda e valor à direita na mesma linha; se não couber, o texto quebra e o valor vai na última. */
export function colunas(esquerda: string, direita: string, largura = COLUNAS, recuo = ""): string[] {
  direita = direita.replace(/ /g, " ");
  const espaco = largura - direita.length - 1;
  const partes = quebrar(esquerda, espaco, recuo);
  const ultima = partes.pop()!;
  return [...partes, ultima + " ".repeat(Math.max(1, largura - ultima.length - direita.length)) + direita];
}

const hora = new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });

/** Comprovante de separação e entrega: cada item com [ ] para o separador marcar. */
export function montarComprovante(nomeLoja: string, p: PedidoCompleto): LinhaComprovante[] {
  const L: LinhaComprovante[] = [];
  const add = (texto: string, estilo: Omit<LinhaComprovante, "texto"> = {}) => L.push({ texto, ...estilo });
  const varias = (linhas: string[], estilo: Omit<LinhaComprovante, "texto"> = {}) => linhas.forEach((t) => add(t, estilo));

  varias(quebrar(nomeLoja.toUpperCase(), COLUNAS), { negrito: true, centro: true });
  add(`PEDIDO Nº ${p.numero}`, { grande: true, centro: true });
  add(hora.format(p.criadoEm).replace(",", ""), { centro: true });
  if (p.pagoEm) add("*** PAGO PELO SITE ***", { negrito: true, centro: true });
  L.push(SEPARADOR);

  varias(quebrar(`CLIENTE: ${p.clienteNome}`, COLUNAS), { negrito: true });
  add(`TELEFONE: ${telefoneBR(p.clienteTelefone)}`);
  varias(quebrar(`ENTREGA: ${p.rua}, ${p.numeroEndereco}${p.complemento ? ` - ${p.complemento}` : ""}`, COLUNAS, "  "));
  varias(quebrar(`BAIRRO: ${p.bairro}`, COLUNAS), { negrito: true });
  if (p.referencia) varias(quebrar(`REFERÊNCIA: ${p.referencia}`, COLUNAS, "  "));
  L.push(SEPARADOR);

  add(`ITENS (${p.itens.length})`, { negrito: true });
  for (const i of p.itens) {
    if (i.unidade === "kg") {
      varias(colunas(`[ ] ${i.nome}`, moeda(i.total), COLUNAS, "    "), { negrito: true });
      add(`    PESAR ~${quilos(i.quantidade)} (${moeda(i.precoUnitario)}/kg)`);
    } else {
      const quantidade = Number.isInteger(i.quantidade) ? i.quantidade : i.quantidade.toLocaleString("pt-BR");
      varias(colunas(`[ ] ${quantidade}x ${i.nome}`, moeda(i.total), COLUNAS, "    "), { negrito: true });
      if (i.temVasilhame === true) add("    TROCA: cliente tem o botijão vazio");
      if (i.temVasilhame === false) add(`    LEVAR VASILHAME (+${moeda(i.precoVasilhame)} cada)`, { negrito: true });
    }
    if (i.observacao) varias(quebrar(`    obs.: ${i.observacao}`, COLUNAS, "    "));
  }
  L.push(SEPARADOR);

  varias(colunas("Subtotal", moeda(p.subtotal)));
  varias(colunas("Entrega", p.taxaEntrega === 0 ? "grátis" : moeda(p.taxaEntrega)));
  // Letra dupla: 24 colunas.
  varias(colunas("TOTAL", moeda(p.total), COLUNAS / 2), { grande: true });
  if (p.itens.some((i) => i.unidade === "kg")) add("Itens por peso: valor aproximado.");
  L.push(SEPARADOR);

  varias(quebrar(`PAGAMENTO: ${ROTULO_PAGAMENTO[p.formaPagamento]}${p.pagoEm ? " (PAGO)" : ""}`, COLUNAS), { negrito: true });
  if (p.formaPagamento === "entrega_dinheiro") {
    if (p.trocoPara) add(`LEVAR TROCO: ${moeda(centavos(p.trocoPara - p.total))} (para ${moeda(p.trocoPara)})`, { negrito: true });
    else add("Não precisa de troco");
  } else if (!p.pagoEm && !p.formaPagamento.startsWith("online_")) {
    add("Levar a maquininha", { negrito: true });
  }
  if (p.observacoes) {
    L.push(SEPARADOR);
    varias(quebrar(`OBSERVAÇÕES: ${p.observacoes}`, COLUNAS, "  "), { negrito: true });
  }
  L.push(SEPARADOR);
  add("Separado por: ______________________________");
  add("");
  add("Entregador:   ______________________________");
  // O formato de moeda usa espaço não separável; na impressora, espaço comum.
  return L.map((l) => ({ ...l, texto: l.texto.replace(/ /g, " ") }));
}
