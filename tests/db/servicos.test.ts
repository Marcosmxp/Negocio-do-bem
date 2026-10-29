import { randomUUID } from "node:crypto";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { filtroServicosPublicos } from "@/lib/servicos/consultas";
import { identificarPrestador, podeGerirServico } from "@/lib/servicos/permissoes";

const usuariosCriados: string[] = [];
const empresasCriadas: string[] = [];

async function usuario(nome = "Pessoa Prestadora") {
  const criado = await db.usuario.create({
    data: { nome, email: `teste-servicos-${randomUUID()}@example.com`, senhaHash: "x" },
  });
  usuariosCriados.push(criado.id);
  return criado;
}

async function perfilEAnuncio() {
  const dono = await usuario();
  const perfil = await db.perfilProfissional.create({
    data: {
      usuarioId: dono.id, nomePublico: "Pessoa Prestadora",
      apresentacao: "Trabalho com serviços de tecnologia.",
      cidade: "Recife", uf: "PE", remoto: true,
      emailContato: "contato@example.com", publicado: true,
    },
  });
  const anuncio = await db.servico.create({
    data: {
      perfilUsuarioId: perfil.usuarioId, titulo: "Sites para negócios",
      descricao: "Criação de sites sob medida para negócios da comunidade.",
      categoria: "Tecnologia", cidade: "Recife", uf: "PE",
      remoto: true, busca: "sites para negocios tecnologia recife pe",
      status: "publicado",
    },
  });
  return { dono, perfil, anuncio };
}

afterEach(async () => {
  // Só limpa os fixtures desta suite; não apaga dados de outras suites de teste.
  await db.usuario.deleteMany({ where: { id: { in: usuariosCriados.splice(0) } } });
  await db.empresa.deleteMany({ where: { id: { in: empresasCriadas.splice(0) } } });
});

afterAll(async () => { await db.$disconnect(); });

describe("integridade e visibilidade dos serviços", () => {
  it("mostra anúncio publicado e oculta quando o perfil deixa de ser público", async () => {
    const { perfil, anuncio } = await perfilEAnuncio();
    const filtro = filtroServicosPublicos("negócios", "Tecnologia");
    expect((await db.servico.findMany({ where: filtro })).map((s) => s.id)).toEqual([anuncio.id]);
    await db.perfilProfissional.update({ where: { usuarioId: perfil.usuarioId }, data: { publicado: false } });
    expect(await db.servico.count({ where: filtro })).toBe(0);
  });

  it("não publica serviço pendente, rejeitado ou oculto", async () => {
    const { anuncio } = await perfilEAnuncio();
    const filtro = filtroServicosPublicos("", "");
    await db.servico.update({ where: { id: anuncio.id }, data: { status: "pendente" } });
    expect(await db.servico.count({ where: filtro })).toBe(0);
    await db.servico.update({ where: { id: anuncio.id }, data: { status: "rejeitado", motivoRecusa: "O texto precisa de correção." } });
    expect(await db.servico.count({ where: filtro })).toBe(0);
    await db.servico.update({ where: { id: anuncio.id }, data: { status: "publicado", motivoRecusa: null, oculto: true } });
    expect(await db.servico.count({ where: filtro })).toBe(0);
  });

  it("recusa anúncio sem prestador, com dois prestadores ou sem modalidade", async () => {
    const { perfil, anuncio } = await perfilEAnuncio();
    await expect(db.servico.create({
      data: {
        titulo: "Outro serviço", descricao: "Descrição completa para outro serviço.",
        categoria: "Tecnologia", cidade: "Recife", uf: "PE", remoto: true,
      },
    })).rejects.toThrow();

    const empresa = await db.empresa.create({
      data: {
        instagramUsername: `servicos-${randomUUID().replaceAll("-", "").slice(0, 16)}`,
        nome: "Empresa Teste", resumo: "Empresa fictícia para teste.",
        categoria: "Serviços", cidade: "Recife", uf: "PE",
      },
    });
    empresasCriadas.push(empresa.id);
    await expect(db.servico.update({
      where: { id: anuncio.id }, data: { empresaId: empresa.id, perfilUsuarioId: perfil.usuarioId },
    })).rejects.toThrow();
    await expect(db.servico.update({
      where: { id: anuncio.id }, data: { remoto: false, presencial: false },
    })).rejects.toThrow();
  });

  it("identifica quem pode editar; rejeita IDs de terceiros e membros inexistentes", async () => {
    const { dono, anuncio } = await perfilEAnuncio();
    const intruso = await usuario("Pessoa sem permissão");
    expect(await db.$transaction((tx) => podeGerirServico(tx, dono.id, anuncio.id))).toBeTruthy();
    expect(await db.$transaction((tx) => podeGerirServico(tx, intruso.id, anuncio.id))).toBeNull();
    expect(await db.$transaction((tx) => identificarPrestador(tx, intruso.id, "profissional"))).toBeNull();
  });

  it("só permite anunciar em empresa verificada que o usuário administra", async () => {
    const dono = await usuario();
    const intruso = await usuario("Terceiro");
    const empresa = await db.empresa.create({
      data: {
        instagramUsername: `empresa-${randomUUID().replaceAll("-", "").slice(0, 16)}`,
        nome: "Ateliê Teste", resumo: "Negócio fictício.",
        categoria: "Serviços", cidade: "Olinda", uf: "PE",
        status: "verificada", moderacao: "aprovada",
      },
    });
    empresasCriadas.push(empresa.id);
    await db.empresaMembro.create({ data: { empresaId: empresa.id, usuarioId: dono.id } });

    expect(await db.$transaction((tx) => identificarPrestador(tx, intruso.id, "empresa", empresa.id))).toBeNull();
    expect(await db.$transaction((tx) => identificarPrestador(tx, dono.id, "empresa", empresa.id))).toMatchObject({
      empresaId: empresa.id, cidade: "Olinda", uf: "PE",
    });
    await db.empresa.update({ where: { id: empresa.id }, data: { oculta: true } });
    expect(await db.$transaction((tx) => identificarPrestador(tx, dono.id, "empresa", empresa.id))).toBeNull();
  });
});
