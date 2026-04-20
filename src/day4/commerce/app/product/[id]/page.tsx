import Link from "next/link";
import { notFound } from "next/navigation";
import NavBar from "../../../components/NavBar";
import AskTrigger from "../../../components/AskTrigger";
import ProductArt from "../../../components/ProductArt";
import { getProduct } from "../../../lib/api";

export const dynamic = "force-dynamic";

function fmtBRL(v: number): string {
  return v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function describe(category: string, brand: string): string {
  return `Uma peça ${category.toLowerCase()} da ${brand}. Considerada pelos agentes antes de chegar até você.`;
}

export default async function ProductPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let product;
  try {
    product = await getProduct(id);
  } catch {
    notFound();
  }

  const statusRows = Object.entries(product.status_breakdown).sort((a, b) => b[1] - a[1]);
  const statusMax = Math.max(...statusRows.map(([, n]) => n), 1);
  const paymentRows = Object.entries(product.payment_breakdown).sort((a, b) => b[1] - a[1]);
  const paymentMax = Math.max(...paymentRows.map(([, n]) => n), 1);

  return (
    <>
      <NavBar active="product" />
      <main className="shell">
        <section className="detail">
          <div className="detail-art">
            <ProductArt id={product.product_id} name={product.name} size="detail" priority />
          </div>
          <div className="detail-meta">
            <div className="crumb">
              <Link href="/shop">Catálogo</Link> · {product.category}
            </div>
            <h1 className="detail-name">{product.name}</h1>
            <div className="detail-brand">{product.brand}</div>

            <div className="detail-price">
              <span className="val">{fmtBRL(product.price)}</span>
              <span className="unit">un / preço cheio</span>
            </div>

            <p className="detail-lede">{describe(product.category, product.brand)}</p>

            <AskTrigger product={product} />

            <div className="detail-signals">
              <div className="signal">
                <div className="signal-label">Pedidos históricos</div>
                <div className="signal-value">{product.order_count}</div>
                <div className="signal-hint">no Ledger</div>
              </div>
              <div className="signal">
                <div className="signal-label">Receita</div>
                <div className="signal-value">{fmtBRL(product.total_revenue ?? 0)}</div>
                <div className="signal-hint">lifetime</div>
              </div>
              <div className="signal">
                <div className="signal-label">Qtd média</div>
                <div className="signal-value">{product.avg_qty.toFixed(2)}</div>
                <div className="signal-hint">por pedido</div>
              </div>
            </div>

            {statusRows.length > 0 && (
              <div className="distribution">
                <div className="dist-title">Status das ordens</div>
                {statusRows.map(([label, n]) => (
                  <div className="dist-row" key={label}>
                    <span>{label}</span>
                    <div className="dist-bar"><span style={{ width: `${(n / statusMax) * 100}%` }} /></div>
                    <span style={{ textAlign: "right" }}>{n}</span>
                  </div>
                ))}
              </div>
            )}

            {paymentRows.length > 0 && (
              <div className="distribution">
                <div className="dist-title">Forma de pagamento</div>
                {paymentRows.map(([label, n]) => (
                  <div className="dist-row" key={label}>
                    <span>{label}</span>
                    <div className="dist-bar"><span style={{ width: `${(n / paymentMax) * 100}%` }} /></div>
                    <span style={{ textAlign: "right" }}>{n}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </section>

        <footer className="footer">
          Veredito do crew gerado em tempo real · baseado em dados reais do Ledger e Memory
        </footer>
      </main>
    </>
  );
}
