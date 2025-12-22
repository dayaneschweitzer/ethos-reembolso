# ETHOS - Reembolso (v0.1) — Frontend com API Mockada

Este repositório contém um starter em **Angular (standalone + routing)** para o teste técnico de **Reembolso**.
A v0.1 implementa:
- **Tela 1:** Minhas Solicitações (listagem)
- **Tela 2:** Novo Reembolso (criação + itens + comprovantes locais)
- **Mocs de API** via `HttpInterceptor` (sem depender do ERP no desenvolvimento local)

## Requisitos
- Node.js 18+ (recomendado)
- npm 9+

## Como rodar
```bash
npm install
npm start
```
Acesse: `http://localhost:4200`

## Configuração
- `src/environments/environment.ts`
  - `useMocks: true` para usar o `MockInterceptor`
  - `apiBaseUrl` aponta para o host do ERP (mantido para futura integração real)

## Estrutura
- `src/app/core` → infra (ApiClient, models, mocks)
- `src/app/features` → telas/fluxos (solicitações e reembolso)
