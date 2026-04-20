import Link from "next/link";
import NavBar from "../components/NavBar";
import ProductArt from "../components/ProductArt";
import ProductCard from "../components/ProductCard";
import SearchBar from "../components/SearchBar";
import { getFeatured, getTrending } from "../lib/api";

export const dynamic = "force-dynamic";

function fmt(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return String(n);
}

export default async function HomePage() {
  const [featured, trending] = await Promise.all([getFeatured(), getTrending()]);
  const headline = featured[0];
  const stats = {
    curated: featured.length,
    catalog: 200,
    reviews: 406,
    agents: 3,
  };

  return (
    <>
      <NavBar active="home" />
      <main className="shell">
        <section className="hero">
          <div>
            <div className="hero-eyebrow">Concept No. 04 · Abril / 2026</div>
            <h1 className="hero-title">
              Três agentes,
              <br />
              uma <em>recomendação</em>
              <br />
              inequívoca.
            </h1>
            <p className="hero-lede">
              ShopAgent é um concept store onde cada produto é considerado por um
              trio de agentes que leem o Ledger, escutam a Memória dos clientes e
              sintetizam um veredito. Você pergunta, eles deliberam.
            </p>
            <div className="hero-cta">
              <Link href="/shop" className="btn primary">Explorar catálogo</Link>
              {headline && (
                <Link href={`/product/${headline.product_id}`} className="btn ghost">
                  Ou comece pelo mais desejado →
                </Link>
              )}
            </div>
          </div>
          {headline && (
            <Link href={`/product/${headline.product_id}`} className="hero-side" aria-label={`Abrir ${headline.name}`}>
              <ProductArt id={headline.product_id} name={headline.name} size="hero" priority />
              <div style={{ position: "absolute", left: 28, bottom: 28, zIndex: 2 }}>
                <div style={{
                  fontFamily: "var(--font-plex), sans-serif",
                  fontSize: 10,
                  letterSpacing: "0.28em",
                  textTransform: "uppercase",
                  color: "rgba(24,21,23,0.7)",
                  marginBottom: 8,
                }}>
                  Mais pedido · {headline.order_count ?? 0} ordens
                </div>
                <div style={{
                  fontFamily: "var(--font-instrument-serif), serif",
                  fontStyle: "italic",
                  fontSize: 34,
                  lineHeight: 1.05,
                  color: "rgba(24,21,23,0.92)",
                  maxWidth: 360,
                }}>
                  {headline.name}
                </div>
              </div>
            </Link>
          )}
        </section>

        <div className="hero-stats">
          <div className="hero-stat">
            <div className="hero-stat-label">Catálogo vivo</div>
            <div className="hero-stat-value">{fmt(stats.catalog)}</div>
            <div className="hero-stat-hint">objetos curados, atualizados em tempo real</div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-label">Vozes de cliente</div>
            <div className="hero-stat-value">{fmt(stats.reviews)}</div>
            <div className="hero-stat-hint">reviews indexados em busca semântica</div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-label">Agentes no time</div>
            <div className="hero-stat-value">{stats.agents}</div>
            <div className="hero-stat-hint">Analyst · Research · Reporter</div>
          </div>
          <div className="hero-stat">
            <div className="hero-stat-label">Latencia média</div>
            <div className="hero-stat-value">~18s</div>
            <div className="hero-stat-hint">para um veredito completo</div>
          </div>
        </div>

        <SearchBar />

        <section className="section">
          <div className="section-head">
            <h2 className="section-title">Mais pedidos da casa</h2>
            <span className="section-meta">Ranking por ordem de venda</span>
          </div>
          <div className="grid">
            {featured.map((p, i) => (
              <ProductCard key={p.product_id} product={p} badge={i === 0 ? "Nº 01" : undefined} />
            ))}
          </div>
        </section>

        {trending.length > 0 && (
          <section className="section">
            <div className="section-head">
              <h2 className="section-title">Momento atual</h2>
              <span className="section-meta">Pedidos nas últimas 24h</span>
            </div>
            <div className="grid">
              {trending.slice(0, 6).map((p) => (
                <ProductCard key={p.product_id} product={p} badge="Trending" />
              ))}
            </div>
          </section>
        )}

        <section className="editorial">
          <p className="editorial-quote">
            “Agentic Commerce não é um chatbot no canto da tela. É um time de
            agentes <em>lendo cada review, cruzando cada métrica</em> antes de
            você decidir.”
          </p>
          <div className="editorial-attrib">Seman ai data engineer · Day 04</div>
        </section>

        <footer className="footer">
          ShopAgent Concept Store · Powered by CrewAI · {stats.catalog} produtos · {stats.reviews} reviews
        </footer>
      </main>
    </>
  );
}
