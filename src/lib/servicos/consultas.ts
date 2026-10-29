import "server-only";
import { db, type Prisma } from "@/lib/db";
import { CATEGORIAS_SERVICOS, limitarPagina, numeroPagina, POR_PAGINA_SERVICOS } from "@/lib/servicos";
import { normalizarTexto } from "@/lib/texto";

/** Toda listagem pública passa por esta condição, inclusive contagens. */
export function filtroServicosPublicos(q: string, categoria: string): Prisma.ServicoWhereInput {
  const termos = normalizarTexto(q).slice(0, 100).split(" ").filter(Boolean).slice(0, 6);
  return {
    status: "publicado",
    oculto: false,
    OR: [
      { perfil: { is: { publicado: true } } },
      { empresa: { is: { moderacao: "aprovada", oculta: false, status: "verificada" } } },
    ],
    ...(CATEGORIAS_SERVICOS.some((nome) => nome === categoria) ? { categoria } : {}),
    AND: termos.map((termo) => ({ busca: { contains: termo } })),
  };
}

export async function listarServicosPublicos(filtros: { q: string; categoria: string; pagina: unknown }) {
  const q = filtros.q.slice(0, 100);
  const categoria = CATEGORIAS_SERVICOS.find((nome) => nome === filtros.categoria) ?? "";
  const where = filtroServicosPublicos(q, categoria);
  const total = await db.servico.count({ where });
  const { pagina, paginas } = limitarPagina(numeroPagina(filtros.pagina), total);
  const itens = await db.servico.findMany({
    where,
    select: {
      id: true, titulo: true, descricao: true, categoria: true, cidade: true, uf: true,
      remoto: true, presencial: true, precoReferencia: true,
      perfil: { select: { nomePublico: true, emailContato: true, site: true } },
      empresa: { select: { nome: true, instagramUsername: true } },
    },
    orderBy: [{ criadoEm: "desc" }, { id: "desc" }],
    skip: (pagina - 1) * POR_PAGINA_SERVICOS,
    take: POR_PAGINA_SERVICOS,
  });
  return { itens, total, pagina, paginas, q, categoria };
}
