export async function generateBootstrapYAML(token: string): Promise<string> {
  return `apiVersion: v1
kind: Namespace
metadata:
  name: yourproduct-agent
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: agent-config
  namespace: yourproduct-agent
data:
  token: "MY_TOKEN_HERE"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: yourproduct-agent
  namespace: yourproduct-agent
spec:
  replicas: 1
  selector:
    matchLabels:
      app: yourproduct-agent
  template:
    metadata:
      labels:
        app: yourproduct-agent
    spec:
      containers:
        - name: agent
          image: yourproduct/agent:MY_VERSION_HERE
          env:
            - name: TOKEN
              valueFrom:
                configMapKeyRef:
                  name: agent-config
                  key: token
`;
}
