// Lê as execuções do workflow do agente MAG direto do SQLite do n8n e
// devolve JSON legível: o que o contato disse, o que a MAG respondeu, e
// quais tools ela chamou.
//
// Roda DENTRO do container (`docker exec magma-n8n-dev node /tmp/ler_execucoes.js 1600`),
// porque os módulos `sqlite3` e `flatted` são do próprio n8n — o payload
// da execução é serializado com `flatted` (grafo com ciclos), então
// `JSON.parse` não dá conta.
//
//   uso: node ler_execucoes.js [id_minimo]
//
// O caminho dentro do pnpm store muda entre versões do n8n. Se o require
// falhar, ache o novo com:
//   find /usr/local/lib/node_modules/n8n -iname '*sqlite3*' -type d

const fs = require('fs');

const PNPM = '/usr/local/lib/node_modules/n8n/node_modules/.pnpm';
const acharModulo = (prefixo) => {
  const dir = fs.readdirSync(PNPM).find((d) => d.startsWith(prefixo + '@'));
  if (!dir) throw new Error(`módulo ${prefixo} não achado em ${PNPM}`);
  return `${PNPM}/${dir}/node_modules/${prefixo}`;
};

const sqlite3 = require(acharModulo('sqlite3'));
const flatted = require(acharModulo('flatted'));

const WORKFLOW = process.env.MAGMA_WORKFLOW_ID || 'ypeJKZLsGq1WxkQB';
const desde = parseInt(process.argv[2] || '0', 10);

const db = new sqlite3.Database(
  '/home/node/.n8n/database.sqlite',
  sqlite3.OPEN_READONLY,
);

const sql = `
  SELECT e.id, e.status, e.startedAt, d.data
    FROM execution_entity e
    JOIN execution_data d ON d.executionId = e.id
   WHERE e.workflowId = ? AND e.id > ?
   ORDER BY e.id ASC`;

db.all(sql, [WORKFLOW, desde], (err, linhas) => {
  if (err) {
    console.log(JSON.stringify({ erro: err.message }));
    return;
  }

  const saida = [];
  for (const linha of linhas) {
    let dados;
    try {
      dados = flatted.parse(linha.data);
    } catch (e) {
      saida.push({ id: linha.id, erro: 'não deu pra parsear' });
      continue;
    }

    const runData = (dados.resultData && dados.resultData.runData) || {};
    const json1 = (no) => {
      try {
        return runData[no][0].data.main[0][0].json;
      } catch (e) {
        return null;
      }
    };

    const consolidado = json1('Consolidar mensagens');
    const contexto = json1('Preparar contexto SDR');

    let respostaAgente = null;
    let tools = [];
    try {
      const agente = runData['SDR - Capitã de Matrículas'][0].data.main[0][0].json;
      respostaAgente = agente.output;
      tools = (agente.intermediateSteps || []).map((passo) => ({
        tool: passo.action && passo.action.tool,
        input: passo.action && passo.action.toolInput,
      }));
    } catch (e) {
      /* execução que não chegou no agente (buffer descartado, escalado…) */
    }

    const erro = dados.resultData && dados.resultData.error;

    saida.push({
      id: linha.id,
      status: linha.status,
      startedAt: linha.startedAt,
      numero: consolidado ? consolidado.numero : contexto && contexto.numero,
      contato_texto: consolidado ? consolidado.texto : null,
      papel: contexto ? contexto.papel : null,
      escalado: contexto ? contexto.escalado : null,
      agente_texto: respostaAgente,
      tools,
      erro: erro ? { no: erro.node && erro.node.name, msg: erro.message } : null,
      nos: Object.keys(runData),
    });
  }

  console.log(JSON.stringify(saida, null, 1));
});
