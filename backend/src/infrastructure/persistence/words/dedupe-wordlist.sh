#!/usr/bin/env bash
set -euo pipefail

# Remove duplicate words from wordlist.txt (keeps first occurrence).
# File format: one word per line.
#
# Usage: ./dedupe-wordlist.sh [path/to/wordlist.txt]

file="${1:-$(dirname "$0")/wordlist.txt}"
tmp="$(mktemp)"

awk '!seen[$0]++' "$file" > "$tmp"

removed=$(( $(wc -l < "$file") - $(wc -l < "$tmp") ))
mv "$tmp" "$file"
echo "Removed $removed duplicate word(s). $(wc -l < "$file") words remain."
