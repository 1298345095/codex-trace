#!/bin/sh
set -e

: "${DISPLAY:=:99}"
export DISPLAY

exec xvfb-run --auto-servernum --server-args="-screen 0 1024x768x24" "$@"
