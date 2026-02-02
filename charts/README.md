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
