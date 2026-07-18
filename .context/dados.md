# Dados, seed e ambientes

> Detalhe: `docs/plataforma/08-conteudo-inicial-seeds.md` (seed-first) e `01-arquitetura.md`.

## Ambientes

| | Dev | Prod |
|---|---|---|
| Subir | `plataforma/init-dev.sh` | `plataforma/init-prod.sh` + `docker-compose.prod.yml` |
| Banco | SQLite (`db.sqlite3`, fora do git) | MySQL (PyMySQL + cryptography) |
| Web | runserver + next dev (porta 8000 local costuma estar ocupada por outra app) | nginx no HOST da VPS → containers em portas loopback |
| Mídia | `backend/media/` (fora do git), URLs relativas | volume + nginx; **pendente aplicar `client_max_body_size 1g` no host** |

## Seed-first (constituição §1)

- Todo conteúdo do template é registro inicial no banco; `conteudo_origem="template"` pode ser re-seedado, `"editado"` NUNCA é sobrescrito.
- Seed deve ser idempotente (rodar 2× não muda nada). Comando completo do doc 08 ainda pendente (ver `status.md`).
- `backend/data.json` é dump local de trabalho — fora do git.

## Mídia

- Originais + thumbs 480px (Pillow, corrige EXIF Orientation) em `media/`; vídeos sem transcode/thumb.
- Dedup por `meta.nome_original` + `meta.size`; itens antigos sem `nome_original` ficam fora da checagem (sem backfill).
