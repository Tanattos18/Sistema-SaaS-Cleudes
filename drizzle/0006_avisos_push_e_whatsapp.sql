CREATE TABLE "chaves_sistema" (
	"chave" text PRIMARY KEY NOT NULL,
	"valor" text NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inscricoes_push" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer NOT NULL,
	"usuario_id" integer NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"aparelho" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "inscricoes_push_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
ALTER TABLE "lojas" ADD COLUMN "aviso_whatsapp_ativo" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "inscricoes_push" ADD CONSTRAINT "inscricoes_push_loja_id_lojas_id_fk" FOREIGN KEY ("loja_id") REFERENCES "public"."lojas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inscricoes_push" ADD CONSTRAINT "inscricoes_push_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "inscricoes_push_loja_idx" ON "inscricoes_push" USING btree ("loja_id");