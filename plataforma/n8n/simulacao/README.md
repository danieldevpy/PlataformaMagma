# Simulação de conversa com a MAG (dev)

Ferramenta pra conversar com o agente do WhatsApp **sem WhatsApp**: injeta
o payload da Evolution direto no webhook do n8n de dev e lê a resposta do
banco de execuções.

Nasceu da bateria de 6 conversas simuladas de 25/07
(`.context/historico/2026-07-25-simulacoes-sdr-6-perfis.md`), que produziu
as specs 024–028. Está versionada porque três tarefas dependem dela e
porque reconstruí-la custa caro — o conhecimento embutido aqui (payload da
Evolution, `flatted` no `execution_data`, o truque do DDD 00) levou uma
sessão inteira pra descobrir:

- **024-T11** — rerodar os 6 perfis e comparar turno a turno
- **025-T12/T13** — as 3 formulações de pagamento e o ciclo do handoff
- **027-T1** — reproduzir o travamento do n8n sob carga crescente

## Como rodar

```bash
cd plataforma/n8n

# 1. Sobe o n8n aceitando os números de teste com DDD 00
docker compose -f docker-compose.dev.yml -f simulacao/override.dev.yml up -d

# 2. Copia o leitor pra dentro do container (some a cada recriação)
docker cp simulacao/ler_execucoes.js magma-n8n-dev:/tmp/ler_execucoes.js

# 3. Conversa (um turno por chamada; a memória do Redis mantém o fio)
simulacao/conversar.py 5500900000001 "Rafa" "oi, quanto custa o socorrista?"
simulacao/conversar.py 5500900000001 "Rafa" "e quando começa?"

# 4. QUANDO TERMINAR: devolve o dev ao estado normal
docker compose -f docker-compose.dev.yml up -d
```

Depois de recriar o container, o n8n leva ~15s a mais que o `healthz` pra
registrar os webhooks. Se o `conversar.py` der 404, espere e repita.

## Por que não chega em telefone de ninguém

Os números usam **DDD 00** (`5500 9xxxxxxxx`), que não existe. O fluxo roda
inteiro — buffer, identificação, agente, tools, backend — e só falha no
último nó, `Responder no WhatsApp (SDR)`, com "Bad request". Por isso as
execuções aparecem com status `error` mesmo quando a conversa foi
perfeita: **o erro é o esperado**, e é ele que garante a segurança do
teste. A instância Evolution de dev está conectada a um número real.

Efeito colateral: como o fluxo morre antes de `Registrar conversa (SDR)`,
estas conversas **não** entram em `conversas_conversa` (spec 021).

## Limpar entre rodadas

Sem isso a rodada seguinte mente pra você — o contato entra silenciado e a
memória contamina o teste:

```python
# manage.py shell --settings=config.settings.dev
from apps.nucleo.models import ContatoEscalado
from apps.leads.models import Lead
ContatoEscalado.objects.filter(numero__startswith="55009").delete()
Lead.objects.filter(whatsapp__startswith="55009").delete()
```

```bash
docker exec magma-n8n-redis-dev sh -c \
  "redis-cli --scan --pattern 'mag:*:55009*' | xargs -r redis-cli DEL"
```

Alternativa sem apagar nada: usar **números novos** a cada rodada
(`...0011`, `...0021`, …). Foi o que a sessão de 25/07 fez, e é mais
seguro quando você quer comparar rodadas.

## Ler execuções direto

```bash
docker exec magma-n8n-dev node /tmp/ler_execucoes.js 1600 | python3 -m json.tool
```

Devolve, por execução: o que o contato disse, o que a MAG respondeu, as
tools chamadas com os argumentos, o papel, se estava escalado, e em que nó
parou. É a fonte das transcrições do histórico.
