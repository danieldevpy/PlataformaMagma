# Spec 026 — Mídia curada no atendimento: a MAG mostra, não só descreve

> Ideia do Daniel na revisão da bateria de conversas de 25/07
> (`.context/historico/2026-07-25-simulacoes-sdr-6-perfis.md`):
>
> *"eu poderia até sugerir 'gostaria de conhecer melhor esse curso?
> acredito que seu filho iria gostar' e aí a pessoa querer saber mais que
> o normal, poder enviar foto/vídeo escolhido a dedo pelos gestores."*

## Problema / oportunidade

A MAG vende um curso cujo argumento principal é **prática** — manequim,
DEA, prancha, simulação de cenário real. E hoje ela vende isso **por
escrito**, no canal onde a foto é a linguagem nativa.

O acervo já existe e já é curado: a spec 008 organizou `Midia` em camadas
(turma, curso, instrutores, estrutura, geral) e a Mesa de Luz já tem
atalhos de curadoria (`destaque`, `capa`, `avaliacao`) usados pelo gestor
pra escolher o que presta. O que falta é a ponte: **nada disso chega no
WhatsApp**, que é justamente onde a decisão de compra acontece.

O efeito colateral que isso resolve é o achado 2 da spec 024 (ficha
técnica no lugar de convite): hoje, quando a MAG quer cativar, o único
recurso que ela tem é escrever mais. Com mídia, o convite tem pra onde
ir — *"quer ver como é a aula prática?"* passa a ser uma pergunta com
resposta, não retórica.

**Ponto inegociável:** quem escolhe o que a MAG mostra é o **gestor**, não
o modelo. A mídia sai de um conjunto curado a dedo; a IA só decide *a
hora* de oferecer, nunca *o que* existe pra oferecer.

## O que muda para o usuário

- **Contato:** ao demonstrar interesse mais fundo, recebe 1–2 fotos ou um
  vídeo curto da prática real da Magma — as mesmas imagens que o gestor
  aprovaria pra postar.
- **Contato:** vê a escola antes de decidir ir até lá; pra quem está em
  Belford Roxo pesando se vale o deslocamento, isso é o argumento.
- **Gestor:** marca a mídia uma vez na Mesa de Luz e ela passa a trabalhar
  no atendimento — sem mandar foto na mão, sem manter pasta paralela no
  celular.

## Critérios de aceite

- [ ] **Curadoria explícita.** Existe uma marcação nova de curadoria
      ("serve pro atendimento") aplicada na Mesa de Luz, do mesmo jeito
      que `destaque`/`capa`/`avaliacao` já são hoje.
- [ ] **A MAG só alcança o que foi marcado.** A ação nova devolve
      **exclusivamente** mídia com essa marcação — nunca o acervo inteiro,
      nunca mídia de turma sem consentimento.
- [ ] **Contexto respeitado.** Pedindo mídia do Socorrista APH, vem mídia
      do APH (camada `curso`) e da escola (camadas `estrutura`/`geral`) —
      não vem foto de outro curso.
- [ ] **Envio real.** A MAG manda a mídia pelo WhatsApp com legenda, e a
      pessoa recebe imagem/vídeo de verdade (não link).
- [ ] **Teto por conversa.** No máximo 2 envios de mídia por conversa —
      atendimento não é feed.
- [ ] **Sem mídia marcada = sem promessa.** Curso sem nenhuma mídia
      curada: a MAG **não oferece** ("quer ver fotos?") e segue a conversa
      normalmente. Nunca oferece o que não tem (regra 7 do SDR, spec 024).
- [ ] **LGPD:** nenhuma mídia de camada `turma` entra no conjunto
      disponível pro atendimento por padrão.
- [ ] Suíte completa verde, com teste de que a ação não vaza mídia não
      curada.

## Critério de aceite do gestor

O Daniel abre a Mesa de Luz **no celular**, marca 4 fotos como "serve pro
atendimento", e na conversa seguinte pelo WhatsApp a MAG oferece e manda
exatamente aquelas — sem ninguém tocar em código, config ou n8n.

## Fora de escopo

- Escolher a "melhor" mídia por IA. A ordem é a curadoria do gestor
  (`ordem`/`tags`), não julgamento do modelo.
- Mandar mídia **proativamente** (Nutridora, Radar). Aqui é só dentro da
  conversa, quando a pessoa demonstra interesse.
- Receber mídia do contato (foto de documento, comprovante). Outro
  assunto, outra spec.

## Perguntas abertas (decisão do Daniel na revisão)

1. **Tag nova (`atendimento`) ou reusar `destaque`?** Reusar é zero
   trabalho de UI, mas mistura dois propósitos ("melhor foto do acervo" ≠
   "foto que convence quem ainda não comprou"). Proposta: **tag nova**.
2. **Vídeo entra?** A Evolution manda vídeo, mas peso de arquivo em
   conexão da Baixada é real. Proposta: **começar só com foto**, vídeo
   depois de medir.
