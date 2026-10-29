CREATE TABLE "auditoria" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer,
	"usuario_id" integer,
	"acao" text NOT NULL,
	"entidade" text NOT NULL,
	"entidade_id" integer,
	"dados" jsonb,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "bairros" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer NOT NULL,
	"nome" text NOT NULL,
	"taxa" numeric(12, 2) NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "categorias" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer NOT NULL,
	"nome" text NOT NULL,
	"icone" text,
	"ordem" integer DEFAULT 0 NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "horarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer NOT NULL,
	"dia_semana" smallint NOT NULL,
	"abre" text NOT NULL,
	"fecha" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "lojas" (
	"id" serial PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"nome" text NOT NULL,
	"whatsapp" text NOT NULL,
	"endereco" text,
	"mensagem_boas_vindas" text,
	"pedido_minimo" numeric(12, 2) DEFAULT 0 NOT NULL,
	"modo_taxa" text DEFAULT 'fixa' NOT NULL,
	"taxa_fixa" numeric(12, 2) DEFAULT 0 NOT NULL,
	"frete_gratis_acima" numeric(12, 2),
	"formas_pagamento" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"mp_access_token" text,
	"token_impressao" text NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "lojas_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "pedido_itens" (
	"id" serial PRIMARY KEY NOT NULL,
	"pedido_id" integer NOT NULL,
	"produto_id" integer NOT NULL,
	"nome" text NOT NULL,
	"unidade" text NOT NULL,
	"quantidade" numeric(10, 3) NOT NULL,
	"preco_unitario" numeric(12, 2) NOT NULL,
	"tem_vasilhame" boolean,
	"preco_vasilhame" numeric(12, 2),
	"total" numeric(12, 2) NOT NULL,
	"observacao" text
);
--> statement-breakpoint
CREATE TABLE "pedidos" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer NOT NULL,
	"numero" integer NOT NULL,
	"codigo" text NOT NULL,
	"status" text NOT NULL,
	"cliente_nome" text NOT NULL,
	"cliente_telefone" text NOT NULL,
	"rua" text NOT NULL,
	"numero_endereco" text NOT NULL,
	"complemento" text,
	"bairro" text NOT NULL,
	"bairro_id" integer,
	"referencia" text,
	"observacoes" text,
	"forma_pagamento" text NOT NULL,
	"troco_para" numeric(12, 2),
	"subtotal" numeric(12, 2) NOT NULL,
	"taxa_entrega" numeric(12, 2) NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"pago_em" timestamp with time zone,
	"mp_preferencia_id" text,
	"mp_pagamento_id" text,
	"impresso_em" timestamp with time zone,
	"cancelado_motivo" text,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pedidos_codigo_unique" UNIQUE("codigo")
);
--> statement-breakpoint
CREATE TABLE "precos_agendados" (
	"id" serial PRIMARY KEY NOT NULL,
	"produto_id" integer NOT NULL,
	"preco" numeric(12, 2) NOT NULL,
	"vigente_em" date NOT NULL,
	"promocao" boolean DEFAULT false NOT NULL,
	"aplicado_em" timestamp with time zone,
	"usuario_id" integer,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "produtos" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer NOT NULL,
	"categoria_id" integer NOT NULL,
	"codigo" text,
	"nome" text NOT NULL,
	"descricao" text,
	"unidade" text DEFAULT 'un' NOT NULL,
	"preco" numeric(12, 2) NOT NULL,
	"preco_de" numeric(12, 2),
	"preco_vasilhame" numeric(12, 2),
	"imagem_url" text,
	"disponivel" boolean DEFAULT true NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tentativas_login" (
	"id" serial PRIMARY KEY NOT NULL,
	"email" text NOT NULL,
	"ip" text NOT NULL,
	"sucesso" boolean NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "usuarios" (
	"id" serial PRIMARY KEY NOT NULL,
	"loja_id" integer NOT NULL,
	"nome" text NOT NULL,
	"email" text NOT NULL,
	"senha_hash" text NOT NULL,
	"perfil" text DEFAULT 'operador' NOT NULL,
	"ativo" boolean DEFAULT true NOT NULL,
	"trocar_senha" boolean DEFAULT false NOT NULL,
	"criado_em" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usuarios_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_loja_id_lojas_id_fk" FOREIGN KEY ("loja_id") REFERENCES "public"."lojas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "auditoria" ADD CONSTRAINT "auditoria_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "bairros" ADD CONSTRAINT "bairros_loja_id_lojas_id_fk" FOREIGN KEY ("loja_id") REFERENCES "public"."lojas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "categorias" ADD CONSTRAINT "categorias_loja_id_lojas_id_fk" FOREIGN KEY ("loja_id") REFERENCES "public"."lojas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "horarios" ADD CONSTRAINT "horarios_loja_id_lojas_id_fk" FOREIGN KEY ("loja_id") REFERENCES "public"."lojas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_itens" ADD CONSTRAINT "pedido_itens_pedido_id_pedidos_id_fk" FOREIGN KEY ("pedido_id") REFERENCES "public"."pedidos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedido_itens" ADD CONSTRAINT "pedido_itens_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_loja_id_lojas_id_fk" FOREIGN KEY ("loja_id") REFERENCES "public"."lojas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "pedidos" ADD CONSTRAINT "pedidos_bairro_id_bairros_id_fk" FOREIGN KEY ("bairro_id") REFERENCES "public"."bairros"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "precos_agendados" ADD CONSTRAINT "precos_agendados_produto_id_produtos_id_fk" FOREIGN KEY ("produto_id") REFERENCES "public"."produtos"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "precos_agendados" ADD CONSTRAINT "precos_agendados_usuario_id_usuarios_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."usuarios"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_loja_id_lojas_id_fk" FOREIGN KEY ("loja_id") REFERENCES "public"."lojas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "produtos" ADD CONSTRAINT "produtos_categoria_id_categorias_id_fk" FOREIGN KEY ("categoria_id") REFERENCES "public"."categorias"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_loja_id_lojas_id_fk" FOREIGN KEY ("loja_id") REFERENCES "public"."lojas"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "auditoria_loja_idx" ON "auditoria" USING btree ("loja_id","criado_em");--> statement-breakpoint
CREATE UNIQUE INDEX "bairros_loja_nome_idx" ON "bairros" USING btree ("loja_id","nome");--> statement-breakpoint
CREATE UNIQUE INDEX "categorias_loja_nome_idx" ON "categorias" USING btree ("loja_id","nome");--> statement-breakpoint
CREATE INDEX "horarios_loja_idx" ON "horarios" USING btree ("loja_id");--> statement-breakpoint
CREATE INDEX "pedido_itens_pedido_idx" ON "pedido_itens" USING btree ("pedido_id");--> statement-breakpoint
CREATE UNIQUE INDEX "pedidos_loja_numero_idx" ON "pedidos" USING btree ("loja_id","numero");--> statement-breakpoint
CREATE INDEX "pedidos_loja_status_idx" ON "pedidos" USING btree ("loja_id","status","criado_em");--> statement-breakpoint
CREATE INDEX "precos_agendados_pendentes_idx" ON "precos_agendados" USING btree ("vigente_em","aplicado_em");--> statement-breakpoint
CREATE INDEX "produtos_loja_cat_idx" ON "produtos" USING btree ("loja_id","categoria_id");--> statement-breakpoint
CREATE UNIQUE INDEX "produtos_loja_codigo_idx" ON "produtos" USING btree ("loja_id","codigo");--> statement-breakpoint
CREATE INDEX "tentativas_email_idx" ON "tentativas_login" USING btree ("email","criado_em");--> statement-breakpoint
CREATE INDEX "tentativas_ip_idx" ON "tentativas_login" USING btree ("ip","criado_em");