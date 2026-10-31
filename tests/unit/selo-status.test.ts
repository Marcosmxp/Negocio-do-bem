import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { EmpresaCard, type EmpresaResumo } from "@/components/EmpresaCard";
import { EmpresaLinha } from "@/components/EmpresaLinha";
import { SeloStatus } from "@/components/SeloStatus";
import { lerFiltros, ORDENS } from "@/lib/diretorio";

const empresa: EmpresaResumo = {
  instagramUsername: "cafe_exemplo",
  nome: "Café Exemplo",
  fotoUrl: null,
  resumo: "Um café da comunidade.",
  categoria: "Café e padaria",
  cidade: "Recife",
  uf: "PE",
  status: "verificada",
  causas: [],
  _count: { depoimentos: 0 },
};

describe("rótulos de perfil assumido", () => {
  it("não apresenta a aprovação automática como conferência da moderação", () => {
    const selo = renderToStaticMarkup(createElement(SeloStatus, { status: "verificada" }));

    expect(selo).toContain("Perfil assumido");
    expect(selo).toContain("O selo não certifica a identidade nem as causas do negócio.");
    expect(selo).not.toContain("moderação conferiu");
    expect(selo).not.toContain("Verificado pelo dono");
  });

  it("mantém o selo de indicação sem afirmar que o perfil já foi assumido", () => {
    const selo = renderToStaticMarkup(createElement(SeloStatus, { status: "indicada" }));

    expect(selo).toContain("Indicado pela comunidade");
    expect(selo).not.toContain("Perfil assumido");
  });

  it("usa a mesma descrição verdadeira no card e no ícone da lista", () => {
    const card = renderToStaticMarkup(createElement(EmpresaCard, { empresa }));
    const linha = renderToStaticMarkup(createElement(EmpresaLinha, { empresa }));

    expect(card).toContain("Perfil assumido");
    expect(linha).toContain('aria-label="Perfil assumido"');
    expect(linha).toContain("<title>Perfil assumido</title>");
    expect(linha).not.toContain("Verificado pelo dono");
  });

  it("preserva o cadastro por etapas no painel sem prometer verificação", () => {
    const pagina = readFileSync(new URL("../../src/app/painel/page.tsx", import.meta.url), "utf8");
    expect(pagina).toContain("Você ainda não assumiu um perfil de negócio.");
    expect(pagina).toContain('href="/participar?dono=sim"');
  });

  it("usa o rótulo de perfil assumido na moderação sem perder o link de Instagram", () => {
    const pagina = readFileSync(new URL("../../src/app/moderacao/page.tsx", import.meta.url), "utf8");
    expect(pagina).toContain('"perfil já assumido" : "sem dono"');
    expect(pagina).toContain("<LinkInstagram endereco={r.empresa.instagramUsername}");
  });

  it("muda o rótulo da ordenação sem quebrar os parâmetros existentes", () => {
    expect(ORDENS.verificados).toBe("Assumidos primeiro");
    expect(lerFiltros({ verificados: "sim", ordem: "verificados" })).toMatchObject({
      verificados: true,
      ordem: "verificados",
    });
  });
});
