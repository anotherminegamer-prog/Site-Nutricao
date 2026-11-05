# Protótipo — monitor pessoal de saúde

Versão portável do artifact do Claude, para rodar fora dele. A interface é a
mesma; por baixo, login/senha/recuperação agora são feitos pelo
**Supabase Auth**, e os registros ficam numa tabela real (`entries`)
protegida por Row Level Security — o próprio banco garante que cada pessoa
só vê os próprios dados, não é mais uma regra só no código do app.

## 1. Criar o projeto (Supabase)

1. Crie uma conta em supabase.com e um novo projeto (tem plano gratuito).
2. No painel, abra **SQL Editor → New query**, cole o conteúdo de
   `supabase-schema.sql` e rode.
3. Em **Project Settings → API**, copie a **Project URL** e a
   **anon public key**.

## 2. Configurar o Auth (importante, é fácil esquecer)

Em **Authentication → URL Configuration**, no seu projeto Supabase:

- **Site URL**: coloque o endereço onde o site vai ficar (ex.:
  `https://seu-dominio.com`; para testar local, `http://localhost:5173`).
- **Redirect URLs**: adicione os dois — o de produção e
  `http://localhost:5173` — separados por vírgula ou um por linha,
  dependendo da versão do painel.

Isso é o que faz o link de confirmação de cadastro e o de "esqueci minha
senha" te trazerem de volta pro site certo, em vez de dar erro.

Em **Authentication → Providers → Email**, por padrão o Supabase exige
confirmar o e-mail antes do primeiro login funcionar. Para testar mais
rápido sozinho, dá pra desligar essa opção ali; para uso real, é melhor
deixar ligada.

## 3. Configurar o projeto localmente

```bash
cp .env.example .env
```

Abra `.env` e cole a URL e a chave que você copiou no passo 1.

```bash
npm install
npm run dev
```

Abra o endereço que aparecer no terminal e teste: criar conta, confirmar o
e-mail (se a opção estiver ligada), entrar, adicionar registros, sair e
entrar de novo — e testar "esqueci minha senha" também.

## 4. Colocar no ar

Suba este projeto para um repositório no GitHub e conecte na
[Vercel](https://vercel.com) ou [Netlify](https://netlify.com) (plano
gratuito, detectam projetos Vite sozinhas).

Nas **Environment Variables** do projeto na Vercel/Netlify, adicione as
mesmas duas variáveis do `.env`:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Depois do deploy, volte no painel do Supabase (passo 2) e atualize a
**Site URL** e as **Redirect URLs** para o endereço público de verdade
(ex. `https://seu-projeto.vercel.app`, e depois seu domínio próprio).

## 5. Conectar seu próprio domínio

No painel da Vercel/Netlify: **Settings → Domains → Add**, digite seu
domínio e siga as instruções de DNS no site onde ele foi registrado. Não
esqueça de repetir o ajuste da **Site URL** no Supabase (passo 2) depois
que o domínio estiver no ar.

## O que mudou em relação à versão anterior

- **Sem código de senha na mão**: cadastro, login, limite de tentativas e
  recuperação de senha (por e-mail de verdade, não mais por código gerado
  na hora) são todos do Supabase Auth.
- **Sessão persiste**: antes, sair da página sempre te deslogava (de
  propósito, porque a chave de cifra só existia na memória). Agora, como
  não há mais essa chave, a sessão do Supabase persiste — recarregar a
  página não desloga.
- **Sem criptografia própria dos registros**: os valores ficam guardados
  como colunas normais no Postgres, não mais cifrados com AES pelo app. A
  proteção agora vem da Row Level Security (cada pessoa só acessa a própria
  linha) e da criptografia em repouso que o próprio Supabase já mantém na
  infraestrutura dele — só que isso não é mais "nem o Supabase consegue
  ler", como era antes. Se esse ponto for importante pra você (zero-
  knowledge de verdade), me avise — dá pra reconstruir, mas é um desenho
  diferente e conflita com deixar o Supabase cuidar da recuperação de senha
  por e-mail.

## Metas, pontos e cosméticos

Se você já tinha rodado uma versão anterior do `supabase-schema.sql`, rode de
novo o arquivo inteiro. Ele agora é **idempotente** (usa `if not exists` e
`drop policy if exists`), então pode ser executado quantas vezes precisar, sem
erro de "already exists" e sem perder dados. Esta versão também adiciona a
função `seed_default_goals`, o trigger `enforce_goal_completion` e as
validações descritas abaixo — **rode o arquivo antes de subir o novo código do
site**, porque o site passou a depender dessa função.

Como funciona:

- Toda conta começa com um catálogo padrão de 8 metas diárias (definido em
  `DEFAULT_GOALS`, em `src/lib/helpers.js`). A semeadura roda dentro do banco
  (função `seed_default_goals`, com lock), no primeiro carregamento da tela
  de Metas: abrir duas abas ao mesmo tempo não duplica as metas, e quem
  removeu todas de propósito não as ganha de volta.
- Cada meta concluída no dia soma pontos (10 por padrão); a mesma meta não
  pode ser concluída duas vezes no mesmo dia.
- Os pontos **não vêm do site**: o trigger `enforce_goal_completion` copia os
  pontos da própria meta, só aceita a data de hoje (com 1 dia de folga para
  fuso) e limita a 20 conclusões por dia. Toda meta vale 10 pontos, fixado por
  constraint.
- Pontos servem pra desbloquear cores de fundo da própria tela de Metas —
  branco e preto são grátis sempre; as outras têm um custo. A aparência de
  cada cor (`COSMETIC_STYLES`) fica no código, mas o **preço** vem da tabela
  `cosmetics` no banco — é essa tabela que decide o valor de verdade.
- O preço é validado dentro do próprio Postgres: a política de RLS em
  `cosmetic_unlocks` recalcula o saldo de pontos (ganho menos já gasto) e
  só deixa a linha de desbloqueio entrar se o saldo cobrir o preço da tabela
  `cosmetics` — não o que o site eventualmente mandar. Isso fecha a brecha
  que existia antes: nem chamando a API do Supabase direto, pulando o site,
  dá pra desbloquear uma cor sem pontos suficientes.
- As datas usam o **fuso local** de quem usa o app (antes usavam UTC, e depois
  das 21h no Brasil o app já achava que era o dia seguinte).

## Estrutura do código

- `src/App.jsx` — componentes e lógica de estado.
- `src/App.css` — estilos (antes ficavam numa string dentro do `App.jsx`).
- `src/lib/helpers.js` — datas, constantes e utilitários.

## Dietas recomendadas

Na aba **Dietas** o app recomenda de 1 a 3 padrões alimentares reais (Guia
Alimentar Brasileiro, Mediterrânea, DASH, low carb moderada, baixo índice
glicêmico, vegetariana, vegana e ganho de massa magra), cada um com base
científica citada, como seguir, o que priorizar/reduzir e um dia de exemplo.

Etapas que a pessoa percorre para a recomendação ser correta:

1. **Dados básicos** - nascimento, sexo e altura.
2. **Rotina e objetivo** - nível de atividade do dia a dia, objetivo, refeições
   por dia, tempo para cozinhar e orçamento.
3. **Restrições e alergias** - vegetariano, vegano, sem lactose, sem glúten,
   alergia a oleaginosas, alergia a peixes/frutos do mar.
4. **Triagem de saúde** - pressão alta, diabetes, colesterol, doença cardíaca ou
   renal, gestação/amamentação, histórico de transtorno alimentar (com
   consentimento explícito).
5. **Peso** (obrigatório), **sono** (3 noites nos últimos 7 dias) e
   **exercício** (semana) vindos dos registros do painel. Sono e exercício são
   opcionais, mas aumentam a precisão.

Como a recomendação é calculada (`src/lib/diet.js`):

- Gasto energético: Mifflin-St Jeor x fator do dia a dia + exercício registrado
  (~4 METs). Perda = déficit de até 15% (máx. 500 kcal), com piso de 1.200
  (mulheres) / 1.500 (homens) kcal; ganho = superávit de até 300 kcal.
- Proteína tem piso por kg (1,2 g/kg na perda; 1,6 g/kg no ganho).
- Cada dieta recebe uma pontuação por objetivo, condições de saúde, restrições
  (incompatíveis são excluídas; as adaptáveis trazem instruções), tempo de
  preparo, orçamento, sono e volume de exercício.
- **Regras de segurança**: menores de 18 anos, histórico de transtorno
  alimentar, gestação/amamentação e doença renal **não recebem metas
  numéricas** e só veem o guia alimentar geral; IMC < 18,5 nunca recebe meta de
  emagrecimento; diabetes e doença cardíaca recebem aviso para alinhar com o
  médico.

As dietas e regras ficam em `src/lib/dietData.js` (conteúdo) e
`src/lib/diet.js` (cálculo). **Isto é orientação geral, não prescrição**: a
tela deixa isso claro e recomenda um nutricionista/médico. O perfil de saúde
(tabela `health_profiles`) é dado sensível: protegido por RLS, e a pessoa pode
apagá-lo na própria tela. Se o site for público, revise com um nutricionista
responsável e a política de privacidade (LGPD) antes de publicar.

**Rode o `supabase-schema.sql` de novo** para criar a tabela `health_profiles`.