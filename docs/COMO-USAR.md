# Supermercado Caixeta — como usar o sistema

> As senhas **não** ficam neste arquivo, porque ele vai para o GitHub.
> Elas estão em **`ACESSOS-PRIVADO.md`**, na raiz da pasta do projeto. Esse arquivo fica só no seu computador (está no `.gitignore`).
>
> Custos, preços e o roteiro para novos clientes ficam em `docs/PROJETO-E-NEGOCIO.md`, documento interno da Akylla que também fica só no seu computador.

## Links

| O quê | Endereço |
|---|---|
| Loja (o cliente faz o pedido) | https://sistema-saa-s-cleudes.vercel.app/caixeta |
| Área do lojista (painel) | https://sistema-saa-s-cleudes.vercel.app/login |
| Verificação do sistema | https://sistema-saa-s-cleudes.vercel.app/api/saude |
| Demonstração (GitHub Pages, sem banco) | https://tanattos18.github.io/Sistema-SaaS-Cleudes/ |
| Código no GitHub | https://github.com/Tanattos18/Sistema-SaaS-Cleudes |
| Hospedagem do site | https://vercel.com (projeto `sistema-saa-s-cleudes`) |
| Banco de dados | https://console.neon.tech |
| Mercado Pago (credenciais) | https://www.mercadopago.com.br/developers/panel/app |

A página **/api/saude** mostra se o site está conectado ao banco sem exibir senhas. Quando está tudo certo, ela mostra `"banco":"conectado"`.

## Para o cliente (loja)

1. Abre o link da loja no celular, no tablet ou no computador. Dá para instalar como aplicativo: no Android, use **Adicionar à tela inicial**; no iPhone, **Compartilhar → Adicionar à Tela de Início**.
2. Escolhe os produtos. A carne é pedida pelo valor (ex.: R$ 30 de acém), e o gás é a troca do vasilhame.
3. No carrinho, clica em **Finalizar** e preenche nome, telefone e endereço, que são obrigatórios.
4. Escolhe como pagar:
   - **Pix**: o QR code e o código copia e cola aparecem na própria página do pedido. O cliente paga no app do banco e a página confirma sozinha. O Pix vale por 30 minutos; depois disso, ele gera um novo pelo botão.
   - **Cartão de crédito ou débito**: paga na página segura do Mercado Pago e volta para o pedido.
   - **Dinheiro**: paga ao entregador e pode pedir troco.
   - **Maquininha na entrega**: o entregador leva a maquininha.
5. Com o pedido confirmado (na entrega, na hora; Pix e cartão, depois de aprovados), ele **é impresso sozinho no balcão** e **chega sozinho no WhatsApp da loja**, se o aviso automático estiver ligado. O cliente fica com o link para acompanhar.

Fora do horário de funcionamento, a loja não aceita pedidos. Pedidos abaixo do valor mínimo também são bloqueados.

## Para o lojista (painel)

Entre em **/login** com o e-mail e a senha do administrador. No primeiro acesso com senha provisória, o sistema pede uma senha nova.

| Menu | Para que serve |
|---|---|
| **Pedidos** | Resumo do dia e pedidos novos. Abra um pedido para mudar a situação (em separação → saiu para entrega → entregue), reimprimir ou cancelar. |
| **Produtos** / **+ Novo produto** | Cadastrar, editar, pausar e pôr foto, preço e categoria. Dentro do produto dá para **agendar um preço** para outro dia. |
| **Preços e promoções** | Mudar vários preços de uma vez e programar promoções (ex.: cadastra hoje e a oferta vale amanhã). |
| **Categorias** | Criar, renomear e ordenar as seções da loja. |
| **Importar planilha** | Baixar o modelo em Excel, preencher e enviar para cadastrar ou atualizar vários produtos. |
| **Configurações da loja** | Dados e WhatsApp, valor mínimo, taxa de entrega (fixa, por bairro ou grátis acima de um valor), formas de pagamento, Mercado Pago, horários e impressora. |
| **Usuários** | Criar acessos para funcionários. O perfil **operador** só cuida de pedidos; o **administrador** mexe em tudo. |
| **Minha senha** | Trocar a própria senha. |

Por segurança, depois de 5 senhas erradas seguidas o login fica bloqueado por um tempo.

### Ligar o pagamento online (Mercado Pago)

1. No painel do Mercado Pago (link acima), crie uma aplicação **só para este sistema** e copie o **Access Token**. Use o de **teste** para experimentar e o de **produção** para valer.
2. No sistema, abra **Configurações da loja → Mercado Pago**, cole o token e clique em **Conectar e testar**. Ele fica guardado criptografado.
3. Abra **Aviso automático de pagamento (webhook)**, logo abaixo, e siga os passos: coloque a URL mostrada na aplicação do Mercado Pago (eventos **Order** e **Pagamentos**) e cole a **assinatura secreta** no painel.
4. Enquanto o Mercado Pago não estiver conectado, as opções Pix e Cartão não aparecem para o cliente. Dinheiro e maquininha continuam funcionando.

O pagamento aprovado é confirmado de três formas: pelo aviso do Mercado Pago, pela página do pedido aberta e pelo programa da impressora, que confere a cada 15 segundos. Se uma falhar, as outras liberam o pedido.

### Avisos de pedido (notificação e WhatsApp)

Cada pedido confirmado (na entrega, na hora; Pix e cartão, depois de aprovados) avisa o dono sozinho:

**Notificação no painel (grátis):**
1. Abra o painel no celular ou no computador que deve receber os avisos. No celular, instale antes: no Android, **Adicionar à tela inicial**; no iPhone, **Compartilhar → Adicionar à Tela de Início**, e abra pelo ícone (no iPhone é obrigatório).
2. Na tela de **Pedidos** (ou em **Configurações da loja → Avisos de pedido**), toque em **Ativar avisos neste aparelho** e permita as notificações.
3. Toque em **🔔 Enviar aviso de teste**. A notificação chega com som, mesmo com o painel fechado. Tocar nela abre o pedido.
4. Repita em cada aparelho que deve receber (o do dono, o do balcão etc.).

**WhatsApp da loja (API oficial da Meta):** em **Configurações da loja → Avisos de pedido**, clique em **Ligar aviso no WhatsApp**. Cada pedido chega como mensagem no WhatsApp cadastrado em **Dados da loja**, enviada pelo número oficial da Akylla. Só aparece depois que a Akylla configurar o número oficial no servidor (ver `docs/PRODUCAO.md`).

### Impressora do balcão (térmica 80 mm ou impressora comum A4)

1. No computador do balcão, instale o **Node.js** (https://nodejs.org, versão LTS).
2. Numa pasta (ex.: `C:\Impressora`), salve os arquivos `agente.js`, `imprimir-windows.ps1`, `imprimir-comum.ps1`, `iniciar.bat` e `LEIA-ME.txt`, que estão em https://sistema-saa-s-cleudes.vercel.app/impressora/agente.js (troque o nome no fim do endereço para baixar cada um) ou na pasta `public/impressora` do projeto. Na mesma pasta, salve o **config.json** baixado em **Configurações da loja → Impressora**.
3. Dê dois cliques em **iniciar.bat**. O painel passa a mostrar **"Programa conectado no computador ..."**.
4. Em **Configurações da loja → Impressora do balcão → Qual impressora imprime os pedidos**, escolha o tipo (térmica USB, impressora comum A4 ou térmica de rede), a impressora na lista (o programa manda a lista das impressoras instaladas naquele computador) e o número de vias. Salve.
5. Clique em **🖨️ Imprimir página de teste**. A folha sai em poucos segundos.
6. A partir daí, os pedidos novos (e os pagos, depois de aprovados) saem impressos sozinhos. Para trocar de impressora depois, é só escolher outra no painel: o programa troca sozinho, sem mexer no computador. O passo a passo completo está em `public/impressora/LEIA-ME.txt`.
7. Se trocar a chave da impressora no painel, baixe o config.json de novo.

## Para quem mantém o sistema

| Tarefa | Comando (na pasta do projeto) |
|---|---|
| Rodar no computador | `npm run dev` e abrir http://localhost:3000/caixeta |
| Testes automáticos | `npm test` |
| Redefinir uma senha (banco local) | `npm run db:senha -- email@exemplo.com NovaSenha` |
| Redefinir uma senha (banco de produção) | `npx tsx --env-file=.env.producao scripts/redefinir-senha.ts email@exemplo.com NovaSenha` |
| Criar tabelas, loja e produtos no Neon | `npm run db:producao` |
| Atualizar a demonstração do Pages | `npm run pages:catalogo` e depois commit e push |

- **Publicar mudanças:** basta dar *push* na branch `main`. O Vercel atualiza o site sozinho, e o GitHub Pages atualiza a demonstração.
- **Variáveis do Vercel** (Settings → Environment Variables): `DATABASE_URL` (URL *pooled* do Neon, com `-pooler`), `SESSION_SECRET` e, opcionalmente, `SITE_URL` quando houver domínio próprio. Depois de mudar alguma, faça **Redeploy**.
- O guia de instalação completo está em [`PRODUCAO.md`](PRODUCAO.md).
