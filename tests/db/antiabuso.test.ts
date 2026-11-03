import { createHash, randomUUID } from "node:crypto";
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

  it("aplica a cota de origem confiável mesmo quando as contas são diferentes", async () => {
    const origem = "203.0.113.155";
    const negocioId = randomUUID();
    const primeira = await reservarEscrita({
      operacao: "denuncia", usuarioId: randomUUID(), negocioId, origem,
    });
    expect(primeira).toBe(true);
    const chave = createHash("sha256")
      .update(JSON.stringify(["ndb:escrita:v1", "denuncia", "origem", origem]))
      .digest("hex");
    await db.tentativaAcesso.update({ where: { chave }, data: { contagem: 200 } });
    expect(await reservarEscrita({
      operacao: "denuncia", usuarioId: randomUUID(), negocioId, origem,
    })).toBe(false);
    expect(await reservarEscrita({
      operacao: "denuncia", usuarioId: randomUUID(), negocioId, origem: "198.51.100.9",
    })).toBe(true);
  });

  it("sem IP confiável, não impõe uma cota comum a contas sem relação", async () => {
    const resultados = await Promise.all(Array.from({ length: 12 }, () =>
      reservarEscrita({ operacao: "indicacao", usuarioId: randomUUID(), origem: null }),
    ));
    expect(resultados.every(Boolean)).toBe(true);
  });
});
