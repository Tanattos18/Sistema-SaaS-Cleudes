-- Formas de pagamento passam a ser: Pix e cartão (pagos no site, Mercado Pago), dinheiro e maquininha na entrega.
-- Lojas que aceitavam qualquer cartão/Pix/VR na entrega ficam com a maquininha; quem aceitava dinheiro continua aceitando.
UPDATE "lojas"
SET "formas_pagamento" = (
  '["online_pix","online_cartao"]'::jsonb
  || CASE WHEN "formas_pagamento" ? 'entrega_dinheiro' THEN '["entrega_dinheiro"]'::jsonb ELSE '[]'::jsonb END
  || CASE WHEN "formas_pagamento" ?| array['entrega_pix','entrega_credito','entrega_debito','entrega_vr','entrega_maquininha'] THEN '["entrega_maquininha"]'::jsonb ELSE '[]'::jsonb END
)
WHERE NOT ("formas_pagamento" ? 'online_pix');
