#!/usr/bin/env bash
# extract_office_batch.sh
# 批量把 .ppt/.doc/.pptx/.docx 提取为 markdown
# 用法: ./extract_office_batch.sh <源目录> <输出目录>

set -e

SRC="${1:?需提供源目录}"
DST="${2:?需提供输出目录}"

mkdir -p "$DST"

# 1. 老式 .ppt -> .pptx
echo "[1/4] 转换 .ppt -> .pptx"
shopt -s nullglob
PPTS=("$SRC"/*.ppt)
if [ ${#PPTS[@]} -gt 0 ]; then
    soffice --headless --convert-to pptx --outdir "$DST" "${PPTS[@]}" 2>&1 | grep -v "^$" || true
fi

# 2. 老式 .doc -> .docx
echo "[2/4] 转换 .doc -> .docx"
DOCS=("$SRC"/*.doc)
if [ ${#DOCS[@]} -gt 0 ]; then
    soffice --headless --convert-to docx --outdir "$DST" "${DOCS[@]}" 2>&1 | grep -v "^$" || true
fi

# 3. 复制原始 .pptx/.docx
echo "[3/4] 收集已有 .pptx/.docx"
for f in "$SRC"/*.pptx "$SRC"/*.docx; do
    [ -e "$f" ] || continue
    cp "$f" "$DST/"
done

# 4. markitdown 批量提取
echo "[4/4] 提取文本为 markdown"
for f in "$DST"/*.pptx "$DST"/*.docx; do
    [ -e "$f" ] || continue
    out="${f%.*}.md"
    python -m markitdown "$f" > "$out" 2>/dev/null && echo "  OK: $(basename "$out") ($(wc -l < "$out") lines)" || echo "  FAIL: $(basename "$f")"
done

echo ""
echo "完成。可读 markdown:"
ls -la "$DST"/*.md 2>/dev/null | awk '{print "  "$NF}' || echo "  (无)"
