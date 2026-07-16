import { Fragment } from "react";

/**
 * Marquee decorativo de saídas profissionais (aria-hidden).
 * As duas <span> repetidas são necessárias para o loop CSS contínuo.
 */
export default function OutcomesMarquee({ itens }: { itens: string[] }) {
  const linha = itens.map((item, i) => (
    <Fragment key={i}>
      {item} <i>◆</i>{" "}
    </Fragment>
  ));

  return (
    <div className="marquee" aria-hidden="true">
      <div className="marquee-track">
        <span>{linha}</span>
        <span>{linha}</span>
      </div>
    </div>
  );
}
