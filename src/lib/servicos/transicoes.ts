/** Regras puras das transições; verificações de permissão ficam no servidor. */
export type EstadoServico = "pendente" | "publicado" | "rejeitado";
export type DecisaoModeracao = "aprovar" | "rejeitar";

export function estadoAposRevisao(): EstadoServico {
  // Edição de um anúncio aprovado não pode contornar a moderação.
  return "pendente";
}

export function estadoAposDecisao(estado: string, decisao: DecisaoModeracao): EstadoServico | null {
  if (estado !== "pendente") return null;
  return decisao === "aprovar" ? "publicado" : "rejeitado";
}
