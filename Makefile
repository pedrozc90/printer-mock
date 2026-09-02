.DEFAULT_GOAL := help

SHELL := bash
.SHELLFLAGS := -eu -o pipefail -c

# -- help ---------------------

.PHONY: help
help:
	@grep -E '^[a-zA-Z_-]+:.*## .*$$' $(MAKEFILE_LIST) \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-20s\033[0m %s\n", $$1, $$2}'

# -- NPM -------------------

.PHONY: start
start: ## run application
	npm start

.PHONY: check
check: ## format and type check
	npm run format:fix && npm run typecheck
