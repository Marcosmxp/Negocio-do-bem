import { describe, expect, it } from "vitest";
import { formularioDeEntrada, observarFila, sanitizarHtml } from "../apoio/cache-cnpj/html.mjs";

const empresa = "Empresa sintética";
const marcador = "RECEITA_SINTETICA";

function ficha(pedido: string, dado = "", trecho = "") {
  return `<article><header>${empresa}</header>${trecho}<span>${dado}</span><form><input name="reivindicacaoId" value="${pedido}"><input name="modo" value="adicionar"></form><form><input name="reivindicacaoId" value="${pedido}"><input name="motivo" value=""></form></article>`;
}

function observar(html: string, pedido: string) {
  return observarFila(html, empresa, pedido, marcador);
}

describe("observador HTTP do cache de CNPJ por ficha", () => {
  it("aceita o dado renderizado em cada ficha completa", () => {
    const html = ficha("pedido-1", marcador) + ficha("pedido-2", marcador);
    for (const pedido of ["pedido-1", "pedido-2"]) {
      expect(observar(html, pedido)).toEqual({ ficha: true, controles: true, marcadorRenderizado: true });
    }
  });

  it("não usa o único marcador da primeira ficha para aprovar a segunda", () => {
    const html = ficha("pedido-1", marcador) + ficha("pedido-2");
    expect(observar(html, "pedido-1").marcadorRenderizado).toBe(true);
    expect(observar(html, "pedido-2")).toEqual({ ficha: true, controles: true, marcadorRenderizado: false });
  });

  it("não troca associação por contagem global quando a ficha errada repete o marcador", () => {
    const html = ficha("pedido-1", `${marcador} ${marcador}`) + ficha("pedido-2");
    expect(observar(html, "pedido-2").marcadorRenderizado).toBe(false);
  });

  it("não aceita o marcador renderizado somente fora das fichas", () => {
    const html = ficha("pedido-1") + `<aside><span>${marcador}</span></aside>`;
    expect(observar(html, "pedido-1").marcadorRenderizado).toBe(false);
  });

  it("não aceita o marcador existente somente em payload RSC", () => {
    const html = ficha("pedido-1") + `<script>self.__next_f.push([1,${JSON.stringify(`<span>${marcador}</span>`)}])</script>`;
    expect(observar(html, "pedido-1").marcadorRenderizado).toBe(false);
  });

  it("omite scripts com espaço no fechamento do registro de diagnóstico", () => {
    expect(sanitizarHtml(`<script>${marcador}</script >`)).toBe("<!-- script omitido -->");
  });

  it("não aceita como visível o marcador em script com espaço no fechamento", () => {
    expect(observar(ficha("pedido-1", `<script>${marcador}</script >`), "pedido-1").marcadorRenderizado).toBe(false);
  });

  it.each(['"', "'"])("não aceita como visível o marcador em atributo delimitado por %s", aspas => {
    const html = ficha("pedido-1", `<b title=${aspas}3 > ${marcador}${aspas}>Outro dado</b>`);
    expect(observar(html, "pedido-1").marcadorRenderizado).toBe(false);
  });

  it("não encontra o nome da empresa apenas em atributo", () => {
    const html = ficha("pedido-1", marcador).replace(`<header>${empresa}</header>`, `<header title="3 > ${empresa}">Outra empresa</header>`);
    expect(observar(html, "pedido-1").ficha).toBe(false);
  });

  it("preserva texto de elementos aninhados sem ler os atributos como texto", () => {
    const html = ficha("pedido-1", `<b title="<span>falso</span>"><em>${marcador}</em></b>`);
    expect(observar(html, "pedido-1").marcadorRenderizado).toBe(true);
    const apenasAtributo = ficha("pedido-1", `<b><em title="3 > ${marcador}">Outro dado</em></b>`);
    expect(observar(apenasAtributo, "pedido-1").marcadorRenderizado).toBe(false);
  });

  it.each(["style", "title", "textarea", "xmp", "iframe", "noembed", "noframes"])(
    "não trata conteúdo de %s como elementos da ficha", nome => {
      const html = ficha("pedido-1", "", `<${nome}><span>${marcador}</span></${nome}>`);
      expect(observar(html, "pedido-1").marcadorRenderizado).toBe(false);
    },
  );

  it("não fecha texto bruto com um nome de tag apenas semelhante", () => {
    const html = ficha("pedido-1", "", `<style></style-falso><span>${marcador}</span></style>`);
    expect(observar(html, "pedido-1").marcadorRenderizado).toBe(false);
  });

  it.each([
    `<b title="3 > ${marcador}`,
    `<!-- <span>${marcador}</span>`,
    `<b>${marcador}</span>`,
  ])("recusa fragmento incompleto ou desequilibrado em vez de aprovar a ficha: %s", trecho => {
    expect(() => observar(ficha("pedido-1", trecho), "pedido-1")).toThrow(/estrutura-/);
  });

  it("não interpreta tags e scripts dentro de comentários", () => {
    const html = ficha("pedido-1", `<!-- <script>falso</script ><span>${marcador}</span> -->`);
    expect(observar(html, "pedido-1").marcadorRenderizado).toBe(false);
  });

  it.each([
    `<SCRIPT title="3 > 2">${marcador}</SCRIPT \t>`,
    `<script>${marcador}</script ignorado>`,
    `<script>${marcador}`,
  ])("omite o conteúdo do script sem executar JavaScript: %s", script => {
    expect(sanitizarHtml(script)).toBe("<!-- script omitido -->");
  });

  it("preserva o texto visível depois de um atributo com maior que", () => {
    const html = ficha("pedido-1", `<b title="3 > 2">${marcador}</b>`);
    expect(observar(html, "pedido-1").marcadorRenderizado).toBe(true);
  });

  it("lê o formulário e omite o seletor com maior que em outro atributo", () => {
    const html = '<form title="3 > 2" method="post"><input title="3 > 2" name="email"><input name="senha"><input title="3 > 2" type="hidden" name="$ACTION_ID_prova" value="seletor-sintetico"></form>';
    const formulario = formularioDeEntrada(html, "https://exemplo.test/entrar");
    expect(formulario.destino.href).toBe("https://exemplo.test/entrar");
    expect(formulario.dados.get("$ACTION_ID_prova")).toBe("seletor-sintetico");
    expect(sanitizarHtml(html)).not.toContain("seletor-sintetico");
  });

  it("não lê comentários como elementos visíveis", () => {
    const html = ficha("pedido-1", `<!-- <span>${marcador}</span> -->`);
    expect(observar(html, "pedido-1").marcadorRenderizado).toBe(false);
  });

  it("lê conclusão de segmento com espaço no fechamento do script", () => {
    const html = ficha("pedido-1", "", '<template id="B:1"></template>') +
      `<div hidden id="S:1"><span>${marcador}</span></div>` + '<script>$RC("B:1","S:1")</script >';
    expect(observar(html, "pedido-1").marcadorRenderizado).toBe(true);
  });

  it("associa o segmento concluído do Next somente ao limite da ficha correspondente", () => {
    const html = ficha("pedido-1", "", '<!--$?--><template id="B:1"></template><!--/$-->') +
      ficha("pedido-2", "", '<!--$?--><template id="B:2"></template><!--/$-->') +
      `<div hidden id="S:1"><span>${marcador}</span></div><div hidden id="S:2"><span>Sem o dado esperado</span></div>` +
      '<script>$RC("B:1","S:1")</script><script>$RC("B:2","S:2")</script>';
    expect(observar(html, "pedido-1").marcadorRenderizado).toBe(true);
    expect(observar(html, "pedido-2").marcadorRenderizado).toBe(false);
  });

  it("aceita dados completos nos dois segmentos sem executar os scripts", () => {
    const html = ficha("pedido-1", "", '<template id="B:1"></template>') +
      ficha("pedido-2", "", '<template id="B:2"></template>') +
      `<div hidden id="S:1"><span>${marcador}</span></div><div hidden id="S:2"><span>${marcador}</span></div>` +
      '<script>$RC("B:1","S:1")</script><script>$RC("B:2","S:2")</script>';
    expect(observar(html, "pedido-1").marcadorRenderizado).toBe(true);
    expect(observar(html, "pedido-2").marcadorRenderizado).toBe(true);
  });

  it("recusa uma ficha duplicada em vez de escolher arbitrariamente uma ocorrência", () => {
    const html = ficha("pedido-1", marcador) + ficha("pedido-1", marcador);
    expect(() => observar(html, "pedido-1")).toThrow(/ficha.*unica|ficha.*única/);
  });

  it("falha explicitamente quando o limite não tem segmento correlacionado", () => {
    const html = ficha("pedido-1", "", '<template id="B:1"></template>') + `<div hidden id="S:1"><span>${marcador}</span></div>`;
    expect(() => observar(html, "pedido-1")).toThrow(/segmento.*correlacionado/);
  });

  it("não confunde um identificador apenas fora da ficha com o pedido observado", () => {
    const html = ficha("pedido-1", marcador) + '<input name="reivindicacaoId" value="pedido-2">';
    expect(observar(html, "pedido-2")).toEqual({ ficha: false, controles: false, marcadorRenderizado: false });
  });

  it("não aceita dois pedidos agrupados na mesma ficha com um único dado", () => {
    const html = ficha("pedido-1", marcador).replace("</article>", ficha("pedido-2").replace(/<\/?article>/g, "") + "</article>");
    expect(() => observar(html, "pedido-1")).toThrow(/pedido.*ficha/);
  });

  it("não usa atributo data-name como se fosse o nome do campo", () => {
    const html = ficha("pedido-1", marcador).replaceAll('name="reivindicacaoId"', 'data-name="reivindicacaoId" name="outro"');
    expect(observar(html, "pedido-1")).toEqual({ ficha: false, controles: false, marcadorRenderizado: false });
  });

  it("não interpreta uma instrução serializada no payload RSC como conclusão", () => {
    const html = ficha("pedido-1", "", '<template id="B:1"></template>') + `<div hidden id="S:1"><span>${marcador}</span></div>` +
      `<script>self.__next_f.push([1,${JSON.stringify('$RC("B:1","S:1")')}])</script>`;
    expect(() => observar(html, "pedido-1")).toThrow(/segmento.*correlacionado/);
  });

  it("não presume um protocolo desconhecido de limite como dado completo", () => {
    const html = ficha("pedido-1", marcador, '<template id="B:novo-formato"></template>');
    expect(() => observar(html, "pedido-1")).toThrow(/segmento.*correlacionado/);
  });
});
