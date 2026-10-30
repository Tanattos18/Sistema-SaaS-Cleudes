ALTER TABLE "lojas" ADD COLUMN "impressora_tipo" text;--> statement-breakpoint
ALTER TABLE "lojas" ADD COLUMN "impressora_nome" text;--> statement-breakpoint
ALTER TABLE "lojas" ADD COLUMN "impressora_ip" text;--> statement-breakpoint
ALTER TABLE "lojas" ADD COLUMN "impressora_porta" integer;--> statement-breakpoint
ALTER TABLE "lojas" ADD COLUMN "impressora_copias" smallint DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "lojas" ADD COLUMN "impressoras_disponiveis" jsonb;--> statement-breakpoint
ALTER TABLE "lojas" ADD COLUMN "impressora_computador" text;--> statement-breakpoint
ALTER TABLE "lojas" ADD COLUMN "impressao_teste_pedida_em" timestamp with time zone;