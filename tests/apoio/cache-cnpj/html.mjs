export function exigir(condicao, codigo) {
  if (!condicao) throw new Error(`[HARNESS37] ${codigo}`);
}
export function decodificar(valor) {
  const entidades = { amp: "&", quot: '"', apos: "'", lt: "<", gt: ">" };
  return valor.replace(/&(#x[0-9a-f]+|#[0-9]+|amp|quot|apos|lt|gt);/gi, (_, entidade) => {
    if (entidade.startsWith("#x")) return String.fromCodePoint(parseInt(entidade.slice(2), 16));
    if (entidade.startsWith("#")) return String.fromCodePoint(parseInt(entidade.slice(1), 10));
    return entidades[entidade.toLowerCase()];
  });
}
export function atributo(tag, nome) {
  const resultado = tag.match(new RegExp(`\\b${nome}=(?:"([^"]*)"|'([^']*)')`, "i"));
  return resultado ? decodificar(resultado[1] ?? resultado[2] ?? "") : undefined;
}
export function formularioDeEntrada(html, pagina) {
  const candidatos = [...html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)]
    .map((trecho) => ({ atributos: trecho[1], entradas: [...trecho[2].matchAll(/<input\b[^>]*>/gi)].map(m => m[0]) }))
    .filter(({ entradas }) => {
      const nomes = entradas.map(tag => atributo(tag, "name"));
      return nomes.includes("email") && nomes.includes("senha");
    });
  exigir(candidatos.length === 1, "formulario-entrada-unico");
  const formulario = candidatos[0];
  exigir(atributo(formulario.atributos, "method")?.toLowerCase() === "post", "metodo-formulario");
  const destino = new URL(atributo(formulario.atributos, "action") || pagina, pagina);
  exigir(destino.origin === new URL(pagina).origin, "destino-formulario");
  const dados = new FormData();
  for (const tag of formulario.entradas) {
    const nome = atributo(tag, "name");
    if (nome && atributo(tag, "type")?.toLowerCase() === "hidden") dados.append(nome, atributo(tag, "value") ?? "");
  }
  exigir([...dados.keys()].filter(nome => /^\$ACTION_(?:ID|REF)_/.test(nome)).length === 1, "seletor-server-action");
  return { destino, dados };
}
export function sanitizarHtml(html) {
  return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "<!-- script omitido -->")
    .replace(/<input\b[^>]*>/gi, tag => {
      const nome = atributo(tag, "name");
      if (!nome?.startsWith("$ACTION")) return tag;
      return tag.replace(/\bvalue=(?:"[^"]*"|'[^']*')/gi, 'value="[omitido]"');
    });
}
export function observarFila(html, empresa, pedido, marcador) {
  return {
    ficha: html.includes(empresa),
    controles: html.includes(`value="${pedido}"`) && html.includes('name="modo"') && html.includes('name="motivo"'),
    marcadorRenderizado: [...sanitizarHtml(html).matchAll(/<span\b[^>]*>([\s\S]*?)<\/span>/gi)]
      .some(trecho => trecho[1].replace(/<!--[\s\S]*?-->/g, "").replace(/<[^>]*>/g, "").includes(marcador)),
  };
}
