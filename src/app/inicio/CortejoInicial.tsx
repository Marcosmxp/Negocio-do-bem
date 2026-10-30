import Link from "next/link";
import type { CSSProperties } from "react";
import { PESSOAS_DO_CORTEJO } from "@/components/cortejo/dados";
import { PERSONAGENS } from "@/components/cortejo/personagens";
import { hrefDiretorio } from "@/lib/diretorio";

/** O cortejo continua visível sem JavaScript, sem inventar contagens enquanto o banco responde. */
export function CortejoInicial() {
  const Caramelo = PERSONAGENS.caramelo.Figura;
  return (
    <div className="cortejo pintura" data-estado="parado" style={{ "--textura-grao": "none", "--textura-falhas": "none" } as CSSProperties}>
      <div className="cortejo-palco">
        <ul className="cortejo-fila">
          {PESSOAS_DO_CORTEJO.map((pessoa, indice) => {
            const Figura = PERSONAGENS[pessoa.id].Figura;
            return (
              <li key={pessoa.id} className="cortejo-vaga">
                <Link href={hrefDiretorio({ tipos: [pessoa.rotulo] })} className="cortejo-pessoa" aria-label={`Ver negócios de ${pessoa.rotulo.toLocaleLowerCase("pt-BR")}`}>
                  <Figura placa={pessoa.placa} />
                </Link>
                {indice === PESSOAS_DO_CORTEJO.length - 1 && <div className="cortejo-cachorro" aria-hidden="true"><Caramelo /></div>}
              </li>
            );
          })}
        </ul>
      </div>
      <span className="sr-only">Encontre negócios pelo tipo, pela cidade ou pelas causas.</span>
    </div>
  );
}
