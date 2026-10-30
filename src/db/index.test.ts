import { describe, expect, it } from "vitest";
import { urlParaPostgresJs } from "./index";

describe("URL do banco", () => {
  it("tira o channel_binding que o Neon coloca e mantém o resto", () => {
    expect(urlParaPostgresJs("postgresql://u:s3nh@ep-x-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require")).toBe(
      "postgresql://u:s3nh@ep-x-pooler.sa-east-1.aws.neon.tech/neondb?sslmode=require",
    );
    expect(urlParaPostgresJs("postgres://u:p@localhost:5432/db")).toBe("postgres://u:p@localhost:5432/db");
  });
});
