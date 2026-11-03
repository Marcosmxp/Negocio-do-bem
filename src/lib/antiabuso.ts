import "server-only";
import { createHash } from "node:crypto";
import { headers } from "next/headers";
import { ipDoCabecalho, JANELA_MS } from "@/lib/auth/tentativas";
import { db } from "@/lib/db";

/**
 * Proteção complementar aos limites de login e às regras de cada operação.
 * Os limiares de WAF e os sinais de deteção de campanhas ficam na configuração
 * privada da infraestrutura; estes são apenas orçamentos de escrita da aplicação.
 */
export type OperacaoControlada = "depoimento" | "denuncia" | "indicacao" | "reivindicacao";

const ORCAMENTOS = {
  depoimento: { conta: 8, origem: 200, negocio: 60 },
  denuncia: { conta: 12, origem: 200, negocio: 80 },
  indicacao: { conta: 24, origem: 200, negocio: null },
  reivindicacao: { conta: 5, origem: 200, negocio: 25 },
} as const;

export const MENSAGEM_CONTENCAO =
  "Muitas operações em pouco tempo. Aguarde alguns minutos e tente novamente.";

function chave(operacao: OperacaoControlada, escopo: string, valor: string): string {
  // Nunca persistir e-mail, IP, identificadores de sessão ou dados de formulário na tabela.
  return createHash("sha256").update(JSON.stringify(["ndb:escrita:v1", operacao, escopo, valor])).digest("hex");
}

/**
 * Reutiliza TentativaAcesso, que já existe no PostgreSQL.
 * Uma instrução INSERT ... ON CONFLICT por contador impede perda de incrementos
 * entre Workers concorrentes. Contagens negadas não são revertidas (cooldown).
 */
async function reservar(chaveDoContador: string, limite: number): Promise<boolean> {
  const agora = new Date();
  const inicio = new Date(agora.getTime() - JANELA_MS);
  const teto = limite + 1;
  const [linha] = await db.$queryRaw<{ contagem: number }[]>`
    INSERT INTO "TentativaAcesso" ("chave", "contagem", "janelaIniciadaEm", "email")
    VALUES (${chaveDoContador}, 1, ${agora}, NULL)
    ON CONFLICT ("chave") DO UPDATE SET
      "contagem" = CASE
        WHEN "TentativaAcesso"."janelaIniciadaEm" >= ${inicio}
          THEN LEAST("TentativaAcesso"."contagem" + 1, ${teto})
        ELSE 1
      END,
      "janelaIniciadaEm" = CASE
        WHEN "TentativaAcesso"."janelaIniciadaEm" >= ${inicio}
          THEN "TentativaAcesso"."janelaIniciadaEm"
        ELSE EXCLUDED."janelaIniciadaEm"
      END
    RETURNING "contagem"`;
  return (linha?.contagem ?? teto) <= limite;
}

/** Só usa IP de proxy identificado e confiável; x-forwarded-for do visitante não serve. */
async function origemConfiavel(): Promise<string | null> {
  if (
    process.env.CLOUDFLARE_DEPLOY !== "1" &&
    process.env.VERCEL !== "1" &&
    process.env.AUTENTICACAO_PROXY_CONFIAVEL !== "1"
  ) {
    return null;
  }
  return ipDoCabecalho(await headers());
}

/**
 * Conta tentativas validadas antes da escrita. Conta, origem confiável e destino
 * são proteções independentes: IP desconhecido nunca bloqueia todos os visitantes.
 *
 * O limite por negócio é uma barreira temporária contra campanhas, não uma decisão
 * automática de moderação: denúncias continuam sem retirar conteúdo do ar.
 */
export async function reservarEscrita({
  operacao, usuarioId, negocioId, origem,
}: {
  operacao: OperacaoControlada;
  usuarioId: string;
  negocioId?: string;
  /** Apenas para testes ou origem obtida no servidor; nunca preencher a partir de FormData. */
  origem?: string | null;
}): Promise<boolean> {
  const politica = ORCAMENTOS[operacao];
  if (!usuarioId || (negocioId !== undefined && !negocioId)) return false;
  const ip = origem === undefined ? await origemConfiavel() : origem;
  const contadores: Array<{ escopo: string; valor: string; limite: number }> = [
    { escopo: "conta", valor: usuarioId, limite: politica.conta },
  ];
  if (ip) contadores.push({ escopo: "origem", valor: ip, limite: politica.origem });
  if (negocioId && politica.negocio !== null) {
    contadores.push({ escopo: "negocio", valor: negocioId, limite: politica.negocio });
  }
  for (const { escopo, valor, limite } of contadores) {
    if (!(await reservar(chave(operacao, escopo, valor), limite))) return false;
  }
  // Limpeza amostrada: evitar varrer toda a tabela a cada envio, mesmo sob carga.
  if (Math.random() < 0.01) {
    const vencidas = new Date(Date.now() - 2 * JANELA_MS);
    await db.tentativaAcesso.deleteMany({ where: { janelaIniciadaEm: { lt: vencidas } } });
  }
  return true;
}
