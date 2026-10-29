import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { moderarServico } from "@/acoes/servicos";
import { IconeRede } from "@/components/IconeRede";
import { exigirModerador } from "@/lib/auth/sessao";
import { db } from "@/lib/db";

export const metadata: Metadata = { title: "Moderar serviços", robots: { index: false } };

export default function ModeracaoServicos() {
  return (
    <div className="mx-auto w-full max-w-5xl px-4 pt-8 sm:px-6 sm:pt-12">
      <nav aria-label="Você está em" className="mb-7 flex items-center gap-2 text-sm text-suave">
        <Link href="/moderacao" className="inline-flex items-center gap-2 font-medium text-coral-700 hover:underline">
          <IconeRede nome="voltar" className="h-4 w-4" /> Moderação
        </Link>
        <span aria-hidden="true">/</span>
        <span>Serviços</span>
      </nav>
      <span className="inline-flex items-center gap-2 rounded-full bg-folha-50 px-3 py-1.5 text-xs font-semibold text-folha">
        <IconeRede nome="seguro" className="h-4 w-4" /> Moderação da comunidade
      </span>
      <h1 className="mt-4 font-serif text-4xl font-semibold tracking-tight sm:text-5xl">Analisar anúncios</h1>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-suave sm:text-base">Verifique os dados e a descrição de cada serviço antes de disponibilizá-lo à comunidade.</p>
      <Suspense fallback={<div className="mt-8 h-80 animate-pulse rounded-3xl bg-superficie" />}><Conteudo /></Suspense>
    </div>
  );
}

async function Conteudo() {
  await exigirModerador();
  const pendentes = await db.servico.findMany({
    where: { status: "pendente" },
    include: { perfil: { select: { nomePublico: true } }, empresa: { select: { nome: true } } },
    orderBy: { criadoEm: "asc" }, take: 50,
  });
  return (
    <section aria-labelledby="pendentes" className="mt-8 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-linha pb-4">
        <h2 id="pendentes" className="font-serif text-2xl font-semibold sm:text-3xl">Aguardando revisão</h2>
        <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">{pendentes.length} pendentes</span>
      </div>
      {pendentes.length === 0 ? (
        <div className="cartao flex flex-col items-center px-6 py-12 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-folha-50 text-folha"><IconeRede nome="verificar" className="h-7 w-7" /></div>
          <h3 className="mt-5 font-serif text-2xl font-semibold">Tudo em dia</h3>
          <p className="mt-2 text-sm text-suave">Nenhum anúncio de serviço aguardando análise.</p>
        </div>
      ) : (
        <div className="grid gap-4">
          {pendentes.map((servico) => (
            <article className="cartao min-w-0 overflow-hidden p-5 sm:p-7" key={servico.id}>
              <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
                <div>
                  <span className="rounded-full bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800">Aguardando análise</span>
                  <h3 className="mt-4 break-words font-serif text-2xl font-semibold leading-tight">{servico.titulo}</h3>
                  <p className="mt-2 inline-flex items-center gap-2 text-sm font-medium">
                    <IconeRede nome={servico.empresa ? "empresa" : "pessoa"} className="h-4 w-4 text-suave" />
                    {servico.perfil?.nomePublico ?? servico.empresa?.nome}
                  </p>
                </div>
                <span className="text-xs text-suave sm:text-right">{servico.categoria}<span aria-hidden="true"> · </span>{servico.cidade}, {servico.uf}</span>
              </div>
              <p className="mt-5 whitespace-pre-wrap break-words rounded-2xl bg-papel/70 p-4 text-sm leading-relaxed text-suave sm:p-5">{servico.descricao}</p>
              <div className="mt-4 flex flex-wrap gap-2 text-xs text-suave">
                {servico.remoto && <span className="rounded-full bg-papel px-3 py-1.5">Remoto</span>}
                {servico.presencial && <span className="rounded-full bg-papel px-3 py-1.5">Presencial</span>}
                <span className="rounded-full bg-papel px-3 py-1.5">{servico.precoReferencia || "Sem preço definido"}</span>
              </div>
              <div className="mt-6 flex flex-col gap-3 border-t border-linha pt-5 sm:flex-row sm:justify-end">
                {(["aprovar", "rejeitar"] as const).map((decisao) => (
                  <form key={decisao} action={moderarServico} className="w-full sm:w-auto">
                    <input type="hidden" name="id" value={servico.id} />
                    <input type="hidden" name="decisao" value={decisao} />
                    <button type="submit" className={`${decisao === "aprovar" ? "botao-coral" : "botao-claro"} min-h-11 w-full px-6 sm:w-auto`}>
                      {decisao === "aprovar" ? <IconeRede nome="verificar" className="h-4 w-4" /> : <IconeRede nome="ocultar" className="h-4 w-4" />}
                      {decisao === "aprovar" ? "Aprovar anúncio" : "Recusar anúncio"}
                    </button>
                  </form>
                ))}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}
