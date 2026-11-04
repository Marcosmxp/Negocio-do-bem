import { randomUUID } from "node:crypto";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Prisma } from "@/generated/prisma/client";
import { db } from "@/lib/db";

const contexto = vi.hoisted(() => ({
  usuario: null as { id: string; nome: string; email: string; moderador: boolean; emailConfirmado: boolean } | null,
  criarSessao: vi.fn(),
  medir: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  redirect: (url: string): never => { throw new Error("REDIRECT " + url); },
}));
vi.mock("next/headers", () => ({ headers: async () => new Headers() }));
vi.mock("next/server", () => ({ after: vi.fn() }));
vi.mock("@/lib/auth/sessao", () => ({
  exigirUsuario: async () => contexto.usuario,
  criarSessao: contexto.criarSessao,
  encerrarSessao: vi.fn(),
  idDaSessaoAtual: vi.fn(async () => null),
  caminhoSeguro: (valor: unknown, padrao = "/") =>
    typeof valor === "string" && valor.startsWith("/") && !valor.startsWith("//") ? valor : padrao,
}));
vi.mock("@/lib/auth/tentativas", () => ({
  ipDoCabecalho: () => null,
  tentativaDoIpLiberada: async () => true,
  reservarTentativaDoEmail: async () => true,
  zerarTentativasDoEmail: vi.fn(),
  zerarTentativasDeTodasAsOrigens: vi.fn(),
}));
vi.mock("@/lib/medicao-servidor", () => ({ medir: contexto.medir }));

const { cadastrar } = await import("@/acoes/conta");
const { publicarDepoimento } = await import("@/acoes/depoimentos");

const usuarioIds: string[] = [];
const empresaIds: string[] = [];
let leitor: { id: string; nome: string; email: string };

function formulario(campos: Record<string, string>): FormData {
  const dados = new FormData();
  for (const [campo, valor] of Object.entries(campos)) dados.set(campo, valor);
  return dados;
}

function dadosCadastro(email: string) {
  return formulario({
    nome: "Nova Pessoa", email, senha: "senha-segura-123",
    telefone: "(11) 99148-8052",
  });
}

beforeEach(async () => {
  const id = randomUUID();
  leitor = await db.usuario.create({
    data: { nome: "Lauro Leitor", email: `leitor-${id}@exemplo.com`, senhaHash: "scrypt$fixture" },
  });
  usuarioIds.push(leitor.id);
  contexto.usuario = { ...leitor, moderador: false, emailConfirmado: true };
  vi.clearAllMocks();
});

afterEach(async () => {
  vi.restoreAllMocks();
  await db.empresa.deleteMany({ where: { id: { in: empresaIds.splice(0) } } });
  await db.usuario.deleteMany({ where: { id: { in: usuarioIds.splice(0) } } });
  contexto.usuario = null;
});

afterAll(async () => {
  await db.$disconnect();
});

describe("duplicados concorrentes nas Server Actions", () => {
  it("cadastro mantém telefone e devolve erro no e-mail sem criar sessão", async () => {
    // Simula a consulta prévia desatualizada: a criação ainda bate na UNIQUE real do PostgreSQL.
    vi.spyOn(db.usuario, "findUnique").mockResolvedValueOnce(null);
    const estado = await cadastrar(undefined, dadosCadastro(leitor.email));

    expect(estado?.erros?.email).toBe("Já existe uma conta com este e-mail. Que tal entrar?");
    expect(contexto.criarSessao).not.toHaveBeenCalled();
    expect(contexto.medir).not.toHaveBeenCalled();
    expect(await db.usuario.count({ where: { email: leitor.email } })).toBe(1);
  });

  it("não pula a validação obrigatória do telefone", async () => {
    const estado = await cadastrar(undefined, formulario({
      nome: "Outra Pessoa", email: `outra-${randomUUID()}@exemplo.com`, senha: "senha-segura-123",
    }));
    expect(estado?.erros?.telefone).toBeTruthy();
    expect(contexto.criarSessao).not.toHaveBeenCalled();
  });

  it("depoimento repetido não envia notificação nem analytics", async () => {
    const empresa = await db.empresa.create({
      data: {
        instagramUsername: "livraria-" + randomUUID().replaceAll("-", "").slice(0, 15),
        nome: "Livraria Raiz", resumo: "Livros e cultura local",
        categoria: "Serviços", cidade: "Recife", uf: "PE", moderacao: "aprovada",
      },
    });
    empresaIds.push(empresa.id);
    await db.depoimento.create({
      data: { empresaId: empresa.id, autorId: leitor.id, texto: "Primeiro depoimento completo para teste." },
    });
    vi.spyOn(db.depoimento, "findUnique").mockResolvedValueOnce(null);

    const estado = await publicarDepoimento(undefined, formulario({
      empresaId: empresa.id,
      texto: "Outro depoimento submetido ao mesmo tempo, igualmente válido.",
    }));
    expect(estado?.erro).toBe("Você já deixou um depoimento para este negócio. Obrigado!");
    expect(contexto.medir).not.toHaveBeenCalled();
    expect(await db.depoimento.count({ where: { empresaId: empresa.id, autorId: leitor.id } })).toBe(1);
  });

  it("falhas que não são P2002 continuam sendo lançadas", async () => {
    const falha = new Prisma.PrismaClientKnownRequestError("Sem conexão", {
      code: "P1001", clientVersion: "teste",
    });
    vi.spyOn(db.usuario, "create").mockRejectedValueOnce(falha);

    await expect(cadastrar(undefined, dadosCadastro(`outro-${randomUUID()}@exemplo.com`))).rejects.toBe(falha);
    expect(contexto.criarSessao).not.toHaveBeenCalled();
  });
});
