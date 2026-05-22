IMAGE_PREFIX ?= ghcr.io/openeverest
EVEREST_SERVER_DEV_IMAGE_NAME ?= openeverest-dev

init:               ## Install dependencies
	npm ci
	npx playwright install

install-operators:  ## Install operators to k8s
	../bin/everestctl install -v \
		--disable-telemetry \
		--system-namespace openeverest-system \
		--version 0.0.0 \
		--version-metadata-url https://check-dev.percona.com \
		--namespaces percona-everest-operators \
		--helm.set versionMetadataURL=https://check-dev.percona.com \
		--helm.set server.image=$(IMAGE_PREFIX)/$(EVEREST_SERVER_DEV_IMAGE_NAME) \

test-cli:           ## Run all tests
	npx playwright test --project=cli

test-install:       ## Run installation flow tests. Requires minikube installed and /etc/hosts updated
	npx playwright test tests/flow/install.spec.ts

test-namespaces:
	npx playwright test tests/flow/namespaces.spec.ts

lint:               ## Run linter typescript checks
	npm run lint:ts && npm run typecheck && echo 'Lint OK'

lint-fix:           ## Fix linter errors where possible
	npx eslint --fix .
