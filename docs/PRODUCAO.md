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
