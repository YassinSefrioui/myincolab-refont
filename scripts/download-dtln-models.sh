#!/usr/bin/env bash
# Downloads pre-trained DTLN ONNX models (≈2 MB each) into public/models/.
# Tries multiple CDN/mirror sources. If all fail, prints a warning and
# lets the build continue (noise suppression will be silently disabled at runtime).

DEST="$(dirname "$0")/../public/models"
mkdir -p "$DEST"

# Candidate sources, tried in order (GitHub LFS media → jsDelivr → raw GitHub → original HF)
SOURCES_1=(
    "https://media.githubusercontent.com/media/breizhn/DTLN/master/pretrained_model/model_1.onnx"
    "https://cdn.jsdelivr.net/gh/breizhn/DTLN@master/pretrained_model/model_1.onnx"
    "https://raw.githubusercontent.com/breizhn/DTLN/master/pretrained_model/model_1.onnx"
    "https://huggingface.co/breizhn/DTLN/resolve/main/model_1.onnx"
    "https://huggingface.co/alekya/DTLN/resolve/main/model_1.onnx"
)

SOURCES_2=(
    "https://media.githubusercontent.com/media/breizhn/DTLN/master/pretrained_model/model_2.onnx"
    "https://cdn.jsdelivr.net/gh/breizhn/DTLN@master/pretrained_model/model_2.onnx"
    "https://raw.githubusercontent.com/breizhn/DTLN/master/pretrained_model/model_2.onnx"
    "https://huggingface.co/breizhn/DTLN/resolve/main/model_2.onnx"
    "https://huggingface.co/alekya/DTLN/resolve/main/model_2.onnx"
)

download_model() {
    local name="$1"
    shift
    local sources=("$@")
    local dest="$DEST/$name"

    # Skip if already present and looks valid
    if [ -f "$dest" ]; then
        local existing
        existing=$(wc -c < "$dest")
        if [ "$existing" -gt 500000 ]; then
            echo "  ✓ $name already present ($(( existing / 1024 )) KB) — skipping download"
            return 0
        fi
    fi

    echo "Downloading $name..."
    for url in "${sources[@]}"; do
        echo "  Trying: $url"
        if curl -fL --silent --max-time 90 "$url" -o "$dest" 2>/dev/null; then
            local size
            size=$(wc -c < "$dest" 2>/dev/null || echo 0)
            if [ "$size" -gt 500000 ]; then
                echo "  ✓ $name  ($(( size / 1024 )) KB)"
                return 0
            else
                echo "  ✗ Too small (${size} bytes) — likely an error page, trying next source…"
                rm -f "$dest"
            fi
        else
            echo "  ✗ curl failed — trying next source…"
            rm -f "$dest"
        fi
    done

    echo ""
    echo "  ⚠  WARNING: Could not download $name from any source."
    echo "     Noise suppression will be disabled. The rest of the app works normally."
    echo "     To fix: manually copy model_1.onnx and model_2.onnx into frontend-web/public/models/"
    echo ""
    return 0   # non-fatal — do NOT fail the build
}

download_model "model_1.onnx" "${SOURCES_1[@]}"
download_model "model_2.onnx" "${SOURCES_2[@]}"

echo "✓ DTLN model check complete."
