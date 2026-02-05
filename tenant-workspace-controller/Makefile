.PHONY: help build push run shell clean test lint version

# Variables
VERSION := $(shell cat VERSION 2>/dev/null || echo "dev")
REGISTRY := zot.saas.internal
IMAGE_REPO := saas/tenant-workspace-controller
IMAGE_NAME := $(REGISTRY)/$(IMAGE_REPO)
CONTAINER_NAME := tenant-workspace-controller
PYTHON := python3

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

# run: ## Run container in detached mode
# 	docker run -d \
# 		--name $(CONTAINER_NAME) \
# 		$(IMAGE_NAME):$(VERSION)
# 	@echo "$(COLOR_GREEN)Container started: $(CONTAINER_NAME)$(COLOR_RESET)"

# run-fg: ## Run container in foreground
# 	docker run --rm \
# 		--name $(CONTAINER_NAME) \
# 		$(IMAGE_NAME):$(VERSION)

# shell: ## Get shell in running container
# 	docker exec -it $(CONTAINER_NAME) sh

# shell-bash: ## Get bash shell in running container
# 	docker exec -it $(CONTAINER_NAME) bash

# shell-run: ## Run container and get immediate shell
# 	docker run --rm -it \
# 		--entrypoint sh \
# 		$(IMAGE_NAME):$(VERSION)

# logs: ## Show container logs
# 	docker logs -f $(CONTAINER_NAME)

# stop: ## Stop running container
# 	docker stop $(CONTAINER_NAME)

# restart: ## Restart container
# 	docker restart $(CONTAINER_NAME)

# clean: ## Remove container and images
# 	-docker stop $(CONTAINER_NAME) 2>/dev/null || true
# 	-docker rm $(CONTAINER_NAME) 2>/dev/null || true
# 	@echo "$(COLOR_GREEN)Cleaned container$(COLOR_RESET)"

# clean-images: clean ## Remove container and all images
# 	-docker rmi $(IMAGE_NAME):$(VERSION) 2>/dev/null || true
# 	-docker rmi $(IMAGE_NAME):latest 2>/dev/null || true
# 	@echo "$(COLOR_GREEN)Cleaned images$(COLOR_RESET)"

# # clean-all: clean-images ## Remove everything including dangling images
# # 	docker image prune -f
# # 	@echo "$(COLOR_GREEN)Cleaned all$(COLOR_RESET)"

# inspect: ## Inspect image labels and details
# 	@echo "$(COLOR_YELLOW)Image: $(IMAGE_NAME):$(VERSION)$(COLOR_RESET)"
# 	@docker inspect $(IMAGE_NAME):$(VERSION) | grep -A 10 '"Labels"' || echo "Image not found"

# test: ## Run tests in container
# 	docker run --rm \
# 		--entrypoint $(PYTHON) \
# 		$(IMAGE_NAME):$(VERSION) \
# 		-m pytest tests/

# lint: ## Run linting locally
# 	@echo "$(COLOR_GREEN)Running flake8...$(COLOR_RESET)"
# 	$(PYTHON) -m flake8 src/
# 	@echo "$(COLOR_GREEN)Running black check...$(COLOR_RESET)"
# 	$(PYTHON) -m black --check src/
# 	@echo "$(COLOR_GREEN)Running mypy...$(COLOR_RESET)"
# 	$(PYTHON) -m mypy src/

# format: ## Format code with black
# 	@echo "$(COLOR_GREEN)Formatting code...$(COLOR_RESET)"
# 	$(PYTHON) -m black src/

# dev-setup: ## Setup local development environment
# 	@echo "$(COLOR_GREEN)Setting up development environment...$(COLOR_RESET)"
# 	$(PYTHON) -m venv venv
# 	./venv/bin/pip install --upgrade pip
# 	./venv/bin/pip install -r requirements.txt
# 	./venv/bin/pip install -r requirements-dev.txt
# 	@echo "$(COLOR_GREEN)Done! Activate with: source venv/bin/activate$(COLOR_RESET)"

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

# ps: ## Show running containers
# 	@docker ps -a | grep $(CONTAINER_NAME) || echo "No containers found"

# stats: ## Show container stats
# 	docker stats $(CONTAINER_NAME)

# Default target
.DEFAULT_GOAL := help
