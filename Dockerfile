# ─── Stage 1 : Build ──────────────────────────────────────────────────────────
FROM node:20-alpine AS build
WORKDIR /app

# curl is needed by download-dtln-models.sh (Alpine ships wget only)
RUN apk add --no-cache curl bash

COPY package*.json ./
RUN npm ci

# ── Download DTLN ONNX models before the build so they end up in dist/ ────────
# This is done before COPY . . so the layer is re-used as long as the script
# hasn't changed.  (~2 MB each — adds ~4 MB to the image, cached by Docker.)
COPY scripts/ ./scripts/
RUN bash scripts/download-dtln-models.sh

COPY . .
RUN npm run build

# ─── Stage 2 : Serve ──────────────────────────────────────────────────────────
FROM nginx:1.27-alpine
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
