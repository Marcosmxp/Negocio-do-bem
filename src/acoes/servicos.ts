"use server";

import { redirect } from "next/navigation";
import { registrarAuditoria } from "@/lib/auditoria";
import { exigirModerador, exigirUsuario } from "@/lib/auth/sessao";
import { db } from "@/lib/db";
import { errosPorCampo, texto, valoresDoFormulario, type EstadoFormulario } from "@/lib/formulario";
import { buscaServico, esquemaPerfilProfissional, esquemaServico } from "@/lib/servicos";

const DESTINO = "/painel/servicos";

export async function salvarPerfilProfissional(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const usuario = await exigirUsuario(DESTINO);
  const valores = valoresDoFormulario(dados);
  const resultado = esquemaPerfilProfissional.safeParse({
    nomePublico: texto(dados, "nomePublico"),
    apresentacao: texto(dados, "apresentacao"),
    municipio: texto(dados, "municipio"),
    remoto: dados.get("remoto") === "sim",
    presencial: dados.get("presencial") === "sim",
    emailContato: texto(dados, "emailContato"),
    site: texto(dados, "site"),
    publicado: dados.get("publicado") === "sim",
  });
  if (!resultado.success) return { erros: errosPorCampo(resultado.error), valores };
  const { municipio, ...perfil } = resultado.data;
  await db.$transaction(async (tx) => {
    await tx.perfilProfissional.upsert({
      where: { usuarioId: usuario.id },
      create: { usuarioId: usuario.id, ...perfil, cidade: municipio.nome, uf: municipio.uf },
      update: { ...perfil, cidade: municipio.nome, uf: municipio.uf },
    });
    await registrarAuditoria(tx, {
      usuarioId: usuario.id, acao: "perfil_profissional.salvo", alvoTipo: "perfilProfissional", alvoId: usuario.id,
    });
  });
  redirect(`${DESTINO}?aviso=perfil_salvo`);
}

export async function criarServico(_estado: EstadoFormulario, dados: FormData): Promise<EstadoFormulario> {
  const usuario = await exigirUsuario(DESTINO);
  const valores = valoresDoFormulario(dados);
  const resultado = esquemaServico.safeParse({
    prestador: texto(dados, "prestador"), empresaId: texto(dados, "empresaId") || undefined,
    titulo: texto(dados, "titulo"), descricao: texto(dados, "descricao"),
    categoria: texto(dados, "categoria"), remoto: dados.get("remoto") === "sim",
    presencial: dados.get("presencial") === "sim", precoReferencia: texto(dados, "precoReferencia"),
  });
  if (!resultado.success) return { erros: errosPorCampo(resultado.error), valores };
  const { prestador, empresaId, ...servico } = resultado.data;
  let cidade: string;
  let uf: string;
  let dono: { perfilUsuarioId: string | null; empresaId: string | null };

  if (prestador === "profissional") {
    const perfil = await db.perfilProfissional.findUnique({ where: { usuarioId: usuario.id } });
    if (!perfil?.publicado) return { erro: "Publique primeiro seu perfil profissional.", valores };
    ({ cidade, uf } = perfil);
    dono = { perfilUsuarioId: usuario.id, empresaId: null };
  } else {
    const membro = await db.empresaMembro.findUnique({
      where: { empresaId_usuarioId: { empresaId: empresaId!, usuarioId: usuario.id } }, include: { empresa: true },
    });
    if (!membro || membro.empresa.status !== "verificada" || membro.empresa.moderacao !== "aprovada" || membro.empresa.oculta) {
      return { erro: "Você só pode anunciar por um negócio verificado, publicado e do qual é dono.", valores };
    }
    ({ cidade, uf } = membro.empresa);
    dono = { perfilUsuarioId: null, empresaId: membro.empresaId };
  }

  await db.$transaction(async (tx) => {
    const criado = await tx.servico.create({
      data: { ...servico, ...dono, cidade, uf, busca: buscaServico({ ...servico, cidade, uf }), status: "pendente" },
    });
    await registrarAuditoria(tx, {
      usuarioId: usuario.id, acao: "servico.criado", alvoTipo: "servico", alvoId: criado.id,
    });
  });
  redirect(`${DESTINO}?aviso=servico_enviado`);
}

/** Permissão verificada no servidor; não basta esconder o botão da interface. */
export async function alternarServico(dados: FormData): Promise<void> {
  const usuario = await exigirUsuario(DESTINO);
  const id = texto(dados, "id");
  const oculto = dados.get("oculto") === "sim";
  await db.$transaction(async (tx) => {
    const servico = await tx.servico.findUnique({ where: { id }, select: { perfilUsuarioId: true, empresaId: true } });
    if (!servico) return;
    const autorizado = servico.perfilUsuarioId === usuario.id || (!!servico.empresaId && !!(await tx.empresaMembro.findUnique({
      where: { empresaId_usuarioId: { empresaId: servico.empresaId, usuarioId: usuario.id } },
    })));
    if (!autorizado) return;
    await tx.servico.update({ where: { id }, data: { oculto } });
    await registrarAuditoria(tx, { usuarioId: usuario.id, acao: oculto ? "servico.oculto" : "servico.reativado", alvoTipo: "servico", alvoId: id });
  });
  redirect(DESTINO);
}

export async function moderarServico(dados: FormData): Promise<void> {
  const moderador = await exigirModerador();
  const id = texto(dados, "id");
  const status = dados.get("decisao") === "aprovar" ? "publicado" : "rejeitado";
  await db.$transaction(async (tx) => {
    const { count } = await tx.servico.updateMany({ where: { id, status: "pendente" }, data: { status } });
    if (!count) return;
    await registrarAuditoria(tx, { usuarioId: moderador.id, acao: `servico.${status}`, alvoTipo: "servico", alvoId: id });
  });
  redirect("/moderacao/servicos");
}
