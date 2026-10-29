import "server-only";
import type { Prisma } from "@/lib/db";

/** Consulta e autorização são feitas com a mesma transação usada para gravar. */
export async function identificarPrestador(
  tx: Prisma.TransactionClient,
  usuarioId: string,
  prestador: "profissional" | "empresa",
  empresaId?: string,
) {
  if (prestador === "profissional") {
    const perfil = await tx.perfilProfissional.findUnique({
      where: { usuarioId },
      select: { publicado: true, cidade: true, uf: true },
    });
    if (!perfil?.publicado) return null;
    return { perfilUsuarioId: usuarioId, empresaId: null, cidade: perfil.cidade, uf: perfil.uf };
  }

  if (!empresaId) return null;
  const membro = await tx.empresaMembro.findUnique({
    where: { empresaId_usuarioId: { empresaId, usuarioId } },
    select: {
      empresaId: true,
      empresa: { select: { status: true, moderacao: true, oculta: true, cidade: true, uf: true } },
    },
  });
  if (!membro || membro.empresa.status !== "verificada" || membro.empresa.moderacao !== "aprovada" || membro.empresa.oculta) {
    return null;
  }
  return {
    perfilUsuarioId: null,
    empresaId: membro.empresaId,
    cidade: membro.empresa.cidade,
    uf: membro.empresa.uf,
  };
}

/** O acesso ao anúncio nunca é inferido apenas da interface. */
export async function podeGerirServico(tx: Prisma.TransactionClient, usuarioId: string, servicoId: string) {
  const servico = await tx.servico.findFirst({
    where: {
      id: servicoId,
      OR: [
        { perfilUsuarioId: usuarioId },
        { empresa: { is: { membros: { some: { usuarioId } } } } },
      ],
    },
    select: { id: true, perfilUsuarioId: true, empresaId: true },
  });
  return servico;
}
