import { readFileSync } from "node:fs";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SeloStatus } from "@/components/SeloStatus";
import { checklistDoPerfil } from "@/lib/boas-vindas";

const RECEM_ASSUMIDO = { fotoUrl: null, historia: "", causas: [], oficial: false, moderacao: "aprovada" };
const COMPLETO = {
  fotoUrl: "/enviados/perfis/foto.jpg",
  historia: "Começou na garagem de casa.",
  causas: [{ causa: "antirracista" }],
  oficial: true,
  moderacao: "aprovada",
};

describe("checklistDoPerfil", () => {
  it("perfil recém-assumido: as três coisas faltam, cada uma com o link da sua seção", () => {
    expect(checklistDoPerfil(RECEM_ASSUMIDO, true)).toEqual({
      itens: [
        { rotulo: "Uma foto", feito: false, href: "#foto" },
        { rotulo: "As causas que vocês vivem", feito: false, href: "#causas" },
        { rotulo: "A história de vocês", feito: false, href: "#historia" },
      ],
      pedirSelo: true,
      mostrar: true,
    });
  });

  it("cada item fica feito com o dado preenchido", () => {
    const { itens } = checklistDoPerfil({ ...RECEM_ASSUMIDO, causas: [{ causa: "antirracista" }] }, true);
    expect(itens.map((item) => item.feito)).toEqual([false, true, false]);
    expect(checklistDoPerfil({ ...COMPLETO, oficial: false }, true).itens.every((item) => item.feito)).toBe(true);
  });

  it("história só com espaços e causa que saiu da lista não contam", () => {
    const { itens } = checklistDoPerfil({ ...RECEM_ASSUMIDO, historia: "  \n ", causas: [{ causa: "causa-que-saiu" }] }, true);
    expect(itens.map((item) => item.feito)).toEqual([false, false, false]);
  });

  it("some quando as três coisas estão feitas e o perfil é oficial", () => {
    expect(checklistDoPerfil(COMPLETO, true)).toMatchObject({ pedirSelo: false, mostrar: false });
  });

  it("perfil oficial com algo faltando: mostra, sem pedir o selo", () => {
    expect(checklistDoPerfil({ ...COMPLETO, historia: "" }, true)).toMatchObject({ pedirSelo: false, mostrar: true });
  });

  it("perfil completo que não é oficial: continua, para pedir o selo", () => {
    expect(checklistDoPerfil({ ...COMPLETO, oficial: false }, true)).toMatchObject({ pedirSelo: true, mostrar: true });
  });

  it("não convida à confirmação quando o perfil foi tirado do ar", () => {
    expect(checklistDoPerfil({ ...COMPLETO, oficial: false, moderacao: "rejeitada" }, true))
      .toMatchObject({ pedirSelo: false, mostrar: false });
  });

  it("sem o Entrar com Instagram, não pede o selo", () => {
    expect(checklistDoPerfil(RECEM_ASSUMIDO, false)).toMatchObject({ pedirSelo: false, mostrar: true });
    expect(checklistDoPerfil({ ...COMPLETO, oficial: false }, false)).toMatchObject({ pedirSelo: false, mostrar: false });
  });
});

describe("comunicação dos níveis de confiança", () => {
  it("explica que o selo oficial não certifica identidade legal", () => {
    const oficial = renderToStaticMarkup(createElement(SeloStatus, { status: "verificada", oficial: true }));
    const assumido = renderToStaticMarkup(createElement(SeloStatus, { status: "verificada", oficial: false }));

    expect(oficial).toContain("Perfil oficial");
    expect(oficial).toContain("não certifica a identidade legal");
    expect(assumido).toContain("Perfil assumido");
    expect(assumido).not.toContain("Perfil oficial");
  });

  it("não promete comprovação de identidade no convite ao cadastro", () => {
    const pagina = readFileSync(new URL("../../src/app/participar/page.tsx", import.meta.url), "utf8");
    expect(pagina).toContain("A confirmação pelo Instagram é um processo separado.");
    expect(pagina).not.toContain('titulo: "O perfil é seu."');
  });
});
