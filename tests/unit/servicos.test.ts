import { describe, expect, it } from "vitest";
import { buscaServico, esquemaServico, filtroServicosPublicos } from "@/lib/servicos";

const exemplo = {
  prestador: "profissional", titulo: "Desenvolvimento web", descricao: "Criação de sites responsivos para pequenos negócios.",
  categoria: "Tecnologia", remoto: true, presencial: false, precoReferencia: "",
};

describe("serviços", () => {
  it("aceita cadastro válido e normaliza preço vazio", () => {
    expect(esquemaServico.parse(exemplo).precoReferencia).toBeNull();
  });
  it("exige modalidade e empresa escolhida quando prestador é empresa", () => {
    expect(esquemaServico.safeParse({ ...exemplo, remoto: false }).success).toBe(false);
    expect(esquemaServico.safeParse({ ...exemplo, prestador: "empresa" }).success).toBe(false);
    expect(esquemaServico.safeParse({ ...exemplo, prestador: "empresa", empresaId: "id123" }).success).toBe(true);
  });
  it("recusa categoria inventada e descrição curta", () => {
    expect(esquemaServico.safeParse({ ...exemplo, categoria: "Inventada" }).success).toBe(false);
    expect(esquemaServico.safeParse({ ...exemplo, descricao: "Curta" }).success).toBe(false);
  });
  it("normaliza termos para pesquisa", () => {
    expect(buscaServico({ titulo: "Criação", descricao: "Páginas", categoria: "Tecnologia", cidade: "São Paulo", uf: "SP" })).toContain("criacao paginas tecnologia sao paulo sp");
  });
  it("não expõe serviços pendentes, ocultos nem prestadores não publicados", () => {
    const filtro = filtroServicosPublicos("Criação de Sites", "Tecnologia");
    expect(filtro.status).toBe("publicado");
    expect(filtro.oculto).toBe(false);
    expect(filtro.AND).toEqual([{ busca: { contains: "criacao" } }, { busca: { contains: "de" } }, { busca: { contains: "sites" } }]);
    expect(filtro.OR).toHaveLength(2);
  });
});
