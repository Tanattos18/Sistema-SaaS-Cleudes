ALTER TABLE "lojas" ADD COLUMN "mp_webhook_secret" text;--> statement-breakpoint
ALTER TABLE "lojas" ADD COLUMN "callmebot_apikey" text;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "mp_ordem_id" text;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "pix_copia_e_cola" text;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "pix_qr_code" text;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "pix_expira_em" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "pedidos" ADD COLUMN "whatsapp_avisado_em" timestamp with time zone;