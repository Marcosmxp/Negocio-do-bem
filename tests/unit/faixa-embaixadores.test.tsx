import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { RostoNaFaixa } from "@/components/FaixaEmbaixadores";
import type { EmbaixadorNoSite } from "@/lib/embaixadores";

const faixaRolante = readFileSync(new URL("../../src/components/FaixaRolante.tsx", import.meta.url), "utf8");
const estilos = readFileSync(new URL("../../src/app/globals.css", import.meta.url), "utf8");

const embaixador: EmbaixadorNoSite = {
  id: "e1",
  nome: "Ana Lima",
  instagramUsername: "ana.lima",
  fotoUrl: null,
  seguidores: "12 mil",
  numeroDeSeguidores: 12000,
  titulo: "Embaixadora do bem",
  cidade: "Recife",
  uf: "PE",
  lugar: "Recife, PE",
  naInicial: true,
  destino: { href: "/cidades/recife-pe", detalhe: "Negócios em Recife" },
  href: "/embaixadores/ana.lima",
  sobre: null,
};

function links(html: string) {
  return [...html.matchAll(/<a\b[^>]*>/g)].map((m) => m[0]);
}

describe("faixa dos embaixadores", () => {
  it("o rosto da faixa leva à página e ao lugar, na ordem do Tab", () => {
    const html = renderToStaticMarkup(<RostoNaFaixa embaixador={embaixador} />);
    expect(links(html)).toHaveLength(2);
    expect(html).toContain('href="/embaixadores/ana.lima"');
    expect(html).toContain('href="/cidades/recife-pe"');
    expect(html).not.toContain("tabindex");
  });

  it("na cópia do laço, os mesmos links ficam fora do Tab", () => {
    const html = renderToStaticMarkup(<RostoNaFaixa embaixador={embaixador} naCopia />);
    const naCopia = links(html);
    expect(naCopia).toHaveLength(2);
    for (const link of naCopia) expect(link).toContain('tabindex="-1"');
    expect(html).toContain('href="/embaixadores/ana.lima"');
    expect(html).toContain('href="/cidades/recife-pe"');
  });

  it("o teclado pode alcançar os originais sem ficar preso na animação", () => {
    expect(faixaRolante).toContain('className="faixa-originais flex gap-4 pr-4"');
    expect(estilos).toContain(".faixa-janela:has(.faixa-originais :focus-visible)");
    expect(estilos).toMatch(/:has\(\.faixa-originais :focus-visible\) \.faixa-rolando \{\s*animation: none;/);
    expect(estilos).toMatch(/:has\(\.faixa-originais :focus-visible\) \{\s*overflow-x: auto;/);
  });

  it("remede a largura quando o conteúdo muda sem redimensionar a janela", () => {
    expect(faixaRolante).toContain("observador.observe(janela.current)");
    expect(faixaRolante).toContain("observador.observe(lista.current)");
  });

  it("a cópia fica fora do leitor de tela, mas continua clicável", () => {
    // Com inert, os rostos repetidos não abriam nada, e boa parte da faixa na tela é a cópia.
    const copia = faixaRolante.match(/<ul[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/ul>/)?.[0];
    expect(copia).toBeDefined();
    expect(copia).not.toMatch(/\binert\b/);
    expect(copia).toContain("{copia}");
    expect(copia).toContain("onMouseDown");
    expect(copia).toContain("evento.preventDefault()");
  });
});
