import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

/**
 * Criptografia de segredos guardados no banco (credencial do Mercado Pago de cada loja).
 * A chave vem de SEGREDO_CHAVE ou, se não houver, de SESSION_SECRET. Quem só tem acesso ao banco
 * não consegue usar a credencial.
 */
function chave(): Buffer {
  const base = process.env.SEGREDO_CHAVE || process.env.SESSION_SECRET;
  if (!base) {
    if (process.env.NODE_ENV === "production") throw new Error("SESSION_SECRET não configurado.");
    return createHash("sha256").update("dev-somente-local-segredos").digest();
  }
  return createHash("sha256").update(`segredos:${base}`).digest();
}

export function cifrar(texto: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", chave(), iv);
  const dados = Buffer.concat([c.update(texto, "utf8"), c.final()]);
  return ["v1", iv.toString("base64url"), c.getAuthTag().toString("base64url"), dados.toString("base64url")].join(":");
}

/** null se o valor estiver corrompido ou tiver sido cifrado com outra chave. */
export function decifrar(cifrado: string | null | undefined): string | null {
  if (!cifrado) return null;
  const [v, iv, tag, dados] = cifrado.split(":");
  if (v !== "v1" || !iv || !tag || !dados) return null;
  try {
    const d = createDecipheriv("aes-256-gcm", chave(), Buffer.from(iv, "base64url"));
    d.setAuthTag(Buffer.from(tag, "base64url"));
    return Buffer.concat([d.update(Buffer.from(dados, "base64url")), d.final()]).toString("utf8");
  } catch {
    return null;
  }
}
