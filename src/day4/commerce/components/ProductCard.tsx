import Link from "next/link";
import type { Product } from "../lib/types";
import ProductArt from "./ProductArt";

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ProductCard({ product, badge }: { product: Product; badge?: string }) {
  return (
    <Link href={`/product/${product.product_id}`} className="card">
      <div className="card-art">
        <ProductArt id={product.product_id} name={product.name} />
        <span className="card-tag">{product.category.split(" ")[0]}</span>
        {badge && <span className="card-badge">{badge}</span>}
      </div>
      <div className="card-meta">
        <h3 className="card-name">{product.name}</h3>
        <div className="card-sub">
          <span>{product.brand}</span>
          {product.order_count !== undefined && (
            <>
              <span className="dot-sep" />
              <span>{product.order_count} pedidos</span>
            </>
          )}
        </div>
        <div className="card-price">
          <strong>{fmtBRL(product.price)}</strong>
          <em>Ask the agents →</em>
        </div>
      </div>
    </Link>
  );
}
