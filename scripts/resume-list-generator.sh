#!/usr/bin/env bash
# Generate data/resumes.yaml with file metadata
# Can be run from anywhere inside the project

# Find project root by going up until we see config.toml (Hugo root)
BASE_DIR="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
RESUME_DIR="$BASE_DIR/static"
OUTPUT_FILE="$BASE_DIR/data/resumes.yaml"

mkdir -p "$BASE_DIR/data"
{
  echo "# Auto-generated resume metadata"
  echo "---"
} > "$OUTPUT_FILE"

for prefix in $(ls "$RESUME_DIR"/DenisTolochko_* 2>/dev/null | sed -E 's/_[0-9]{8}\..*//' | sort -u); do
  rawrole=$(echo "$prefix" | sed -E 's/^.*_//')
  role=$(echo "$rawrole" | sed 's/_/ /g' | sed -E 's/([a-z])([A-Z])/\1 \2/g')

  echo "- title: \"$role\"" >> "$OUTPUT_FILE"
  echo "  files:" >> "$OUTPUT_FILE"

  for file in "$prefix"*; do
    [ -f "$file" ] || continue
    fname=$(basename "$file")
    format=$(echo "$fname" | awk -F. '{print toupper($NF)}')
    size=$(du -k "$file" | cut -f1)
    updated=$(date -r "$file" +%Y-%m-%d)
    full_hash=$(sha256sum "$file" | awk '{print $1}')
    short_hash=$(echo "$full_hash" | cut -c1-12)

    echo "    - name: \"$fname\"" >> "$OUTPUT_FILE"
    echo "      format: \"$format\"" >> "$OUTPUT_FILE"
    echo "      size: \"${size} KB\"" >> "$OUTPUT_FILE"
    echo "      updated: \"$updated\"" >> "$OUTPUT_FILE"
    echo "      hash: \"$short_hash\"" >> "$OUTPUT_FILE"
    echo "      hash_full: \"$full_hash\"" >> "$OUTPUT_FILE"
  done
  echo "" >> "$OUTPUT_FILE"
done

echo "✅ $OUTPUT_FILE generated."
