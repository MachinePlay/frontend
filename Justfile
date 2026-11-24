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

# Regenerate TS types from ./openapi.json; `just gen-api` in the umbrella dir
# refreshes that first.
gen-api:
    pnpm gen-api

# Build & publish the static site on the VPS.
deploy:
    ssh root@machineplay.org deploy-machineplay-frontend
