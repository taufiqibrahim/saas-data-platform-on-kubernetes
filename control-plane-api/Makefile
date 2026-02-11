.PHONY: help build push run shell clean test lint version

# Variables
VERSION := $(shell cat VERSION 2>/dev/null || echo "dev")
REGISTRY := zot.saas.internal
IMAGE_REPO := saas/control-plane
IMAGE_NAME := $(REGISTRY)/$(IMAGE_REPO)
CONTAINER_NAME := control-plane

# Colors for output
COLOR_RESET := \033[0m
COLOR_BOLD := \033[1m
COLOR_GREEN := \033[32m
COLOR_YELLOW := \033[33m

help: ## Show this help message
	@echo "$(COLOR_BOLD)Available targets:$(COLOR_RESET)"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | awk 'BEGIN {FS = ":.*?## "}; {printf "  $(COLOR_GREEN)%-15s$(COLOR_RESET) %s\n", $$1, $$2}'

version: ## Show current version
	@echo "$(COLOR_YELLOW)Current version: $(VERSION)$(COLOR_RESET)"

build: ## Build image
	@echo "Building $(IMAGE_NAME):$(VERSION)"
	docker build \
		--build-arg VERSION=$(VERSION) \
		-t $(IMAGE_NAME):$(VERSION) \
		-t $(IMAGE_NAME):latest \
		.

push: ## Push image to registry
	@echo "Pushing $(IMAGE_NAME):$(VERSION)"
	docker push $(IMAGE_NAME):$(VERSION)
	docker push $(IMAGE_NAME):latest

bump-patch: ## Bump patch version (x.x.1)
	@echo $(VERSION) | awk -F. '{$$3=$$3+1; print $$1"."$$2"."$$3}' > VERSION
	@echo "Version bumped to $$(cat VERSION)"

bump-minor: ## Bump minor version (x.1.0)
	@echo $(VERSION) | awk -F. '{$$2=$$2+1; $$3=0; print $$1"."$$2"."$$3}' > VERSION
	@echo "Version bumped to $$(cat VERSION)"

bump-major: ## Bump major version (1.0.0)
	@echo $(VERSION) | awk -F. '{$$1=$$1+1; $$2=0; $$3=0; print $$1"."$$2"."$$3}' > VERSION
	@echo "Version bumped to $$(cat VERSION)"

release: bump-patch build push ## Bump patch version, build and push
release-minor: bump-minor build push ## Bump minor version, build and push
release-major: bump-major build push ## Bump major version, build and push

# Default target
.DEFAULT_GOAL := help
