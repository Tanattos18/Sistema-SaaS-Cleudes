# Colocando o sistema no ar (Vercel + Neon)

O site roda na **Vercel** e o banco PostgreSQL fica no **Neon**, os dois em São Paulo.
Para a demonstração, os planos gratuitos bastam.

## 1. Banco de dados no Neon

1. Entre em <https://neon.tech> com a sua conta do GitHub.
2. Crie um projeto: nome `pedidos`, PostgreSQL 17, região **AWS South America (São Paulo)**.
3. Em **Connect**, copie duas URLs:
   - a **pooled** (o endereço tem `-pooler`): é a que vai para a Vercel;
   - a **direta** (desligue "Connection pooling"): é a que você usa para criar as tabelas.

## 2. Criar as tabelas e a loja (no seu computador)

Na pasta do projeto, crie o arquivo `.env.producao`. Ele não vai para o GitHub.

```
DATABASE_URL=postgresql://...URL DIRETA do Neon...
ADMIN_EMAIL=email-do-dono@exemplo.com
ADMIN_PASSWORD=
```

Depois rode:

```bash
npm run db:producao
```

Esse comando cria as tabelas, a loja Caixeta, o usuário administrador e os 501 produtos de demonstração.
**Anote a senha provisória que aparece na tela**: ela aparece uma única vez, e no primeiro acesso o sistema pede uma senha nova.
Rodar de novo não duplica nada; use o mesmo comando sempre que houver uma atualização com mudança no banco.

## 3. Site na Vercel

1. Entre em <https://vercel.com> com a sua conta do GitHub.
2. **Add New → Project** e importe o repositório `Tanattos18/Sistema-SaaS-Cleudes`.
3. Em **Environment Variables**, cadastre:

   | Nome | Valor |
   |---|---|
   | `DATABASE_URL` | a URL **pooled** do Neon (com `-pooler`) |
   | `SESSION_SECRET` | gere com o comando abaixo |

   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
   ```
4. Clique em **Deploy**. Em 1 ou 2 minutos o site fica no ar, em `https://<nome-do-projeto>.vercel.app`:
   - vitrine: `/caixeta`
   - painel: `/login`

Cada `git push` na `main` publica uma versão nova sozinho. A região (São Paulo) já está no `vercel.json`.

## 4. Depois da demonstração

- **Domínio próprio:** em *Settings → Domains* na Vercel, adicione o domínio e ajuste o DNS. O HTTPS é automático. Depois cadastre `SITE_URL=https://seu-dominio` nas variáveis.
- **Planos:** o plano gratuito da Vercel (Hobby) é só para uso não comercial. Com o cliente pagando, mude para o **Pro** (cerca de US$ 20 por mês).
  O Neon gratuito tem 0,5 GB e "dorme" sem uso, então o primeiro acesso depois de um tempo parado demora cerca de 1 segundo. Com movimento diário, vale o plano pago.
- **Backup:** o Neon guarda o histórico para restauração por alguns dias (*Restore*). Para guardar por mais tempo, faça uma cópia periódica com `pg_dump`.

## Demonstração no GitHub Pages

O GitHub Pages está configurado como **Deploy from a branch → main / (root)**. A página `index.html` da raiz leva para
`site-demo/`, a demonstração estática da vitrine (sem servidor: o pedido vai direto para o WhatsApp). As fotos e os ícones
são lidos de `public/`, os mesmos do sistema completo. Cada `git push` na `main` atualiza o site em 1 a 2 minutos:
<https://tanattos18.github.io/Sistema-SaaS-Cleudes/>

Depois de mudar produtos de demonstração, rode `npm run pages:catalogo` para refazer `site-demo/catalogo.json` e `site-demo/creditos.html`.

## Impressora do balcão

O programa `public/impressora/agente.js` roda no PC da loja (precisa do Node.js) e, a cada 5 segundos, busca em
`/api/impressao/pendentes` os pedidos novos ainda não impressos, imprime na Epson TM-T88V (ESC/POS, 80 mm) e confirma em
`/api/impressao/confirmar`. Funciona com a impressora no USB (instalada no Windows) ou na rede (porta 9100).

A instalação passo a passo está no painel, em **Configurações → Impressora do balcão**, de onde se baixa o `config.json`
já com a chave da loja. Instruções detalhadas no `LEIA-ME.txt` da mesma pasta.

## WhatsApp oficial (Meta): número da Akylla que avisa as lojas

Um número só, da Akylla, manda o aviso de pedido para o WhatsApp de todas as lojas que ligarem a opção no painel. A Meta cobra por mensagem (categoria "utilidade"), na conta da Akylla.

1. **Meta Business:** em business.facebook.com, crie (ou use) o portfólio da Akylla Studio e faça a verificação da empresa.
2. **Aplicativo:** em developers.facebook.com → **Meus apps → Criar app** → tipo **Empresa** → adicione o produto **WhatsApp**. A Meta já dá um **número de teste** gratuito, que manda mensagem para até 5 números cadastrados. Dá para testar com ele antes de ter o número definitivo.
3. **Número definitivo:** em **WhatsApp → Configuração da API → Adicionar número**, cadastre um chip só para isso (ex.: "Akylla Pedidos"). Esse número **não pode** estar em uso no aplicativo do WhatsApp do celular.
4. **Modelo de mensagem:** em **WhatsApp Manager → Modelos → Criar**: nome `novo_pedido`, categoria **Utilidade**, idioma **Português (BR)**, com este texto (as 7 variáveis nessa ordem):
   ```
   🛒 Novo pedido nº {{1}} na {{2}}
   Total: {{3}} ({{4}})
   Cliente: {{5}}, bairro {{6}}
   Ver o pedido completo: {{7}}
   ```
   Envie para aprovação; costuma sair em minutos ou horas.
5. **Token permanente:** em business.facebook.com → **Configurações → Usuários do sistema → Adicionar** (administrador) → **Gerar token** para o app, com as permissões `whatsapp_business_messaging` e `whatsapp_business_management`, sem validade. Copie o token.
6. **Na Vercel** (Settings → Environment Variables), cadastre e depois faça **Redeploy**:
   - `WHATSAPP_TOKEN`: o token do passo 5;
   - `WHATSAPP_PHONE_NUMBER_ID`: em **WhatsApp → Configuração da API**, o "Identificação do número de telefone" (não é o número em si);
   - opcionais: `WHATSAPP_MODELO` (padrão `novo_pedido`) e `WHATSAPP_IDIOMA` (padrão `pt_BR`).
7. No painel da loja: **Configurações → Avisos de pedido → Ligar aviso no WhatsApp** e **Enviar aviso de teste**.

Se a mensagem não chegar, o motivo aparece no teste do painel (ex.: modelo ainda não aprovado, número de destino não cadastrado no número de teste).
