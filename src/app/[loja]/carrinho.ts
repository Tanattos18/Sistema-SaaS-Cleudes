"use client";

import { useEffect, useState } from "react";
import type { ItemCarrinho } from "@/lib/pedido";

/** Mesmo produto de gás com e sem vasilhame são linhas diferentes no carrinho. */
export function chaveItem(i: Pick<ItemCarrinho, "produtoId" | "temVasilhame">): string {
  return `${i.produtoId}:${i.temVasilhame ?? ""}`;
}

function ler<T>(chave: string, padrao: T): T {
  try {
    const bruto = localStorage.getItem(chave);
    return bruto ? (JSON.parse(bruto) as T) : padrao;
  } catch {
    return padrao;
  }
}

function gravar(chave: string, valor: unknown) {
  try {
    localStorage.setItem(chave, JSON.stringify(valor));
  } catch {
    // Navegação anônima ou armazenamento cheio: o carrinho só não sobrevive ao recarregar.
  }
}

/** Estado salvo no navegador (por loja), carregado depois da hidratação para não divergir do servidor. */
export function useGuardado<T>(chave: string, padrao: T) {
  const [valor, setValor] = useState<T>(padrao);
  const [carregado, setCarregado] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- leitura única do localStorage após hidratar
    setValor(ler(chave, padrao));
    setCarregado(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [chave]);
  useEffect(() => {
    if (carregado) gravar(chave, valor);
  }, [chave, valor, carregado]);
  return [valor, setValor] as const;
}

export type DadosCliente = {
  nome: string;
  telefone: string;
  rua: string;
  numero: string;
  complemento: string;
  bairro: string;
  referencia: string;
};

export const CLIENTE_VAZIO: DadosCliente = { nome: "", telefone: "", rua: "", numero: "", complemento: "", bairro: "", referencia: "" };
