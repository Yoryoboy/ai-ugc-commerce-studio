#!/bin/sh
# Makes a JPEG thumbnail (540 px wide) of a video.
#
#   miniatura.sh <video> [thumbnail]
#
# Without a thumbnail path, borrador-vN.mp4 becomes thumb-vN.jpg in the same folder.
# Uses ffmpeg when installed, otherwise the macOS tools qlmanage and sips.

set -eu

video=$1
if [ $# -ge 2 ]; then
  out=$2
else
  dir=$(dirname "$video")
  name=$(basename "$video")
  name=${name%.*}
  out="$dir/$(printf '%s' "$name" | sed 's/^borrador-/thumb-/').jpg"
fi

if command -v ffmpeg >/dev/null 2>&1; then
  ffmpeg -loglevel error -y -ss 1 -i "$video" -frames:v 1 -vf scale=540:-2 -q:v 4 "$out"
elif command -v qlmanage >/dev/null 2>&1 && command -v sips >/dev/null 2>&1; then
  tmp=$(mktemp -d)
  trap 'rm -rf "$tmp"' EXIT
  qlmanage -t -s 960 -o "$tmp" "$video" >/dev/null 2>&1
  png=$(find "$tmp" -name '*.png' | head -n 1)
  if [ -z "$png" ]; then
    echo "miniatura: qlmanage could not read $video" >&2
    exit 1
  fi
  sips -s format jpeg -s formatOptions 70 --resampleWidth 540 "$png" --out "$out" >/dev/null
else
  echo "miniatura: needs ffmpeg, or qlmanage and sips (macOS)" >&2
  exit 1
fi

printf '%s\n' "$out"
