"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SearchBar({ initial = "" }: { initial?: string }) {
  const [value, setValue] = useState(initial);
  const router = useRouter();

  return (
    <form
      className="search-row"
      onSubmit={(e) => {
        e.preventDefault();
        const q = value.trim();
        router.push(q ? `/shop?search=${encodeURIComponent(q)}` : "/shop");
      }}
    >
      <input
        className="search-input"
        placeholder="Procure por um objeto, marca, sensação…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        aria-label="Buscar produtos"
      />
      <button type="submit" className="btn">Buscar</button>
    </form>
  );
}
