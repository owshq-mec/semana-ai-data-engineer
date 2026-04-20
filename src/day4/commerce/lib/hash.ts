export function hashToHSL(id: string, saturation = 20, lightness = 64): string {
  let hash = 0;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  const hue = hash % 360;
  return `hsl(${hue}, ${saturation}%, ${lightness}%)`;
}

export function productPalette(id: string): { base: string; accent: string; deep: string } {
  const h1 = hashHue(id, 7);
  const h2 = hashHue(id, 13);
  return {
    base: `hsl(${h1}, 22%, 78%)`,
    accent: `hsl(${h2}, 28%, 66%)`,
    deep: `hsl(${h1}, 24%, 38%)`,
  };
}

function hashHue(id: string, seed: number): number {
  let hash = seed;
  for (let i = 0; i < id.length; i += 1) {
    hash = (hash * 31 + id.charCodeAt(i)) >>> 0;
  }
  return hash % 360;
}

export function productInitial(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

const UNSPLASH_POOL: Record<string, string[]> = {
  bag: [
    "photo-1553062407-98eeb64c6a62",
    "photo-1548036328-c9fa89d128fa",
    "photo-1590874103328-eac38a683ce7",
    "photo-1584917865442-de89df76afd3",
  ],
  watch: [
    "photo-1523275335684-37898b6baf30",
    "photo-1587836374828-4dbafa94cf0e",
    "photo-1594534475808-b18fc33b045e",
    "photo-1524592094714-0f0654e20314",
  ],
  clock: [
    "photo-1563861826100-9cb868fdbe1c",
    "photo-1501139083538-0139583c060f",
    "photo-1507646227500-4d389b0012be",
  ],
  hat: [
    "photo-1521369909029-2afed882baee",
    "photo-1514327605112-b887c0e61c0a",
    "photo-1534215754734-18e55d13e346",
    "photo-1556306535-0f09a537f0a3",
  ],
  shoes: [
    "photo-1542291026-7eec264c27ff",
    "photo-1549298916-b41d501d3772",
    "photo-1600185365926-3a2ce3cdb9eb",
    "photo-1595950653106-6c9ebd614d3a",
  ],
  gloves: [
    "photo-1520903920243-00d872a2d1c9",
    "photo-1608256246200-53e635b5b65f",
    "photo-1598532163257-ae3c6b2524b6",
  ],
  table: [
    "photo-1555041469-a586c61ea9bc",
    "photo-1538688525198-9b88f6f53126",
    "photo-1503602642458-232111445657",
    "photo-1540574163026-643ea20ade25",
  ],
  wallet: [
    "photo-1627123424574-724758594e93",
    "photo-1604644401890-0bd678c83788",
  ],
  plate: [
    "photo-1556909114-f6e7ad7d3136",
    "photo-1607082349566-187342175e2f",
    "photo-1549931319-a545dcf3bc73",
  ],
  jewelry: [
    "photo-1515562141207-7a88fb7ce338",
    "photo-1605100804763-247f67b3557e",
    "photo-1602173574767-37ac01994b2a",
    "photo-1611085583191-a3b181a88401",
  ],
  car: [
    "photo-1552519507-da3b142c6e3d",
    "photo-1492144534655-ae79c964c9d7",
    "photo-1503376780353-7e6692767b70",
  ],
  electronics: [
    "photo-1587033411391-5d9e51cce126",
    "photo-1541534741688-6078c6bfb5c5",
    "photo-1496181133206-80ce9b88a853",
    "photo-1531297484001-80022131f5a1",
  ],
  clothing: [
    "photo-1521572163474-6864f9cf17ab",
    "photo-1583743814966-8936f5b7be1a",
    "photo-1603252109303-2751441dd157",
    "photo-1562157873-818bc0726f68",
  ],
  toy: [
    "photo-1596461404969-9ae70f2830c1",
    "photo-1566041510639-8d95a2490bfb",
  ],
  book: [
    "photo-1512820790803-83ca734da794",
    "photo-1544716278-ca5e3f4abd8c",
    "photo-1495446815901-a7297e633e8d",
  ],
  tool: [
    "photo-1504328345606-18bbc8c9d7d1",
    "photo-1581244277943-fe4a9c777189",
    "photo-1530124566582-a618bc2615dc",
  ],
  sports: [
    "photo-1594381898411-846e7d193883",
    "photo-1606925797300-0b35e9d1794e",
    "photo-1517649763962-0c623066013b",
  ],
  garden: [
    "photo-1416879595882-3373a0480b5b",
    "photo-1512699355324-f07e3106dae5",
    "photo-1558618666-fcd25c85cd64",
  ],
  generic: [
    "photo-1560769629-975ec94e6a86",
    "photo-1519125323398-675f0ddb6308",
    "photo-1607082348824-0a96f2a4b9da",
  ],
};

const NOUN_MAP: Array<[RegExp, keyof typeof UNSPLASH_POOL]> = [
  [/\b(bag|handbag|tote|purse|backpack|satchel|pouch)\b/, "bag"],
  [/\b(watch|wristwatch)\b/, "watch"],
  [/\b(clock|timepiece)\b/, "clock"],
  [/\b(hat|cap|beanie|helmet)\b/, "hat"],
  [/\b(shoe|shoes|sneaker|boot|boots|sandal|heel|heels)\b/, "shoes"],
  [/\b(glove|gloves|mitten|mittens)\b/, "gloves"],
  [/\b(table|desk|chair|sofa|bench|bed|furniture)\b/, "table"],
  [/\b(wallet|cardholder|purse)\b/, "wallet"],
  [/\b(plate|bowl|cup|mug|dish|fork|spoon|knife)\b/, "plate"],
  [/\b(necklace|ring|earring|bracelet|jewel|jewelry|pendant)\b/, "jewelry"],
  [/\b(car|vehicle|truck|automobile)\b/, "car"],
  [/\b(keyboard|mouse|phone|computer|laptop|speaker|headphone|headphones|camera|monitor)\b/, "electronics"],
  [/\b(shirt|pants|jean|jeans|dress|coat|jacket|sweater|hoodie|scarf|tie|sock|socks)\b/, "clothing"],
  [/\b(toy|doll|game|puzzle|block|lego)\b/, "toy"],
  [/\b(book|novel|magazine|journal)\b/, "book"],
  [/\b(tool|tools|hammer|wrench|screwdriver|drill)\b/, "tool"],
  [/\b(ball|racket|bike|bicycle|sports|gym)\b/, "sports"],
  [/\b(garden|plant|flower|pot|seed)\b/, "garden"],
];

function inferImageKey(name: string): keyof typeof UNSPLASH_POOL {
  const lower = name.toLowerCase();
  for (const [re, key] of NOUN_MAP) {
    if (re.test(lower)) return key;
  }
  return "generic";
}

export function productImageUrl(
  id: string,
  name: string,
  width: number = 800,
  height: number = 1000,
): string {
  const key = inferImageKey(name);
  const pool = UNSPLASH_POOL[key];
  let seedHash = 0;
  for (let i = 0; i < id.length; i += 1) {
    seedHash = (seedHash * 31 + id.charCodeAt(i)) >>> 0;
  }
  const photoId = pool[seedHash % pool.length];
  return `https://images.unsplash.com/${photoId}?w=${width}&h=${height}&fit=crop&crop=entropy&q=80&auto=format`;
}
