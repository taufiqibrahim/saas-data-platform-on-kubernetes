# Workspace Agent Using kopf

## Installation

```bash
pip install -r requirements.txt
```

## Running The Controller

Create the initial Workspace CRDs. In real environment this will be part of bootstrap process.
```bash
kubectl apply -f crds/
```

On different terminal start the controller:
```bash
kopf run src/main.py -n saas-system -n saas-workload -n vela-system
```

Create the Workspace CR. In real environment this will be part of bootstrap process.
```bash
kubectl apply -f examples/workspace-example.yaml
```
