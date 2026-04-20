import NavBar from "../../components/NavBar";
import ProductCard from "../../components/ProductCard";
import SearchBar from "../../components/SearchBar";
import { getCategories, getProducts } from "../../lib/api";

export const dynamic = "force-dynamic";

export default async function ShopPage({ searchParams }: { searchParams: Promise<{ search?: string; category?: string }> }) {
  const params = await searchParams;
  const search = params.search || "";
  const category = params.category || "";
  const [{ items, total }, categories] = await Promise.all([
    getProducts({ limit: 24, search, category }),
    getCategories(),
  ]);

  return (
    <>
      <NavBar active="shop" />
      <main className="shell">
        <section style={{ padding: "60px 40px 24px", maxWidth: 1640, margin: "0 auto" }}>
          <div className="hero-eyebrow">Catálogo · {total} objetos</div>
          <h1 className="hero-title" style={{ fontSize: "clamp(44px, 5vw, 82px)" }}>
            {search ? <>Resultados para <em>“{search}”</em></> : category ? <>Categoria · <em>{category}</em></> : <>Toda a <em>coleção</em>.</>}
          </h1>
          <p className="hero-lede" style={{ marginTop: 14 }}>
            Clique em qualquer objeto para ouvir os três agentes debaterem antes da sua decisão.
          </p>
        </section>

        <SearchBar initial={search} />

        <div style={{ maxWidth: 1640, margin: "0 auto 32px", padding: "0 40px", display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a
            href="/shop"
            className="btn ghost"
            style={!category ? { borderColor: "var(--ink)", color: "var(--ink)" } : undefined}
          >
            Todas
          </a>
          {categories.slice(0, 10).map((c) => (
            <a
              key={c.category}
              href={`/shop?category=${encodeURIComponent(c.category)}`}
              className="btn ghost"
              style={category === c.category ? { borderColor: "var(--ink)", color: "var(--ink)" } : undefined}
            >
              {c.category} <span style={{ opacity: 0.5, marginLeft: 6 }}>{c.product_count}</span>
            </a>
          ))}
        </div>

        <section className="section">
          <div className="grid">
            {items.map((p) => (
              <ProductCard key={p.product_id} product={p} />
            ))}
          </div>
          {items.length === 0 && (
            <div style={{ textAlign: "center", padding: "60px 40px", color: "var(--ink-quiet)", fontStyle: "italic" }}>
              Nenhum objeto encontrado. Tente outra palavra.
            </div>
          )}
        </section>

        <footer className="footer">
          {items.length} de {total} objetos · Mais refinação via categorias acima
        </footer>
      </main>
    </>
  );
}
