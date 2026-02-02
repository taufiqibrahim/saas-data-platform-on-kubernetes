# Helm Charts

[Helm](https://helm.sh/) is a package manager for Kubernetes. Among many other capabilities, helm can store and retrieve helm charts on OCI image repositories.

## 1. Place Charts in the charts directory

Recommended layout:

```text
charts/
└── my-app/
    ├── Chart.yaml
    ├── values.yaml
    └── templates/
```

## 2. Package the Helm Chart (Artifact Creation)

Package the chart into a `.tgz` artifact:

```bash
helm package charts/my-app
```

Result:

```text
my-app-1.2.3.tgz
```

The `.tgz` file is the **only artifact Helm installs**.

## 3. Push a helm chart
This example pushes version `1.2.3` of a `my-app` helm chart to a zot-chart repository within the registry.
```bash
helm push my-app-1.2.3.tgz oci://zot.saas.internal/my-app
```

Generate or Update `index.yaml` (Publishing Step)

Generate the Helm repository index:

```bash
helm repo index artifacts --url https://saas.test
```

This produces:

```text
artifacts/
├── index.yaml
└── charts/
    └── saas-core-1.1.1.tgz
```

`index.yaml` contains:

* chart names
* available versions
* download URLs
* SHA256 digests

⚠️ **Important rule**

> `index.yaml` is **generated during publishing** and must never be edited manually.

---

### 5. Write vs Read Responsibility (Critical Clarification)

There are **two distinct phases** in the Helm lifecycle.

#### Publishing phase (write access)

This happens:

* on a developer machine, or
* in CI/CD

During this phase:

* `helm package` creates `.tgz`
* `helm repo index` **overwrites or updates `index.yaml`**

```text
Developer / CI
   |
   v
artifacts/
├── index.yaml   ← written here
└── charts/*.tgz
```

This directory is **mutable only at build time**.

---

#### Serving phase (read-only)

Once published, artifacts are served by NGINX:

```text
NGINX
  |
  v
/artifacts (mounted read-only)
```

NGINX:

* never modifies files
* serves static content only
* can safely mount the directory as `read-only`

Helm clients **never write** to the repository.
