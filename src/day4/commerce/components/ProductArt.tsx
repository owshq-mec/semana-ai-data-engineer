import { productImageUrl, productInitial, productPalette } from "../lib/hash";

interface Props {
  id: string;
  name: string;
  size?: "card" | "hero" | "detail";
  priority?: boolean;
}

const SIZES: Record<NonNullable<Props["size"]>, { width: number; height: number }> = {
  card: { width: 640, height: 800 },
  hero: { width: 960, height: 1280 },
  detail: { width: 1024, height: 1280 },
};

export default function ProductArt({ id, name, size = "card", priority = false }: Props) {
  const palette = productPalette(id);
  const initial = productInitial(name);
  const gradientId = `g-${id.slice(0, 8)}`;
  const { width, height } = SIZES[size];
  const imageUrl = productImageUrl(id, name, width, height);

  return (
    <>
      <svg
        aria-hidden
        viewBox="0 0 400 500"
        preserveAspectRatio="xMidYMid slice"
        style={{ position: "absolute", inset: 0, width: "100%", height: "100%" }}
      >
        <defs>
          <radialGradient id={`${gradientId}-a`} cx="30%" cy="25%" r="60%">
            <stop offset="0%" stopColor={palette.accent} stopOpacity="0.9" />
            <stop offset="100%" stopColor={palette.base} stopOpacity="0.6" />
          </radialGradient>
          <radialGradient id={`${gradientId}-b`} cx="80%" cy="80%" r="55%">
            <stop offset="0%" stopColor={palette.deep} stopOpacity="0.35" />
            <stop offset="100%" stopColor={palette.base} stopOpacity="0" />
          </radialGradient>
        </defs>
        <rect width="400" height="500" fill={palette.base} />
        <rect width="400" height="500" fill={`url(#${gradientId}-a)`} />
        <rect width="400" height="500" fill={`url(#${gradientId}-b)`} />
      </svg>
      <div className="card-initial" aria-hidden>
        {initial}
      </div>
      <img
        src={imageUrl}
        alt={name}
        className="card-photo"
        loading={priority ? "eager" : "lazy"}
        decoding="async"
      />
    </>
  );
}
