import { z } from "zod";
import { campoEmail, campoMunicipio, campoSite } from "@/lib/formulario";
import { normalizarTexto } from "@/lib/texto";

export const CATEGORIAS_SERVICOS = [
  "Tecnologia", "Design e comunicação", "Marketing", "Construção e reformas",
  "Manutenção e reparos", "Logística e entregas", "Contabilidade e gestão",
  "Educação", "Limpeza", "Fotografia e vídeo", "Alimentação", "Outros",
] as const;

export const esquemaPerfilProfissional = z.object({
  nomePublico: z.string().trim().min(2, "Informe um nome profissional.").max(80),
  apresentacao: z.string().trim().min(20, "Conte um pouco sobre seu trabalho (mínimo 20 caracteres).").max(1200),
  municipio: campoMunicipio,
  remoto: z.boolean(),
  presencial: z.boolean(),
  emailContato: campoEmail,
  site: campoSite,
  publicado: z.boolean(),
}).refine((p) => p.remoto || p.presencial, { path: ["modalidade"], message: "Escolha pelo menos uma modalidade." });

export const esquemaServico = z.object({
  prestador: z.enum(["profissional", "empresa"]),
  empresaId: z.string().max(80).optional(),
  titulo: z.string().trim().min(5, "Informe o título do serviço.").max(100),
  descricao: z.string().trim().min(30, "Descreva o serviço em pelo menos 30 caracteres.").max(2500),
  categoria: z.enum(CATEGORIAS_SERVICOS),
  remoto: z.boolean(),
  presencial: z.boolean(),
  precoReferencia: z.string().trim().max(100).transform((s) => s || null),
}).refine((s) => s.remoto || s.presencial, { path: ["modalidade"], message: "Escolha pelo menos uma modalidade." })
  .refine((s) => s.prestador !== "empresa" || !!s.empresaId, { path: ["empresaId"], message: "Escolha a empresa." });

export function buscaServico(dados: { titulo: string; descricao: string; categoria: string; cidade: string; uf: string }) {
  return normalizarTexto([dados.titulo, dados.descricao, dados.categoria, dados.cidade, dados.uf].join(" "));
}

/** O catálogo só inclui ofertas aprovadas, não ocultas e com prestador publicamente visível. */
export function filtroServicosPublicos(q: string, categoria: string) {
  const termos = normalizarTexto(q).slice(0, 100).split(" ").filter(Boolean).slice(0, 6);
  const selecionada = CATEGORIAS_SERVICOS.find((c) => c === categoria);
  return {
    status: "publicado",
    oculto: false,
    OR: [
      { perfil: { is: { publicado: true } } },
      { empresa: { is: { moderacao: "aprovada", oculta: false, status: "verificada" } } },
    ],
    ...(selecionada ? { categoria: selecionada } : {}),
    AND: termos.map((termo) => ({ busca: { contains: termo } })),
  };
}
