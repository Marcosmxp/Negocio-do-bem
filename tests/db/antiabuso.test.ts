import { randomUUID } from "node:crypto";
import { afterAll, describe, expect, it } from "vitest";
import { reservarEscrita } from "@/lib/antiabuso";
import { db } from "@/lib/db";

afterAll(async () => { await db.$disconnect(); });

describe("reserva atómica de operações de escrita (#104)", () => {
  it("limita chamadas paralelas de uma conta sem perder incrementos", async () => {
    const usuarioId = randomUUID();
    const negocioId = randomUUID();
    const resultados = await Promise.all(Array.from({ length: 18 }, () =>
      reservarEscrita({ operacao: "depoimento", usuarioId, negocioId, origem: null }),
    ));
    expect(resultados.filter(Boolean)).toHaveLength(8);
    expect(await reservarEscrita({ operacao: "depoimento", usuarioId, negocioId, origem: null })).toBe(false);
  });

  it("não mistura a contagem de operações diferentes ou de outras contas", async () => {
    const negocioId = randomUUID();
    const usuarioId = randomUUID();
    for (let i = 0; i < 8; i++) {
      expect(await reservarEscrita({ operacao: "depoimento", usuarioId, negocioId, origem: null })).toBe(true);
    }
    expect(await reservarEscrita({ operacao: "depoimento", usuarioId, negocioId, origem: null })).toBe(false);
    expect(await reservarEscrita({ operacao: "denuncia", usuarioId, negocioId, origem: null })).toBe(true);
    expect(await reservarEscrita({ operacao: "depoimento", usuarioId: randomUUID(), negocioId, origem: null })).toBe(true);
  });

  it("limita agregados por negócio mesmo com diferentes contas", async () => {
    const negocioId = randomUUID();
    const resultados = await Promise.all(Array.from({ length: 66 }, () =>
      reservarEscrita({ operacao: "depoimento", usuarioId: randomUUID(), negocioId, origem: null }),
    ));
    expect(resultados.filter(Boolean)).toHaveLength(60);
  });

  it("sem IP confiável, não impõe uma cota comum a contas sem relação", async () => {
    const resultados = await Promise.all(Array.from({ length: 12 }, () =>
      reservarEscrita({ operacao: "indicacao", usuarioId: randomUUID(), origem: null }),
    ));
    expect(resultados.every(Boolean)).toBe(true);
  });
});
