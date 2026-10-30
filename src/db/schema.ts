import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";

const valor = (nome: string) => numeric(nome, { precision: 12, scale: 2, mode: "number" });
const criadoEm = () => timestamp("criado_em", { withTimezone: true }).defaultNow().notNull();

/**
 * Formas de pagamento. "online_*" são pagas no site pelo Mercado Pago; "entrega_*", ao entregador.
 * Oferecidas hoje: Pix, cartão, dinheiro e maquininha. As outras ficam só para pedidos antigos.
 */
export const FORMAS_PAGAMENTO = [
  "online_pix",
  "online_cartao",
  "entrega_dinheiro",
  "entrega_maquininha",
  "entrega_pix",
  "entrega_credito",
  "entrega_debito",
  "entrega_vr",
] as const;
export type FormaPagamento = (typeof FORMAS_PAGAMENTO)[number];

export const STATUS_PEDIDO = [
  "aguardando_pagamento",
  "novo",
  "em_separacao",
  "saiu_entrega",
  "entregue",
  "cancelado",
] as const;
export type StatusPedido = (typeof STATUS_PEDIDO)[number];

/** Cada comércio assinante. A vitrine pública fica em /{slug}. */
export const lojas = pgTable("lojas", {
  id: serial("id").primaryKey(),
  slug: text("slug").notNull().unique(),
  nome: text("nome").notNull(),
  // Só dígitos, com DDI: 556281517002.
  whatsapp: text("whatsapp").notNull(),
  endereco: text("endereco"),
  mensagemBoasVindas: text("mensagem_boas_vindas"),
  pedidoMinimo: valor("pedido_minimo").notNull().default(0),
  // "fixa": taxaFixa para qualquer endereço; "bairro": só os bairros cadastrados, cada um com sua taxa.
  modoTaxa: text("modo_taxa", { enum: ["fixa", "bairro"] }).notNull().default("fixa"),
  taxaFixa: valor("taxa_fixa").notNull().default(0),
  // Frete grátis a partir deste subtotal (vale para os dois modos). Vazio = nunca.
  freteGratisAcima: valor("frete_gratis_acima"),
  formasPagamento: jsonb("formas_pagamento").$type<FormaPagamento[]>().notNull().default([]),
  // Credencial do Mercado Pago do próprio lojista (o dinheiro cai na conta dele).
  // Guardada criptografada (src/lib/segredo.ts).
  mpAccessToken: text("mp_access_token"),
  // Nome da conta conectada, para o lojista conferir quem recebe.
  mpConta: text("mp_conta"),
  // Assinatura secreta do webhook do Mercado Pago (criptografada): confere que o aviso veio mesmo dele.
  mpWebhookSecret: text("mp_webhook_secret"),
  // Chave do CallMeBot (criptografada): manda cada pedido novo, sozinho, para o WhatsApp da loja.
  callmebotApiKey: text("callmebot_apikey"),
  // Usado pelo programa de impressão instalado no PC da loja.
  tokenImpressao: text("token_impressao").notNull(),
  // Último contato do programa de impressão: o painel mostra se a impressora está conectada.
  impressoraVistaEm: timestamp("impressora_vista_em", { withTimezone: true }),
  ativo: boolean("ativo").notNull().default(true),
  criadoEm: criadoEm(),
});

/** Horário de funcionamento. Dia sem linha = fechado. Fora do horário a vitrine não aceita pedidos. */
export const horarios = pgTable(
  "horarios",
  {
    id: serial("id").primaryKey(),
    lojaId: integer("loja_id").notNull().references(() => lojas.id),
    // 0 = domingo … 6 = sábado
    diaSemana: smallint("dia_semana").notNull(),
    abre: text("abre").notNull(), // "06:00"
    fecha: text("fecha").notNull(), // "20:00"
  },
  (t) => [index("horarios_loja_idx").on(t.lojaId)],
);

export const usuarios = pgTable("usuarios", {
  id: serial("id").primaryKey(),
  lojaId: integer("loja_id").notNull().references(() => lojas.id),
  nome: text("nome").notNull(),
  email: text("email").notNull().unique(),
  senhaHash: text("senha_hash").notNull(),
  perfil: text("perfil", { enum: ["admin", "operador"] }).notNull().default("operador"),
  ativo: boolean("ativo").notNull().default(true),
  // Senha provisória (criada por outra pessoa): obriga a troca no próximo acesso.
  trocarSenha: boolean("trocar_senha").notNull().default(false),
  criadoEm: criadoEm(),
});

/** Histórico de tentativas de login, usado para bloquear quem tenta adivinhar senhas. */
export const tentativasLogin = pgTable(
  "tentativas_login",
  {
    id: serial("id").primaryKey(),
    email: text("email").notNull(),
    ip: text("ip").notNull(),
    sucesso: boolean("sucesso").notNull(),
    criadoEm: criadoEm(),
  },
  (t) => [index("tentativas_email_idx").on(t.email, t.criadoEm), index("tentativas_ip_idx").on(t.ip, t.criadoEm)],
);

export const bairros = pgTable(
  "bairros",
  {
    id: serial("id").primaryKey(),
    lojaId: integer("loja_id").notNull().references(() => lojas.id),
    nome: text("nome").notNull(),
    taxa: valor("taxa").notNull(),
    ativo: boolean("ativo").notNull().default(true),
  },
  (t) => [uniqueIndex("bairros_loja_nome_idx").on(t.lojaId, t.nome)],
);

export const categorias = pgTable(
  "categorias",
  {
    id: serial("id").primaryKey(),
    lojaId: integer("loja_id").notNull().references(() => lojas.id),
    nome: text("nome").notNull(),
    icone: text("icone"),
    ordem: integer("ordem").notNull().default(0),
    ativo: boolean("ativo").notNull().default(true),
  },
  (t) => [uniqueIndex("categorias_loja_nome_idx").on(t.lojaId, t.nome)],
);

export const produtos = pgTable(
  "produtos",
  {
    id: serial("id").primaryKey(),
    lojaId: integer("loja_id").notNull().references(() => lojas.id),
    categoriaId: integer("categoria_id").notNull().references(() => categorias.id),
    // Código do sistema de caixa ou de barras, usado na importação da planilha.
    codigo: text("codigo"),
    nome: text("nome").notNull(),
    descricao: text("descricao"),
    // "kg": o cliente pede pelo valor ("R$ 20 de carne moída") e o preço é por quilo.
    unidade: text("unidade", { enum: ["un", "kg"] }).notNull().default("un"),
    preco: valor("preco").notNull(),
    // Preço "de" riscado, quando o preço atual é promoção.
    precoDe: valor("preco_de"),
    // Gás: preço da troca em `preco`; quem não tem o botijão vazio paga também o vasilhame.
    precoVasilhame: valor("preco_vasilhame"),
    imagemUrl: text("imagem_url"),
    disponivel: boolean("disponivel").notNull().default(true),
    ativo: boolean("ativo").notNull().default(true),
    criadoEm: criadoEm(),
  },
  (t) => [
    index("produtos_loja_cat_idx").on(t.lojaId, t.categoriaId),
    uniqueIndex("produtos_loja_codigo_idx").on(t.lojaId, t.codigo),
  ],
);

/**
 * Mudança de preço programada (ex.: promoção da carne a partir de amanhã).
 * Aplicada automaticamente quando a data chega; `promocao` mostra o preço antigo riscado.
 */
export const precosAgendados = pgTable(
  "precos_agendados",
  {
    id: serial("id").primaryKey(),
    produtoId: integer("produto_id").notNull().references(() => produtos.id),
    preco: valor("preco").notNull(),
    vigenteEm: date("vigente_em").notNull(),
    promocao: boolean("promocao").notNull().default(false),
    aplicadoEm: timestamp("aplicado_em", { withTimezone: true }),
    usuarioId: integer("usuario_id").references(() => usuarios.id),
    criadoEm: criadoEm(),
  },
  (t) => [index("precos_agendados_pendentes_idx").on(t.vigenteEm, t.aplicadoEm)],
);

export const pedidos = pgTable(
  "pedidos",
  {
    id: serial("id").primaryKey(),
    lojaId: integer("loja_id").notNull().references(() => lojas.id),
    // Número sequencial por loja, o que aparece para o cliente e no comprovante.
    numero: integer("numero").notNull(),
    // Identificador público (link de acompanhamento), impossível de adivinhar.
    codigo: text("codigo").notNull().unique(),
    status: text("status", { enum: STATUS_PEDIDO }).notNull(),
    clienteNome: text("cliente_nome").notNull(),
    clienteTelefone: text("cliente_telefone").notNull(),
    rua: text("rua").notNull(),
    numeroEndereco: text("numero_endereco").notNull(),
    complemento: text("complemento"),
    bairro: text("bairro").notNull(),
    bairroId: integer("bairro_id").references(() => bairros.id),
    referencia: text("referencia"),
    observacoes: text("observacoes"),
    formaPagamento: text("forma_pagamento", { enum: FORMAS_PAGAMENTO }).notNull(),
    trocoPara: valor("troco_para"),
    subtotal: valor("subtotal").notNull(),
    taxaEntrega: valor("taxa_entrega").notNull(),
    total: valor("total").notNull(),
    pagoEm: timestamp("pago_em", { withTimezone: true }),
    mpPreferenciaId: text("mp_preferencia_id"),
    mpPagamentoId: text("mp_pagamento_id"),
    // Pix gerado no próprio site (API de Orders do Mercado Pago): QR code e copia e cola.
    mpOrdemId: text("mp_ordem_id"),
    pixCopiaECola: text("pix_copia_e_cola"),
    pixQrCode: text("pix_qr_code"),
    pixExpiraEm: timestamp("pix_expira_em", { withTimezone: true }),
    // Aviso automático no WhatsApp da loja já enviado (evita mandar duas vezes).
    whatsappAvisadoEm: timestamp("whatsapp_avisado_em", { withTimezone: true }),
    impressoEm: timestamp("impresso_em", { withTimezone: true }),
    canceladoMotivo: text("cancelado_motivo"),
    criadoEm: criadoEm(),
  },
  (t) => [
    uniqueIndex("pedidos_loja_numero_idx").on(t.lojaId, t.numero),
    index("pedidos_loja_status_idx").on(t.lojaId, t.status, t.criadoEm),
  ],
);

export const pedidoItens = pgTable(
  "pedido_itens",
  {
    id: serial("id").primaryKey(),
    pedidoId: integer("pedido_id").notNull().references(() => pedidos.id),
    produtoId: integer("produto_id").notNull().references(() => produtos.id),
    // Cópia do produto no momento do pedido: mudanças posteriores no catálogo não alteram o pedido.
    nome: text("nome").notNull(),
    unidade: text("unidade", { enum: ["un", "kg"] }).notNull(),
    // Unidades, ou quilos estimados (valor pedido ÷ preço do kg) nos itens por peso.
    quantidade: numeric("quantidade", { precision: 10, scale: 3, mode: "number" }).notNull(),
    precoUnitario: valor("preco_unitario").notNull(),
    // Gás: true = cliente tem o botijão vazio (só troca); false = levou o vasilhame junto.
    temVasilhame: boolean("tem_vasilhame"),
    precoVasilhame: valor("preco_vasilhame"),
    total: valor("total").notNull(),
    observacao: text("observacao"),
  },
  (t) => [index("pedido_itens_pedido_idx").on(t.pedidoId)],
);

export const auditoria = pgTable(
  "auditoria",
  {
    id: serial("id").primaryKey(),
    lojaId: integer("loja_id").references(() => lojas.id),
    usuarioId: integer("usuario_id").references(() => usuarios.id),
    acao: text("acao").notNull(),
    entidade: text("entidade").notNull(),
    entidadeId: integer("entidade_id"),
    dados: jsonb("dados"),
    criadoEm: criadoEm(),
  },
  (t) => [index("auditoria_loja_idx").on(t.lojaId, t.criadoEm)],
);
