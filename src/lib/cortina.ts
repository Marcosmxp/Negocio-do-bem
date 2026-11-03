export type FaseCortina = "oculta" | "fechando" | "coberta" | "abrindo";
export type EventoCortina = "iniciar" | "cobrir" | "revelar" | "terminar" | "cancelar";
export type BuscaDaCortina = {
  /** Endereço completo da página onde a busca foi enviada. */
  atual: string;
  /** O `action` do formulário, já resolvido pelo navegador. */
  acao: string;
  /** Os campos do formulário, na ordem em que o navegador os enviaria. */
  campos: [string, string][];
};
export type DestinoCortina = { href: string };

/**
 * A cortina só cobre a busca do diretório. Devolve o endereço do resultado,
 * ou null quando o envio deve seguir o caminho nativo: outra origem, outro
 * protocolo ou o mesmo resultado que já está na tela.
 */
export function destinoDaBusca(busca: BuscaDaCortina): DestinoCortina | null {
  let atual: URL;
  let destino: URL;
  try {
    atual = new URL(busca.atual);
    destino = new URL(busca.acao, atual);
  } catch {
    return null;
  }
  if (!/^https?:$/.test(destino.protocol) || destino.origin !== atual.origin) return null;
  destino.search = new URLSearchParams(busca.campos).toString();
  const href = `${destino.pathname}${destino.search}`;
  return href === `${atual.pathname}${atual.search}` ? null : { href };
}

export function proximaFaseCortina(fase: FaseCortina, evento: EventoCortina): FaseCortina {
  if (evento === "cancelar") return "oculta";
  if (fase === "oculta" && evento === "iniciar") return "fechando";
  if (fase === "fechando" && evento === "cobrir") return "coberta";
  if (fase === "coberta" && evento === "revelar") return "abrindo";
  if (fase === "abrindo" && evento === "terminar") return "oculta";
  return fase;
}
