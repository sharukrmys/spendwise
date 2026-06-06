.DEFAULT_GOAL := help
.PHONY: help install dev build preview lint clean deploy-netlify deploy-vercel deploy-vercel-preview deploy-cf deploy-s3

# ─── Colors ──────────────────────────────────────────────────────────────────
BOLD  := \033[1m
RESET := \033[0m
GREEN := \033[32m
CYAN  := \033[36m

# ─── Help ────────────────────────────────────────────────────────────────────
help:
	@echo ""
	@echo "  $(BOLD)SR Expense — available targets$(RESET)"
	@echo ""
	@echo "  $(CYAN)Development$(RESET)"
	@echo "    $(BOLD)install$(RESET)               Install npm dependencies"
	@echo "    $(BOLD)dev$(RESET)                   Start dev server with HMR  (http://localhost:5173)"
	@echo "    $(BOLD)build$(RESET)                 Type-check + production build → dist/"
	@echo "    $(BOLD)preview$(RESET)               Serve the production build locally"
	@echo "    $(BOLD)lint$(RESET)                  Run ESLint"
	@echo "    $(BOLD)clean$(RESET)                 Remove dist/ and node_modules/"
	@echo "    $(BOLD)reinstall$(RESET)             clean node_modules then install"
	@echo ""
	@echo "  $(CYAN)Deployment$(RESET)"
	@echo "    $(BOLD)deploy-netlify$(RESET)        Build + deploy to Netlify (prod)"
	@echo "    $(BOLD)deploy-vercel$(RESET)         Build + deploy to Vercel  (prod)"
	@echo "    $(BOLD)deploy-vercel-preview$(RESET) Deploy to Vercel preview URL"
	@echo "    $(BOLD)deploy-cf$(RESET)             Build + deploy to Cloudflare Pages"
	@echo "    $(BOLD)deploy-s3$(RESET)             Build + sync to AWS S3  (set S3_BUCKET / CF_DIST_ID)"
	@echo ""

# ─── Development ─────────────────────────────────────────────────────────────
install:
	npm install

dev:
	npm run dev

build:
	npm run build

preview: build
	npm run preview

lint:
	npm run lint

clean:
	rm -rf dist node_modules

reinstall: clean install

# ─── Deployment ──────────────────────────────────────────────────────────────

# Netlify  ────────────────────────────────────────────────────────────────────
deploy-netlify: build
	@command -v netlify >/dev/null 2>&1 || npm i -g netlify-cli
	netlify deploy --prod --dir=dist

# Vercel ──────────────────────────────────────────────────────────────────────
deploy-vercel: build
	@command -v vercel >/dev/null 2>&1 || npm i -g vercel
	vercel --prod

deploy-vercel-preview:
	@command -v vercel >/dev/null 2>&1 || npm i -g vercel
	vercel

# Cloudflare Pages ────────────────────────────────────────────────────────────
deploy-cf: build
	@command -v wrangler >/dev/null 2>&1 || npm i -g wrangler
	npx wrangler pages deploy dist --project-name=sr-expense

# AWS S3 + CloudFront ─────────────────────────────────────────────────────────
# Usage: make deploy-s3 S3_BUCKET=your-bucket-name CF_DIST_ID=YOUR_DIST_ID
S3_BUCKET ?= your-bucket-name
CF_DIST_ID ?=

deploy-s3: build
	aws s3 sync dist/ s3://$(S3_BUCKET) --delete
	@if [ -n "$(CF_DIST_ID)" ]; then \
		echo "$(GREEN)Invalidating CloudFront distribution $(CF_DIST_ID)…$(RESET)"; \
		aws cloudfront create-invalidation --distribution-id $(CF_DIST_ID) --paths "/*"; \
	fi
