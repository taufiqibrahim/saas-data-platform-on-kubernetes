# 🚀 SaaS Control Plane UI

A frontend for SaaS Control Plane

## 🧪 Quick Start

```bash
# Install dependencies
npm install
# Or
npm ci

# Start the development server
npm run dev

# Build the app for production
npm run build

# Inject environment variables on runtime
# Make sure environment variables exported
cp dist/index.html index.html.template
envsubst < index.html.template > dist/index.html
# Or
npx envsub dist/index.html

# Preview the production build
npm run preview
```
## Containerize the app

Build
```bash
sudo docker build -t oqullus .
```

Run locally
```bash
sudo docker run --rm -p 4173:80 \
  -e VITE_API_URL=https://staging-api.com \
  oqullus
```

Check on http://localhost:4173.
