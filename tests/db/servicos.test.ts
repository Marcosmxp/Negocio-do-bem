import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { db } from "@/lib/db";
import { filtroServicosPublicos } from "@/lib/servicos";

async function limpar() {
  await db.$executeRawUnsafe(`TRUNCATE "RegistroAuditoria", "Servico", "PerfilProfissional", "Depoimento", "Reivindicacao", "EmpresaMembro", "EmpresaCausa", "Empresa", "Sessao", "Usuario" CASCADE`);
}

beforeEach(limpar);
afterAll(async () => { await limpar(); await db.$disconnect(); });

async function preparar() {
  const usuario = await db.usuario.create({ data: { nome: "Pessoa", email: "servicos-teste@exemplo.com", senhaHash: "x" } });
  const perfil = await db.perfilProfissional.create({
    data: { usuarioId: usuario.id, nomePublico: "Pessoa Prestadora", apresentacao: "Trabalho com serviços de tecnologia.", cidade: "Recife", uf: "PE", remoto: true, publicado: true },
  });
  const servico = await db.servico.create({
    data: { perfilUsuarioId: perfil.usuarioId, titulo: "Sites para negócios", descricao: "Criação de sites sob medida para negócios da comunidade.", categoria: "Tecnologia", cidade: "Recife", uf: "PE", remoto: true, busca: "sites para negocios tecnologia recife pe", status: "publicado" },
  });
  return { perfil, servico };
}

describe("catálogo de serviços", () => {
  it("mostra somente serviço publicado de perfil visível", async () => {
    const { perfil, servico } = await preparar();
    const filtro = filtroServicosPublicos("negócios", "Tecnologia");
    expect((await db.servico.findMany({ where: filtro })).map((s) => s.id)).toEqual([servico.id]);
    await db.perfilProfissional.update({ where: { usuarioId: perfil.usuarioId }, data: { publicado: false } });
    expect(await db.servico.count({ where: filtro })).toBe(0);
  });

  it("não publica um serviço pendente ou oculto", async () => {
    const { servico } = await preparar();
    await db.servico.update({ where: { id: servico.id }, data: { status: "pendente" } });
    expect(await db.servico.count({ where: filtroServicosPublicos("", "") })).toBe(0);
    await db.servico.update({ where: { id: servico.id }, data: { status: "publicado", oculto: true } });
    expect(await db.servico.count({ where: filtroServicosPublicos("", "") })).toBe(0);
  });

  it("rejeita anúncio sem prestador ou com dois prestadores", async () => {
    const { perfil, servico } = await preparar();
    const comum = { titulo: "Outro serviço", descricao: "Descrição detalhada sobre o trabalho realizado.", categoria: "Tecnologia", cidade: "Recife", uf: "PE" };
    await expect(db.servico.create({ data: comum })).rejects.toThrow();
    const empresa = await db.empresa.create({ data: { instagramUsername: "teste-servicos", nome: "Teste", resumo: "Empresa de teste", categoria: "Serviços", cidade: "Recife", uf: "PE" } });
    await expect(db.servico.update({ where: { id: servico.id }, data: { empresaId: empresa.id, perfilUsuarioId: perfil.usuarioId } })).rejects.toThrow();
  });
});
