/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  async rewrites() {
    const backend = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8010";
    return [
      { source: "/api/query", destination: `${backend}/query` },
      { source: "/api/stream/:trace_id", destination: `${backend}/stream/:trace_id` },
      { source: "/api/telemetry/stream", destination: `${backend}/telemetry/stream` },
    ];
  },
};
export default nextConfig;
