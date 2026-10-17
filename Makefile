# OpenCode Plugin Lab — developer interface.
#
# Everything runs through Docker Compose; the lab never mounts the plugin
# development repositories and never touches your existing OpenCode install.
.DEFAULT_GOAL := help
SHELL := /bin/bash

CONFIG ?= all
TIER ?= all
PLUGIN ?=

export CONFIG TIER PLUGIN

.PHONY: help build stage discover start stop logs test test-baseline \
        test-checkpoint test-git-that-shit test-stranger-danger test-all \
        suite validate rc-evidence test-online refresh reset report shell clean

help: ## Show this help
	@echo "OpenCode Plugin Lab"
	@echo
	@echo "  make build              Build staged plugin packages + Docker image"
	@echo "  make stage              Stage allowlisted plugin sources only"
	@echo "  make discover           Show plugin worktrees, versions, commits"
	@echo "  make start              Build (if needed) + run baseline smoke check"
	@echo "  make stop               Stop/remove lab containers"
	@echo "  make logs               Show container logs + latest report"
	@echo
	@echo "  make test CONFIG=<name> TIER=<tier>   Run one configuration"
	@echo "        configs: baseline checkpoint-orchestrator git-that-shit stranger-danger all"
	@echo "        tiers:   smoke functional model integration security validate all"
	@echo "  make test-checkpoint    Checkpoint Orchestrator only"
	@echo "  make test-git-that-shit Git That Shit only"
	@echo "  make test-stranger-danger  Stranger Danger only"
	@echo "  make test-baseline      OpenCode V2 without external plugins"
	@echo "  make test-all           All three plugins together"
	@echo "  make suite              Complete suite across all five configurations"
	@echo "  make validate           Full validation incl. matrix/security/concurrency/isolation"
	@echo "  make rc-evidence        Source/packed/installed version evidence"
	@echo "  make test-online        Optional online model test (needs .env)"
	@echo
	@echo "  make refresh            Re-stage current builds and rebuild image"
	@echo "  make reset              Reset disposable test data"
	@echo "  make report             Print the latest test report"
	@echo "  make shell              Interactive shell in the lab container"
	@echo "  make clean              Remove lab image, staged sources, reports"

build: ## Build staged packages and the Docker image
	@scripts/build.sh

stage: ## Stage allowlisted plugin sources
	@scripts/stage.sh

discover: ## Discover plugin worktrees and revisions
	@scripts/discover.sh

start: ## Build if needed and run a baseline smoke check
	@scripts/start.sh

stop: ## Stop lab containers
	@scripts/stop.sh

logs: ## Show logs and the latest report
	@scripts/logs.sh

test: ## Run one configuration (CONFIG=..., TIER=...)
	@scripts/test.sh "$(CONFIG)" "$(TIER)"

test-baseline:
	@scripts/test.sh baseline "$(TIER)"

test-checkpoint:
	@scripts/test.sh checkpoint-orchestrator "$(TIER)"

test-git-that-shit:
	@scripts/test.sh git-that-shit "$(TIER)"

test-stranger-danger:
	@scripts/test.sh stranger-danger "$(TIER)"

test-all:
	@scripts/test.sh all "$(TIER)"

suite: ## Complete suite across all five configurations
	@scripts/suite.sh

validate: ## Full validation (matrix + security + concurrency + isolation + triggers), harness mounted read-only
	@scripts/validate.sh

rc-evidence: ## Produce source/packed/installed version evidence
	@scripts/rc-evidence.sh

test-online: ## Optional online model test (requires .env)
	@scripts/test-online.sh "$(CONFIG)"

refresh: ## Re-stage and rebuild
	@scripts/refresh.sh

reset: ## Reset disposable test data
	@scripts/reset.sh

report: ## Print the latest report
	@scripts/report.sh

shell: ## Interactive shell in the lab container
	@scripts/shell.sh

clean: ## Remove lab image, staged sources and reports
	@scripts/clean.sh
