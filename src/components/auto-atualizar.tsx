"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** Recarrega os dados da página de tempos em tempos (lista de pedidos aberta no balcão). */
export function AutoAtualizar({ segundos }: { segundos: number }) {
  const router = useRouter();
  useEffect(() => {
    const t = setInterval(() => router.refresh(), segundos * 1000);
    return () => clearInterval(t);
  }, [router, segundos]);
  return null;
}
