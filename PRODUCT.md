# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users
Pós-graduandos e pesquisadores brasileiros procurando disciplinas isoladas (aluno especial) de computação, bioinformática e áreas afins. Contexto de origem: Fiocruz Rondônia / PGBCS, interessados em disciplinas remotas ou presenciais em Rondônia ligadas a GPU, docking e peptídeos. Job: ver rápido quais editais estão abertos e ir à inscrição.

## Product Purpose
Agrega editais de aluno especial de vários programas de pós em um só lugar, com status de inscrição (aberta, em breve, encerrada), modalidade (remota/presencial) e destaque dos temas de interesse. Sucesso = o usuário acha um edital aberto relevante e chega ao PDF/link de inscrição em segundos.

## Positioning
Dados raspados automaticamente 2x/dia (08:00 e 18:00 BRT) dos sites oficiais dos programas; nenhum dado é inventado (campo não encontrado = null).

## Capabilities and Constraints
- Next.js 16 (App Router, cacheComponents, React Compiler), JavaScript sem TypeScript, pnpm; deploy por push (rebuild lê data/disciplines.json).
- Dados: [data/disciplines.json](data/disciplines.json) gerado por scripts/scrape.mjs. Campos: name, institution, remote, inRondonia, regStart, regEnd, enrollStart, enrollEnd, regUrl, startDate, endDate, matches, note.
- Lógica de status em app/List.js (open/soon/closed/unknown/classOn/classSoon), datas em America/Sao_Paulo, calculadas só no cliente.
- Filtros atuais: busca, só abertas, só tema (GPU/docking), só remotas ou Rondônia.
- Novas funcionalidades autorizadas pelo usuário (ordenação, filtro por instituição, tema escuro, detalhes expansíveis, etc.).
- Stack de UI pedido: shadcn com base-ui, botões com cursor pointer.

## Brand Commitments
Título atual "Disciplinas PGBCS"; idioma pt-BR.

## Evidence on Hand
Dados reais em data/disciplines.json. Sem logos, depoimentos ou métricas; não fabricar.

## Product Principles
1. O edital aberto e o prazo vêm primeiro.
2. Dado ausente é mostrado como ausente, nunca adivinhado.
3. Link para a fonte oficial sempre a um clique.
4. Rápido de escanear, útil no celular.
