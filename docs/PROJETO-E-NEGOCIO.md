# Sistema de Pedidos Online — projeto, custos e preços

**Documento interno da Akylla Studio.** Base para a equipe vender, implantar e manter o sistema nos próximos clientes.
Não compartilhar com clientes: tem custos, margens e a condição especial do primeiro cliente.

> Última revisão: 30/10/2026. Os preços de fornecedores (Vercel, Neon, Meta, Mercado Pago) mudam com frequência e alguns estão em dólar. Antes de fechar proposta, confira os valores atuais nos links da seção 9.

---

## 1. O que é o produto

Uma **loja online própria** para supermercados, mercearias, açougues, depósitos de gás e bebidas, no estilo iFood, mas **sem comissão por pedido** e com a marca do cliente.

O cliente final abre a loja pelo celular, escolhe os produtos e paga. O pedido chega sozinho ao balcão, impresso, e ao WhatsApp do dono. O dono acompanha tudo por um painel, de casa.

**A ideia de venda:** "Seu delivery funcionando sozinho, sem pagar 12% a 27% de comissão para aplicativo."

### O que o sistema faz hoje (pronto e testado)

| Parte | O que faz |
|---|---|
| **Loja (vitrine)** | Fotos, categorias, busca, ofertas com preço "de/por", carrinho. Funciona no celular, tablet e computador. Instala como aplicativo (PWA) e abre a vitrine mesmo com internet ruim. Cores e logo do cliente. |
| **Produtos especiais de mercado** | Carne e itens por quilo pedidos **pelo valor** (ex.: "R$ 30 de acém"); gás com **troca de vasilhame** (preço com e sem botijão). |
| **Checkout** | Nome, telefone e endereço obrigatórios; taxa de entrega **fixa, por bairro ou grátis acima de um valor**; **pedido mínimo**; **bloqueio fora do horário**. |
| **Pagamento** | **Pix gerado no próprio site** (QR code e copia e cola) e **cartão** pela página segura do Mercado Pago, os dois pagos na hora. Também **dinheiro com troco** e **maquininha na entrega**. Pedido pago só é liberado depois que o Mercado Pago aprova. |
| **Impressão automática** | Programa instalado no computador do balcão imprime cada pedido sozinho na térmica de 80 mm (testado com Epson TM-T88V). Se a internet cair, imprime quando voltar. |
| **Aviso no WhatsApp** | Cada pedido liberado chega **sozinho** no WhatsApp da loja (via CallMeBot, gratuito). O cliente final também tem um botão para falar com a loja. |
| **Painel do lojista** | Pedidos do dia e faturamento, situação da impressora, produtos, **preço agendado** (promoção que entra no dia seguinte), categorias, **importação por planilha Excel**, horários, bairros, formas de pagamento, Mercado Pago, WhatsApp, usuários (administrador e operador). |
| **Segurança** | Senhas criptografadas, bloqueio após 5 tentativas, registro de quem alterou o quê (auditoria), chaves do Mercado Pago e do WhatsApp guardadas criptografadas, aviso do Mercado Pago conferido com assinatura secreta. |
| **Demonstração** | Versão de vitrine no GitHub Pages para mostrar ao cliente antes de fechar (sem banco, pagamentos simulados). |

### Como funciona um pedido (para explicar ao cliente)

1. O cliente final monta o carrinho e escolhe como pagar.
2. **Pix:** aparece o QR code na tela, ele paga no app do banco e a página confirma sozinha. **Cartão:** paga na página do Mercado Pago e volta. **Dinheiro ou maquininha:** o pedido já está confirmado.
3. Com o pedido confirmado (pago, ou para pagar na entrega), acontecem **automaticamente**:
   - o comprovante sai impresso no balcão;
   - o pedido chega no WhatsApp do dono;
   - o pedido aparece no painel.
4. A loja separa e entrega. Atualizar a situação no painel ("saiu para entrega") é opcional.

**Condições para ser 100% automático:** um computador ligado no balcão com o programa da impressora aberto (dá para abrir sozinho com o Windows) e o Mercado Pago conectado.

### Tecnologia (para a equipe técnica)

- **Next.js 16 + React 19 + Tailwind 4**, hospedado na **Vercel** (região São Paulo).
- **PostgreSQL no Neon**, acessado com Drizzle ORM. Um banco só atende várias lojas (multiloja: cada loja tem seu endereço `/nome-da-loja`).
- **Mercado Pago:** API de Orders para o Pix e Checkout Pro para o cartão (o mesmo formato já validado na Akylla Shop), webhook com assinatura, e três formas de confirmar o pagamento: webhook, página do pedido aberta e programa da impressora.
- **Programa da impressora:** Node.js sem dependências, impressão RAW no Windows (ESC/POS) ou por rede (porta 9100).
- **Código:** github.com/Tanattos18/Sistema-SaaS-Cleudes (manter **privado**). 42 testes automáticos (`npm test`).
- Guia técnico de instalação: [`PRODUCAO.md`](PRODUCAO.md). Manual de uso: [`COMO-USAR.md`](COMO-USAR.md).

---

## 2. Primeiro cliente: Supermercado Caixeta

| Item | Valor |
|---|---|
| Implantação (feita uma vez) | **R$ 1.200** |
| Mensalidade | **R$ 150/mês** |
| Condição | **Preço de cliente fundador (piloto)**, exclusivo deste cliente. Os próximos pagam a tabela da seção 6. |

**Por que foi mais barato:** foi o cliente que validou o produto. O sistema foi construído e testado com ele. Para os próximos, o sistema já chega pronto e validado, e isso tem outro valor.

**Recomendações para o contrato da Caixeta:**
- Deixar escrito que R$ 150 é condição de fundador, válida por 12 meses, com reajuste anual (IPCA) depois disso.
- **WhatsApp oficial da Meta não está incluído nos R$ 150.** Se o cliente quiser, há duas opções: repassar o custo de uso da Meta à parte ("conforme consumo") ou mudar a mensalidade. Hoje ele usa o aviso gratuito (CallMeBot), que não tem custo.
- As taxas do Mercado Pago (Pix e cartão) são descontadas direto do cliente pelo Mercado Pago; não passam pela Akylla.

---

## 3. Período de venda: tudo no nome da Akylla

Até a venda ser finalizada, o sistema fica **todo no nome do Joás / Akylla Studio**. Situação em 30/10/2026:

| Item | Hoje (no nome da Akylla) | Na entrega ao cliente |
|---|---|---|
| WhatsApp da loja (recebe os avisos e aparece no site) | **(62) 8151-7002**, número de testes do Joás | Trocar para o WhatsApp do cliente em **Configurações → Dados da loja** |
| Mercado Pago | Conta da **Akylla Shop** (mesma do akyllashop.com) | Conectar a conta Mercado Pago **do cliente** |
| Login do painel | E-mail do Joás | Criar um usuário administrador com o e-mail do cliente (o da Akylla fica para suporte) |
| Aviso automático no WhatsApp (CallMeBot) | Ativar com o celular do número de testes | Ativar de novo com o celular do cliente |
| Hospedagem (Vercel), banco (Neon), código (GitHub) | Contas da Akylla | **Continuam com a Akylla.** É um serviço por assinatura; o cliente não recebe o código |
| Endereço do site | sistema-saa-s-cleudes.vercel.app/caixeta | Opcional: domínio próprio (ex.: pedidos.supermercadocaixeta.com.br) |

Os dados do cliente (telefone, e-mail e senhas) foram retirados do código, da demonstração e do banco. O número do cliente ainda aparece no **histórico antigo do GitHub** (versões anteriores dos arquivos). Por isso o repositório precisa ficar **privado**.

### ⚠️ Cuidado com o Mercado Pago da Akylla

Com a conta da Akylla conectada, **o dinheiro de qualquer pedido pago no site cai na conta da Akylla**, e não na do supermercado. Então:

- Use **só para testes e demonstração**, com valores pequenos (ex.: um Pix de R$ 1,00 para mostrar ao cliente funcionando).
- **Antes de a loja começar a vender de verdade, troque para a conta do cliente.** Receber o dinheiro de vendas de outra empresa traz problema fiscal (o valor entra como receita da Akylla) e pode violar as regras do Mercado Pago.
- **Crie uma aplicação nova** na conta Mercado Pago da Akylla para este sistema (ex.: "Pedidos Caixeta"). Não use o Access Token da aplicação da Akylla Shop. Cada aplicação tem **um só endereço de webhook**, e o da aplicação atual aponta para o servidor da Akylla Shop. O dinheiro cai na mesma conta de qualquer jeito.

Passo a passo (cerca de 10 minutos):
1. Entre em mercadopago.com.br/developers/panel/app com a conta da Akylla → **Criar aplicação** → nome "Pedidos Caixeta", pagamentos online.
2. Em **Credenciais de produção**, copie o **Access Token** (começa com `APP_USR-`).
3. No painel do sistema: **Configurações da loja → Mercado Pago** → cole e clique em **Conectar e testar**.
4. Na aplicação → **Webhooks**: cole a URL que o painel mostra (`.../api/pagamentos/mercadopago/caixeta`), marque os eventos **Order (Mercado Pago)** e **Pagamentos** e salve. Copie a **assinatura secreta** e cole no painel em **Aviso automático de pagamento**.
5. Faça um pedido de R$ 1,00 com Pix para conferir: o pedido precisa imprimir e chegar no WhatsApp.

---

## 4. WhatsApp: gratuito (CallMeBot) ou oficial (Meta)

O sistema já manda o pedido sozinho para o WhatsApp da loja usando o **CallMeBot**. Compare antes de vender:

| | **CallMeBot** (já pronto no sistema) | **API oficial da Meta** (WhatsApp Cloud API) |
|---|---|---|
| Custo | Grátis | Cobrança **por mensagem** + um número dedicado |
| Configuração | 2 minutos: o dono manda uma mensagem para o robô e cola a chave no painel | Conta Meta Business verificada, número exclusivo (não pode ser usado no app do celular), modelo de mensagem aprovado pela Meta |
| Confiabilidade | Serviço gratuito e não oficial: **às vezes fica sem vagas** para cadastro novo e pode sair do ar | Oficial, estável, com garantia da Meta |
| Quem manda a mensagem | O robô do CallMeBot | O número oficial da loja ou da Akylla |
| Situação no sistema | **Pronto e testado** | **Ainda não implementado** (estimativa: 12 a 20 horas de desenvolvimento) |

> O CallMeBot ficou como opcional na Akylla Shop e não chegou a ser ativado lá, porque o robô estava sem vagas. O teste aqui foi feito com um CallMeBot simulado. Na primeira ativação real, confirme que a mensagem de teste chega.

### Quanto custa a Meta (para incluir na mensalidade)

Desde 2025 a Meta cobra **por mensagem enviada**. Um aviso de pedido para o dono é uma mensagem da categoria **"utilidade"**. As fontes divergem sobre o preço no Brasil: entre **US$ 0,0068 e US$ 0,022 por mensagem**, ou seja, cerca de **R$ 0,04 a R$ 0,12 por pedido** (com o dólar a R$ 5,50). A partir de julho/2026 a Meta passou a cobrar contas brasileiras em reais. Confirme o valor atual na tabela oficial antes de fechar.

| Pedidos por mês | Custo Meta por mês (R$ 0,04 a R$ 0,12 por aviso) | + número dedicado (chip) | **Total estimado** |
|---|---|---|---|
| 300 | R$ 12 a R$ 36 | ~R$ 20 | **R$ 32 a R$ 56** |
| 1.000 | R$ 40 a R$ 120 | ~R$ 20 | **R$ 60 a R$ 140** |
| 3.000 | R$ 120 a R$ 360 | ~R$ 20 | **R$ 140 a R$ 380** |

**Regra para as propostas:** o WhatsApp oficial entra nos planos com uma **franquia de avisos** (ex.: 1.000 por mês). O que passar disso é cobrado à parte (sugestão: R$ 0,15 por aviso), para um cliente com muito movimento não comer a margem.

**Recomendação:** comece todo cliente no CallMeBot, que é grátis. Ofereça a Meta como upgrade (plano Profissional ou Premium) para quem quer o canal oficial ou tem muito pedido.

---

## 5. Custos mensais para manter o sistema

### Custos fixos da Akylla (divididos entre todos os clientes)

| Serviço | Para quê | Custo | Em reais (US$ 1 = R$ 5,50) |
|---|---|---|---|
| **Vercel Pro** | Hospedagem do site e do painel | US$ 20/mês (1 usuário) + uso excedente | **~R$ 110** |
| **Neon** | Banco de dados | Grátis até ~0,5 GB (atende as primeiras lojas); **Launch: US$ 19/mês** quando crescer | **R$ 0 → ~R$ 105** |
| **GitHub** | Código (repositório privado) | Grátis | R$ 0 |
| **Total fixo** | | | **~R$ 110 a R$ 215/mês** |

> **Importante:** o plano **gratuito (Hobby) da Vercel é só para uso não comercial**. Com cliente pagando, o certo é o **Pro**. A Caixeta pode começar no Hobby durante os testes, mas, quando a loja começar a vender, passe para o Pro. Esse custo já paga todos os próximos clientes.

### Custos por cliente

| Item | Custo | Observação |
|---|---|---|
| Domínio próprio (opcional) | ~R$ 40/ano (.com.br) ≈ **R$ 3,50/mês** | Registro.br; pode ser pago pelo cliente |
| WhatsApp CallMeBot | **R$ 0** | |
| WhatsApp Meta (se contratado) | **R$ 32 a R$ 140/mês** | Ver tabela da seção 4 |
| Mercado Pago | **R$ 0 para a Akylla** | As taxas saem do dinheiro do cliente (ver abaixo) |
| Suporte | ~1 a 2 horas/mês por cliente | Ajustes de preço, dúvidas, impressora |

### Custo por cliente conforme a quantidade de clientes

| Clientes | Infra fixa (Vercel Pro + Neon Launch = R$ 215) por cliente | + domínio | **Custo por cliente sem Meta** | Com Meta (1.000 avisos) |
|---|---|---|---|---|
| 1 (só a Caixeta) | R$ 110 (Neon grátis) | R$ 3,50 | **~R$ 114** | ~R$ 174 a R$ 254 |
| 5 | R$ 43 | R$ 3,50 | **~R$ 47** | ~R$ 107 a R$ 187 |
| 10 | R$ 21,50 | R$ 3,50 | **~R$ 25** | ~R$ 85 a R$ 165 |
| 20 | R$ 11 | R$ 3,50 | **~R$ 15** | ~R$ 75 a R$ 155 |

**Leitura:** com só a Caixeta, os R$ 150 cobrem a infraestrutura com pouca sobra (~R$ 36). O sistema passa a dar lucro de verdade a partir do 3º ou 4º cliente, porque a infraestrutura é a mesma para todos.

**Impostos:** some o imposto sobre a mensalidade. No Simples Nacional, serviço de software costuma ficar a partir de ~6% (Anexo III), mas confirme com o contador.

### Taxas do Mercado Pago (pagas pelo cliente, informar na venda)

As taxas variam com o prazo de recebimento e o volume de vendas. As fontes divergem, então confirme no painel do Mercado Pago do cliente:
- **Pix:** de 0% a cerca de 1% (recebimento na hora pode chegar a 1,99%);
- **Cartão de crédito à vista:** cerca de 2,8% a 5% (mais caro para receber na hora; mais barato para receber em 14 ou 30 dias);
- **Débito:** cerca de 0,9% a 2%.

Mesmo assim, sai bem mais barato que o iFood: comissão de 12% no plano Básico (a loja entrega) ou 23% a 27% no plano Entrega, mais mensalidade e taxa de pagamento online.

---

## 6. Tabela de preços para os próximos clientes (sugestão)

### Implantação (paga uma vez)

| Pacote | O que inclui | Preço sugerido |
|---|---|---|
| **Padrão** | Loja com as cores e o logo do cliente, até 500 produtos importados da planilha dele com fotos do nosso banco de imagens, configuração (horários, bairros, taxas, pagamentos), Mercado Pago, WhatsApp, impressora instalada por acesso remoto, treinamento de 1 hora | **R$ 2.500** |
| **Completo** | Padrão + instalação presencial da impressora, domínio próprio configurado, revisão das fotos e da organização das categorias, 30 dias de acompanhamento | **R$ 3.500 a R$ 4.500** |

### Mensalidade

| Plano | Para quem | Inclui | Preço sugerido |
|---|---|---|---|
| **Essencial** | Loja pequena, até ~500 pedidos/mês | Tudo do sistema, aviso no WhatsApp gratuito (CallMeBot), suporte em horário comercial, atualizações | **R$ 299/mês** |
| **Profissional** | Movimento médio | Essencial + **WhatsApp oficial Meta com até 1.000 avisos/mês**, domínio próprio, até 2 ajustes de catálogo por mês feitos pela equipe | **R$ 399/mês** |
| **Premium** | Muito movimento ou mais de uma unidade | Profissional + **até 3.000 avisos/mês**, suporte prioritário (inclusive sábado), relatório mensal de vendas, ajustes ilimitados de catálogo | **R$ 499/mês** |

- Aviso Meta acima da franquia: **R$ 0,15 por aviso**.
- Reajuste anual pelo IPCA. Fidelidade mínima sugerida: 6 a 12 meses (a implantação dá trabalho).
- Desconto de 10% para pagamento anual adiantado.

**Margem estimada com 10 clientes** (antes do imposto e das horas de suporte): Essencial R$ 299 − R$ 25 ≈ **R$ 274**. Profissional R$ 399 − até R$ 165 ≈ **R$ 234 ou mais**. Premium R$ 499 − R$ 165 a R$ 405 (3.000 avisos, conforme o preço da Meta) ≈ **R$ 94 a R$ 334**; conforme o volume real, ajuste a franquia ou o preço do Premium.

### Comparação com o mercado (para argumentar na venda)

| Concorrente | Modelo | Preço (fontes de 2026, conferir) |
|---|---|---|
| **iFood** | Marketplace | 12% de comissão (Básico) ou 23–27% (Entrega) + mensalidade de ~R$ 100–150 + taxa de pagamento online |
| **Anota AI** | Cardápio digital e robô de WhatsApp | ~R$ 100 a R$ 300/mês, conforme o número de pedidos; taxa de adesão |
| **Goomer** | Cardápio digital | Grátis (até 30 pedidos/mês) e planos de R$ 99,90 a R$ 299,90/mês |
| **Cardápio Web** | Cardápio digital | ~R$ 170 a R$ 270/mês |

**Nosso diferencial** (os concorrentes são feitos para restaurante, não para mercado):
- produtos por peso pedidos pelo valor, gás com troca de vasilhame e catálogo grande (500+ itens) com importação por planilha;
- **promoção agendada** para o dia seguinte;
- **impressão automática** no balcão e WhatsApp automático, sem funcionário;
- Pix na própria página, sem comissão;
- marca do cliente e atendimento próximo (implantação feita pela gente).

Com isso, R$ 299 a R$ 499 fica na faixa dos concorrentes premium e muito abaixo do custo de um iFood para quem vende mais de ~R$ 4.000 por mês: 12% de R$ 4.000 já são R$ 480.

---

## 7. Valor de mercado do projeto

### Quanto custaria fazer do zero (desenvolvimento sob encomenda)

| Parte | Horas estimadas |
|---|---|
| Vitrine responsiva, PWA, carrinho, checkout com regras de entrega e horário | 40–60 h |
| Painel do lojista (produtos, preços agendados, planilha, categorias, configurações, usuários, auditoria) | 50–70 h |
| Pagamentos Mercado Pago (Pix no site, cartão, webhook com assinatura, confirmação redundante) | 20–30 h |
| Programa de impressão automática (ESC/POS, Windows e rede) | 15–25 h |
| Aviso automático no WhatsApp | 5–8 h |
| Segurança, testes automáticos, publicação, demonstração e catálogo com 500 produtos e fotos | 30–40 h |
| **Total** | **~160 a 230 horas** |

A **R$ 100 a R$ 150 por hora** (faixa de freelancer pleno ou sênior no Brasil), um projeto sob encomenda equivalente custaria **R$ 16.000 a R$ 35.000**. Esse é o argumento quando o cliente achar a implantação cara: ele paga uma fração disso porque o sistema é compartilhado.

### Valor como produto (SaaS)

Pequenos SaaS costumam ser avaliados em **2 a 4 vezes a receita anual recorrente**. Exemplos:
- 10 clientes × R$ 399 = R$ 3.990/mês → R$ 47.880/ano → **R$ 95 mil a R$ 190 mil**;
- 30 clientes → **R$ 290 mil a R$ 575 mil**.

Esses números são uma referência para metas, não uma avaliação formal.

---

## 8. Roteiro de implantação de um cliente novo (para a equipe)

1. **Proposta e contrato:** plano, implantação, fidelidade, quem paga o domínio, taxas do Mercado Pago informadas, e quem é responsável pelo computador e pela internet do balcão.
2. **Coletar:** logo, cores, endereço, WhatsApp, horários, bairros e taxas, pedido mínimo, planilha de produtos (modelo em **Produtos → Importar planilha**) e acesso ao Mercado Pago do cliente.
3. **Criar a loja** no banco (hoje pelo script `scripts/seed.ts`, adaptado com os dados do novo cliente; ver `PRODUCAO.md`) e o usuário administrador com o e-mail do cliente.
4. **Importar os produtos** pela planilha e revisar fotos e categorias.
5. **Mercado Pago:** o cliente cria a aplicação na conta dele, e a gente conecta o Access Token e o webhook (passo a passo na seção 3).
6. **WhatsApp:** ativar o CallMeBot no celular do cliente (ou a Meta, nos planos que incluem).
7. **Impressora:** instalar o Node.js e o programa no computador do balcão, baixar o `config.json` no painel, imprimir um teste e configurar para abrir com o Windows.
8. **Teste completo:** um pedido com Pix de R$ 1,00, um em dinheiro e um com maquininha. Os três precisam imprimir e chegar no WhatsApp.
9. **Treinamento** (1 hora): painel, preços e promoções, status dos pedidos, o que fazer se a impressora parar.
10. **Divulgação:** link e QR code da loja para o cliente colocar no Instagram, no WhatsApp e no balcão.

### Pontos de atenção (o que mais dá suporte)

- **Computador do balcão desligado** ou programa fechado: não imprime. Os pedidos ficam guardados e saem quando ele volta.
- **Impressora diferente da Epson:** teste antes de prometer. Precisa ser térmica de 80 mm com ESC/POS.
- **CallMeBot sem vagas:** o pedido chega no painel e na impressora do mesmo jeito. Ofereça o plano com Meta.
- **Mercado Pago do cliente com cadastro incompleto:** sem a conta verificada, o Pix e o cartão não funcionam. Peça para o cliente resolver antes da implantação.

---

## 9. Fontes dos preços (conferir antes de cada proposta)

- Vercel: vercel.com/pricing · referência de custo: [makerkit.dev](https://makerkit.dev/blog/saas/vercel-cost)
- Neon: neon.com/pricing
- WhatsApp (Meta): [developers.facebook.com/documentation/business-messaging/whatsapp/pricing](https://developers.facebook.com/documentation/business-messaging/whatsapp/pricing) · comparativos: [whautomate.com](https://whautomate.com/whatsapp-business-api-pricing-brazil), [montymobile.com](https://montymobile.com/newsroom/whatsapp-business-api-pricing-the-complete-2026-cost-guide-for-enterprise-teams/)
- Mercado Pago: [blog Mercado Pago (Pix)](https://www.mercadopago.com.br/blog/quanto-custa-receber-pagamentos-via-pix-e-codigo-qr) · [calculadoradetaxas.com.br](https://www.calculadoradetaxas.com.br/mercado-pago/taxas)
- iFood: [saipos.com/integracoes/ifood/taxa-ifood](https://saipos.com/integracoes/ifood/taxa-ifood)
- Concorrentes: [Goomer](https://goomer.com.br/blog/conheca-os-planos-da-goomer) · [Anota AI](https://reidodelivery.com.br/blog/anota-ai-vale-a-pena) · [Cardápio Web](https://reidodelivery.com.br/blog/cardapio-web-vale-a-pena)
