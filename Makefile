# OpenCode Plugin Lab — developer interface.
#
# Everything runs through Docker Compose; the lab never mounts the plugin
# development repositories into a container and never touches your existing
# OpenCode install.
#
# The default manifest (lab.config.json) tests only the bundled example plugins.
# Select another manifest with PROFILE=<name> (see profiles/) or point at your own
# plugin with `make test-plugin PLUGIN=<path>`.
.DEFAULT_GOAL := help
SHELL := /bin/bash

CONFIG ?=
TIER ?= all
PROFILE ?=
PLUGIN ?=
NAME ?=

export CONFIG TIER PROFILE PLUGIN NAME

.PHONY: help build stage discover start stop logs test suite validate rc-evidence \
        test-online test-plugin profile refresh reset report shell clean \
        test-baseline test-checkpoint test-git-that-shit test-stranger-danger test-all

help: ## Show this help
	@echo "OpenCode Plugin Lab"
	@echo
	@echo "  make build              Stage sources + build the Docker image"
	@echo "  make stage              Stage manifest sources only"
	@echo "  make discover           Show plugin sources, versions, commits, configs"
	@echo "  make start              Build (if needed) + smoke check of the default config"
	@echo "  make stop               Stop/remove lab containers"
	@echo "  make logs               Show container logs + the latest report"
	@echo
	@echo "  make test CONFIG=<name> TIER=<tier>   Run one configuration"
	@echo "        tiers: smoke functional model integration security validate all"
	@echo "  make suite              Complete suite across every configuration"
	@echo "  make validate           Full validation incl. global suites"
	@echo "  make rc-evidence        Source/packed/installed version evidence"
	@echo "  make report             Print the latest test report"
	@echo
	@echo "  make test-plugin PLUGIN=<path> [NAME=..] [TYPE=directory|package|tarball]"
	@echo "                          Build and test ANY local plugin (no commit needed)"
	@echo "  make profile PROFILE=<name>   Build + full suite for an optional profile"
	@echo "  make test-online        Optional online model test (needs .env)"
	@echo
	@echo "  make refresh            Re-stage current sources and rebuild the image"
	@echo "  make reset              Reset disposable test data"
	@echo "  make shell              Interactive shell in the lab container"
	@echo "  make clean              Remove lab image, staged sources and reports"
	@echo
	@echo "Optional regression profile (three @gitdamnit plugins):"
	@echo "  make build PROFILE=gitdamnit && make suite PROFILE=gitdamnit"
	@echo "  make test-checkpoint PROFILE=gitdamnit   (aliases: git-that-shit, stranger-danger, all)"

build: ## Stage sources and build the Docker image
	@scripts/build.sh

stage: ## Stage manifest sources
	@scripts/stage.sh

discover: ## Discover plugin sources and configurations
	@scripts/discover.sh

start: ## Build if needed and smoke-check the default configuration
	@scripts/start.sh

stop: ## Stop lab containers
	@scripts/stop.sh

logs: ## Show logs and the latest report
	@scripts/logs.sh

test: ## Run one configuration (CONFIG=..., TIER=...)
	@scripts/test.sh "$(CONFIG)" "$(TIER)"

suite: ## Complete suite across every configuration
	@scripts/suite.sh

validate: ## Full validation (all global suites, harness mounted read-only)
	@scripts/validate.sh

rc-evidence: ## Produce source/packed/installed version evidence
	@scripts/rc-evidence.sh

test-plugin: ## Build and test an arbitrary local plugin (PLUGIN=<path>)
	@scripts/test-plugin.sh

profile: ## Build + full suite for a profile (PROFILE=<name>)
	@PROFILE="$(PROFILE)" scripts/build.sh
	@PROFILE="$(PROFILE)" scripts/suite.sh

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

# ---------------------------------------------------------------------------
# Optional regression-profile aliases (require PROFILE=gitdamnit to have been
# built at least once: `make build PROFILE=gitdamnit`).
# ---------------------------------------------------------------------------
test-baseline: ## gitdamnit profile: baseline only
	@PROFILE="$(PROFILE)" scripts/test.sh baseline "$(TIER)"

test-checkpoint: ## gitdamnit profile: Checkpoint Orchestrator only
	@PROFILE="$(PROFILE)" scripts/test.sh checkpoint-orchestrator "$(TIER)"

test-git-that-shit: ## gitdamnit profile: Git That Shit only
	@PROFILE="$(PROFILE)" scripts/test.sh git-that-shit "$(TIER)"

test-stranger-danger: ## gitdamnit profile: Stranger Danger only
	@PROFILE="$(PROFILE)" scripts/test.sh stranger-danger "$(TIER)"

test-all: ## gitdamnit profile: all three plugins together
	@PROFILE="$(PROFILE)" scripts/test.sh all "$(TIER)"
