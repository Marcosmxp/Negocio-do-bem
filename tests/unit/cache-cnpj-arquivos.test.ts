import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve } from "node:path";
import { afterEach, expect, it } from "vitest";
import { artefatos } from "../apoio/cache-cnpj/arquivos.mjs";

const criados: string[] = [];
afterEach(() => {
  for (const caminho of criados.splice(0)) rmSync(caminho, { recursive: true });
});

function fixture() {
  const raiz = mkdtempSync(resolve(tmpdir(), "cache-cnpj-artefatos-"));
  criados.push(raiz);
  mkdirSync(resolve(raiz, ".next/server"), { recursive: true });
  mkdirSync(resolve(raiz, ".next/static"));
  writeFileSync(resolve(raiz, ".next/BUILD_ID"), "build-sintetico");
  writeFileSync(resolve(raiz, ".next/server/pagina.js"), "codigo-sintetico");
  writeFileSync(resolve(raiz, ".next/static/pagina.css"), "estilo-sintetico");
  return raiz;
}

it("não confunde promoção do cache de rota em runtime com alteração do build", () => {
  const raiz = fixture();
  const antes = artefatos(raiz);
  const cache = resolve(raiz, ".next/server/route-cache/APP_PAGE/namespace");
  mkdirSync(cache, { recursive: true });
  writeFileSync(resolve(cache, "pagina.html"), "cache-sintetico");
  expect(artefatos(raiz)).toEqual(antes);
});

it.each([".next/BUILD_ID", ".next/server/pagina.js", ".next/static/pagina.css"])(
  "continua detectando mudança do artefato imutável %s",
  caminho => {
    const raiz = fixture();
    const antes = artefatos(raiz);
    writeFileSync(resolve(raiz, caminho), "conteudo-alterado");
    expect(artefatos(raiz)).not.toEqual(antes);
  },
);
