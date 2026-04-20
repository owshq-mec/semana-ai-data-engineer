# ShopAgent Observatory

Editorial-Observatory live dashboard for the Day 4 multi-agent demo.

## Run

```bash
# 1. start data platform
cd ../../gen && docker compose up -d

# 2. start FastAPI sidecar (from repo root)
uvicorn src.day4.api.server:app --host 0.0.0.0 --port 8010 --reload

# 3. start observatory
cd src/day4/observatory
npm install
npm run dev         # http://localhost:3100
```

`NEXT_PUBLIC_BACKEND_URL` overrides the default `http://localhost:8010`.
