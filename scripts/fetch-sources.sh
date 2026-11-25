#!/usr/bin/env bash
# Downloads the CC0 opening tables from lichess-org/chess-openings into data/sources/.
set -euo pipefail
dir="$(cd "$(dirname "$0")/.." && pwd)/data/sources/lichess-chess-openings"
mkdir -p "$dir"
for f in a b c d e; do
  curl -fsSL "https://raw.githubusercontent.com/lichess-org/chess-openings/master/$f.tsv" -o "$dir/$f.tsv"
  echo "downloaded $f.tsv"
done
