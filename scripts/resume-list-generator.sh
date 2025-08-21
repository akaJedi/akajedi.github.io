#!/usr/bin/env bash
# Generate data/resumes.yaml with file metadata
# Works when run from inside the static/ folder

BASE_DIR="$(dirname "$PWD")"          # project root
RESUME_DIR="$PWD"                     # current folder = static
OUTPUT_FILE="$BASE_DIR/data/resumes.yaml"

mkdir -p "$BASE_DIR/data"
echo "# Auto-generated resume metadata" > "$OUTPUT_FILE"

for prefix in $(ls "$RESUME_DIR"/DenisTolochko_* 2>/dev/null | sed -E 's/_[0-9]{8}\..*//' | sort -u); do
  rawrole=$(echo "$prefix" | sed -E 's/^.*_//')
  # replace underscores with spaces
  role=$(echo "$rawrole" | sed 's/_/ /g')
  # insert spaces before capitals (except first char)
  role=$(echo "$role" | sed -E 's/([a-z])([A-Z])/\1 \2/g')
  
  echo "- title: \"$role\"" >> "$OUTPUT_FILE"
  echo "  files:" >> "$OUTPUT_FILE"

  for file in "$prefix"*; do
    [ -f "$file" ] || continue
    fname=$(basename "$file")
    format=$(echo "$fname" | awk -F. '{print toupper($NF)}')
    size=$(du -k "$file" | cut -f1)
    updated=$(date -r "$file" +%Y-%m-%d)
    hash=$(sha256sum "$file" | awk '{print $1}' | cut -c1-12)

    echo "    - name: \"$fname\"" >> "$OUTPUT_FILE"
    echo "      format: \"$format\"" >> "$OUTPUT_FILE"
    echo "      size: \"${size} KB\"" >> "$OUTPUT_FILE"
    echo "      updated: \"$updated\"" >> "$OUTPUT_FILE"
    echo "      hash: \"$hash\"" >> "$OUTPUT_FILE"
  done
  echo "" >> "$OUTPUT_FILE"
done

echo "✅ $OUTPUT_FILE generated."
