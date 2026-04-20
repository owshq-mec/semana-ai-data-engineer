"use client";

import { useEffect } from "react";
import { useConcierge } from "../lib/concierge";
import type { ProductDetail } from "../lib/types";

export default function AskTrigger({ product }: { product: ProductDetail }) {
  const { openAndAsk, setProductContext } = useConcierge();
  const productCtx = {
    product_id: product.product_id,
    name: product.name,
    brand: product.brand,
    category: product.category,
    price: product.price,
  };

  useEffect(() => {
    setProductContext(productCtx);
    return () => setProductContext(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product.product_id]);

  const ask = () => {
    openAndAsk(
      `Faça uma análise completa de "${product.name}" — métricas, sentimento dos reviews e recomendação em 2 frases.`,
      productCtx,
    );
  };

  return (
    <div className="detail-cta">
      <button className="btn primary" onClick={ask}>
        Ask the agents →
      </button>
      <a className="btn ghost" href="/shop">Ver mais produtos</a>
    </div>
  );
}
