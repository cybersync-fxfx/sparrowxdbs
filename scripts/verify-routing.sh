#!/usr/bin/env bash
# ==============================================================================
# SPARROWX TECHNOLOGIES — TRAEFIK v3 ROUTING, TLS & SECURITY VERIFICATION SUITE
# ==============================================================================
# Verifies:
#   1. Single-hop HTTP -> HTTPS 301 redirect across all domains
#   2. Single-hop 301 canonical redirects (www., game., db/game, sec/story)
#   3. Zero-Trust 403 Forbidden on admin.sparrowx.net from unauthorized IPs
#   4. X-Robots-Tag: noindex, nofollow on private & wildcard subdomains
#   5. Security headers (HSTS, nosniff, Referrer-Policy)
#   6. Unknown / unmapped Host header rejection (404 / TLS drop, never 200)
#
# Usage:
#   bash scripts/verify-routing.sh
#   TARGET_IP=139.99.x.x bash scripts/verify-routing.sh   # Test against OVH IP directly
# ==============================================================================
set -euo pipefail

TARGET_IP="${TARGET_IP:-}"
PASS=0
FAIL=0

green() { printf "\033[32m[PASS]\033[0m %s\n" "$1"; }
red()   { printf "\033[31m[FAIL]\033[0m %s\n" "$1"; }
info()  { printf "\033[36m[INFO]\033[0m %s\n" "$1"; }

curl_headers() {
  local scheme="$1"
  local host="$2"
  local path="${3:-/}"
  local port="443"
  [[ "$scheme" == "http" ]] && port="80"

  local extra=()
  if [[ -n "$TARGET_IP" ]]; then
    extra+=(--resolve "${host}:${port}:${TARGET_IP}")
  fi

  curl -sS -I --max-time 8 "${extra[@]}" "${scheme}://${host}${path}" 2>/dev/null || true
}

assert_redirect_301() {
  local scheme="$1"
  local host="$2"
  local path="$3"
  local expected_loc="$4"
  local hdrs status loc

  hdrs="$(curl_headers "$scheme" "$host" "$path")"
  status="$(printf '%s\n' "$hdrs" | awk 'toupper($1) ~ /^HTTP/ {code=$2} END{print code}')"
  loc="$(printf '%s\n' "$hdrs" | awk 'tolower($1)=="location:" {sub(/\r$/,""); print $2; exit}')"

  if [[ "$status" == "301" && "$loc" == "$expected_loc"* ]]; then
    green "301 ${scheme}://${host}${path} -> ${loc}"
    PASS=$((PASS + 1))
  else
    red "Expected 301 -> ${expected_loc} for ${scheme}://${host}${path}, got HTTP ${status:-ERR} (Location: ${loc:-none})"
    FAIL=$((FAIL + 1))
  fi
}

assert_status() {
  local host="$1"
  local path="$2"
  local expected="$3"
  local hdrs status

  hdrs="$(curl_headers "https" "$host" "$path")"
  status="$(printf '%s\n' "$hdrs" | awk 'toupper($1) ~ /^HTTP/ {code=$2} END{print code}')"

  if [[ "$status" == "$expected" ]]; then
    green "HTTPS https://${host}${path} returned HTTP ${status}"
    PASS=$((PASS + 1))
  else
    red "Expected HTTP ${expected} for https://${host}${path}, got HTTP ${status:-ERR}"
    FAIL=$((FAIL + 1))
  fi
}

assert_header_contains() {
  local host="$1"
  local path="$2"
  local header_name="$3"
  local expected_substr="$4"
  local hdrs val

  hdrs="$(curl_headers "https" "$host" "$path")"
  val="$(printf '%s\n' "$hdrs" | grep -i "^${header_name}:" | head -n1 | tr -d '\r' || true)"

  if [[ "${val,,}" == *"${expected_substr,,}"* ]]; then
    green "https://${host}${path} has ${val}"
    PASS=$((PASS + 1))
  else
    red "https://${host}${path} missing '${header_name}: *${expected_substr}*' (got: ${val:-none})"
    FAIL=$((FAIL + 1))
  fi
}

echo "=================================================================="
echo " SparrowX Edge Routing, TLS & Host-Isolation Verification"
echo "=================================================================="
[[ -n "$TARGET_IP" ]] && info "Pinning all DNS resolutions to OVH IP: ${TARGET_IP}"

info "1. Checking single-hop HTTP -> HTTPS 301 redirects..."
for h in \
  sparrowx.net ai.sparrowx.net deploy.sparrowx.net agents.sparrowx.net \
  sec.sparrowx.net dpdp.sparrowx.net db.sparrowx.net file.sparrowx.net \
  password.sparrowx.net console.sparrowx.net panel.sparrowx.net api.sparrowx.net
do
  assert_redirect_301 "http" "$h" "/" "https://${h}/"
done

info "2. Checking canonical & legacy anti-leakage 301 redirects..."
assert_redirect_301 "https" "www.sparrowx.net" "/pricing" "https://sparrowx.net/pricing"
assert_redirect_301 "https" "game.sparrowx.net" "/fivem" "https://sparrowx.net/game/fivem"
assert_redirect_301 "https" "db.sparrowx.net" "/game" "https://sparrowx.net/game"
assert_redirect_301 "https" "sec.sparrowx.net" "/story" "https://sparrowx.net/story"

info "3. Checking Zero-Trust 403 Forbidden on admin.sparrowx.net (unauthorized IP)..."
assert_status "admin.sparrowx.net" "/" "403"

info "4. Checking X-Robots-Tag: noindex, nofollow on private & wildcard subdomains..."
for h in \
  console.sparrowx.net panel.sparrowx.net api.sparrowx.net \
  ingest.sec.sparrowx.net ingest.dpdp.sparrowx.net \
  demo-tenant.ai.sparrowx.net demo-tenant.deploy.sparrowx.net
do
  assert_header_contains "$h" "/" "x-robots-tag" "noindex, nofollow"
done

info "5. Checking global security headers on apex & public services..."
assert_header_contains "sparrowx.net" "/" "strict-transport-security" "max-age=31536000; includeSubDomains"
assert_header_contains "sparrowx.net" "/" "x-content-type-options" "nosniff"
assert_header_contains "sparrowx.net" "/" "x-frame-options" "DENY"
assert_header_contains "sparrowx.net" "/" "referrer-policy" "strict-origin-when-cross-origin"

info "6. Checking unknown / unmapped Host header rejection..."
unknown_hdrs="$(curl_headers "https" "unmapped-rogue-host.invalid" "/")"
unknown_status="$(printf '%s\n' "$unknown_hdrs" | awk 'toupper($1) ~ /^HTTP/ {code=$2} END{print code}')"
if [[ -z "$unknown_status" || "$unknown_status" == "404" || "$unknown_status" == "444" || "$unknown_status" == "421" ]]; then
  green "Unknown Host rejected cleanly (status: ${unknown_status:-TLS-DROPPED})"
  PASS=$((PASS + 1))
else
  red "Unknown Host returned unexpected HTTP ${unknown_status} (must drop or return 404/444)"
  FAIL=$((FAIL + 1))
fi

echo "=================================================================="
printf " Verification Complete: \033[32m%d passed\033[0m, \033[31m%d failed\033[0m\n" "$PASS" "$FAIL"
echo "=================================================================="
[[ "$FAIL" -eq 0 ]]
