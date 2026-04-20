import Link from "next/link";
import TrendingTicker from "./TrendingTicker";

export default function NavBar({ active = "home" }: { active?: "home" | "shop" | "product" }) {
  return (
    <nav className="nav">
      <Link href="/" className="brand" aria-label="ShopAgent home">
        <span className="brand-mark">ShopAgent</span>
        <span className="brand-sub">Concept · No. 04</span>
      </Link>
      <ul className="nav-links">
        <li><Link href="/" className={active === "home" ? "active" : undefined}>Editório</Link></li>
        <li><Link href="/shop" className={active === "shop" ? "active" : undefined}>Catálogo</Link></li>
        <li><Link href="http://localhost:3100" target="_blank" rel="noreferrer">Observatório</Link></li>
      </ul>
      <TrendingTicker />
    </nav>
  );
}
