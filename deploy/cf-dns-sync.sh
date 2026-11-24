#!/usr/bin/env bash
# ==============================================================================
# SPARROWX TECHNOLOGIES — CLOUDFLARE DNS AUTO-SYNC (via CF_DNS_API_TOKEN in .env)
# ==============================================================================
# Automatically creates/updates all SparrowX A records + DMARC TXT record
# using the Cloudflare v4 API. Reads CF_DNS_API_TOKEN strictly from .env
# (NEVER hardcode API tokens in git).
#
# Usage:
#   sudo bash deploy/cf-dns-sync.sh
# ==============================================================================
set -euo pipefail

INSTALL_DIR="${INSTALL_DIR:-/opt/sparrowxdbs}"
ENV_FILE="${INSTALL_DIR}/.env"

green() { printf "\033[32m  [CF-DNS]\033[0m %s\n" "$1"; }
info()  { printf "\033[36m  [CF-DNS]\033[0m %s\n" "$1"; }
warn()  { printf "\033[33m  [CF-DNS]\033[0m %s\n" "$1"; }

# Load CF_DNS_API_TOKEN from persistent /etc/sparrowx/cf.env first (immune to git reset), then .env
if [[ -f "/etc/sparrowx/cf.env" ]]; then
  CF_DNS_API_TOKEN="${CF_DNS_API_TOKEN:-$(grep -E '^CF_DNS_API_TOKEN=' /etc/sparrowx/cf.env | tail -n1 | cut -d= -f2- | tr -d '"\r\n' || true)}"
fi
if [[ -f "$ENV_FILE" ]]; then
  CF_DNS_API_TOKEN="${CF_DNS_API_TOKEN:-$(grep -E '^CF_DNS_API_TOKEN=' "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '"\r\n' || true)}"
  SPARROWX_DOMAIN="${SPARROWX_DOMAIN:-$(grep -E '^SPARROWX_DOMAIN=' "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '"\r\n' || true)}"
  SPARROWX_PUBLIC_IP="${SPARROWX_PUBLIC_IP:-$(grep -E '^SPARROWX_PUBLIC_IP=' "$ENV_FILE" | tail -n1 | cut -d= -f2- | tr -d '"\r\n' || true)}"
fi

DOMAIN="${SPARROWX_DOMAIN:-sparrowx.net}"
[[ "$DOMAIN" == "localhost" || -z "$DOMAIN" ]] && DOMAIN="sparrowx.net"

if [[ -z "${CF_DNS_API_TOKEN:-}" ]]; then
  warn "CF_DNS_API_TOKEN is not set in ${ENV_FILE} — skipping automatic Cloudflare DNS sync."
  exit 0
fi

# Detect public IPv4 if missing or loopback
TARGET_IP="${SPARROWX_PUBLIC_IP:-}"
if [[ -z "$TARGET_IP" || "$TARGET_IP" == "127.0.0.1" ]]; then
  TARGET_IP="$(curl -4 -fsS --max-time 6 https://api.ipify.org 2>/dev/null || curl -4 -fsS --max-time 6 https://ifconfig.me 2>/dev/null || true)"
fi

if [[ -z "$TARGET_IP" ]]; then
  warn "Could not determine server public IPv4 — skipping Cloudflare DNS sync."
  exit 0
fi

info "Syncing Cloudflare DNS for ${DOMAIN} -> ${TARGET_IP}..."

# Run pure Python 3 stdlib Cloudflare v4 DNS reconciler (zero external deps)
python3 - "$CF_DNS_API_TOKEN" "$DOMAIN" "$TARGET_IP" <<'PY'
import json
import sys
import urllib.error
import urllib.parse
import urllib.request

token, domain, target_ip = sys.argv[1], sys.argv[2], sys.argv[3]
BASE = "https://api.cloudflare.com/client/v4"
HEADERS = {
    "Authorization": f"Bearer {token}",
    "Content-Type": "application/json",
    "User-Agent": "SparrowX-DNS-Sync/1.0",
}

def cf_request(method: str, path: str, payload=None):
    data = json.dumps(payload).encode("utf-8") if payload is not None else None
    req = urllib.request.Request(f"{BASE}{path}", data=data, headers=HEADERS, method=method)
    try:
        with urllib.request.urlopen(req, timeout=12) as resp:
            return resp.status, json.loads(resp.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="ignore")
        try:
            return e.code, json.loads(body)
        except Exception:
            return e.code, {"success": False, "errors": [{"message": body[:200]}]}
    except Exception as e:
        return 0, {"success": False, "errors": [{"message": str(e)}]}

# 1. Resolve Zone ID for domain
status, zdata = cf_request("GET", f"/zones?name={urllib.parse.quote(domain)}")
if not zdata.get("success") or not zdata.get("result"):
    errs = zdata.get("errors") or []
    msg = errs[0].get("message", f"HTTP {status}") if errs else f"Zone {domain} not found (HTTP {status})"
    print(f"  [CF-DNS] WARN: Cloudflare API rejected token or zone lookup failed: {msg}")
    sys.exit(0)

zone_id = zdata["result"][0]["id"]
print(f"  [CF-DNS] Resolved zone {domain} (id={zone_id})")

# 2. Fetch existing DNS records
existing = {}
page = 1
while True:
    _, rdata = cf_request("GET", f"/zones/{zone_id}/dns_records?per_page=100&page={page}")
    if not rdata.get("success"):
        break
    for rec in rdata.get("result", []):
        key = (rec.get("type", "").upper(), rec.get("name", "").lower())
        existing[key] = rec
    info = rdata.get("result_info") or {}
    if page >= int(info.get("total_pages", 1)):
        break
    page += 1

def ensure_record(rtype: str, name: str, content: str, proxied=None):
    key = (rtype.upper(), name.lower())
    cur = existing.get(key)
    payload = {
        "type": rtype.upper(),
        "name": name,
        "content": content,
        "ttl": 1,  # Auto
    }
    if rtype.upper() == "A":
        # Preserve existing proxied flag if record already exists; default False for new records
        payload["proxied"] = bool(cur.get("proxied", False)) if (cur and proxied is None) else bool(proxied)

    if cur:
        if cur.get("content") == content and (rtype.upper() != "A" or cur.get("proxied") == payload["proxied"]):
            return "ok"
        st, res = cf_request("PUT", f"/zones/{zone_id}/dns_records/{cur['id']}", payload)
        if res.get("success"):
            print(f"  [CF-DNS] UPDATED {rtype} {name} -> {content}")
            return "updated"
        print(f"  [CF-DNS] WARN: Failed to update {rtype} {name}: {res.get('errors')}")
        return "failed"
    else:
        st, res = cf_request("POST", f"/zones/{zone_id}/dns_records", payload)
        if res.get("success"):
            print(f"  [CF-DNS] CREATED {rtype} {name} -> {content}")
            return "created"
        print(f"  [CF-DNS] WARN: Failed to create {rtype} {name}: {res.get('errors')}")
        return "failed"

# 3. Sync all SparrowX A records
a_hosts = [
    domain,
    f"www.{domain}",
    f"db.{domain}",
    f"sec.{domain}",
    f"dpdp.{domain}",
    f"ingest.sec.{domain}",
    f"ingest.dpdp.{domain}",
    f"file.{domain}",
    f"password.{domain}",
    f"infra.{domain}",
    f"api.{domain}",
    f"ai.{domain}",
    f"*.ai.{domain}",
    f"deploy.{domain}",
    f"*.deploy.{domain}",
    f"agents.{domain}",
    f"console.{domain}",
    f"panel.{domain}",
    f"admin.{domain}",
    f"php.{domain}",
    f"netsec.{domain}",
    f"gamesec.{domain}",
]

counts = {"created": 0, "updated": 0, "ok": 0, "failed": 0}
for h in a_hosts:
    # Force proxied=False for wildcards, php, panel, admin, ingest, netsec, gamesec
    force_direct = h.startswith("*.") or h.split(".")[0] in ("php", "panel", "admin", "ingest", "netsec", "gamesec")
    res = ensure_record("A", h, target_ip, proxied=False if force_direct else None)
    counts[res] += 1

# 4. Sync DMARC TXT record for SEO & email deliverability
dmarc_val = f"v=DMARC1; p=quarantine; rua=mailto:security@{domain}; pct=100; adkim=s; aspf=s"
res = ensure_record("TXT", f"_dmarc.{domain}", dmarc_val)
counts[res] += 1

print(
    f"  [CF-DNS] Done: {counts['created']} created, {counts['updated']} updated, "
    f"{counts['ok']} already up-to-date, {counts['failed']} failed."
)
PY
