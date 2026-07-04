#!/usr/bin/env bash
# md2pdf.sh - 把 ai复习/ 目录下的 MD 文件转为 PDF
# 依赖：Pandoc + TeX Live (xelatex)
# 用法：bash md2pdf.sh <ai复习目录> [输出目录]
#
# 示例：
#   bash md2pdf.sh "D:/学习/模集/ai复习"
#   bash md2pdf.sh "D:/学习/模集/ai复习" "D:/学习/模集/ai复习/_pdf"

set -euo pipefail

INPUT_DIR="${1:?用法: md2pdf.sh <ai复习目录> [输出目录]}"
OUTPUT_DIR="${2:-${INPUT_DIR}/_pdf}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
HEADER="${SCRIPT_DIR}/../templates/pandoc-header.tex"

# 检查依赖
command -v pandoc >/dev/null 2>&1 || { echo "❌ 未安装 Pandoc，请执行: winget install JohnMacFarlane.Pandoc"; exit 1; }
command -v xelatex >/dev/null 2>&1 || { echo "❌ 未安装 TeX Live / XeLaTeX，请安装 TeX Live: https://tug.org/texlive/"; exit 1; }

if [ ! -f "$HEADER" ]; then
  echo "⚠️ 未找到 LaTeX 前言模板 $HEADER，将使用默认设置"
  HEADER_FLAG=""
else
  HEADER_FLAG="-H $HEADER"
fi

mkdir -p "$OUTPUT_DIR"

echo "📄 开始转换 MD → PDF"
echo "   输入: $INPUT_DIR"
echo "   输出: $OUTPUT_DIR"
echo ""

# 转换总索引
if [ -f "$INPUT_DIR/00_总索引.md" ]; then
  echo "  → 00_总索引.pdf"
  pandoc "$INPUT_DIR/00_总索引.md" \
    -o "$OUTPUT_DIR/00_总索引.pdf" \
    --pdf-engine=xelatex \
    $HEADER_FLAG \
    --highlight-style=tango \
    -V geometry:margin=2.5cm \
    2>/dev/null || echo "  ⚠️ 00_总索引.pdf 转换失败（可能含不支持的 Mermaid）"
fi

# 逐章转换：每章合并 5 个 MD 为 1 个 PDF
SUCCESS=0
FAIL=0

for chapter_dir in "$INPUT_DIR"/[0-9][0-9]_第*; do
  [ -d "$chapter_dir" ] || continue
  chapter_name="$(basename "$chapter_dir")"
  echo "  → ${chapter_name}.pdf"

  # 按编号顺序合并
  MERGED=""
  for md_file in "$chapter_dir"/0[1-5]_*.md; do
    [ -f "$md_file" ] || continue
    if [ -n "$MERGED" ]; then
      MERGED="${MERGED}\n\n\\newpage\n\n"
    fi
    MERGED="${MERGED}$(cat "$md_file")"
  done

  if [ -z "$MERGED" ]; then
    echo "    跳过（无 MD 文件）"
    continue
  fi

  # 写临时合并文件
  TMPFILE="$(mktemp "${TMPDIR:-/tmp}/md2pdf-XXXXXX.md")"
  echo -e "$MERGED" > "$TMPFILE"

  # Pandoc 编译
  if pandoc "$TMPFILE" \
    -o "$OUTPUT_DIR/${chapter_name}.pdf" \
    --pdf-engine=xelatex \
    $HEADER_FLAG \
    --highlight-style=tango \
    -V geometry:margin=2.5cm \
    --resource-path="$chapter_dir" \
    2>/dev/null; then
    SUCCESS=$((SUCCESS + 1))
  else
    echo "    ⚠️ ${chapter_name}.pdf 转换失败"
    FAIL=$((FAIL + 1))
  fi

  rm -f "$TMPFILE"
done

echo ""
echo "✅ 完成：成功 ${SUCCESS} 章，失败 ${FAIL} 章"
echo "📂 输出目录：$OUTPUT_DIR"
