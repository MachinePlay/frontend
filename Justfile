dev:
    pnpm dev

install:
    pnpm install

build:
    pnpm build

preview:
    pnpm preview

lint:
    pnpm lint

# Regenerate TS types from ./openapi.json.
# Run `just gen-api` in the backend repo first to refresh openapi.json.
gen-api:
    pnpm gen-api

# Build & publish the static site to the VPS (see deploy-machineplay-frontend in malganis).
deploy:
    ssh root@machineplay.org deploy-machineplay-frontend
