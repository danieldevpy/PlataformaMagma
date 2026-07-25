"""Quem é uma pessoa alcançável por WhatsApp — e quem não é.

Existe por causa de um incidente real (2026-07-25, ver
`.context/historico/2026-07-25-mag-respondendo-grupos.md`): a MAG
respondeu dentro de **quatro grupos** de WhatsApp, incluindo um grupo de
família e dois de turma, e num deles tratou o anúncio do instrutor como se
fosse um lead e acionou a equipe.

A causa é uma linha do workflow: `remoteJid.split('@')[0]`. Num chat
individual o `remoteJid` é `5521999999999@s.whatsapp.net` e isso devolve o
telefone; num grupo é `120363428559042188@g.us` e isso devolve o **id do
grupo**, que passa por número sem levantar suspeita — dígitos, sem
pontuação, plausível à vista.

O n8n passou a barrar isso na entrada, mas essa é a mesma classe de
proteção que a spec 023 já mostrou não bastar sozinha: quem garante
invariante de dado é o backend. Aqui é o segundo cadeado — nada vira
`Lead`, nem recebe toque automático, sem passar por ele.
"""

# Menor telefone internacional plausível (DDI + assinante) e teto do E.164.
# Um id de grupo tem 18+ dígitos e cai fora por aqui; `status@broadcast` e
# os JIDs de canal (`@newsletter`) caem fora por não serem só dígitos ou
# por comprimento.
MIN_DIGITOS = 10
MAX_DIGITOS = 15


def numero_de_pessoa(valor):
    """`valor` é um telefone de gente, alcançável por WhatsApp?

    Deliberadamente burro: só dígitos, comprimento plausível. Não tenta
    validar DDD nem operadora — o objetivo não é provar que o número
    existe (só o WhatsApp sabe disso), é recusar o que comprovadamente
    NÃO é pessoa. Errar pro lado de aceitar um telefone estranho é
    barato; errar pro lado de mandar mensagem pra um grupo já custou
    caro uma vez.
    """
    numero = (valor or "").strip()
    if not numero.isdigit():
        return False
    return MIN_DIGITOS <= len(numero) <= MAX_DIGITOS
