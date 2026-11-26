#!/usr/bin/env python3
"""
================================================================================
 SPARROWX MASTER CYBERSECURITY & NETWORK DDoS FILTRATION TERMINAL DASHBOARD
================================================================================
 Native Linux terminal NOC (Network Operations Center), real-time packet
 filtration monitor, and interactive Whitelist / Blocklist manager.
 Zero third-party Python dependencies (pure Python 3 stdlib).

 Partitioned 5-Pane Aesthetic SOC Layout (Rounded Unicode + 256-Color Themes):
   [TOP BAR] Telemetry Header: Host, NIC Speed/IP, CPU/RAM Bars, Load, Threat
   [PANE 1]  Live RX/TX Sparklines, Peak Rates, Kernel SNMP & XDP Filtration
   [PANE 2]  Protected Downstream Servers, WireGuard Tunnels & Open Ports
   [PANE 3]  Live Active IP Connections, SYN/TW Flood Detector & Top Talkers
   [PANE 4]  Whitelist & Blocklist Manager (Live Split View: XDP/nft/UFW/F2B)
   [PANE 5]  Real-Time Security & Packet Filtration Event Log Stream

 Interactive Controls:
   [1-5/0] Zoom / Reset Pane    [↑/↓] Select Remote IP   [c] Cycle Theme
   [b] Ban IP (XDP+nft+UFW)     [u] Unban IP             [t] Pane 4 View
   [w] Whitelist IP (XDP+UFW)   [W] Remove Whitelist     [x] Strict SYN Mode
   [i] Cycle NIC  [p] Pause     [/] Filter   [r] Refresh [q] Quit

 Usage:
   sudo sparrowx-noc                      # Launch live interactive Linux TUI
   sudo sparrowx-noc --theme cyber        # Themes: cyber | emerald | crimson
   sudo sparrowx-noc --iface enp1s0f0     # Pin specific network interface
   sparrowx-noc --once                    # Print single ANSI terminal snapshot
   sparrowx-noc --demo                    # Opt-in simulated telemetry preview
================================================================================
"""

from __future__ import annotations

import argparse
import collections
import datetime
import ipaddress
import json
import os
import platform
import queue
import re
import shutil
import socket
import struct
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Deque, Dict, List, Optional, Set, Tuple

try:
    import curses
except ImportError:
    curses = None  # Handled gracefully for --once mode on non-curses systems


VERSION = "2.8.0"
SPARK_CHARS = " ▁▂▃▄▅▆▇█"
IS_LINUX = sys.platform.startswith("linux")
THEMES = ("cyber", "emerald", "crimson")
AUTOGUARD_MODES = ("monitor", "protect", "off")
WHITELIST_FILE = Path("/opt/sparrowx/xdp/whitelist_ipv4.txt")
BLOCKLIST_FILE = Path("/opt/sparrowx/xdp/blocked_ipv4.txt")
AUTO_BAN_TTL_SEC = 1800          # 30 minutes max for any automated temporary mitigation
STRICT_SYN_COOLDOWN_SEC = 60.0   # Minimum hold before relaxing auto-triggered strict SYN
STRICT_MANUAL_DEBOUNCE_SEC = 1.5 # Prevent accidental rapid key-repeat flapping on [x]
DISCORD_DEFAULT_DIGEST_SEC = 900 # Periodic Discord health update every 15 minutes (0 to disable)
DISCORD_ENV_FILES = (
    Path("/opt/sparrowxdbs/.env"),
    Path("/opt/sparrowx/.env"),
    Path("/etc/sparrowx/noc.env"),
    Path(".env"),
    Path(".env.local"),
)

# Built-in infrastructure CIDRs that MUST NEVER be auto-banned or flagged as attackers
INTERNAL_SAFE_CIDRS = tuple(
    ipaddress.IPv4Network(c)
    for c in (
        "127.0.0.0/8",      # Loopback
        "10.0.0.0/8",       # RFC1918 / WireGuard / K8s / Internal
        "172.16.0.0/12",    # RFC1918 / Docker bridge networks
        "192.168.0.0/16",   # RFC1918 / LAN
        "100.64.0.0/10",    # CGNAT / Tailscale / ISP shared NAT
        "169.254.0.0/16",   # Link-local / Cloud metadata
        "224.0.0.0/4",      # Multicast
    )
)

TRUSTED_SERVICE_CIDRS: Tuple[Tuple[ipaddress.IPv4Network, str], ...] = tuple(
    (ipaddress.IPv4Network(cidr), label)
    for cidr, label in (
        # Public DNS Resolvers
        ("1.1.1.1/32", "Cloudflare DNS"),
        ("1.0.0.1/32", "Cloudflare DNS"),
        ("8.8.8.8/32", "Google Public DNS"),
        ("8.8.4.4/32", "Google Public DNS"),
        ("9.9.9.9/32", "Quad9 DNS"),
        ("149.112.112.112/32", "Quad9 DNS"),
        # Cloudflare IPv4 Edge Network (official published ranges)
        ("173.245.48.0/20", "Cloudflare Edge"),
        ("103.21.244.0/22", "Cloudflare Edge"),
        ("103.22.200.0/22", "Cloudflare Edge"),
        ("103.31.4.0/22", "Cloudflare Edge"),
        ("141.101.64.0/18", "Cloudflare Edge"),
        ("108.162.192.0/18", "Cloudflare Edge"),
        ("190.93.240.0/20", "Cloudflare Edge"),
        ("188.114.96.0/20", "Cloudflare Edge"),
        ("197.234.240.0/22", "Cloudflare Edge"),
        ("198.41.128.0/17", "Cloudflare Edge"),
        ("162.158.0.0/15", "Cloudflare Edge"),
        ("104.16.0.0/13", "Cloudflare Edge"),
        ("104.24.0.0/14", "Cloudflare Edge"),
        ("172.64.0.0/13", "Cloudflare Edge"),
        ("131.0.72.0/22", "Cloudflare Edge"),
    )
)

# Major CDN, DNS, Search & Developer Platform ASNs (never auto-ban shared reverse proxies/services)
TRUSTED_SERVICE_ASNS: Dict[str, str] = {
    "AS13335": "Cloudflare CDN",
    "AS15169": "Google Infrastructure",
    "AS36459": "GitHub Services",
    "AS54113": "Fastly CDN",
    "AS20940": "Akamai CDN",
    "AS714": "Apple Services",
    "AS8075": "Microsoft Azure",
    "AS32934": "Meta Infrastructure",
    "AS19551": "Imperva / Incapsula",
}
GEO_CACHE_PATHS = (
    Path("/var/cache/sparrowx/noc_geo_cache.json"),
    Path("/tmp/sparrowx_noc_geo_cache.json"),
)
GEO_CACHE_TTL = 86400
GEO_FAIL_RETRY = 300


# ------------------------------------------------------------------------------
# Formatting Helpers
# ------------------------------------------------------------------------------

def fmt_bps(bits_per_sec: float) -> str:
    if bits_per_sec < 0:
        bits_per_sec = 0.0
    if bits_per_sec >= 1_000_000_000:
        return f"{bits_per_sec / 1_000_000_000:.2f} Gbps"
    if bits_per_sec >= 1_000_000:
        return f"{bits_per_sec / 1_000_000:.2f} Mbps"
    if bits_per_sec >= 1_000:
        return f"{bits_per_sec / 1_000:.1f} Kbps"
    return f"{bits_per_sec:.0f} bps"


def fmt_pps(pps: float) -> str:
    if pps < 0:
        pps = 0.0
    if pps >= 1_000_000:
        return f"{pps / 1_000_000:.2f} Mpps"
    if pps >= 1_000:
        return f"{pps / 1_000:.1f} kpps"
    return f"{pps:.0f} pps"


def fmt_bytes(num_bytes: float) -> str:
    if num_bytes < 0:
        num_bytes = 0.0
    for unit in ("B", "KB", "MB", "GB", "TB"):
        if num_bytes < 1024.0:
            return f"{num_bytes:.1f}{unit}" if unit != "B" else f"{int(num_bytes)}B"
        num_bytes /= 1024.0
    return f"{num_bytes:.1f}PB"


def fmt_count(val: int) -> str:
    if val >= 1_000_000_000:
        return f"{val / 1_000_000_000:.2f}B"
    if val >= 1_000_000:
        return f"{val / 1_000_000:.2f}M"
    if val >= 1_000:
        return f"{val / 1_000:.1f}K"
    return str(val)


def fmt_age(epoch_sec: int) -> str:
    if epoch_sec <= 0:
        return "never"
    delta = max(0, int(time.time()) - epoch_sec)
    if delta < 60:
        return f"{delta}s ago"
    if delta < 3600:
        return f"{delta // 60}m {delta % 60}s"
    if delta < 86400:
        return f"{delta // 3600}h {(delta % 3600) // 60}m"
    return f"{delta // 86400}d ago"


def make_sparkline(values: List[float], width: int) -> str:
    if width <= 0:
        return ""
    if not values:
        return "▁" * width
    slice_vals = list(values[-width:])
    if len(slice_vals) < width:
        slice_vals = [0.0] * (width - len(slice_vals)) + slice_vals
    peak = max(slice_vals) if slice_vals else 0.0
    if peak <= 0:
        return "▁" * width
    out = []
    scale = len(SPARK_CHARS) - 1
    for v in slice_vals:
        idx = int(round((max(0.0, v) / peak) * scale))
        idx = max(0, min(scale, idx))
        out.append(SPARK_CHARS[idx])
    return "".join(out)


def make_bar(ratio: float, width: int) -> str:
    width = max(4, width)
    clamped = max(0.0, min(1.0, ratio))
    filled = int(round(clamped * width))
    return "━" * filled + "╌" * (width - filled)


def make_block_bar(ratio: float, width: int) -> str:
    width = max(4, width)
    clamped = max(0.0, min(1.0, ratio))
    filled = int(round(clamped * width))
    return "█" * filled + "░" * (width - filled)


def run_cmd(cmd: List[str], timeout: float = 1.5) -> Tuple[int, str, str]:
    try:
        proc = subprocess.run(
            cmd,
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            timeout=timeout,
            check=False,
        )
        return proc.returncode, proc.stdout, proc.stderr
    except (FileNotFoundError, PermissionError, subprocess.TimeoutExpired, OSError):
        return 127, "", ""


def is_valid_ipv4(ip_str: str) -> bool:
    try:
        ipaddress.IPv4Address(ip_str.strip())
        return True
    except ValueError:
        return False


def bytes_to_ipv4(raw_bytes: List[int]) -> Optional[str]:
    if len(raw_bytes) != 4:
        return None
    try:
        return socket.inet_ntoa(bytes(raw_bytes))
    except OSError:
        return None


def parse_hex_key_to_ipv4(key_field) -> Optional[str]:
    """Parse bpftool JSON key (list of hex strings like ['0x01','0x02','0x03','0x04'] or ints)."""
    if isinstance(key_field, list) and len(key_field) == 4:
        vals: List[int] = []
        for item in key_field:
            if isinstance(item, int):
                vals.append(item & 0xFF)
            elif isinstance(item, str):
                vals.append(int(item, 16) & 0xFF)
            else:
                return None
        return bytes_to_ipv4(vals)
    if isinstance(key_field, int):
        return socket.inet_ntoa(struct.pack("<I", key_field & 0xFFFFFFFF))
    return None


def parse_u64_value(val_field) -> int:
    if isinstance(val_field, int):
        return val_field
    if isinstance(val_field, list) and len(val_field) == 8:
        b = bytes(int(x, 16) if isinstance(x, str) else int(x) for x in val_field)
        return struct.unpack("<Q", b)[0]
    return 0


# ------------------------------------------------------------------------------
# Data Models
# ------------------------------------------------------------------------------

@dataclass
class HostStats:
    hostname: str = "localhost"
    kernel: str = "linux"
    is_root: bool = False
    cpu_pct: float = 0.0
    cpu_cores: int = 1
    mem_used_gb: float = 0.0
    mem_total_gb: float = 0.0
    mem_pct: float = 0.0
    load_1m: float = 0.0
    load_5m: float = 0.0
    load_15m: float = 0.0
    uptime_str: str = "0m"


@dataclass
class NicStats:
    iface: str = "eth0"
    ipv4: str = "-"
    link_speed: str = "-"
    available_ifaces: List[str] = field(default_factory=list)
    rx_bps: float = 0.0
    tx_bps: float = 0.0
    peak_rx_bps: float = 0.0
    peak_tx_bps: float = 0.0
    rx_pps: float = 0.0
    tx_pps: float = 0.0
    rx_drop_ps: float = 0.0
    tx_drop_ps: float = 0.0
    rx_bytes_total: int = 0
    tx_bytes_total: int = 0
    rx_drops_total: int = 0
    tx_drops_total: int = 0
    rx_history: List[float] = field(default_factory=list)
    tx_history: List[float] = field(default_factory=list)


@dataclass
class FiltrationStats:
    xdp_attached: bool = False
    xdp_mode: str = "INACTIVE"
    xdp_prog_id: str = "-"
    xdp_passed: int = 0
    xdp_challenged: int = 0
    xdp_dropped: int = 0
    xdp_whitelisted: int = 0
    xdp_drop_pps: float = 0.0
    nft_drops: int = 0
    iptables_drops: int = 0
    conntrack_count: int = 0
    conntrack_max: int = 0
    syn_recv_count: int = 0
    time_wait_count: int = 0
    established_count: int = 0
    total_sockets: int = 0
    tcp_retrans_ps: float = 0.0
    udp_in_ps: float = 0.0
    udp_err_ps: float = 0.0
    icmp_in_ps: float = 0.0
    fail2ban_jails: int = 0
    fail2ban_banned: int = 0
    ufw_active: bool = False
    strict_mode: bool = False
    autoguard_mode: str = "monitor"  # monitor | protect | off
    safeguard_protected: int = 0
    auto_banned_active: int = 0
    threat_level: str = "NORMAL"  # NORMAL | ELEVATED | UNDER ATTACK


@dataclass
class ProtectedBackend:
    name: str
    kind: str  # WG-TUNNEL | NAT-MASQ | DOCKER | SERVICE
    tunnel_ip: str
    endpoint: str
    status: str  # PROTECTED | IDLE | WAITING | DOWN
    rx_bytes: int = 0
    tx_bytes: int = 0
    rx_bps: float = 0.0
    tx_bps: float = 0.0
    handshake_age: str = "-"


@dataclass
class RemoteTalker:
    ip: str
    total_conns: int
    established: int
    syn_recv: int
    time_wait: int
    udp_conns: int
    ports: str
    process: str
    risk: str  # WHITELIST | ADMIN | INTERNAL | SERVICE | BLOCKED | FLOOD | WARN | OK
    threat_score: int = 0
    safe_reason: str = ""


@dataclass
class IpGeoInfo:
    country: str = ""
    country_code: str = ""
    region: str = ""
    city: str = ""
    isp: str = ""
    org: str = ""
    asn: str = ""
    status: str = "pending"  # pending | ok | private | failed
    fetched_at: float = 0.0

    def location_str(self) -> str:
        if self.status == "private":
            return "Private/LAN (RFC1918)"
        if self.status == "pending":
            return "Resolving GeoIP..."
        if self.status != "ok":
            return "GeoIP unavailable"
        parts: List[str] = []
        if self.region and self.region.lower() != self.country.lower():
            parts.append(self.region)
        elif self.city and self.city.lower() != self.country.lower():
            parts.append(self.city)
        if self.country:
            if self.country_code:
                parts.append(f"{self.country} ({self.country_code})")
            else:
                parts.append(self.country)
        return ", ".join(parts) if parts else "Unknown Location"

    def compact_location_str(self) -> str:
        if self.status == "private":
            return "LAN"
        if self.status == "pending":
            return "Geo..."
        if self.status != "ok":
            return "Geo N/A"
        cc = self.country_code or self.country[:2].upper()
        reg = self.region or self.city
        if cc and reg:
            return f"{cc}/{reg}"
        return self.country or cc or "N/A"

    def isp_str(self) -> str:
        if self.status == "private":
            return "Internal Network"
        if self.status == "pending":
            return "Resolving ISP..."
        if self.status != "ok":
            return "ISP unavailable"
        label = self.isp or self.org or "Unknown ISP"
        if self.asn:
            asn_short = self.asn.split()[0]
            if asn_short.upper().startswith("AS") and asn_short not in label:
                return f"{label} ({asn_short})"
        return label


@dataclass
class PolicyIpEntry:
    ip: str
    source: str  # XDP | NFT | UFW | F2B | FILE
    note: str
    reason: str = ""
    attempted: str = ""
    country: str = ""
    country_code: str = ""
    region: str = ""
    city: str = ""
    isp: str = ""
    asn: str = ""
    geo_status: str = "pending"  # pending | ok | private | failed

    @property
    def location_label(self) -> str:
        if self.geo_status == "private":
            return "Private/LAN (RFC1918)"
        if self.geo_status == "pending" and not self.country:
            return "Resolving GeoIP..."
        if not self.country and not self.region:
            return "GeoIP unavailable"
        parts: List[str] = []
        if self.region and self.region.lower() != self.country.lower():
            parts.append(self.region)
        elif self.city and self.city.lower() != self.country.lower():
            parts.append(self.city)
        if self.country:
            parts.append(f"{self.country} ({self.country_code})" if self.country_code else self.country)
        return ", ".join(parts)

    @property
    def compact_location(self) -> str:
        if self.geo_status == "private":
            return "LAN"
        if self.geo_status == "pending" and not self.country:
            return "Geo..."
        if not self.country and not self.region:
            return "Geo N/A"
        cc = self.country_code or self.country[:2].upper()
        reg = self.region or self.city
        if cc and reg:
            return f"{cc}·{reg}"
        return self.country or cc

    @property
    def isp_label(self) -> str:
        if self.geo_status == "private":
            return "Internal Network"
        if self.geo_status == "pending" and not self.isp:
            return "Resolving ISP..."
        if not self.isp:
            return "ISP unavailable"
        if self.asn:
            asn_short = self.asn.split()[0]
            if asn_short.upper().startswith("AS") and asn_short not in self.isp:
                return f"{self.isp} ({asn_short})"
        return self.isp


@dataclass
class LogEvent:
    ts: str
    tag: str  # XDP | DROP | BAN | WHT | WAF | WG | SYS | AUTH
    message: str


@dataclass
class DashboardSnapshot:
    timestamp: str
    host: HostStats
    nic: NicStats
    filtration: FiltrationStats
    backends: List[ProtectedBackend]
    listening_ports: List[str]
    talkers: List[RemoteTalker]
    blocked_ips: List[PolicyIpEntry]
    whitelisted_ips: List[PolicyIpEntry]
    logs: List[LogEvent]
    demo_mode: bool = False


# ------------------------------------------------------------------------------
# Non-Blocking IP Geolocation & ISP Intelligence Resolver (Pure Stdlib)
# ------------------------------------------------------------------------------

class IpGeoResolver:
    """Thread-safe background IP GeoIP + ISP resolver with persistent JSON disk cache."""

    def __init__(self, enabled: bool = True):
        self.enabled = enabled
        self._lock = threading.Lock()
        self._cache: Dict[str, IpGeoInfo] = {}
        self._pending: Deque[str] = collections.deque()
        self._queued: Set[str] = set()
        self._wakeup = threading.Event()
        self._cache_path: Optional[Path] = None
        self._worker_started = False
        if self.enabled:
            self._load_disk_cache()

    def _start_worker(self) -> None:
        if self._worker_started or not self.enabled:
            return
        self._worker_started = True
        t = threading.Thread(target=self._worker_loop, name="spx-geo-resolver", daemon=True)
        t.start()

    def _select_cache_path(self) -> Optional[Path]:
        if self._cache_path is not None:
            return self._cache_path
        for cand in GEO_CACHE_PATHS:
            try:
                cand.parent.mkdir(parents=True, exist_ok=True)
                self._cache_path = cand
                return cand
            except OSError:
                continue
        return None

    def _load_disk_cache(self) -> None:
        now = time.time()
        for cand in GEO_CACHE_PATHS:
            if not cand.exists():
                continue
            try:
                raw = json.loads(cand.read_text(encoding="utf-8", errors="ignore"))
                if isinstance(raw, dict):
                    for ip, d in raw.items():
                        if not isinstance(d, dict):
                            continue
                        fetched = float(d.get("fetched_at", 0.0) or 0.0)
                        status = str(d.get("status", "ok"))
                        ttl = GEO_CACHE_TTL if status == "ok" else GEO_FAIL_RETRY
                        if now - fetched < ttl:
                            self._cache[ip] = IpGeoInfo(
                                country=str(d.get("country", "")),
                                country_code=str(d.get("country_code", "")),
                                region=str(d.get("region", "")),
                                city=str(d.get("city", "")),
                                isp=str(d.get("isp", "")),
                                org=str(d.get("org", "")),
                                asn=str(d.get("asn", "")),
                                status=status,
                                fetched_at=fetched,
                            )
                self._cache_path = cand
                break
            except (OSError, json.JSONDecodeError, ValueError, TypeError):
                continue

    def _save_disk_cache(self) -> None:
        p = self._select_cache_path()
        if p is None:
            return
        try:
            with self._lock:
                items = list(self._cache.items())[-500:]
            payload = {
                ip: {
                    "country": info.country,
                    "country_code": info.country_code,
                    "region": info.region,
                    "city": info.city,
                    "isp": info.isp,
                    "org": info.org,
                    "asn": info.asn,
                    "status": info.status,
                    "fetched_at": info.fetched_at,
                }
                for ip, info in items
                if info.status in ("ok", "private")
            }
            tmp = p.with_suffix(".tmp")
            tmp.write_text(json.dumps(payload), encoding="utf-8")
            tmp.replace(p)
        except OSError:
            pass

    @staticmethod
    def _is_private_ip(ip: str) -> bool:
        try:
            addr = ipaddress.IPv4Address(ip.strip())
            return (
                addr.is_private
                or addr.is_loopback
                or addr.is_link_local
                or addr.is_multicast
                or addr.is_reserved
            )
        except ValueError:
            return True

    def get_cached_or_queue(self, ip: str) -> IpGeoInfo:
        ip = ip.strip()
        if not ip or self._is_private_ip(ip):
            return IpGeoInfo(
                country="Private/LAN",
                country_code="LAN",
                region="RFC1918",
                isp="Internal Network",
                status="private",
                fetched_at=time.time(),
            )
        now = time.time()
        with self._lock:
            cached = self._cache.get(ip)
            if cached is not None:
                ttl = GEO_CACHE_TTL if cached.status == "ok" else GEO_FAIL_RETRY
                if now - cached.fetched_at < ttl:
                    return cached
            if self.enabled and ip not in self._queued:
                self._queued.add(ip)
                self._pending.append(ip)
                self._wakeup.set()
        if self.enabled:
            self._start_worker()
        return IpGeoInfo(status="pending")

    def resolve_batch_sync(self, ips: List[str], timeout: float = 2.5) -> None:
        """Resolve a batch of uncached public IPs synchronously (used for --once mode)."""
        if not self.enabled:
            return
        need: List[str] = []
        now = time.time()
        with self._lock:
            for ip in ips:
                ip = ip.strip()
                if not ip or self._is_private_ip(ip):
                    continue
                cached = self._cache.get(ip)
                if cached is not None and (now - cached.fetched_at) < (
                    GEO_CACHE_TTL if cached.status == "ok" else GEO_FAIL_RETRY
                ):
                    continue
                if ip not in need:
                    need.append(ip)
        if not need:
            return
        self._fetch_batch(need[:40], timeout=timeout)

    def _worker_loop(self) -> None:
        while True:
            self._wakeup.wait(timeout=3.0)
            self._wakeup.clear()
            batch: List[str] = []
            with self._lock:
                while self._pending and len(batch) < 40:
                    ip = self._pending.popleft()
                    batch.append(ip)
            if not batch:
                continue
            try:
                self._fetch_batch(batch, timeout=3.0)
            except Exception:
                pass
            finally:
                with self._lock:
                    for ip in batch:
                        self._queued.discard(ip)

    def _fetch_batch(self, ips: List[str], timeout: float = 3.0) -> None:
        if not ips:
            return
        now = time.time()
        resolved: Dict[str, IpGeoInfo] = {}

        # Primary: ip-api.com batch endpoint (fast, single HTTP request for up to 100 IPs)
        try:
            url = "http://ip-api.com/batch?fields=status,query,country,countryCode,regionName,city,isp,org,as"
            body = json.dumps(ips).encode("utf-8")
            req = urllib.request.Request(
                url,
                data=body,
                headers={
                    "Content-Type": "application/json",
                    "User-Agent": f"SparrowX-NOC/{VERSION}",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                data = json.loads(resp.read().decode("utf-8", errors="ignore"))
            if isinstance(data, list):
                for item in data:
                    if not isinstance(item, dict):
                        continue
                    q_ip = str(item.get("query", "")).strip()
                    if not q_ip:
                        continue
                    if item.get("status") == "success":
                        resolved[q_ip] = IpGeoInfo(
                            country=str(item.get("country", "")),
                            country_code=str(item.get("countryCode", "")),
                            region=str(item.get("regionName", "")),
                            city=str(item.get("city", "")),
                            isp=str(item.get("isp", "") or item.get("org", "")),
                            org=str(item.get("org", "")),
                            asn=str(item.get("as", "")),
                            status="ok",
                            fetched_at=now,
                        )
        except (urllib.error.URLError, OSError, json.JSONDecodeError, ValueError, TimeoutError):
            pass

        # Fallback: ipwho.is for any IPs not resolved by primary (capped at 6 per batch)
        missing = [ip for ip in ips if ip not in resolved]
        for ip in missing[:6]:
            try:
                req = urllib.request.Request(
                    f"https://ipwho.is/{ip}",
                    headers={"User-Agent": f"SparrowX-NOC/{VERSION}"},
                )
                with urllib.request.urlopen(req, timeout=min(2.0, timeout)) as resp:
                    item = json.loads(resp.read().decode("utf-8", errors="ignore"))
                if isinstance(item, dict) and item.get("success"):
                    conn = item.get("connection") if isinstance(item.get("connection"), dict) else {}
                    asn_val = conn.get("asn")
                    asn_str = f"AS{asn_val}" if asn_val else ""
                    resolved[ip] = IpGeoInfo(
                        country=str(item.get("country", "")),
                        country_code=str(item.get("country_code", "")),
                        region=str(item.get("region", "")),
                        city=str(item.get("city", "")),
                        isp=str(conn.get("isp", "") or conn.get("org", "")),
                        org=str(conn.get("org", "")),
                        asn=asn_str,
                        status="ok",
                        fetched_at=now,
                    )
            except (urllib.error.URLError, OSError, json.JSONDecodeError, ValueError, TimeoutError):
                continue

        with self._lock:
            for ip in ips:
                if ip in resolved:
                    self._cache[ip] = resolved[ip]
                elif ip not in self._cache or self._cache[ip].status != "ok":
                    self._cache[ip] = IpGeoInfo(status="failed", fetched_at=now)

        if resolved:
            self._save_disk_cache()


# ------------------------------------------------------------------------------
# Smart Safe-Guard Engine (Prevents Banning Normal Users, Admins & Services)
# ------------------------------------------------------------------------------

class SafeIpGuard:
    """
    Continuously discovers host IPs, gateways, DNS resolvers, active SSH admin
    sessions, WireGuard peer endpoints, Docker networks, client VPS backends,
    and trusted CDN/service CIDRs/ASNs so the firewall and NOC NEVER ban
    legitimate infrastructure or lock out the operator.
    """

    def __init__(self) -> None:
        self.host_ips: Set[str] = set()
        self.gateway_ips: Set[str] = set()
        self.dns_ips: Set[str] = set()
        self.admin_ssh_ips: Set[str] = set()
        self.backend_ips: Set[str] = set()
        self._last_refresh: float = 0.0
        self._refresh_env_ssh()

    def _refresh_env_ssh(self) -> None:
        for env_key in ("SSH_CONNECTION", "SSH_CLIENT"):
            raw = os.environ.get(env_key, "").strip()
            if raw:
                first = raw.split()[0].replace("::ffff:", "")
                if is_valid_ipv4(first):
                    self.admin_ssh_ips.add(first)

    def refresh_dynamic(
        self,
        backends: Optional[List[ProtectedBackend]] = None,
        active_ssh_ips: Optional[Set[str]] = None,
        force: bool = False,
    ) -> None:
        now = time.monotonic()
        self._refresh_env_ssh()
        if active_ssh_ips:
            for ip in active_ssh_ips:
                if is_valid_ipv4(ip):
                    self.admin_ssh_ips.add(ip)

        if backends:
            for b in backends:
                for candidate in (b.tunnel_ip.split("/")[0], b.endpoint.rsplit(":", 1)[0]):
                    cand = candidate.strip()
                    if is_valid_ipv4(cand):
                        self.backend_ips.add(cand)

        if not force and (now - self._last_refresh) < 15.0:
            return
        self._last_refresh = now

        if not IS_LINUX:
            return

        # 1. All local IPv4 addresses on this host
        rc, out, _ = run_cmd(["ip", "-4", "-o", "addr", "show"], timeout=1.0)
        if rc == 0:
            found_host: Set[str] = set()
            for m in re.finditer(r"inet\s+(\d+\.\d+\.\d+\.\d+)", out):
                if is_valid_ipv4(m.group(1)):
                    found_host.add(m.group(1))
            if found_host:
                self.host_ips = found_host

        # 2. Default gateway IP(s)
        rc, out, _ = run_cmd(["ip", "route", "show", "default"], timeout=1.0)
        if rc == 0:
            found_gw: Set[str] = set()
            for m in re.finditer(r"\bvia\s+(\d+\.\d+\.\d+\.\d+)", out):
                if is_valid_ipv4(m.group(1)):
                    found_gw.add(m.group(1))
            if found_gw:
                self.gateway_ips = found_gw

        # 3. Configured system DNS resolvers (/etc/resolv.conf)
        resolv = Path("/etc/resolv.conf")
        if resolv.exists():
            try:
                found_dns: Set[str] = set()
                for line in resolv.read_text(encoding="utf-8", errors="ignore").splitlines():
                    parts = line.strip().split()
                    if len(parts) >= 2 and parts[0] == "nameserver" and is_valid_ipv4(parts[1]):
                        found_dns.add(parts[1])
                if found_dns:
                    self.dns_ips = found_dns
            except OSError:
                pass

    @property
    def total_dynamic_protected(self) -> int:
        return len(self.host_ips | self.gateway_ips | self.dns_ips | self.admin_ssh_ips | self.backend_ips)

    def classify(
        self,
        ip: str,
        geo: Optional[IpGeoInfo] = None,
        extra_whitelisted: Optional[Set[str]] = None,
    ) -> Tuple[bool, str, str]:
        """Returns (is_protected, category_tag, human_reason)."""
        clean = ip.strip()
        if not is_valid_ipv4(clean):
            return False, "INVALID", "Invalid IPv4"

        addr = ipaddress.IPv4Address(clean)

        # 1. Explicit operator whitelist always wins
        if extra_whitelisted and clean in extra_whitelisted:
            return True, "WHITELIST", "Explicitly whitelisted operator IP"

        # 2. Active SSH operator session (prevents self-lockout)
        if clean in self.admin_ssh_ips:
            return True, "ADMIN", "Active SSH operator session"

        # 3. Host's own IPs, gateway, or system DNS resolvers
        if clean in self.host_ips:
            return True, "HOST", "Local server interface IP"
        if clean in self.gateway_ips:
            return True, "HOST", "Server default network gateway"
        if clean in self.dns_ips:
            return True, "SERVICE", "Host DNS resolver (/etc/resolv.conf)"

        # 4. Internal / Docker / WireGuard / Loopback / CGNAT ranges
        for net in INTERNAL_SAFE_CIDRS:
            if addr in net:
                if clean.startswith("127."):
                    return True, "INTERNAL", "Loopback interface (127.0.0.0/8)"
                if clean.startswith("172."):
                    return True, "INTERNAL", "Docker / Private RFC1918 network"
                if clean.startswith("100."):
                    return True, "INTERNAL", "Carrier-Grade NAT / Tailscale subnet"
                return True, "INTERNAL", "Private / WireGuard internal network"

        # 5. Protected WireGuard peers & registered client VPS backends
        if clean in self.backend_ips:
            return True, "BACKEND", "Protected WireGuard peer / client backend"

        # 6. Well-known critical CDN & public DNS CIDRs (Cloudflare, Google DNS, Quad9)
        for net, label in TRUSTED_SERVICE_CIDRS:
            if addr in net:
                return True, "SERVICE", f"Trusted service infrastructure ({label})"

        # 7. GeoIP ASN check for major CDNs / Cloud / Developer platforms
        if geo and geo.status == "ok" and geo.asn:
            asn_key = geo.asn.split()[0].upper()
            if asn_key in TRUSTED_SERVICE_ASNS:
                return True, "SERVICE", f"Trusted service ASN ({TRUSTED_SERVICE_ASNS[asn_key]} · {asn_key})"

        return False, "PUBLIC", ""


def evaluate_talker_behavior(
    info: Dict[str, Any],
    strike_count: int = 0,
    log_evidence: Optional[Dict[str, str]] = None,
) -> Tuple[int, str]:
    """
    Smart behavioral scoring (0-100) for a non-protected PUBLIC IP.
    Designed to distinguish real volumetric/SYN/brute-force attackers from
    normal high-concurrency browsers, mobile CGNAT carriers, and legitimate services.
    """
    total = int(info.get("total", 0))
    est = int(info.get("est", 0))
    syn = int(info.get("syn", 0))
    tw = int(info.get("tw", 0))
    udp = int(info.get("udp", 0))

    score = 0

    # 1. Half-open TCP SYN Flood signature (high SYN-RECV with very few completed handshakes)
    if syn >= 25 and syn > max(est * 3, 15):
        score += 65
    elif syn >= 15 and syn > max(est * 2, 10):
        score += 45
    elif syn >= 10 and est == 0:
        score += 30
    elif syn >= 6 and est == 0:
        score += 15

    # 2. Connection exhaustion ONLY when established ratio is unhealthy or count is extreme
    # Normal users / office NAT / HTTP2 browsers with 15-80 ESTAB sockets & low SYN are NOT flooders!
    if total >= 250 and est < total * 0.25:
        score += 45
    elif total >= 140 and est < total * 0.30:
        score += 25
    elif total >= 80 and est == 0 and tw >= 60:
        score += 30

    # 3. High UDP socket churn from single public IP
    if udp >= 120:
        score += 35
    elif udp >= 60:
        score += 15

    # 4. Established-Session Trust Credit: real browsers/apps hold clean ESTAB sockets with ~0 SYN-RECV
    if est >= 3 and syn <= 3 and total < 160:
        score = max(0, score - 25)

    # 5. Multi-signal log correlation (SSH brute-force or heavy Nginx 429 abuse)
    if log_evidence:
        attempted = (log_evidence.get("attempted") or "").lower()
        if "ssh brute-force" in attempted or "invalid ssh user" in attempted:
            score += 35
        elif "429" in attempted or "rate-limit" in attempted:
            score += 20

    # 6. Sustained persistence bonus (only consecutive attack ticks reach FLOOD)
    if score >= 55 and strike_count >= 3:
        score = min(100, score + 15)

    score = max(0, min(100, score))

    # Require sustained persistence (strike_count >= 2) before labeling FLOOD to eliminate 1s bursts
    if score >= 75 and strike_count >= 2:
        return score, "FLOOD"
    if score >= 40:
        return score, "WARN"
    return score, "OK"


# ------------------------------------------------------------------------------
# Discord Webhook Alerting & Periodic NOC Telemetry Notifier (Stdlib Only)
# ------------------------------------------------------------------------------

def resolve_discord_webhook_url(explicit: Optional[str] = None) -> str:
    """Resolve Discord webhook URL from CLI flag, environment, or local .env files."""
    candidates: List[str] = []
    if explicit:
        candidates.append(explicit.strip())
    for env_key in (
        "SPARROWX_DISCORD_WEBHOOK_URL",
        "NOC_DISCORD_WEBHOOK_URL",
        "DISCORD_WEBHOOK_URL",
    ):
        val = os.environ.get(env_key, "").strip()
        if val:
            candidates.append(val)

    for env_path in DISCORD_ENV_FILES:
        if not env_path.exists():
            continue
        try:
            for raw in env_path.read_text(encoding="utf-8", errors="ignore").splitlines():
                line = raw.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                k = k.strip()
                if k in (
                    "SPARROWX_DISCORD_WEBHOOK_URL",
                    "NOC_DISCORD_WEBHOOK_URL",
                    "DISCORD_WEBHOOK_URL",
                ):
                    v = v.strip().strip('"').strip("'")
                    if v:
                        candidates.append(v)
        except OSError:
            continue

    for url in candidates:
        if url.startswith("https://discord.com/api/webhooks/") or url.startswith(
            "https://discordapp.com/api/webhooks/"
        ):
            return url
    return ""


def _neutralize_discord_mentions(text: str) -> str:
    text = re.sub(r"@(everyone|here)", "@\u200b\\1", text, flags=re.IGNORECASE)
    return re.sub(r"<@!?\d+>|<@&\d+>", "[mention]", text)


class DiscordWebhookNotifier:
    """Non-blocking Discord embed dispatcher with cooldown deduplication."""

    COLOR_RED = 0xEF4444
    COLOR_ORANGE = 0xF97316
    COLOR_AMBER = 0xF59E0B
    COLOR_GREEN = 0x10B981
    COLOR_CYAN = 0x06B6D4
    COLOR_PURPLE = 0xA855F7

    def __init__(
        self,
        webhook_url: Optional[str] = None,
        enabled: bool = True,
        digest_interval_sec: float = DISCORD_DEFAULT_DIGEST_SEC,
    ):
        self.webhook_url = resolve_discord_webhook_url(webhook_url) if enabled else ""
        self.enabled = bool(enabled and self.webhook_url)
        self.digest_interval_sec = max(0.0, float(digest_interval_sec))
        self.sent_count = 0
        self.failed_count = 0
        self.last_error = ""
        self._cooldowns: Dict[str, float] = {}
        self._lock = threading.Lock()
        self._queue: "queue.Queue[Dict[str, Any]]" = queue.Queue(maxsize=64)
        self._worker: Optional[threading.Thread] = None
        if self.enabled:
            self._worker = threading.Thread(target=self._worker_loop, daemon=True)
            self._worker.start()

    def _post_payload(self, payload: Dict[str, Any], timeout: float = 5.0) -> Tuple[bool, str]:
        if not self.webhook_url:
            return False, "Discord webhook URL not configured"
        data = json.dumps(payload).encode("utf-8")
        req = urllib.request.Request(
            self.webhook_url,
            data=data,
            headers={
                "Content-Type": "application/json",
                "User-Agent": f"SparrowX-NOC/{VERSION}",
            },
            method="POST",
        )
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                status = getattr(resp, "status", 204)
                if 200 <= status < 300:
                    with self._lock:
                        self.sent_count += 1
                    return True, f"HTTP {status}"
                with self._lock:
                    self.failed_count += 1
                    self.last_error = f"HTTP {status}"
                return False, f"HTTP {status}"
        except urllib.error.HTTPError as e:
            err_msg = f"HTTP {e.code}"
            with self._lock:
                self.failed_count += 1
                self.last_error = err_msg
            return False, err_msg
        except Exception as e:
            err_msg = str(e)[:120]
            with self._lock:
                self.failed_count += 1
                self.last_error = err_msg
            return False, err_msg

    def _worker_loop(self) -> None:
        while True:
            payload = self._queue.get()
            try:
                self._post_payload(payload, timeout=5.0)
                time.sleep(0.45)  # Polite pacing to avoid Discord 429 burst limits
            except Exception:
                pass
            finally:
                self._queue.task_done()

    def build_embed_payload(
        self,
        title: str,
        description: str = "",
        color: int = COLOR_CYAN,
        fields: Optional[List[Tuple[str, str, bool]]] = None,
        content: Optional[str] = None,
    ) -> Dict[str, Any]:
        embed_fields: List[Dict[str, Any]] = []
        for name, val, inline in (fields or [])[:20]:
            s_val = _neutralize_discord_mentions(str(val or "—"))[:950]
            embed_fields.append(
                {
                    "name": _neutralize_discord_mentions(str(name))[:120],
                    "value": s_val or "—",
                    "inline": bool(inline),
                }
            )
        embed: Dict[str, Any] = {
            "title": _neutralize_discord_mentions(title)[:220],
            "color": color,
            "fields": embed_fields,
            "footer": {"text": f"SparrowX Master Cybersecurity NOC v{VERSION} · Live Telemetry"},
            "timestamp": datetime.datetime.now(datetime.timezone.utc).isoformat().replace("+00:00", "Z"),
        }
        if description:
            embed["description"] = _neutralize_discord_mentions(description)[:1900]
        payload: Dict[str, Any] = {
            "username": "SparrowX Master NOC",
            "allowed_mentions": {"parse": []},
            "embeds": [embed],
        }
        if content:
            payload["content"] = _neutralize_discord_mentions(content)[:300]
        return payload

    def send_embed(
        self,
        title: str,
        description: str = "",
        color: int = COLOR_CYAN,
        fields: Optional[List[Tuple[str, str, bool]]] = None,
        dedup_key: Optional[str] = None,
        cooldown_sec: float = 30.0,
        content: Optional[str] = None,
        sync: bool = False,
    ) -> Tuple[bool, str]:
        if not self.enabled:
            return False, "Discord webhook not configured (set SPARROWX_DISCORD_WEBHOOK_URL)"
        now = time.monotonic()
        if dedup_key and not sync:
            with self._lock:
                last = self._cooldowns.get(dedup_key, 0.0)
                if (now - last) < cooldown_sec:
                    return False, "cooldown"
                self._cooldowns[dedup_key] = now
                if len(self._cooldowns) > 400:
                    cutoff = now - 600.0
                    self._cooldowns = {k: v for k, v in self._cooldowns.items() if v >= cutoff}
        payload = self.build_embed_payload(
            title=title,
            description=description,
            color=color,
            fields=fields,
            content=content,
        )
        if sync:
            return self._post_payload(payload, timeout=6.0)
        try:
            self._queue.put_nowait(payload)
            return True, "queued"
        except queue.Full:
            return False, "queue_full"

    def send_snapshot(
        self,
        snap: DashboardSnapshot,
        title: str = "Live NOC Status Update",
        color: Optional[int] = None,
        sync: bool = False,
    ) -> Tuple[bool, str]:
        f = snap.filtration
        nic = snap.nic
        host = snap.host
        if color is None:
            color = (
                self.COLOR_RED
                if f.threat_level == "UNDER ATTACK"
                else (self.COLOR_AMBER if f.threat_level == "ELEVATED" else self.COLOR_GREEN)
            )
        top_blk = ", ".join(b.ip for b in snap.blocked_ips[:5]) or "None"
        fields: List[Tuple[str, str, bool]] = [
            ("Host & NIC", f"`{host.hostname}` · `{nic.iface}` ({nic.ipv4})", True),
            ("Threat Level", f"**{f.threat_level}** · Guard: `{f.autoguard_mode.upper()}`", True),
            ("CPU / RAM / Uptime", f"{host.cpu_pct:.1f}% ({host.cpu_cores}c) · {host.mem_used_gb:.1f}/{host.mem_total_gb:.1f}GB · Up {host.uptime_str}", False),
            ("Ingress (RX)", f"{fmt_bps(nic.rx_bps)} ({fmt_pps(nic.rx_pps)}) · Peak {fmt_bps(nic.peak_rx_bps)}", True),
            ("Egress (TX)", f"{fmt_bps(nic.tx_bps)} ({fmt_pps(nic.tx_pps)}) · Peak {fmt_bps(nic.peak_tx_bps)}", True),
            ("XDP / Firewall", f"{f.xdp_mode} · Drop `{fmt_pps(f.xdp_drop_pps)}` · Strict-SYN `{'ON' if f.strict_mode else 'STD'}` · UFW `{f.ufw_status}`", False),
            ("Connections", f"{len(snap.talkers)} IPs / {f.total_sockets} sock · SYN `{f.syn_recv_count}` · EST `{f.established_count}` · TW `{f.time_wait_count}`", True),
            ("Protected / Policy", f"{len(snap.backends)} services · ⛔ {len(snap.blocked_ips)} BLK · ✓ {len(snap.whitelisted_ips)} WL", True),
            ("Recent Blocklist", f"`{top_blk}`", False),
        ]
        return self.send_embed(
            title=f"🛡️ {title}",
            description=f"Real-time kernel, XDP/eBPF & firewall snapshot from `{host.hostname}`.",
            color=color,
            fields=fields,
            sync=sync,
        )


# ------------------------------------------------------------------------------
# Linux Telemetry Collectors (100% Real Kernel/System Data in Live Mode)
# ------------------------------------------------------------------------------

class TelemetryCollector:
    def __init__(
        self,
        iface: Optional[str] = None,
        demo: bool = False,
        autoguard: str = "monitor",
        discord_webhook: Optional[str] = None,
        discord_interval: float = DISCORD_DEFAULT_DIGEST_SEC,
        no_discord: bool = False,
    ):
        self.demo = demo
        self.forced_iface = iface
        self.active_iface = iface or self._detect_default_iface()
        self.autoguard_mode = autoguard if autoguard in AUTOGUARD_MODES else "monitor"
        self.safe_guard = SafeIpGuard()
        self.discord = DiscordWebhookNotifier(
            webhook_url=discord_webhook,
            enabled=not no_discord,
            digest_interval_sec=discord_interval,
        )
        self._discord_baseline_ready: bool = False
        self._discord_seen_blocked: Set[str] = set()
        self._discord_last_threat: str = "NORMAL"
        self._discord_last_digest_mono: float = time.monotonic()
        self._last_snapshot: Optional[DashboardSnapshot] = None

        self._prev_cpu: Optional[Tuple[int, int]] = None
        self._prev_net: Dict[str, Tuple[float, int, int, int, int, int, int]] = {}
        self._prev_xdp_drop: Optional[Tuple[float, int]] = None
        self._prev_snmp: Optional[Tuple[float, int, int, int, int]] = None
        self._prev_wg_bytes: Dict[str, Tuple[float, int, int]] = {}
        self._peak_rx_bps: float = 0.0
        self._peak_tx_bps: float = 0.0

        # Smart hysteresis & anti-flap state
        self._ip_strikes: Dict[str, int] = {}
        self._auto_bans: Dict[str, float] = {}  # ip -> expires_at_epoch
        self._last_strict_toggle_mono: float = 0.0
        self._strict_auto_engaged: bool = False
        self._strict_high_ticks: int = 0
        self._strict_low_ticks: int = 0
        self._latest_whitelisted: Set[str] = set()

        self.rx_history: Deque[float] = collections.deque(maxlen=72)
        self.tx_history: Deque[float] = collections.deque(maxlen=72)

        self.log_buffer: Deque[LogEvent] = collections.deque(maxlen=350)
        self._log_offsets: Dict[str, int] = {}
        self._demo_tick = 0
        self._demo_strict = False
        self.geo_resolver = IpGeoResolver(enabled=not demo)
        self._evidence_cache: Dict[str, Dict[str, str]] = {}
        self._evidence_last_scan: float = 0.0
        self._evidence_ip_sig: Tuple[str, ...] = ()

        # Demo lists (ONLY used when --demo is explicitly enabled)
        self._demo_banned: List[PolicyIpEntry] = [
            PolicyIpEntry(
                ip="185.220.101.42",
                source="XDP",
                note="482.1K pkts",
                reason="XDP Wire-Speed DDoS Drop (482.1K pkts)",
                attempted="UDP amplification flood targeting :53 & :28015 (41.2 kpps)",
                country="Germany",
                country_code="DE",
                region="Hesse",
                city="Frankfurt",
                isp="Zwiebelfreunde e.V.",
                asn="AS205100",
                geo_status="ok",
            ),
            PolicyIpEntry(
                ip="45.155.205.91",
                source="XDP",
                note="194.6K pkts",
                reason="XDP SYN Flood Mitigation (194.6K pkts)",
                attempted="34x half-open TCP SYN flood probes on :443 & :51820",
                country="Russia",
                country_code="RU",
                region="Moscow",
                city="Moscow",
                isp="HOSTKEY B.V.",
                asn="AS57043",
                geo_status="ok",
            ),
            PolicyIpEntry(
                ip="91.240.118.17",
                source="NFT",
                note="sparrowx_shield",
                reason="nftables Shield Auto-Blacklist",
                attempted="Port scan across :22, :445, :3389 & :8080 (68 blocked)",
                country="Netherlands",
                country_code="NL",
                region="North Holland",
                city="Amsterdam",
                isp="Stark Industries Solutions Ltd",
                asn="AS44477",
                geo_status="ok",
            ),
            PolicyIpEntry(
                ip="194.26.135.88",
                source="F2B",
                note="sshd",
                reason="SSH Brute-Force (Fail2Ban: sshd)",
                attempted="14x failed SSH login attempts (users: root, admin) on :22",
                country="United States",
                country_code="US",
                region="California",
                city="Los Angeles",
                isp="FiberState LLC",
                asn="AS399629",
                geo_status="ok",
            ),
            PolicyIpEntry(
                ip="103.149.28.14",
                source="UFW",
                note="DENY IN",
                reason="UFW Firewall Rule (DENY IN)",
                attempted="HTTP 429 rate-limit burst & /.env, /wp-login.php vuln scan",
                country="Singapore",
                country_code="SG",
                region="Central Singapore",
                city="Singapore",
                isp="DigitalOcean LLC",
                asn="AS14061",
                geo_status="ok",
            ),
        ]
        self._demo_whitelisted: List[PolicyIpEntry] = [
            PolicyIpEntry("51.79.142.18", "XDP", "Edge Peer #1 (trusted)"),
            PolicyIpEntry("139.99.84.201", "XDP", "Origin Node SG-01"),
            PolicyIpEntry("145.239.61.99", "NFT", "sparrowx_shield WL"),
            PolicyIpEntry("172.69.34.102", "UFW", "ALLOW IN (Admin NOC)"),
        ]

        if not self.demo:
            self._prime_log_sources()
            self.push_event(
                "SYS",
                f"SparrowX Linux Master NOC v{VERSION} initialized on iface={self.active_iface}",
            )
        else:
            self._seed_demo_logs()

    def push_event(self, tag: str, message: str) -> None:
        ts = datetime.datetime.now().strftime("%H:%M:%S")
        self.log_buffer.append(LogEvent(ts=ts, tag=tag, message=message))

    def _detect_default_iface(self) -> str:
        if not IS_LINUX:
            return "eth0"
        rc, out, _ = run_cmd(["ip", "route", "show", "default"])
        if rc == 0:
            for line in out.splitlines():
                m = re.search(r"\bdev\s+(\S+)", line)
                if m:
                    return m.group(1)
        ifaces = self._list_net_ifaces()
        for cand in ifaces:
            if cand != "lo" and not cand.startswith(("docker", "br-", "veth")):
                return cand
        return ifaces[0] if ifaces else "eth0"

    def _list_net_ifaces(self) -> List[str]:
        if not IS_LINUX or not Path("/proc/net/dev").exists():
            return [self.active_iface]
        names: List[str] = []
        try:
            with open("/proc/net/dev", "r", encoding="utf-8", errors="ignore") as f:
                for line in f.readlines()[2:]:
                    if ":" in line:
                        name = line.split(":", 1)[0].strip()
                        if name and name != "lo":
                            names.append(name)
        except OSError:
            pass
        return names or [self.active_iface]

    def cycle_interface(self) -> str:
        ifaces = self._list_net_ifaces()
        if not ifaces:
            return self.active_iface
        if self.active_iface in ifaces:
            idx = (ifaces.index(self.active_iface) + 1) % len(ifaces)
            self.active_iface = ifaces[idx]
        else:
            self.active_iface = ifaces[0]
        self.rx_history.clear()
        self.tx_history.clear()
        self._peak_rx_bps = 0.0
        self._peak_tx_bps = 0.0
        self.push_event("SYS", f"Switched primary telemetry interface to {self.active_iface}")
        return self.active_iface

    # -- Host Telemetry --------------------------------------------------------

    def _collect_host(self) -> HostStats:
        hs = HostStats(
            hostname=socket.gethostname(),
            kernel=platform.release(),
            is_root=(os.geteuid() == 0) if hasattr(os, "geteuid") else False,
            cpu_cores=os.cpu_count() or 1,
        )
        if not IS_LINUX:
            return hs

        try:
            with open("/proc/stat", "r", encoding="utf-8") as f:
                parts = f.readline().split()
            if len(parts) >= 5 and parts[0] == "cpu":
                nums = [int(x) for x in parts[1:9]]
                idle = nums[3] + (nums[4] if len(nums) > 4 else 0)
                total = sum(nums)
                if self._prev_cpu is not None:
                    d_idle = idle - self._prev_cpu[0]
                    d_total = total - self._prev_cpu[1]
                    if d_total > 0:
                        hs.cpu_pct = max(0.0, min(100.0, (1.0 - d_idle / d_total) * 100.0))
                self._prev_cpu = (idle, total)
        except OSError:
            pass

        try:
            meminfo: Dict[str, int] = {}
            with open("/proc/meminfo", "r", encoding="utf-8") as f:
                for line in f:
                    if ":" in line:
                        k, v = line.split(":", 1)
                        meminfo[k.strip()] = int(v.strip().split()[0])
            total_kb = meminfo.get("MemTotal", 0)
            avail_kb = meminfo.get("MemAvailable", meminfo.get("MemFree", 0))
            used_kb = max(0, total_kb - avail_kb)
            if total_kb > 0:
                hs.mem_total_gb = total_kb / (1024 * 1024)
                hs.mem_used_gb = used_kb / (1024 * 1024)
                hs.mem_pct = (used_kb / total_kb) * 100.0
        except (OSError, ValueError):
            pass

        try:
            l1, l5, l15 = os.getloadavg()
            hs.load_1m, hs.load_5m, hs.load_15m = l1, l5, l15
        except OSError:
            pass

        try:
            with open("/proc/uptime", "r", encoding="utf-8") as f:
                up_sec = int(float(f.read().split()[0]))
            days, rem = divmod(up_sec, 86400)
            hours, rem = divmod(rem, 3600)
            mins = rem // 60
            hs.uptime_str = f"{days}d {hours}h {mins}m" if days else f"{hours}h {mins}m"
        except (OSError, ValueError):
            pass

        return hs

    # -- Network RX/TX Rates & NIC Metadata (/proc/net/dev + sysfs) ------------

    def _collect_nic(self) -> NicStats:
        ifaces = self._list_net_ifaces()
        if self.active_iface not in ifaces and ifaces:
            self.active_iface = ifaces[0]

        ns = NicStats(iface=self.active_iface, available_ifaces=ifaces)
        if not IS_LINUX or not Path("/proc/net/dev").exists():
            return ns

        # NIC IPv4 address
        rc, out, _ = run_cmd(["ip", "-4", "-o", "addr", "show", "dev", self.active_iface], timeout=0.8)
        if rc == 0:
            m = re.search(r"inet\s+(\d+\.\d+\.\d+\.\d+)", out)
            if m:
                ns.ipv4 = m.group(1)

        # NIC link speed from sysfs
        speed_p = Path(f"/sys/class/net/{self.active_iface}/speed")
        if speed_p.exists():
            try:
                sp = int(speed_p.read_text().strip())
                if sp >= 1000:
                    ns.link_speed = f"{sp // 1000}GbE"
                elif sp > 0:
                    ns.link_speed = f"{sp}MbE"
            except (OSError, ValueError):
                pass

        now = time.monotonic()
        try:
            with open("/proc/net/dev", "r", encoding="utf-8", errors="ignore") as f:
                for line in f.readlines()[2:]:
                    if ":" not in line:
                        continue
                    name, rest = line.split(":", 1)
                    name = name.strip()
                    if name != self.active_iface:
                        continue
                    cols = rest.split()
                    if len(cols) < 12:
                        continue
                    rx_bytes = int(cols[0])
                    rx_pkts = int(cols[1])
                    rx_drop = int(cols[3])
                    tx_bytes = int(cols[8])
                    tx_pkts = int(cols[9])
                    tx_drop = int(cols[11])

                    ns.rx_bytes_total = rx_bytes
                    ns.tx_bytes_total = tx_bytes
                    ns.rx_drops_total = rx_drop
                    ns.tx_drops_total = tx_drop

                    prev = self._prev_net.get(name)
                    if prev is not None:
                        dt = max(0.05, now - prev[0])
                        ns.rx_bps = max(0.0, (rx_bytes - prev[1]) * 8.0 / dt)
                        ns.rx_pps = max(0.0, (rx_pkts - prev[2]) / dt)
                        ns.rx_drop_ps = max(0.0, (rx_drop - prev[3]) / dt)
                        ns.tx_bps = max(0.0, (tx_bytes - prev[4]) * 8.0 / dt)
                        ns.tx_pps = max(0.0, (tx_pkts - prev[5]) / dt)
                        ns.tx_drop_ps = max(0.0, (tx_drop - prev[6]) / dt)

                    self._prev_net[name] = (
                        now, rx_bytes, rx_pkts, rx_drop, tx_bytes, tx_pkts, tx_drop
                    )
                    break
        except (OSError, ValueError):
            pass

        self._peak_rx_bps = max(self._peak_rx_bps, ns.rx_bps)
        self._peak_tx_bps = max(self._peak_tx_bps, ns.tx_bps)
        ns.peak_rx_bps = self._peak_rx_bps
        ns.peak_tx_bps = self._peak_tx_bps

        self.rx_history.append(ns.rx_bps)
        self.tx_history.append(ns.tx_bps)
        ns.rx_history = list(self.rx_history)
        ns.tx_history = list(self.tx_history)
        return ns

    # -- Kernel Protocol Counters (/proc/net/snmp) -----------------------------

    def _collect_snmp_rates(self) -> Tuple[float, float, float, float]:
        """Returns (tcp_retrans_ps, udp_in_ps, udp_err_ps, icmp_in_ps)."""
        if not IS_LINUX or not Path("/proc/net/snmp").exists():
            return 0.0, 0.0, 0.0, 0.0
        try:
            lines = Path("/proc/net/snmp").read_text(encoding="utf-8", errors="ignore").splitlines()
            parsed: Dict[str, Dict[str, int]] = {}
            i = 0
            while i + 1 < len(lines):
                if ":" in lines[i] and ":" in lines[i + 1]:
                    proto_h, keys_s = lines[i].split(":", 1)
                    proto_v, vals_s = lines[i + 1].split(":", 1)
                    if proto_h == proto_v:
                        keys = keys_s.split()
                        vals = vals_s.split()
                        if len(keys) == len(vals):
                            parsed[proto_h] = {k: int(v) for k, v in zip(keys, vals) if v.lstrip("-").isdigit()}
                        i += 2
                        continue
                i += 1
            tcp_retrans = parsed.get("Tcp", {}).get("RetransSegs", 0)
            udp_in = parsed.get("Udp", {}).get("InDatagrams", 0)
            udp_err = parsed.get("Udp", {}).get("InErrors", 0)
            icmp_in = parsed.get("Icmp", {}).get("InMsgs", 0)
            now = time.monotonic()
            if self._prev_snmp is not None:
                dt = max(0.1, now - self._prev_snmp[0])
                rates = (
                    max(0.0, (tcp_retrans - self._prev_snmp[1]) / dt),
                    max(0.0, (udp_in - self._prev_snmp[2]) / dt),
                    max(0.0, (udp_err - self._prev_snmp[3]) / dt),
                    max(0.0, (icmp_in - self._prev_snmp[4]) / dt),
                )
            else:
                rates = (0.0, 0.0, 0.0, 0.0)
            self._prev_snmp = (now, tcp_retrans, udp_in, udp_err, icmp_in)
            return rates
        except (OSError, ValueError):
            return 0.0, 0.0, 0.0, 0.0

    # -- XDP, nftables, iptables, conntrack, Fail2Ban, UFW + Whitelist ---------

    def _collect_filtration_and_policies(
        self, syn_recv: int, time_wait: int, established: int, total_sockets: int
    ) -> Tuple[FiltrationStats, List[PolicyIpEntry], List[PolicyIpEntry]]:
        tcp_ret, udp_in, udp_err, icmp_in = self._collect_snmp_rates()
        fs = FiltrationStats(
            syn_recv_count=syn_recv,
            time_wait_count=time_wait,
            established_count=established,
            total_sockets=total_sockets,
            tcp_retrans_ps=tcp_ret,
            udp_in_ps=udp_in,
            udp_err_ps=udp_err,
            icmp_in_ps=icmp_in,
        )
        blocked: List[PolicyIpEntry] = []
        whitelisted: List[PolicyIpEntry] = []
        seen_block: Set[Tuple[str, str]] = set()
        seen_white: Set[Tuple[str, str]] = set()

        if not IS_LINUX:
            return fs, blocked, whitelisted

        # 1. XDP attach status
        rc, out, _ = run_cmd(["ip", "-details", "link", "show", "dev", self.active_iface])
        if rc == 0:
            if "xdpgeneric" in out:
                fs.xdp_attached = True
                fs.xdp_mode = "GENERIC"
            elif "xdpoffload" in out:
                fs.xdp_attached = True
                fs.xdp_mode = "HW-OFFLOAD"
            elif re.search(r"\bprog/xdp\b|\bxdp\b", out):
                fs.xdp_attached = True
                fs.xdp_mode = "NATIVE"
            m_id = re.search(r"prog/xdp\s+id\s+(\d+)", out)
            if m_id:
                fs.xdp_prog_id = m_id.group(1)

        # 2. SparrowX XDP per-CPU stats (`xdp_stats`), blocklists & whitelist maps
        if shutil.which("bpftool"):
            for dump_cmd in (
                ["bpftool", "-j", "map", "dump", "pinned", "/sys/fs/bpf/sparrowx/xdp_stats"],
                ["bpftool", "-j", "map", "dump", "name", "xdp_stats"],
            ):
                rc, out, _ = run_cmd(dump_cmd, timeout=1.2)
                if rc == 0 and out.strip().startswith("["):
                    try:
                        entries = json.loads(out)
                        totals = {0: 0, 1: 0, 2: 0, 3: 0}
                        for entry in entries:
                            key = entry.get("key")
                            idx = key if isinstance(key, int) else (
                                int.from_bytes(bytes(int(x, 16) for x in key), "little")
                                if isinstance(key, list)
                                else -1
                            )
                            if idx not in totals:
                                continue
                            if "values" in entry and isinstance(entry["values"], list):
                                totals[idx] = sum(parse_u64_value(c.get("value", 0)) for c in entry["values"])
                            elif "value" in entry:
                                totals[idx] = parse_u64_value(entry["value"])
                        fs.xdp_passed = totals[0]
                        fs.xdp_challenged = totals[1]
                        fs.xdp_dropped = totals[2]
                        fs.xdp_whitelisted = totals[3]
                        now = time.monotonic()
                        if self._prev_xdp_drop is not None:
                            dt = max(0.1, now - self._prev_xdp_drop[0])
                            fs.xdp_drop_pps = max(0.0, (fs.xdp_dropped - self._prev_xdp_drop[1]) / dt)
                        self._prev_xdp_drop = (now, fs.xdp_dropped)
                        break
                    except (json.JSONDecodeError, ValueError, TypeError):
                        pass

            # XDP Blocklist maps
            for map_name in ("blocked_ipv4", "sparrowx_blacklist"):
                rc, out, _ = run_cmd(["bpftool", "-j", "map", "dump", "name", map_name], timeout=1.2)
                if rc == 0 and out.strip().startswith("["):
                    try:
                        for entry in json.loads(out)[:80]:
                            ip = parse_hex_key_to_ipv4(entry.get("key"))
                            if ip and (ip, "XDP") not in seen_block:
                                val = parse_u64_value(entry.get("value", 0))
                                note = f"{fmt_count(val)} hits" if val > 0 else map_name
                                blocked.append(PolicyIpEntry(ip, "XDP", note))
                                seen_block.add((ip, "XDP"))
                    except (json.JSONDecodeError, ValueError, TypeError):
                        pass

            # XDP Whitelist maps (`static_whitelist` permanent + `whitelist` dynamic LRU)
            for dump_cmd in (
                ["bpftool", "-j", "map", "dump", "pinned", "/sys/fs/bpf/sparrowx/static_whitelist"],
                ["bpftool", "-j", "map", "dump", "name", "static_whitelist"],
                ["bpftool", "-j", "map", "dump", "pinned", "/sys/fs/bpf/sparrowx/whitelist"],
                ["bpftool", "-j", "map", "dump", "name", "whitelist"],
            ):
                rc, out, _ = run_cmd(dump_cmd, timeout=1.2)
                if rc == 0 and out.strip().startswith("["):
                    try:
                        lbl = "XDP static WL" if "static_whitelist" in dump_cmd[-1] else "XDP_PASS (fast-path)"
                        for entry in json.loads(out)[:80]:
                            ip = parse_hex_key_to_ipv4(entry.get("key"))
                            if ip and (ip, "XDP") not in seen_white:
                                whitelisted.append(PolicyIpEntry(ip, "XDP", lbl))
                                seen_white.add((ip, "XDP"))
                    except (json.JSONDecodeError, ValueError, TypeError):
                        pass

        # 3. nftables drops, blacklist & whitelist sets
        if shutil.which("nft"):
            rc, out, _ = run_cmd(["nft", "list", "ruleset"], timeout=1.2)
            if rc == 0:
                drop_pkts = 0
                for line in out.splitlines():
                    if "drop" in line and "packets" in line:
                        m = re.search(r"packets\s+(\d+)", line)
                        if m:
                            drop_pkts += int(m.group(1))
                fs.nft_drops = drop_pkts

            rc, out, _ = run_cmd(["nft", "list", "set", "inet", "sparrowx_shield", "blacklist"], timeout=1.0)
            if rc == 0:
                for ip in re.findall(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", out):
                    if is_valid_ipv4(ip) and (ip, "NFT") not in seen_block:
                        blocked.append(PolicyIpEntry(ip, "NFT", "sparrowx_shield"))
                        seen_block.add((ip, "NFT"))

            rc, out, _ = run_cmd(["nft", "list", "set", "inet", "sparrowx_shield", "whitelist"], timeout=1.0)
            if rc == 0:
                for ip in re.findall(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", out):
                    if is_valid_ipv4(ip) and (ip, "NFT") not in seen_white:
                        whitelisted.append(PolicyIpEntry(ip, "NFT", "sparrowx_shield WL"))
                        seen_white.add((ip, "NFT"))

        # 4. iptables drop counters
        if shutil.which("iptables"):
            rc, out, _ = run_cmd(["iptables", "-L", "INPUT", "-n", "-v", "-x"], timeout=1.0)
            if rc == 0:
                ipt_drops = 0
                for line in out.splitlines():
                    parts = line.split()
                    if len(parts) >= 3 and parts[0].isdigit() and parts[2] in ("DROP", "REJECT"):
                        ipt_drops += int(parts[0])
                fs.iptables_drops = ipt_drops

        # 5. Conntrack & Strict SYN status
        try:
            p_cnt = Path("/proc/sys/net/netfilter/nf_conntrack_count")
            p_max = Path("/proc/sys/net/netfilter/nf_conntrack_max")
            if p_cnt.exists():
                fs.conntrack_count = int(p_cnt.read_text().strip())
            if p_max.exists():
                fs.conntrack_max = int(p_max.read_text().strip())
        except (OSError, ValueError):
            pass

        try:
            p_syn = Path("/proc/sys/net/ipv4/tcp_syncookies")
            p_ret = Path("/proc/sys/net/ipv4/tcp_synack_retries")
            if p_syn.exists() and p_ret.exists():
                fs.strict_mode = p_syn.read_text().strip() == "1" and int(p_ret.read_text().strip()) <= 2
        except (OSError, ValueError):
            pass

        # 6. Fail2Ban active jails & banned IPs
        if shutil.which("fail2ban-client"):
            rc, out, _ = run_cmd(["fail2ban-client", "status"], timeout=1.0)
            if rc == 0:
                m = re.search(r"Jail list:\s*(.+)", out)
                if m:
                    jails = [j.strip() for j in m.group(1).split(",") if j.strip()]
                    fs.fail2ban_jails = len(jails)
                    total_banned = 0
                    for jail in jails[:8]:
                        rc2, out2, _ = run_cmd(["fail2ban-client", "status", jail], timeout=0.8)
                        if rc2 == 0:
                            m_cnt = re.search(r"Currently banned:\s*(\d+)", out2)
                            if m_cnt:
                                total_banned += int(m_cnt.group(1))
                            m_ips = re.search(r"Banned IP list:\s*(.+)", out2)
                            if m_ips:
                                for ip in m_ips.group(1).split():
                                    if is_valid_ipv4(ip) and (ip, "F2B") not in seen_block:
                                        blocked.append(PolicyIpEntry(ip, "F2B", jail))
                                        seen_block.add((ip, "F2B"))
                    fs.fail2ban_banned = total_banned

        # 7. UFW DENY (blocklist) & ALLOW IN (whitelist) IP rules
        if shutil.which("ufw"):
            rc, out, _ = run_cmd(["ufw", "status"], timeout=1.0)
            if rc == 0:
                fs.ufw_active = "Status: active" in out
                for line in out.splitlines():
                    m = re.search(r"\b((?:\d{1,3}\.){3}\d{1,3})\b", line)
                    if not m:
                        continue
                    ip = m.group(1)
                    if not is_valid_ipv4(ip):
                        continue
                    if "DENY" in line and (ip, "UFW") not in seen_block:
                        blocked.append(PolicyIpEntry(ip, "UFW", "DENY IN"))
                        seen_block.add((ip, "UFW"))
                    elif "ALLOW" in line and "Anywhere" in line.split("ALLOW")[0] and (ip, "UFW") not in seen_white:
                        whitelisted.append(PolicyIpEntry(ip, "UFW", "ALLOW IN"))
                        seen_white.add((ip, "UFW"))

        # 8. Persistent SparrowX whitelist file (/opt/sparrowx/xdp/whitelist_ipv4.txt)
        if WHITELIST_FILE.exists():
            try:
                existing_wl_ips = {w.ip for w in whitelisted}
                for raw in WHITELIST_FILE.read_text(encoding="utf-8", errors="ignore").splitlines():
                    parts = raw.split("#", 1)
                    ip = parts[0].strip()
                    note = parts[1].strip() if len(parts) > 1 and parts[1].strip() else "persisted WL"
                    if is_valid_ipv4(ip) and ip not in existing_wl_ips:
                        whitelisted.append(PolicyIpEntry(ip, "FILE", note[:22]))
                        existing_wl_ips.add(ip)
            except OSError:
                pass

        # Smart Threat Level calculation (higher, realistic thresholds so normal spikes don't alarm)
        if fs.xdp_drop_pps >= 2000 or fs.syn_recv_count >= 60:
            fs.threat_level = "UNDER ATTACK"
        elif fs.xdp_drop_pps >= 200 or fs.syn_recv_count >= 25 or fs.fail2ban_banned >= 25:
            fs.threat_level = "ELEVATED"
        else:
            fs.threat_level = "NORMAL"

        fs.autoguard_mode = self.autoguard_mode
        fs.safeguard_protected = self.safe_guard.total_dynamic_protected + len(whitelisted)
        fs.auto_banned_active = len(self._auto_bans)

        return fs, blocked, whitelisted

    # -- Ban Reason, Attempted Attack Evidence & GeoIP/ISP Enrichment ----------

    @staticmethod
    def _read_tail_lines(path: Path, max_bytes: int = 131072) -> List[str]:
        if not path.exists():
            return []
        try:
            size = path.stat().st_size
            read_from = max(0, size - max_bytes)
            with open(path, "r", encoding="utf-8", errors="ignore") as f:
                if read_from > 0:
                    f.seek(read_from)
                    f.readline()
                return f.readlines()
        except OSError:
            return []

    @staticmethod
    def _jail_to_reason(jail: str) -> str:
        j = jail.strip().lower()
        if j in ("sshd", "ssh", "sshd-ddos", "sshd-aggressive"):
            return f"SSH Brute-Force (Fail2Ban: {jail})"
        if "nginx" in j or "http" in j or "apache" in j or "waf" in j:
            return f"HTTP/WAF Abuse (Fail2Ban: {jail})"
        if "recidive" in j:
            return "Repeat Offender (Fail2Ban: recidive)"
        if "ddos" in j or "flood" in j or "syn" in j:
            return f"L4 Flood Protection (Fail2Ban: {jail})"
        if "postfix" in j or "dovecot" in j or "mail" in j:
            return f"Mail Auth Abuse (Fail2Ban: {jail})"
        return f"Fail2Ban Jail ({jail})" if jail else "Fail2Ban Auto-Ban"

    def _scan_ban_evidence(self, target_ips: Set[str]) -> Dict[str, Dict[str, str]]:
        """Correlate blocked IPs against system logs to explain WHY they were banned & WHAT they tried."""
        if not target_ips:
            return {}

        now = time.monotonic()
        ip_sig = tuple(sorted(target_ips))
        if ip_sig == self._evidence_ip_sig and (now - self._evidence_last_scan) < 4.0:
            return self._evidence_cache

        stats: Dict[str, Dict[str, Any]] = {
            ip: {
                "ssh_fail": 0,
                "ssh_invalid": 0,
                "ssh_preauth": 0,
                "ssh_users": [],
                "f2b_found": 0,
                "f2b_jail": "",
                "ufw_hits": 0,
                "ufw_ports": [],
                "ufw_protos": set(),
                "ufw_syn": 0,
                "nginx_hits": 0,
                "nginx_paths": [],
                "nginx_429": 0,
                "sbs_msg": "",
                "manual_reason": "",
                "manual_tried": "",
            }
            for ip in target_ips
        }

        # 1. Persistent manual blocklist notes (/opt/sparrowx/xdp/blocked_ipv4.txt)
        if BLOCKLIST_FILE.exists():
            try:
                for raw in BLOCKLIST_FILE.read_text(encoding="utf-8", errors="ignore").splitlines():
                    if "#" not in raw:
                        continue
                    ip_part, comment = raw.split("#", 1)
                    ip_key = ip_part.strip()
                    if ip_key in stats and comment.strip():
                        c_text = comment.strip()
                        if "|" in c_text:
                            r_part, t_part = c_text.split("|", 1)
                            stats[ip_key]["manual_reason"] = r_part.strip()
                            stats[ip_key]["manual_tried"] = t_part.strip()
                        else:
                            stats[ip_key]["manual_reason"] = c_text
            except OSError:
                pass

        # 2. SSH authentication logs (/var/log/auth.log, /var/log/secure)
        for auth_path in (Path("/var/log/auth.log"), Path("/var/log/secure")):
            for line in self._read_tail_lines(auth_path, 163840):
                matched_ip = None
                for ip in target_ips:
                    if ip in line:
                        matched_ip = ip
                        break
                if matched_ip is None:
                    continue
                st = stats[matched_ip]
                m_inv = re.search(r"Invalid user\s+(\S+)\s+from", line)
                if m_inv:
                    st["ssh_invalid"] += 1
                    u = m_inv.group(1)[:18]
                    if u not in st["ssh_users"] and len(st["ssh_users"]) < 3:
                        st["ssh_users"].append(u)
                    continue
                m_fail = re.search(r"Failed\s+\S+\s+for\s+(?:invalid user\s+)?(\S+)\s+from", line)
                if m_fail:
                    st["ssh_fail"] += 1
                    u = m_fail.group(1)[:18]
                    if u not in st["ssh_users"] and len(st["ssh_users"]) < 3:
                        st["ssh_users"].append(u)
                    continue
                m_pre = re.search(r"(?:Disconnected from|Connection closed by)\s+(?:authenticating|invalid)\s+user\s+(\S+)", line)
                if m_pre:
                    st["ssh_preauth"] += 1
                    u = m_pre.group(1)[:18]
                    if u not in st["ssh_users"] and len(st["ssh_users"]) < 3:
                        st["ssh_users"].append(u)
                elif "Did not receive identification string" in line or "banner exchange" in line or "Unable to negotiate" in line:
                    st["ssh_preauth"] += 1

        # 3. Fail2Ban log (/var/log/fail2ban.log)
        for line in self._read_tail_lines(Path("/var/log/fail2ban.log"), 131072):
            matched_ip = None
            for ip in target_ips:
                if ip in line:
                    matched_ip = ip
                    break
            if matched_ip is None:
                continue
            st = stats[matched_ip]
            m_j = re.search(r"\[([a-zA-Z0-9_.-]+)\]\s+(Found|Ban)\s+", line)
            if m_j:
                st["f2b_jail"] = m_j.group(1)
                if m_j.group(2) == "Found":
                    st["f2b_found"] += 1

        # 4. UFW / Kernel firewall drop logs (/var/log/ufw.log, /var/log/kern.log)
        for fw_path in (Path("/var/log/ufw.log"), Path("/var/log/kern.log")):
            for line in self._read_tail_lines(fw_path, 131072):
                if "SRC=" not in line:
                    continue
                m_src = re.search(r"SRC=((?:\d{1,3}\.){3}\d{1,3})", line)
                if not m_src or m_src.group(1) not in stats:
                    continue
                st = stats[m_src.group(1)]
                st["ufw_hits"] += 1
                m_proto = re.search(r"PROTO=(\w+)", line)
                if m_proto:
                    st["ufw_protos"].add(m_proto.group(1))
                m_dpt = re.search(r"DPT=(\d+)", line)
                if m_dpt:
                    p = m_dpt.group(1)
                    if p not in st["ufw_ports"] and len(st["ufw_ports"]) < 4:
                        st["ufw_ports"].append(p)
                if " SYN " in line:
                    st["ufw_syn"] += 1

        # 5. Nginx WAF / rate-limit / scan logs
        for ngx_path in (Path("/var/log/nginx/error.log"), Path("/var/log/nginx/access.log")):
            for line in self._read_tail_lines(ngx_path, 98304):
                matched_ip = None
                for ip in target_ips:
                    if ip in line:
                        matched_ip = ip
                        break
                if matched_ip is None:
                    continue
                st = stats[matched_ip]
                if "limiting requests" in line or "limiting connections" in line or " 429 " in line:
                    st["nginx_429"] += 1
                    st["nginx_hits"] += 1
                elif " 403 " in line or " 404 " in line or " 401 " in line or "access forbidden" in line:
                    st["nginx_hits"] += 1
                m_req = re.search(r'"(?:GET|POST|HEAD|PUT|DELETE)\s+([^\s"?]+)', line)
                if m_req:
                    uri = m_req.group(1)[:28]
                    if uri not in st["nginx_paths"] and len(st["nginx_paths"]) < 3:
                        st["nginx_paths"].append(uri)

        # 6. SparrowX NetSec / XDP attack log (/var/log/sbs/attacks.log)
        for line in self._read_tail_lines(Path("/var/log/sbs/attacks.log"), 65536):
            matched_ip = None
            for ip in target_ips:
                if ip in line:
                    matched_ip = ip
                    break
            if matched_ip is None:
                continue
            clean = re.sub(r"\s+", " ", line.strip())
            stats[matched_ip]["sbs_msg"] = clean[-96:]

        # Synthesize crisp (reason, attempted) strings for each IP
        result: Dict[str, Dict[str, str]] = {}
        for ip, st in stats.items():
            reason_hint = ""
            attempted_parts: List[str] = []

            if st["manual_reason"]:
                reason_hint = st["manual_reason"]
            if st["manual_tried"]:
                attempted_parts.append(st["manual_tried"])

            ssh_total = st["ssh_fail"] + st["ssh_invalid"] + st["ssh_preauth"]
            if ssh_total > 0:
                users_s = f" ({', '.join(st['ssh_users'])})" if st["ssh_users"] else ""
                if st["ssh_fail"] > 0 and st["ssh_invalid"] > 0:
                    attempted_parts.append(f"{ssh_total}x SSH brute-force & invalid user{users_s} on :22")
                elif st["ssh_fail"] > 0:
                    attempted_parts.append(f"{st['ssh_fail']}x failed SSH password{users_s} on :22")
                elif st["ssh_invalid"] > 0:
                    attempted_parts.append(f"{st['ssh_invalid']}x invalid SSH user login{users_s} on :22")
                else:
                    attempted_parts.append(f"{st['ssh_preauth']}x SSH pre-auth/banner probe{users_s} on :22")
            elif st["f2b_found"] > 0:
                jail_lbl = st["f2b_jail"] or "sshd"
                attempted_parts.append(f"{st['f2b_found']}x auth/filter violations in {jail_lbl}")

            if st["ufw_hits"] > 0:
                protos = "/".join(sorted(st["ufw_protos"])) or "IP"
                ports = ",".join(f":{p}" for p in st["ufw_ports"]) if st["ufw_ports"] else "host"
                if st["ufw_syn"] >= 5:
                    attempted_parts.append(f"{st['ufw_syn']}x TCP SYN probes on {ports}")
                else:
                    attempted_parts.append(f"{st['ufw_hits']}x blocked {protos} probes on {ports}")

            if st["nginx_hits"] > 0:
                paths_s = f" ({', '.join(st['nginx_paths'][:2])})" if st["nginx_paths"] else ""
                if st["nginx_429"] > 0:
                    attempted_parts.append(f"{st['nginx_429']}x HTTP rate-limit/429 burst{paths_s}")
                else:
                    attempted_parts.append(f"{st['nginx_hits']}x HTTP/WAF probe{paths_s}")

            if st["sbs_msg"]:
                attempted_parts.append(st["sbs_msg"])

            result[ip] = {
                "reason": reason_hint,
                "attempted": " ; ".join(attempted_parts[:2]),
            }

        self._evidence_cache = result
        self._evidence_last_scan = now
        self._evidence_ip_sig = ip_sig
        return result

    def _enrich_blocked_entries(self, blocked: List[PolicyIpEntry], sync_geo: bool = False) -> None:
        if not blocked:
            return
        ips = [b.ip for b in blocked]
        evidence = self._scan_ban_evidence(set(ips)) if IS_LINUX else {}

        if sync_geo:
            self.geo_resolver.resolve_batch_sync(ips, timeout=2.5)

        for b in blocked:
            ev = evidence.get(b.ip, {})

            # 1. Human-readable Reason why it was banned
            if not b.reason:
                if ev.get("reason"):
                    b.reason = ev["reason"]
                elif b.source == "F2B":
                    b.reason = self._jail_to_reason(b.note)
                elif b.source == "XDP":
                    b.reason = f"XDP Wire-Speed Drop ({b.note})" if b.note else "XDP Wire-Speed Drop"
                elif b.source == "NFT":
                    b.reason = f"nftables Shield Blacklist ({b.note})" if b.note else "nftables Shield Blacklist"
                elif b.source == "UFW":
                    b.reason = f"UFW Firewall Block ({b.note})" if b.note else "UFW Firewall Block"
                else:
                    b.reason = b.note or "Security Policy Ban"

            # 2. What that IP tried to do
            if not b.attempted:
                if ev.get("attempted"):
                    b.attempted = ev["attempted"]
                elif b.source == "F2B":
                    j = b.note.strip().lower()
                    if "ssh" in j:
                        b.attempted = "Repeated failed SSH login / brute-force attempts on :22"
                    elif "nginx" in j or "http" in j:
                        b.attempted = "HTTP flood, scanner, or auth brute-force on :80/:443"
                    else:
                        b.attempted = f"Triggered Fail2Ban threshold in jail '{b.note}'"
                elif b.source == "XDP":
                    b.attempted = f"High-rate L3/L4 packet flood dropped at NIC ({b.note})"
                elif b.source == "NFT":
                    b.attempted = "Flagged by SparrowX Shield firewall blacklist"
                elif b.source == "UFW":
                    b.attempted = "Blocked inbound connection attempt via UFW DENY"
                else:
                    b.attempted = "Matched active SparrowX blocklist policy"

            # 3. IP Location (Country & Region) + ISP Info
            geo = self.geo_resolver.get_cached_or_queue(b.ip)
            b.country = geo.country
            b.country_code = geo.country_code
            b.region = geo.region
            b.city = geo.city
            b.isp = geo.isp
            b.asn = geo.asn
            b.geo_status = geo.status

    # -- Protected Downstream Servers, WireGuard Tunnels & Open Ports ----------

    def _collect_backends_and_ports(self) -> Tuple[List[ProtectedBackend], List[str]]:
        backends: List[ProtectedBackend] = []
        listening_ports: List[str] = []
        if not IS_LINUX:
            return backends, listening_ports

        now = time.monotonic()

        # 1. WireGuard tunnels (`wg show all dump`)
        if shutil.which("wg"):
            rc, out, _ = run_cmd(["wg", "show", "all", "dump"], timeout=1.2)
            if rc == 0:
                for line in out.splitlines():
                    cols = line.split("\t")
                    if len(cols) >= 8:
                        iface = cols[0]
                        endpoint = cols[3] if cols[3] != "(none)" else "awaiting"
                        allowed = cols[4].split(",")[0]
                        latest_hs = int(cols[5]) if cols[5].isdigit() else 0
                        rx_b = int(cols[6]) if cols[6].isdigit() else 0
                        tx_b = int(cols[7]) if cols[7].isdigit() else 0

                        rx_bps = 0.0
                        tx_bps = 0.0
                        key = f"{iface}:{allowed}"
                        prev = self._prev_wg_bytes.get(key)
                        if prev is not None:
                            dt = max(0.1, now - prev[0])
                            rx_bps = max(0.0, (rx_b - prev[1]) * 8.0 / dt)
                            tx_bps = max(0.0, (tx_b - prev[2]) * 8.0 / dt)
                        self._prev_wg_bytes[key] = (now, rx_b, tx_b)

                        age_sec = (int(time.time()) - latest_hs) if latest_hs > 0 else 999999
                        status = "PROTECTED" if (latest_hs > 0 and age_sec < 180) else ("IDLE" if latest_hs > 0 else "WAITING")

                        backends.append(
                            ProtectedBackend(
                                name=iface,
                                kind="WG-TUNNEL",
                                tunnel_ip=allowed,
                                endpoint=endpoint,
                                status=status,
                                rx_bytes=rx_b,
                                tx_bytes=tx_b,
                                rx_bps=rx_bps,
                                tx_bps=tx_bps,
                                handshake_age=fmt_age(latest_hs),
                            )
                        )

        # 2. nftables detroit_nat protected masquerade backend IPs
        if shutil.which("nft"):
            rc, out, _ = run_cmd(["nft", "list", "set", "ip", "detroit_nat", "postrouting_masq"], timeout=1.0)
            if rc == 0:
                existing_ips = {b.tunnel_ip.split("/")[0] for b in backends}
                for ip in re.findall(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", out):
                    if ip not in existing_ips:
                        backends.append(
                            ProtectedBackend(
                                name="detroit-nat",
                                kind="NAT-MASQ",
                                tunnel_ip=f"{ip}/32",
                                endpoint="nft-forward",
                                status="PROTECTED",
                            )
                        )
                        existing_ips.add(ip)

        # 3. Local Docker services
        if shutil.which("docker"):
            rc, out, _ = run_cmd(["docker", "ps", "--format", "{{.Names}}\t{{.Status}}\t{{.Ports}}"], timeout=1.2)
            if rc == 0:
                for line in out.splitlines():
                    parts = line.split("\t")
                    if len(parts) >= 2:
                        name = parts[0]
                        st_raw = parts[1]
                        ports = parts[2] if len(parts) > 2 else ""
                        m_port = re.search(r":(\d+)->", ports)
                        ep = f":{m_port.group(1)}" if m_port else "internal"
                        status = "PROTECTED" if st_raw.lower().startswith("up") else "DOWN"
                        backends.append(
                            ProtectedBackend(
                                name=name[:18],
                                kind="DOCKER",
                                tunnel_ip="127.0.0.1",
                                endpoint=ep,
                                status=status,
                                handshake_age=st_raw.replace("Up ", "")[:12],
                            )
                        )

        # 4. Registered Client VPS & Game Edge Proxies (/opt/sparrowx/clients/registry.json)
        #    Enrich with live packet/byte counters from `nft list chain ip sparrowx_edge_nat prerouting`
        edge_counters: Dict[str, Tuple[int, int]] = {}
        if shutil.which("nft"):
            rc_n, out_n, _ = run_cmd(["nft", "list", "chain", "ip", "sparrowx_edge_nat", "prerouting"], timeout=1.0)
            if rc_n == 0:
                for line in out_n.splitlines():
                    m_tag = re.search(r'comment\s+"spx_([^"]+)"', line)
                    m_cnt = re.search(r"packets\s+(\d+)\s+bytes\s+(\d+)", line)
                    if m_tag and m_cnt:
                        aid_key = m_tag.group(1)
                        prev_p, prev_b = edge_counters.get(aid_key, (0, 0))
                        edge_counters[aid_key] = (prev_p + int(m_cnt.group(1)), prev_b + int(m_cnt.group(2)))

        seen_agents: Set[str] = set()
        for reg_candidate in (
            Path("/opt/sparrowx/clients/registry.json"),
            Path("/opt/sparrowxdbs/data/client-vps-registry.json"),
        ):
            if not reg_candidate.exists():
                continue
            try:
                entries = json.loads(reg_candidate.read_text(encoding="utf-8"))
                if isinstance(entries, list):
                    for item in entries[:25]:
                        aid = str(item.get("agent_id") or item.get("agentId") or "")
                        if not aid or aid in seen_agents:
                            continue
                        seen_agents.add(aid)
                        uname = str(item.get("username") or aid)[:14]
                        kind_lbl = str(item.get("kind") or "CLIENT-VPS")[:9]
                        backend_ip = str(item.get("client_ip") or item.get("publicIp") or item.get("tunnel_ip") or "direct-edge")
                        edge_ports = str(item.get("edge_ports") or item.get("ports") or "")[:16]
                        pkts, nbytes = edge_counters.get(aid, (0, 0))
                        st_raw = str(item.get("status") or "PROVISIONED").upper()
                        st = "PROTECTED" if (st_raw == "PROTECTED" or pkts > 0) else "WAITING"
                        age_info = f"{fmt_count(pkts)}pkts/{fmt_bytes(nbytes)}" if pkts > 0 else (edge_ports or "ready")
                        backends.append(
                            ProtectedBackend(
                                name=uname,
                                kind=kind_lbl,
                                tunnel_ip=backend_ip,
                                endpoint=edge_ports or str(item.get("email") or "")[:18],
                                status=st,
                                rx_bytes=nbytes,
                                handshake_age=age_info,
                            )
                        )
            except (OSError, json.JSONDecodeError):
                pass

        # 5. Exposed listening ports (`ss -tuln`)
        rc, out, _ = run_cmd(["ss", "-tuln"], timeout=1.0)
        if rc == 0:
            ports_set: Set[str] = set()
            for line in out.splitlines()[1:]:
                cols = line.split()
                if len(cols) >= 5:
                    proto = cols[0].upper()[:3]
                    local = cols[4]
                    if local.startswith(("127.", "[::1]")):
                        continue
                    port = local.rsplit(":", 1)[-1]
                    if port.isdigit():
                        ports_set.add(f"{port}/{proto}")
            listening_ports = sorted(ports_set, key=lambda x: int(x.split("/")[0]))[:10]

        return backends, listening_ports

    # -- Live Active IP Connections (`ss -tunapn`) -----------------------------

    def _collect_connections(self) -> Tuple[List[RemoteTalker], int, int, int, int]:
        if not IS_LINUX:
            return [], 0, 0, 0, 0

        rc, out, _ = run_cmd(["ss", "-tunapn"], timeout=1.5)
        if rc != 0:
            rc, out, _ = run_cmd(["ss", "-tunan"], timeout=1.5)
        if rc != 0:
            return [], 0, 0, 0, 0

        agg: Dict[str, dict] = {}
        syn_total = 0
        tw_total = 0
        est_total = 0
        total_sockets = 0

        for line in out.splitlines()[1:]:
            parts = line.split()
            if len(parts) < 6:
                continue
            proto = parts[0].lower()
            state = parts[1].upper()
            local_addr = parts[4]
            peer_addr = parts[5]

            if state in ("LISTEN", "UNCONN"):
                continue

            total_sockets += 1
            if state == "SYN-RECV":
                syn_total += 1
            elif state == "TIME-WAIT":
                tw_total += 1
            elif state == "ESTAB":
                est_total += 1

            peer_ip = peer_addr
            if peer_ip.startswith("["):
                peer_ip = peer_ip.split("]")[0].lstrip("[")
            elif ":" in peer_ip:
                peer_ip = peer_ip.rsplit(":", 1)[0]
            peer_ip = peer_ip.replace("::ffff:", "")
            if peer_ip in ("*", "0.0.0.0", "::", "127.0.0.1", "::1", ""):
                continue

            local_port = local_addr.rsplit(":", 1)[-1] if ":" in local_addr else ""
            proc = "-"
            m_proc = re.search(r'users:\(\("([^"]+)"', line)
            if m_proc:
                proc = m_proc.group(1)

            entry = agg.get(peer_ip)
            if entry is None:
                entry = {"total": 0, "est": 0, "syn": 0, "tw": 0, "udp": 0, "ports": set(), "proc": proc}
                agg[peer_ip] = entry

            entry["total"] += 1
            if state == "ESTAB":
                entry["est"] += 1
            elif state == "SYN-RECV":
                entry["syn"] += 1
            elif state == "TIME-WAIT":
                entry["tw"] += 1
            if proto.startswith("udp"):
                entry["udp"] += 1
            if local_port and len(entry["ports"]) < 4:
                entry["ports"].add(local_port)
            if entry["proc"] == "-" and proc != "-":
                entry["proc"] = proc

        active_ssh_ips: Set[str] = set()
        for ip, info in agg.items():
            if info["est"] > 0 and (info["proc"] == "sshd" or "22" in info["ports"]):
                active_ssh_ips.add(ip)

        self.safe_guard.refresh_dynamic(active_ssh_ips=active_ssh_ips)

        # Track sustained strikes across ticks so 1-second legitimate spikes never flag as FLOOD
        active_ips = set(agg.keys())
        for stale_ip in [k for k in self._ip_strikes if k not in active_ips]:
            self._ip_strikes[stale_ip] -= 1
            if self._ip_strikes[stale_ip] <= 0:
                del self._ip_strikes[stale_ip]

        talkers: List[RemoteTalker] = []
        for ip, info in agg.items():
            geo = self.geo_resolver.get_cached_or_queue(ip) if is_valid_ipv4(ip) else None
            is_protected, category, safe_reason = self.safe_guard.classify(
                ip, geo=geo, extra_whitelisted=self._latest_whitelisted
            )
            if is_protected:
                self._ip_strikes.pop(ip, None)
                risk = category  # WHITELIST | ADMIN | INTERNAL | SERVICE | HOST | BACKEND
                score = 0
            else:
                prelim_score, _ = evaluate_talker_behavior(info, strike_count=0)
                if prelim_score >= 45:
                    self._ip_strikes[ip] = min(20, self._ip_strikes.get(ip, 0) + 1)
                else:
                    self._ip_strikes[ip] = max(0, self._ip_strikes.get(ip, 0) - 1)
                score, risk = evaluate_talker_behavior(
                    info,
                    strike_count=self._ip_strikes.get(ip, 0),
                    log_evidence=self._evidence_cache.get(ip),
                )

            ports_str = ",".join(sorted(info["ports"]))[:12] or "-"
            talkers.append(
                RemoteTalker(
                    ip=ip,
                    total_conns=info["total"],
                    established=info["est"],
                    syn_recv=info["syn"],
                    time_wait=info["tw"],
                    udp_conns=info["udp"],
                    ports=ports_str,
                    process=info["proc"][:10],
                    risk=risk,
                    threat_score=score,
                    safe_reason=safe_reason,
                )
            )

        talkers.sort(key=lambda t: (t.threat_score * 10 + t.syn_recv * 5 + t.total_conns), reverse=True)
        return talkers[:60], syn_total, tw_total, est_total, total_sockets

    # -- Live Multi-Source Security Log Tailer ---------------------------------

    LOG_SOURCES = [
        ("/var/log/sbs/attacks.log", "XDP", None),
        ("/var/log/fail2ban.log", "BAN", ("Ban ", "Unban ", "Found ")),
        ("/var/log/ufw.log", "DROP", ("[UFW BLOCK]", "[UFW AUDIT]")),
        ("/var/log/kern.log", "DROP", ("UFW BLOCK", "XDP", "SYN flooding", "nf_conntrack", "dropped")),
        ("/var/log/auth.log", "AUTH", ("Failed password", "Invalid user", "Disconnected from authenticating")),
        ("/var/log/nginx/error.log", "WAF", ("limiting requests", "limiting connections", "access forbidden", "429", "403")),
    ]

    def _prime_log_sources(self) -> None:
        if not IS_LINUX:
            return
        for path_str, tag, keywords in self.LOG_SOURCES:
            p = Path(path_str)
            if not p.exists():
                continue
            try:
                size = p.stat().st_size
                read_from = max(0, size - 8192)
                with open(p, "r", encoding="utf-8", errors="ignore") as f:
                    f.seek(read_from)
                    if read_from > 0:
                        f.readline()
                    tail_lines = f.readlines()[-12:]
                    self._log_offsets[path_str] = f.tell()
                for line in tail_lines:
                    self._ingest_log_line(tag, keywords, line)
            except OSError:
                pass

    def _poll_logs(self) -> None:
        if not IS_LINUX:
            return
        for path_str, tag, keywords in self.LOG_SOURCES:
            p = Path(path_str)
            if not p.exists():
                continue
            try:
                size = p.stat().st_size
                offset = self._log_offsets.get(path_str, size)
                if size < offset:
                    offset = 0
                if size == offset:
                    continue
                with open(p, "r", encoding="utf-8", errors="ignore") as f:
                    f.seek(offset)
                    chunk = f.read(16384)
                    self._log_offsets[path_str] = f.tell()
                for line in chunk.splitlines():
                    self._ingest_log_line(tag, keywords, line)
            except OSError:
                pass

    def _ingest_log_line(self, tag: str, keywords: Optional[Tuple[str, ...]], line: str) -> None:
        text = line.strip()
        if not text:
            return
        if keywords is not None and not any(k in text for k in keywords):
            return
        ts = datetime.datetime.now().strftime("%H:%M:%S")
        m_ts = re.search(r"(\d{2}:\d{2}:\d{2})", text)
        if m_ts:
            ts = m_ts.group(1)
        clean = re.sub(r"\s+", " ", text)
        self.log_buffer.append(LogEvent(ts=ts, tag=tag, message=clean[:180]))

    # -- Interactive Mitigation & Whitelist Actions ----------------------------

    def _persist_ip_line(self, file_path: Path, ip: str, comment: str = "") -> bool:
        try:
            file_path.parent.mkdir(parents=True, exist_ok=True)
            lines = file_path.read_text(encoding="utf-8", errors="ignore").splitlines() if file_path.exists() else []
            existing = {ln.split("#", 1)[0].strip() for ln in lines}
            if ip not in existing:
                entry = f"{ip}  # {comment}" if comment else ip
                with open(file_path, "a", encoding="utf-8") as f:
                    f.write(f"{entry}\n")
            return True
        except OSError:
            return False

    def _remove_ip_line(self, file_path: Path, ip: str) -> bool:
        if not file_path.exists():
            return False
        try:
            lines = file_path.read_text(encoding="utf-8", errors="ignore").splitlines()
            kept = [ln for ln in lines if ln.split("#", 1)[0].strip() != ip]
            if len(kept) != len(lines):
                file_path.write_text("\n".join(kept) + ("\n" if kept else ""), encoding="utf-8")
                return True
        except OSError:
            pass
        return False

    def cycle_autoguard(self) -> str:
        idx = (AUTOGUARD_MODES.index(self.autoguard_mode) + 1) % len(AUTOGUARD_MODES)
        self.autoguard_mode = AUTOGUARD_MODES[idx]
        desc = {
            "monitor": "MONITOR (Smart threat scoring + advisory only — zero auto-bans)",
            "protect": "PROTECT (Zero-FP auto-mitigation: 30m temp-ban on score>=85 x4 ticks, Safe-Guard enforced)",
            "off": "OFF (Manual NOC control only)",
        }[self.autoguard_mode]
        msg = f"Auto-Guard switched to {desc}"
        self.push_event("SAFE", msg)
        self.discord.send_embed(
            title=f"⚙️ Auto-Guard Mode Changed -> {self.autoguard_mode.upper()}",
            description=desc,
            color=DiscordWebhookNotifier.COLOR_PURPLE,
            fields=[("Host", f"`{socket.gethostname()}`", True), ("Mode", f"`{self.autoguard_mode.upper()}`", True)],
            dedup_key=f"autoguard:{self.autoguard_mode}",
            cooldown_sec=5.0,
        )
        return msg

    def _evaluate_smart_defense(
        self,
        talkers: List[RemoteTalker],
        filtration: FiltrationStats,
        blocked_set: Set[str],
        whitelisted_set: Set[str],
    ) -> None:
        """
        Smart zero-false-positive defense loop:
          1. Automatically expires temporary auto-bans after AUTO_BAN_TTL_SEC (30m)
          2. Auto-hysteresis for Strict-SYN mode (requires 3 sustained attack ticks to engage
             and >= 60s cooldown + 5 quiet ticks to relax — eliminates flapping)
          3. In PROTECT mode, auto-mitigates ONLY non-protected PUBLIC attackers with
             threat_score >= 85 sustained for >= 4 consecutive ticks
        """
        now_epoch = time.time()
        now_mono = time.monotonic()

        # 1. Expire any temporary auto-bans whose 30m TTL has elapsed
        expired = [ip for ip, exp in self._auto_bans.items() if now_epoch >= exp]
        for ip in expired:
            self._auto_bans.pop(ip, None)
            self.unban_ip(ip, silent=True)
            self.push_event("SAFE", f"Auto-ban expired (30m TTL) -> unbanned {ip}")

        if self.autoguard_mode == "off":
            return

        # 2. Strict-SYN hysteresis (only auto-adjust in PROTECT mode; never flap!)
        if self.autoguard_mode == "protect" and IS_LINUX and not self.demo:
            under_syn_pressure = filtration.syn_recv_count >= 60 or filtration.xdp_drop_pps >= 2000
            if under_syn_pressure:
                self._strict_high_ticks += 1
                self._strict_low_ticks = 0
                if (
                    self._strict_high_ticks >= 3
                    and not filtration.strict_mode
                    and (now_mono - self._last_strict_toggle_mono) >= STRICT_SYN_COOLDOWN_SEC
                ):
                    self.toggle_strict_mode(force_enable=True, auto=True)
                    self._strict_auto_engaged = True
            else:
                self._strict_high_ticks = 0
                if self._strict_auto_engaged and filtration.strict_mode:
                    self._strict_low_ticks += 1
                    if (
                        self._strict_low_ticks >= 5
                        and (now_mono - self._last_strict_toggle_mono) >= STRICT_SYN_COOLDOWN_SEC
                    ):
                        self.toggle_strict_mode(force_enable=False, auto=True)
                        self._strict_auto_engaged = False
                        self._strict_low_ticks = 0

        # 3. Per-IP confirmed sustained attacker check
        for tk in talkers:
            if tk.ip in blocked_set or tk.ip in whitelisted_set:
                continue
            if tk.risk != "FLOOD" or tk.threat_score < 85:
                continue
            strikes = self._ip_strikes.get(tk.ip, 0)
            if strikes < 4:
                continue

            # Double-check SafeIpGuard with latest GeoIP/ASN before touching ANY IP
            geo = self.geo_resolver.get_cached_or_queue(tk.ip)
            is_prot, cat, why = self.safe_guard.classify(tk.ip, geo=geo, extra_whitelisted=whitelisted_set)
            if is_prot:
                self.push_event("SAFE", f"Protected {tk.ip} [{cat}] from auto-mitigation ({why})")
                continue

            if self.autoguard_mode == "protect":
                reason = f"Smart Auto-Guard (Score {tk.threat_score}/100, {strikes}x sustained)"
                attempted = f"Sustained flood: SYN:{tk.syn_recv} EST:{tk.established} TOT:{tk.total_conns} on :{tk.ports}"
                res = self.ban_ip(tk.ip, reason=reason, attempted=attempted)
                if res.startswith("BANNED") or res.startswith("[DEMO] Banned"):
                    self._auto_bans[tk.ip] = now_epoch + AUTO_BAN_TTL_SEC
                    blocked_set.add(tk.ip)
                    self.push_event("SAFE", f"Auto-mitigated {tk.ip} for 30m (score={tk.threat_score}, strikes={strikes})")
            elif self.autoguard_mode == "monitor" and strikes == 4:
                self.push_event(
                    "SAFE",
                    f"Advisory: {tk.ip} sustained score={tk.threat_score}/100 (SYN:{tk.syn_recv} EST:{tk.established}) — press [b] to ban or [a] for PROTECT",
                )

    def ban_ip(self, ip: str, reason: str = "", attempted: str = "", force: bool = False) -> str:
        ip = ip.strip()
        if not is_valid_ipv4(ip):
            msg = f"Invalid IPv4 address: {ip}"
            self.push_event("SYS", msg)
            return msg

        # HARD SAFE-GUARD: Never ban internal/Docker/WireGuard, admin SSH, host/gateway, DNS, Cloudflare, or backends!
        if not force:
            geo = self.geo_resolver.get_cached_or_queue(ip)
            is_prot, cat, why = self.safe_guard.classify(
                ip, geo=geo, extra_whitelisted=self._latest_whitelisted
            )
            if is_prot:
                msg = f"SAFEGUARD REFUSED ban of {ip} [{cat}]: {why}"
                self.push_event("SAFE", msg)
                return msg

        ban_reason = reason.strip() or "Manual NOC Operator Ban"
        ban_tried = attempted.strip() or "Manually blocked via SparrowX Master NOC"

        if self.demo:
            self._demo_whitelisted = [w for w in self._demo_whitelisted if w.ip != ip]
            if not any(b.ip == ip for b in self._demo_banned):
                self._demo_banned.insert(
                    0,
                    PolicyIpEntry(
                        ip=ip,
                        source="XDP",
                        note="manual ban",
                        reason=ban_reason,
                        attempted=ban_tried,
                        country="Unknown",
                        country_code="??",
                        region="Operator Action",
                        isp="Manual Block",
                        geo_status="ok",
                    ),
                )
            msg = f"[DEMO] Banned {ip} across XDP + nftables + UFW"
            self.push_event("BAN", msg)
            return msg

        applied: List[str] = []
        if shutil.which("bpftool"):
            hex_key = [f"{int(oct_):02x}" for oct_ in ip.split(".")]
            epoch_hex = [f"{b:02x}" for b in struct.pack("<Q", int(time.time()))]
            for map_name in ("blocked_ipv4", "sparrowx_blacklist"):
                rc, _, _ = run_cmd(
                    ["bpftool", "map", "update", "name", map_name, "key", "hex", *hex_key, "value", "hex", *epoch_hex],
                    timeout=1.5,
                )
                if rc == 0:
                    applied.append(f"XDP:{map_name}")

        if shutil.which("nft"):
            rc, _, _ = run_cmd(["nft", "add", "element", "inet", "sparrowx_shield", "blacklist", f"{{ {ip} }}"], timeout=1.5)
            if rc == 0:
                applied.append("nft")

        if shutil.which("ufw"):
            rc, _, _ = run_cmd(["ufw", "insert", "1", "deny", "from", ip, "to", "any"], timeout=2.0)
            if rc == 0:
                applied.append("ufw")
        elif shutil.which("iptables"):
            rc, _, _ = run_cmd(["iptables", "-I", "INPUT", "1", "-s", ip, "-j", "DROP"], timeout=1.5)
            if rc == 0:
                applied.append("iptables")

        if self._persist_ip_line(BLOCKLIST_FILE, ip, f"{ban_reason} | {ban_tried}"):
            applied.append("file")

        self._evidence_last_scan = 0.0

        if applied:
            msg = f"BANNED {ip} -> [{', '.join(applied)}]"
            self.push_event("BAN", msg)
            geo = self.geo_resolver.get_cached_or_queue(ip)
            geo_loc = ", ".join(p for p in (geo.city, geo.country) if p) if geo and geo.geo_status == "ok" else "Resolving..."
            geo_isp = f"{geo.isp} ({geo.asn})" if geo and geo.isp else "Unknown"
            self._discord_seen_blocked.add(ip)
            self.discord.send_embed(
                title=f"⛔ IP Banned: {ip}",
                description=ban_reason,
                color=DiscordWebhookNotifier.COLOR_RED,
                fields=[
                    ("Target IP", f"`{ip}`", True),
                    ("Layers Applied", f"`{', '.join(applied)}`", True),
                    ("Attempted Activity", ban_tried, False),
                    ("Location / ISP", f"{geo_loc} · {geo_isp}", False),
                ],
                dedup_key=f"ban:{ip}",
                cooldown_sec=60.0,
            )
            return msg
        msg = f"Ban failed for {ip} (run with sudo/root privileges)"
        self.push_event("SYS", msg)
        return msg

    def unban_ip(self, ip: str, silent: bool = False) -> str:
        ip = ip.strip()
        if not is_valid_ipv4(ip):
            msg = f"Invalid IPv4 address: {ip}"
            if not silent:
                self.push_event("SYS", msg)
            return msg

        if self.demo:
            self._demo_banned = [b for b in self._demo_banned if b.ip != ip]
            msg = f"[DEMO] Unbanned {ip} from all blocklists"
            if not silent:
                self.push_event("SYS", msg)
            return msg

        removed: List[str] = []
        if shutil.which("bpftool"):
            hex_key = [f"{int(oct_):02x}" for oct_ in ip.split(".")]
            for map_name in ("blocked_ipv4", "sparrowx_blacklist"):
                rc, _, _ = run_cmd(["bpftool", "map", "delete", "name", map_name, "key", "hex", *hex_key], timeout=1.5)
                if rc == 0:
                    removed.append(f"XDP:{map_name}")

        if shutil.which("nft"):
            rc, _, _ = run_cmd(["nft", "delete", "element", "inet", "sparrowx_shield", "blacklist", f"{{ {ip} }}"], timeout=1.5)
            if rc == 0:
                removed.append("nft")

        if shutil.which("ufw"):
            rc, _, _ = run_cmd(["ufw", "delete", "deny", "from", ip, "to", "any"], timeout=2.0)
            if rc == 0:
                removed.append("ufw")

        if shutil.which("fail2ban-client"):
            rc, _, _ = run_cmd(["fail2ban-client", "unban", ip], timeout=1.5)
            if rc == 0:
                removed.append("fail2ban")

        if self._remove_ip_line(BLOCKLIST_FILE, ip):
            removed.append("file")

        msg = f"UNBANNED {ip} <- [{', '.join(removed)}]" if removed else f"No active ban found for {ip}"
        if not silent:
            self.push_event("SYS", msg)
            if removed:
                self._discord_seen_blocked.discard(ip)
                self.discord.send_embed(
                    title=f"✅ IP Unbanned: {ip}",
                    description=msg,
                    color=DiscordWebhookNotifier.COLOR_GREEN,
                    fields=[("IP", f"`{ip}`", True), ("Cleared From", f"`{', '.join(removed)}`", True)],
                    dedup_key=f"unban:{ip}",
                    cooldown_sec=10.0,
                )
        return msg

    def whitelist_ip(self, ip: str, note: str = "trusted") -> str:
        ip = ip.strip()
        if not is_valid_ipv4(ip):
            msg = f"Invalid IPv4 address: {ip}"
            self.push_event("SYS", msg)
            return msg

        if self.demo:
            self._demo_banned = [b for b in self._demo_banned if b.ip != ip]
            if not any(w.ip == ip for w in self._demo_whitelisted):
                self._demo_whitelisted.insert(0, PolicyIpEntry(ip, "XDP", f"XDP_PASS ({note})"))
            msg = f"[DEMO] Whitelisted {ip} across XDP + nftables + UFW"
            self.push_event("WHT", msg)
            return msg

        # Clear any existing ban on this IP first
        self.unban_ip(ip, silent=True)

        applied: List[str] = []
        # 1. Inject into XDP static_whitelist (permanent) & dynamic whitelist maps
        if shutil.which("bpftool"):
            hex_key = [f"{int(oct_):02x}" for oct_ in ip.split(".")]
            epoch_hex = [f"{b:02x}" for b in struct.pack("<Q", int(time.time()))]
            rc_s, _, _ = run_cmd(
                ["bpftool", "map", "update", "name", "static_whitelist", "key", "hex", *hex_key, "value", "hex", *epoch_hex],
                timeout=1.5,
            )
            if rc_s == 0:
                applied.append("XDP:static_wl")
            ts_ns_hex = [f"{b:02x}" for b in struct.pack("<Q", 0)]  # 0 = never-expiring entry
            rc, _, _ = run_cmd(
                ["bpftool", "map", "update", "name", "whitelist", "key", "hex", *hex_key, "value", "hex", *ts_ns_hex],
                timeout=1.5,
            )
            if rc == 0:
                applied.append("XDP:whitelist")

        # 1b. Also add IP to Fail2Ban ignoreip on active jails so F2B never re-bans a whitelisted user
        if shutil.which("fail2ban-client"):
            rc_f, out_f, _ = run_cmd(["fail2ban-client", "status"], timeout=1.0)
            if rc_f == 0:
                m_j = re.search(r"Jail list:\s*(.+)", out_f)
                if m_j:
                    jails = [j.strip() for j in m_j.group(1).split(",") if j.strip()]
                    f2b_added = False
                    for jail in jails[:8]:
                        rc_i, _, _ = run_cmd(["fail2ban-client", "set", jail, "addignoreip", ip], timeout=1.0)
                        if rc_i == 0:
                            f2b_added = True
                    if f2b_added:
                        applied.append("fail2ban:ignore")

        # 2. nftables whitelist set (auto-create set if table exists)
        if shutil.which("nft"):
            rc_t, _, _ = run_cmd(["nft", "list", "table", "inet", "sparrowx_shield"], timeout=1.0)
            if rc_t == 0:
                run_cmd(
                    ["nft", "add", "set", "inet", "sparrowx_shield", "whitelist", "{ type ipv4_addr; }"],
                    timeout=1.0,
                )
                rc, _, _ = run_cmd(
                    ["nft", "add", "element", "inet", "sparrowx_shield", "whitelist", f"{{ {ip} }}"],
                    timeout=1.2,
                )
                if rc == 0:
                    applied.append("nft")

        # 3. UFW ALLOW IN rule at priority 1
        if shutil.which("ufw"):
            rc, _, _ = run_cmd(["ufw", "insert", "1", "allow", "from", ip, "to", "any"], timeout=2.0)
            if rc == 0:
                applied.append("ufw")
        elif shutil.which("iptables"):
            rc, _, _ = run_cmd(["iptables", "-I", "INPUT", "1", "-s", ip, "-j", "ACCEPT"], timeout=1.5)
            if rc == 0:
                applied.append("iptables")

        # 4. Persist to /opt/sparrowx/xdp/whitelist_ipv4.txt
        if self._persist_ip_line(WHITELIST_FILE, ip, note):
            applied.append("file")

        if applied:
            msg = f"WHITELISTED {ip} -> [{', '.join(applied)}]"
            self.push_event("WHT", msg)
            self.discord.send_embed(
                title=f"🟢 IP Whitelisted: {ip}",
                description=f"Added to bypass maps ({note}).",
                color=DiscordWebhookNotifier.COLOR_GREEN,
                fields=[("IP", f"`{ip}`", True), ("Layers", f"`{', '.join(applied)}`", True)],
                dedup_key=f"wl:{ip}",
                cooldown_sec=10.0,
            )
            return msg
        msg = f"Whitelist failed for {ip} (run with sudo/root privileges)"
        self.push_event("SYS", msg)
        return msg

    def unwhitelist_ip(self, ip: str, silent: bool = False) -> str:
        ip = ip.strip()
        if not is_valid_ipv4(ip):
            msg = f"Invalid IPv4 address: {ip}"
            if not silent:
                self.push_event("SYS", msg)
            return msg

        if self.demo:
            self._demo_whitelisted = [w for w in self._demo_whitelisted if w.ip != ip]
            msg = f"[DEMO] Removed {ip} from whitelist"
            if not silent:
                self.push_event("WHT", msg)
            return msg

        removed: List[str] = []
        if shutil.which("bpftool"):
            hex_key = [f"{int(oct_):02x}" for oct_ in ip.split(".")]
            for wl_map in ("static_whitelist", "whitelist"):
                rc, _, _ = run_cmd(["bpftool", "map", "delete", "name", wl_map, "key", "hex", *hex_key], timeout=1.5)
                if rc == 0:
                    removed.append(f"XDP:{wl_map}")

        if shutil.which("nft"):
            rc, _, _ = run_cmd(["nft", "delete", "element", "inet", "sparrowx_shield", "whitelist", f"{{ {ip} }}"], timeout=1.2)
            if rc == 0:
                removed.append("nft")

        if shutil.which("ufw"):
            rc, _, _ = run_cmd(["ufw", "delete", "allow", "from", ip, "to", "any"], timeout=2.0)
            if rc == 0:
                removed.append("ufw")

        if self._remove_ip_line(WHITELIST_FILE, ip):
            removed.append("file")

        msg = f"UN-WHITELISTED {ip} <- [{', '.join(removed)}]" if removed else f"No whitelist entry found for {ip}"
        if not silent:
            self.push_event("WHT", msg)
        return msg

    def toggle_strict_mode(self, force_enable: Optional[bool] = None, auto: bool = False) -> str:
        now_mono = time.monotonic()
        if not auto and (now_mono - self._last_strict_toggle_mono) < STRICT_MANUAL_DEBOUNCE_SEC:
            return "Strict SYN toggle debounced (wait 1.5s to prevent rapid flapping)"

        if self.demo:
            self._demo_strict = (not self._demo_strict) if force_enable is None else bool(force_enable)
            self._last_strict_toggle_mono = now_mono
            state = "ENABLED" if self._demo_strict else "DISABLED"
            msg = f"[DEMO] Under-Attack Strict Mitigation {state}"
            self.push_event("XDP", msg)
            return msg

        if not IS_LINUX:
            return "Strict mode requires Linux root"

        currently_strict = False
        try:
            currently_strict = int(Path("/proc/sys/net/ipv4/tcp_synack_retries").read_text().strip()) <= 2
        except (OSError, ValueError):
            pass

        want_strict = (not currently_strict) if force_enable is None else bool(force_enable)
        if want_strict == currently_strict:
            return "Strict SYN mode already in requested state"

        prefix = "[AUTO] " if auto else ""
        if want_strict:
            cmds = [
                ["sysctl", "-w", "net.ipv4.tcp_syncookies=1"],
                ["sysctl", "-w", "net.ipv4.tcp_synack_retries=2"],
                ["sysctl", "-w", "net.ipv4.tcp_max_syn_backlog=16384"],
            ]
            ok = all(run_cmd(c, timeout=1.0)[0] == 0 for c in cmds)
            msg = (
                f"{prefix}UNDER-ATTACK STRICT MODE ENABLED (SYN cookies + backlog=16384)"
                if ok
                else "Strict mode toggle requires root privileges (sudo sparrowx-noc)"
            )
        else:
            cmds = [
                ["sysctl", "-w", "net.ipv4.tcp_synack_retries=5"],
                ["sysctl", "-w", "net.ipv4.tcp_max_syn_backlog=4096"],
            ]
            ok = all(run_cmd(c, timeout=1.0)[0] == 0 for c in cmds)
            msg = (
                f"{prefix}Strict mode relaxed to standard SYN backlog profile"
                if ok
                else "Strict mode toggle requires root privileges"
            )
        if ok:
            self._last_strict_toggle_mono = now_mono
            if not auto:
                self._strict_auto_engaged = False
            self.discord.send_embed(
                title=f"⚡ Strict-SYN Mitigation {'ENABLED' if want_strict else 'RELAXED'}",
                description=msg,
                color=DiscordWebhookNotifier.COLOR_ORANGE if want_strict else DiscordWebhookNotifier.COLOR_GREEN,
                fields=[
                    ("Host", f"`{socket.gethostname()}`", True),
                    ("Trigger", "Auto-Guard" if auto else "Manual Operator", True),
                ],
                dedup_key=f"strict:{want_strict}",
                cooldown_sec=15.0,
            )
        self.push_event("XDP", msg)
        return msg

    # -- Opt-In Demo Telemetry (Only used when --demo is passed) ---------------

    def _seed_demo_logs(self) -> None:
        samples = [
            ("XDP", "eBPF sparrowx_xdp_ddos attached NATIVE on enp1s0f0 (prog id 42) — wire-speed scrubbing active"),
            ("WHT", "Whitelisted 51.79.142.18 & 139.99.84.201 in XDP fast-path + nft sparrowx_shield"),
            ("WG", "Tunnel spx_8f12a09c (10.66.0.2/32) handshake OK — routing clean L4/L7 traffic to origin"),
            ("DROP", "XDP_DROP UDP amplification burst src=185.220.101.42 dport=53 rate=41.2 kpps"),
            ("XDP", "SPX1 Challenge-Cookie sent via XDP_TX to 45.155.205.91:49102 (unverified UDP)"),
            ("BAN", "Auto-synced 185.220.101.42 -> XDP blocked_ipv4 + nft inet sparrowx_shield blacklist"),
            ("WAF", "nginx limit_req 429 dropped 312 req/s burst on infra.sparrowx.net from 194.26.135.88"),
            ("DROP", "SYN flood spike detected src=45.155.205.91 syn_recv=34 — SYN cookies enforcing"),
        ]
        now = datetime.datetime.now()
        for i, (tag, msg) in enumerate(samples):
            ts = (now - datetime.timedelta(seconds=(len(samples) - i) * 3)).strftime("%H:%M:%S")
            self.log_buffer.append(LogEvent(ts=ts, tag=tag, message=msg))

    def _collect_demo(self) -> DashboardSnapshot:
        import math

        self._demo_tick += 1
        t = self._demo_tick
        wave = 0.65 + 0.35 * math.sin(t * 0.6)
        rx_bps = 380_000_000 + 240_000_000 * wave
        tx_bps = 110_000_000 + 45_000_000 * math.cos(t * 0.4)
        self._peak_rx_bps = max(self._peak_rx_bps, rx_bps)
        self._peak_tx_bps = max(self._peak_tx_bps, tx_bps)
        self.rx_history.append(rx_bps)
        self.tx_history.append(tx_bps)

        if t % 3 == 0:
            self.push_event(
                "XDP",
                f"XDP_DROP scrubbed {int(32000 + 8000 * wave)} invalid UDP/SYN pkts/s on enp1s0f0 -> clean forward",
            )

        wl_set = {w.ip for w in self._demo_whitelisted}
        bl_set = {b.ip for b in self._demo_banned}

        host = HostStats(
            hostname="ovh-edge-01.sparrowx.net",
            kernel="6.8.0-49-generic",
            is_root=True,
            cpu_pct=18.4 + 4.2 * wave,
            cpu_cores=16,
            mem_used_gb=6.8,
            mem_total_gb=32.0,
            mem_pct=21.2,
            load_1m=1.42,
            load_5m=1.18,
            load_15m=0.94,
            uptime_str="42d 11h 08m",
        )
        nic = NicStats(
            iface=self.active_iface or "enp1s0f0",
            ipv4="51.79.210.44",
            link_speed="10GbE",
            available_ifaces=["enp1s0f0", "spx_8f12a09c", "spx_3b90e411", "docker0"],
            rx_bps=rx_bps,
            tx_bps=tx_bps,
            peak_rx_bps=self._peak_rx_bps,
            peak_tx_bps=self._peak_tx_bps,
            rx_pps=64200 + 18500 * wave,
            tx_pps=21400 + 4100 * wave,
            rx_drop_ps=38400 + 9200 * wave,
            tx_drop_ps=0.0,
            rx_bytes_total=842_910_234_112 + t * 50_000_000,
            tx_bytes_total=319_482_118_904 + t * 18_000_000,
            rx_drops_total=14_820_441 + t * 38000,
            tx_drops_total=0,
            rx_history=list(self.rx_history),
            tx_history=list(self.tx_history),
        )
        filt = FiltrationStats(
            xdp_attached=True,
            xdp_mode="NATIVE",
            xdp_prog_id="42",
            xdp_passed=98_412_300 + t * 24000,
            xdp_challenged=1_842_110 + t * 1200,
            xdp_dropped=14_820_441 + t * 38000,
            xdp_whitelisted=412_900 + t * 40,
            xdp_drop_pps=38400 + 9200 * wave,
            nft_drops=284_912 + t * 110,
            iptables_drops=41_205,
            conntrack_count=18_420,
            conntrack_max=524_288,
            syn_recv_count=62 if wave > 0.7 else 19,
            time_wait_count=214,
            established_count=1_482,
            total_sockets=1_758,
            tcp_retrans_ps=14.2,
            udp_in_ps=48_200.0,
            udp_err_ps=124.0,
            icmp_in_ps=8.5,
            fail2ban_jails=4,
            fail2ban_banned=len(self._demo_banned) + 12,
            ufw_active=True,
            strict_mode=self._demo_strict,
            threat_level="UNDER ATTACK" if wave > 0.7 else "ELEVATED",
        )
        backends = [
            ProtectedBackend("spx_8f12a09c", "WG-TUNNEL", "10.66.0.2/32", "51.79.142.18:51820", "PROTECTED", 48_210_000_000, 19_400_000_000, 62_000_000, 28_000_000, "14s ago"),
            ProtectedBackend("spx_3b90e411", "WG-TUNNEL", "10.66.0.6/32", "139.99.84.201:51821", "PROTECTED", 22_900_000_000, 11_800_000_000, 34_000_000, 19_000_000, "9s ago"),
            ProtectedBackend("spx_9c44d710", "WG-TUNNEL", "10.66.0.10/32", "145.239.61.99:51822", "PROTECTED", 9_150_000_000, 4_200_000_000, 14_500_000, 6_200_000, "21s ago"),
            ProtectedBackend("sparrowx-nginx", "DOCKER", "127.0.0.1", ":443", "PROTECTED", handshake_age="14d"),
            ProtectedBackend("sparrowx-app", "DOCKER", "127.0.0.1", ":3000", "PROTECTED", handshake_age="14d"),
            ProtectedBackend("sparrowx-netsec", "DOCKER", "127.0.0.1", ":8090", "PROTECTED", handshake_age="14d"),
        ]
        raw_talkers = [
            RemoteTalker("45.155.205.91", 74, 2, 34, 14, 38, "443,51820", "nginx", "FLOOD"),
            RemoteTalker("185.220.101.42", 52, 0, 19, 8, 33, "53,28015", "kernel", "FLOOD"),
            RemoteTalker("194.26.135.88", 29, 18, 4, 7, 0, "443,80", "nginx", "WARN"),
            RemoteTalker("51.79.142.18", 12, 12, 0, 0, 1, "51820,443", "wg", "OK"),
            RemoteTalker("139.99.84.201", 9, 9, 0, 0, 1, "51821,443", "wg", "OK"),
            RemoteTalker("172.69.34.102", 6, 6, 0, 0, 0, "443", "nginx", "OK"),
        ]
        for tk in raw_talkers:
            if tk.ip in wl_set:
                tk.risk = "WHITELIST"
            elif tk.ip in bl_set and tk.risk != "FLOOD":
                tk.risk = "BLOCKED"

        return DashboardSnapshot(
            timestamp=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            host=host,
            nic=nic,
            filtration=filt,
            backends=backends,
            listening_ports=["22/TCP", "80/TCP", "443/TCP", "51820/UDP", "51821/UDP", "28015/UDP"],
            talkers=raw_talkers,
            blocked_ips=list(self._demo_banned),
            whitelisted_ips=list(self._demo_whitelisted),
            logs=list(self.log_buffer),
            demo_mode=True,
        )

    # -- Master Collect Tick ---------------------------------------------------

    def collect(self, sync_geo: bool = False) -> DashboardSnapshot:
        if self.demo:
            return self._collect_demo()

        host = self._collect_host()
        nic = self._collect_nic()
        backends, listening_ports = self._collect_backends_and_ports()
        self.safe_guard.refresh_dynamic(backends=backends)
        talkers, syn_recv, time_wait, established, total_sockets = self._collect_connections()
        filtration, blocked, whitelisted = self._collect_filtration_and_policies(
            syn_recv=syn_recv,
            time_wait=time_wait,
            established=established,
            total_sockets=total_sockets,
        )
        # Enrich every blocklisted IP with ban reason, attempted activity, and GeoIP/ISP
        self._enrich_blocked_entries(blocked, sync_geo=sync_geo)

        # Cross-tag remote talkers with live WHITELIST / BLOCKED / SAFE-GUARD status
        wl_set = {w.ip for w in whitelisted}
        self._latest_whitelisted = wl_set
        bl_set = {b.ip for b in blocked}
        for tk in talkers:
            if tk.ip in wl_set:
                tk.risk = "WHITELIST"
                tk.threat_score = 0
            elif tk.ip in bl_set and tk.risk not in ("FLOOD", "ADMIN", "INTERNAL", "HOST", "SERVICE", "BACKEND"):
                tk.risk = "BLOCKED"

        # Run smart zero-FP defense evaluation (TTL expiry, Strict-SYN hysteresis, sustained-attack guard)
        self._evaluate_smart_defense(talkers, filtration, bl_set, wl_set)
        filtration.autoguard_mode = self.autoguard_mode
        filtration.safeguard_protected = self.safe_guard.total_dynamic_protected + len(wl_set)
        filtration.auto_banned_active = len(self._auto_bans)

        self._poll_logs()

        snap = DashboardSnapshot(
            timestamp=datetime.datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            host=host,
            nic=nic,
            filtration=filtration,
            backends=backends,
            listening_ports=listening_ports,
            talkers=talkers,
            blocked_ips=blocked,
            whitelisted_ips=whitelisted,
            logs=list(self.log_buffer),
            demo_mode=False,
        )
        self._last_snapshot = snap
        self._process_discord_telemetry(snap)
        return snap

    def _process_discord_telemetry(self, snap: DashboardSnapshot) -> None:
        """Detect live threat transitions, new Fail2Ban/XDP bans, and periodic digests."""
        if not self.discord.enabled or snap.demo_mode:
            return

        current_blocked = {b.ip: b for b in snap.blocked_ips}
        threat = snap.filtration.threat_level

        # First tick: record baseline so startup doesn't replay pre-existing bans
        if not self._discord_baseline_ready:
            self._discord_baseline_ready = True
            self._discord_seen_blocked = set(current_blocked.keys())
            self._discord_last_threat = threat
            self._discord_last_digest_mono = time.monotonic()
            return

        # 1. Threat level escalation or recovery
        if threat != self._discord_last_threat:
            prev_threat = self._discord_last_threat
            self._discord_last_threat = threat
            if threat == "UNDER ATTACK":
                top_talkers = ", ".join(
                    f"{t.ip} ({t.total_conns}c/{t.risk})" for t in snap.talkers[:4]
                ) or "None"
                self.discord.send_embed(
                    title=f"🚨 UNDER ATTACK DETECTED on {snap.host.hostname}",
                    description=f"Threat escalated from `{prev_threat}` -> **`UNDER ATTACK`** on `{snap.nic.iface}`.",
                    color=DiscordWebhookNotifier.COLOR_RED,
                    content="**URGENT: SPARROWX NOC UNDER ATTACK ALERT**",
                    fields=[
                        ("Ingress (RX)", f"{fmt_bps(snap.nic.rx_bps)} ({fmt_pps(snap.nic.rx_pps)})", True),
                        ("XDP Drop Rate", f"`{fmt_pps(snap.filtration.xdp_drop_pps)}`", True),
                        ("SYN-RECV / Sockets", f"SYN `{snap.filtration.syn_recv_count}` · Total `{snap.filtration.total_sockets}`", True),
                        ("Auto-Guard / Strict-SYN", f"`{snap.filtration.autoguard_mode.upper()}` · Strict `{'ON' if snap.filtration.strict_mode else 'STD'}`", True),
                        ("Top Active IPs", f"`{top_talkers}`", False),
                    ],
                    dedup_key="threat:UNDER_ATTACK",
                    cooldown_sec=90.0,
                )
            elif threat == "ELEVATED":
                self.discord.send_embed(
                    title=f"⚠️ Elevated Traffic / Threat on {snap.host.hostname}",
                    description=f"Threat transitioned `{prev_threat}` -> **`ELEVATED`** on `{snap.nic.iface}`.",
                    color=DiscordWebhookNotifier.COLOR_AMBER,
                    fields=[
                        ("Ingress (RX)", f"{fmt_bps(snap.nic.rx_bps)} ({fmt_pps(snap.nic.rx_pps)})", True),
                        ("XDP Drop Rate", f"`{fmt_pps(snap.filtration.xdp_drop_pps)}`", True),
                        ("SYN-RECV", f"`{snap.filtration.syn_recv_count}`", True),
                    ],
                    dedup_key="threat:ELEVATED",
                    cooldown_sec=120.0,
                )
            elif prev_threat in ("UNDER ATTACK", "ELEVATED") and threat == "NORMAL":
                self.discord.send_embed(
                    title=f"✅ Threat Mitigated — Back to NORMAL ({snap.host.hostname})",
                    description=f"Traffic normalized from `{prev_threat}` -> **`NORMAL`**.",
                    color=DiscordWebhookNotifier.COLOR_GREEN,
                    fields=[
                        ("Ingress (RX)", f"{fmt_bps(snap.nic.rx_bps)} ({fmt_pps(snap.nic.rx_pps)})", True),
                        ("XDP Drop Rate", f"`{fmt_pps(snap.filtration.xdp_drop_pps)}`", True),
                        ("Active Blocklist", f"`{len(snap.blocked_ips)}` IPs", True),
                    ],
                    dedup_key="threat:NORMAL",
                    cooldown_sec=60.0,
                )

        # 2. Newly detected Fail2Ban / XDP / nftables / UFW bans
        for ip, entry in current_blocked.items():
            if ip in self._discord_seen_blocked:
                continue
            self._discord_seen_blocked.add(ip)
            geo_parts = [p for p in (entry.city, entry.country) if p]
            geo_loc = ", ".join(geo_parts) if geo_parts else "Unknown"
            if entry.country_code and entry.country_code != "??":
                geo_loc = f"{geo_loc} ({entry.country_code})"
            isp_str = f"{entry.isp} ({entry.asn})" if entry.isp else (entry.asn or "Unknown")
            self.discord.send_embed(
                title=f"🛡️ New Blocklist Hit: {ip} [{entry.source}]",
                description=entry.reason or "Blocked by SparrowX Security Layer",
                color=DiscordWebhookNotifier.COLOR_ORANGE,
                fields=[
                    ("Host", f"`{snap.host.hostname}`", True),
                    ("Blocked IP", f"`{ip}`", True),
                    ("Enforcement", f"`{entry.source}`", True),
                    ("Activity / Evidence", entry.attempted or entry.note or "Filter violation", False),
                    ("GeoIP & ISP", f"{geo_loc} · {isp_str}", False),
                ],
                dedup_key=f"newblk:{ip}",
                cooldown_sec=180.0,
            )

        # Prune unbanned IPs from seen set so future re-bans alert again
        self._discord_seen_blocked &= set(current_blocked.keys())

        # 3. Periodic NOC status digest
        if self.discord.digest_interval_sec > 0:
            now_mono = time.monotonic()
            if (now_mono - self._discord_last_digest_mono) >= self.discord.digest_interval_sec:
                self._discord_last_digest_mono = now_mono
                self.discord.send_snapshot(snap, title=f"Periodic NOC Health Update ({snap.host.hostname})")

    def send_discord_snapshot(self, sync: bool = False) -> str:
        snap = self._last_snapshot or self.collect(sync_geo=True)
        ok, detail = self.discord.send_snapshot(
            snap,
            title=f"Live NOC Snapshot ({snap.host.hostname})",
            sync=sync,
        )
        if ok:
            msg = f"Discord NOC snapshot {'sent' if sync else 'queued'} ({detail})"
            self.push_event("SYS", msg)
            return msg
        msg = f"Discord webhook unavailable: {detail}"
        self.push_event("SYS", msg)
        return msg


# ------------------------------------------------------------------------------
# Aesthetic 256-Color SOC Theme Engine & 5-Pane Curses UI
# ------------------------------------------------------------------------------

class SparrowxCursesApp:
    # Color pair IDs
    P_BORDER = 1
    P_ACCENT = 2
    P_GOOD = 3
    P_WARN = 4
    P_DANGER = 5
    P_XDP = 6
    P_TEXT = 7
    P_MUTED = 8
    P_HEADER_BAR = 9
    P_BADGE_RED = 10
    P_BADGE_GREEN = 11
    P_BADGE_AMBER = 12
    P_TITLE_PILL = 13
    P_WHITELIST = 14

    def __init__(self, collector: TelemetryCollector, interval: float = 1.0, theme: str = "cyber"):
        self.collector = collector
        self.interval = max(0.3, interval)
        self.theme_idx = THEMES.index(theme) if theme in THEMES else 0
        self.focused_pane = 0  # 0 = 5-pane grid; 1..5 = zoomed pane
        self.policy_view = 0   # 0 = SPLIT (Block+White), 1 = BLOCKLIST ONLY, 2 = WHITELIST ONLY
        self.paused = False
        self.filter_text = ""
        self.selected_talker_idx = 0
        self.selected_block_idx = 0
        self.status_banner = ""
        self.status_banner_until = 0.0
        self.snapshot: Optional[DashboardSnapshot] = None

    @property
    def theme_name(self) -> str:
        return THEMES[self.theme_idx]

    def set_banner(self, text: str, duration: float = 5.0) -> None:
        self.status_banner = text
        self.status_banner_until = time.monotonic() + duration

    def _apply_theme(self) -> None:
        curses.start_color()
        try:
            curses.use_default_colors()
            bg = -1
        except curses.error:
            bg = curses.COLOR_BLACK

        hi = getattr(curses, "COLORS", 8) >= 256
        t = self.theme_name

        if hi:
            if t == "cyber":
                # Sleek Neon Cyan / Electric Violet / Emerald / Crimson SOC
                curses.init_pair(self.P_BORDER, 39, bg)        # Electric Cyan
                curses.init_pair(self.P_ACCENT, 51, bg)        # Neon Aqua
                curses.init_pair(self.P_GOOD, 48, bg)          # Neon Mint/Emerald
                curses.init_pair(self.P_WARN, 214, bg)         # Warm Amber
                curses.init_pair(self.P_DANGER, 197, bg)       # Vivid Crimson
                curses.init_pair(self.P_XDP, 177, bg)          # Electric Violet
                curses.init_pair(self.P_TEXT, 253, bg)         # Crisp Ice White
                curses.init_pair(self.P_MUTED, 245, bg)        # Cool Slate
                curses.init_pair(self.P_HEADER_BAR, 255, 24)   # White on Deep Navy-Cyan
                curses.init_pair(self.P_BADGE_RED, 255, 196)   # Alert Red Pill
                curses.init_pair(self.P_BADGE_GREEN, 16, 48)   # Healthy Mint Pill
                curses.init_pair(self.P_BADGE_AMBER, 16, 214)  # Warning Amber Pill
                curses.init_pair(self.P_TITLE_PILL, 16, 45)    # Dark on Bright Cyan
                curses.init_pair(self.P_WHITELIST, 84, bg)     # Bright Seafoam Green
            elif t == "emerald":
                # Matrix / Stealth Phosphor NOC
                curses.init_pair(self.P_BORDER, 35, bg)
                curses.init_pair(self.P_ACCENT, 46, bg)
                curses.init_pair(self.P_GOOD, 82, bg)
                curses.init_pair(self.P_WARN, 220, bg)
                curses.init_pair(self.P_DANGER, 196, bg)
                curses.init_pair(self.P_XDP, 50, bg)
                curses.init_pair(self.P_TEXT, 194, bg)
                curses.init_pair(self.P_MUTED, 244, bg)
                curses.init_pair(self.P_HEADER_BAR, 16, 40)
                curses.init_pair(self.P_BADGE_RED, 255, 196)
                curses.init_pair(self.P_BADGE_GREEN, 16, 46)
                curses.init_pair(self.P_BADGE_AMBER, 16, 220)
                curses.init_pair(self.P_TITLE_PILL, 16, 46)
                curses.init_pair(self.P_WHITELIST, 120, bg)
            else:
                # Crimson Tactical Red-Team Ops
                curses.init_pair(self.P_BORDER, 161, bg)
                curses.init_pair(self.P_ACCENT, 204, bg)
                curses.init_pair(self.P_GOOD, 80, bg)
                curses.init_pair(self.P_WARN, 214, bg)
                curses.init_pair(self.P_DANGER, 196, bg)
                curses.init_pair(self.P_XDP, 213, bg)
                curses.init_pair(self.P_TEXT, 255, bg)
                curses.init_pair(self.P_MUTED, 245, bg)
                curses.init_pair(self.P_HEADER_BAR, 255, 88)
                curses.init_pair(self.P_BADGE_RED, 255, 196)
                curses.init_pair(self.P_BADGE_GREEN, 16, 48)
                curses.init_pair(self.P_BADGE_AMBER, 16, 214)
                curses.init_pair(self.P_TITLE_PILL, 255, 161)
                curses.init_pair(self.P_WHITELIST, 86, bg)
        else:
            # Clean 16-color fallback
            curses.init_pair(self.P_BORDER, curses.COLOR_CYAN, bg)
            curses.init_pair(self.P_ACCENT, curses.COLOR_CYAN, bg)
            curses.init_pair(self.P_GOOD, curses.COLOR_GREEN, bg)
            curses.init_pair(self.P_WARN, curses.COLOR_YELLOW, bg)
            curses.init_pair(self.P_DANGER, curses.COLOR_RED, bg)
            curses.init_pair(self.P_XDP, curses.COLOR_MAGENTA, bg)
            curses.init_pair(self.P_TEXT, curses.COLOR_WHITE, bg)
            curses.init_pair(self.P_MUTED, curses.COLOR_WHITE, bg)
            curses.init_pair(self.P_HEADER_BAR, curses.COLOR_BLACK, curses.COLOR_CYAN)
            curses.init_pair(self.P_BADGE_RED, curses.COLOR_WHITE, curses.COLOR_RED)
            curses.init_pair(self.P_BADGE_GREEN, curses.COLOR_BLACK, curses.COLOR_GREEN)
            curses.init_pair(self.P_BADGE_AMBER, curses.COLOR_BLACK, curses.COLOR_YELLOW)
            curses.init_pair(self.P_TITLE_PILL, curses.COLOR_BLACK, curses.COLOR_CYAN)
            curses.init_pair(self.P_WHITELIST, curses.COLOR_GREEN, bg)

    def _safe_addstr(self, win, y: int, x: int, text: str, attr: int = 0) -> None:
        max_y, max_x = win.getmaxyx()
        if y < 0 or y >= max_y or x >= max_x:
            return
        avail = max_x - x - 1
        if avail <= 0:
            return
        try:
            win.addnstr(y, x, text, avail, attr)
        except curses.error:
            pass

    def _draw_rounded_box(
        self, stdscr, y: int, x: int, h: int, w: int, title: str, active: bool = False
    ):
        """Draw a sleek rounded Unicode pane card with a high-contrast title pill."""
        if h < 4 or w < 14:
            return None
        win = stdscr.derwin(h, w, y, x)
        b_attr = curses.color_pair(self.P_ACCENT if active else self.P_BORDER) | (curses.A_BOLD if active else 0)
        try:
            top_line = "╭" + "─" * (w - 2) + "╮"
            bot_line = "╰" + "─" * (w - 2) + "╯"
            win.addnstr(0, 0, top_line, w - 1, b_attr)
            for row in range(1, h - 1):
                win.addnstr(row, 0, "│", 1, b_attr)
                win.addnstr(row, w - 1, "│", 1, b_attr)
            win.addnstr(h - 1, 0, bot_line, w - 1, b_attr)
        except curses.error:
            pass

        pill_attr = curses.color_pair(self.P_TITLE_PILL if active else self.P_ACCENT) | curses.A_BOLD
        self._safe_addstr(win, 0, 2, f" ◆ {title} ", pill_attr)
        return win

    # -- Top Master Telemetry Header (2-Line Aesthetic Strip) ------------------

    def _render_header(self, stdscr, snap: DashboardSnapshot, w: int) -> None:
        mode_tag = " DEMO" if snap.demo_mode else " LIVE"
        root_tag = "ROOT" if snap.host.is_root else "USER"
        left = (
            f" ◆ SPARROWX MASTER CYBERSECURITY NOC v{VERSION} [{mode_tag.strip()}]  │  "
            f"{snap.host.hostname} ({root_tag})  │  NIC: {snap.nic.iface} ({snap.nic.ipv4} · {snap.nic.link_speed})  │  "
            f"THEME: {self.theme_name.upper()}"
        )
        self._safe_addstr(stdscr, 0, 0, left.ljust(max(1, w - 1)), curses.color_pair(self.P_HEADER_BAR) | curses.A_BOLD)

        threat = snap.filtration.threat_level
        t_pair = (
            self.P_BADGE_RED if threat == "UNDER ATTACK"
            else (self.P_BADGE_AMBER if threat == "ELEVATED" else self.P_BADGE_GREEN)
        )
        badge = f" ● {threat} │ {snap.timestamp.split()[-1]} "
        bx = max(0, w - len(badge) - 1)
        self._safe_addstr(stdscr, 0, bx, badge, curses.color_pair(t_pair) | curses.A_BOLD)

        # Sub-header hardware & policy summary strip (line 1)
        cpu_bar = make_bar(snap.host.cpu_pct / 100.0, 8)
        ram_bar = make_bar(snap.host.mem_pct / 100.0, 8)
        disc_s = f"DISCORD:ON({self.collector.discord.sent_count})" if self.collector.discord.enabled else "DISCORD:OFF"
        sub = (
            f" CPU [{cpu_bar}] {snap.host.cpu_pct:4.1f}% ({snap.host.cpu_cores}c)  │  "
            f"RAM [{ram_bar}] {snap.host.mem_used_gb:.1f}/{snap.host.mem_total_gb:.1f}GB  │  "
            f"UP {snap.host.uptime_str}  │  "
            f"GUARD:{snap.filtration.autoguard_mode.upper()}  │  "
            f"{disc_s}  │  "
            f"⛔ {len(snap.blocked_ips)} BLK · ✓ {len(snap.whitelisted_ips)} WL · 🛡️ {snap.filtration.safeguard_protected} SAFE"
        )
        self._safe_addstr(stdscr, 1, 0, sub, curses.color_pair(self.P_MUTED))

    # -- Pane 1: Traffic, Sparklines, Kernel SNMP & XDP Filtration -------------

    def _render_pane_traffic(self, win, snap: DashboardSnapshot) -> None:
        if win is None:
            return
        h, w = win.getmaxyx()
        inner_w = max(10, w - 4)
        nic = snap.nic
        f = snap.filtration

        row = 1
        self._safe_addstr(
            win, row, 2,
            f"IN  (RX) {fmt_bps(nic.rx_bps):>10}  │ {fmt_pps(nic.rx_pps):>9}  │ Peak {fmt_bps(nic.peak_rx_bps):>10}  │ Drop {fmt_pps(nic.rx_drop_ps)}",
            curses.color_pair(self.P_GOOD) | curses.A_BOLD,
        )
        row += 1
        if row < h - 1:
            self._safe_addstr(win, row, 2, f"RX ▸ {make_sparkline(nic.rx_history, max(8, inner_w - 6))}", curses.color_pair(self.P_GOOD))
            row += 1

        if row < h - 1:
            self._safe_addstr(
                win, row, 2,
                f"OUT (TX) {fmt_bps(nic.tx_bps):>10}  │ {fmt_pps(nic.tx_pps):>9}  │ Peak {fmt_bps(nic.peak_tx_bps):>10}  │ Tot {fmt_bytes(nic.rx_bytes_total)}/{fmt_bytes(nic.tx_bytes_total)}",
                curses.color_pair(self.P_WARN) | curses.A_BOLD,
            )
            row += 1
        if row < h - 1:
            self._safe_addstr(win, row, 2, f"TX ▸ {make_sparkline(nic.tx_history, max(8, inner_w - 6))}", curses.color_pair(self.P_WARN))
            row += 1

        if row < h - 1:
            self._safe_addstr(win, row, 2, "╌" * inner_w, curses.color_pair(self.P_MUTED))
            row += 1

        if row < h - 1:
            xdp_attr = curses.color_pair(self.P_XDP) | curses.A_BOLD if f.xdp_attached else curses.color_pair(self.P_DANGER)
            strict_s = "STRICT-SYN:ON" if f.strict_mode else "STRICT-SYN:STD"
            self._safe_addstr(
                win, row, 2,
                f"XDP/eBPF {f.xdp_mode:<9} (id:{f.xdp_prog_id})  │ Drop {fmt_pps(f.xdp_drop_pps):>9}  │ {strict_s}",
                xdp_attr,
            )
            row += 1

        if row < h - 1:
            total_xdp = f.xdp_passed + f.xdp_dropped
            scrub_pct = (f.xdp_dropped / total_xdp * 100.0) if total_xdp > 0 else 0.0
            self._safe_addstr(
                win, row, 2,
                f"XDP Pass:{fmt_count(f.xdp_passed):>6}  Chal:{fmt_count(f.xdp_challenged):>6}  Drop:{fmt_count(f.xdp_dropped):>6} ({scrub_pct:4.1f}%)  WL:{fmt_count(f.xdp_whitelisted):>5}",
                curses.color_pair(self.P_TEXT),
            )
            row += 1

        if row < h - 1:
            ufw_s = "ON" if f.ufw_active else "OFF"
            self._safe_addstr(
                win, row, 2,
                f"Firewall nftDrop={fmt_count(f.nft_drops)}  iptDrop={fmt_count(f.iptables_drops)}  UFW={ufw_s}  F2B={f.fail2ban_banned} ({f.fail2ban_jails}j)",
                curses.color_pair(self.P_TEXT),
            )
            row += 1

        if row < h - 1:
            self._safe_addstr(
                win, row, 2,
                f"L3/L4    UDP:{fmt_pps(f.udp_in_ps)} (err:{f.udp_err_ps:.0f}/s)  TCP-Retrans:{f.tcp_retrans_ps:.1f}/s  ICMP:{f.icmp_in_ps:.1f}/s",
                curses.color_pair(self.P_MUTED),
            )
            row += 1

        if row < h - 1:
            ct_ratio = (f.conntrack_count / f.conntrack_max) if f.conntrack_max > 0 else 0.0
            bar = make_block_bar(ct_ratio, 10)
            syn_attr = curses.color_pair(self.P_DANGER) | curses.A_BOLD if f.syn_recv_count >= 15 else curses.color_pair(self.P_GOOD)
            self._safe_addstr(
                win, row, 2,
                f"State    CT:{fmt_count(f.conntrack_count)}/{fmt_count(f.conntrack_max)} [{bar}]  SYN:{f.syn_recv_count}  TW:{f.time_wait_count}  EST:{f.established_count}",
                syn_attr,
            )

    # -- Pane 2: Protected Downstream Servers, Tunnels & Open Ports ------------

    def _render_pane_backends(self, win, snap: DashboardSnapshot) -> None:
        if win is None:
            return
        h, w = win.getmaxyx()
        self._safe_addstr(
            win, 1, 2,
            f"{'TARGET':<14} {'TYPE':<9} {'TUNNEL IP':<15} {'STATUS':<10} {'FLOW / AGE'}",
            curses.color_pair(self.P_ACCENT) | curses.A_BOLD,
        )
        max_row = h - 2 if snap.listening_ports else h - 1

        if not snap.backends:
            self._safe_addstr(win, 3, 2, "No WireGuard tunnels (spx_*/wg*) or Docker backends active.", curses.color_pair(self.P_WARN))
            self._safe_addstr(win, 4, 2, "Attach downstream servers via tunnel-manager.sh to protect them.", curses.color_pair(self.P_MUTED))
        else:
            row = 2
            for b in snap.backends:
                if row >= max_row:
                    break
                st_attr = (
                    curses.color_pair(self.P_GOOD) | curses.A_BOLD
                    if b.status == "PROTECTED"
                    else (curses.color_pair(self.P_WARN) if b.status in ("IDLE", "WAITING") else curses.color_pair(self.P_DANGER))
                )
                flow = (
                    f"{fmt_bps(b.rx_bps)}/{fmt_bps(b.tx_bps)}"
                    if b.kind == "WG-TUNNEL" and (b.rx_bps > 0 or b.tx_bps > 0)
                    else f"{b.endpoint} ({b.handshake_age})"
                )
                line = f"{b.name[:14]:<14} {b.kind[:9]:<9} {b.tunnel_ip[:15]:<15} {b.status[:10]:<10} {flow}"
                self._safe_addstr(win, row, 2, line, st_attr)
                row += 1

        if snap.listening_ports and h >= 5:
            ports_line = "OPEN PORTS: " + "  ".join(snap.listening_ports)
            self._safe_addstr(win, h - 2, 2, ports_line, curses.color_pair(self.P_MUTED))

    # -- Pane 3: Live Active IP Connections & Top Talkers ----------------------

    def _filtered_talkers(self, snap: DashboardSnapshot) -> List[RemoteTalker]:
        if not self.filter_text:
            return snap.talkers
        q = self.filter_text.lower()
        return [
            t for t in snap.talkers
            if q in t.ip.lower() or q in t.ports.lower() or q in t.process.lower() or q in t.risk.lower()
        ]

    def _render_pane_connections(self, win, snap: DashboardSnapshot) -> None:
        if win is None:
            return
        h, w = win.getmaxyx()
        self._safe_addstr(
            win, 1, 2,
            f"{'REMOTE IP':<16} {'TOT':>4} {'EST':>4} {'SYN':>4} {'TW':>3} {'UDP':>4} {'PORTS':<10} {'PROC':<8} {'STATE'}",
            curses.color_pair(self.P_ACCENT) | curses.A_BOLD,
        )
        talkers = self._filtered_talkers(snap)
        if not talkers:
            msg = f"No connections matching '{self.filter_text}'." if self.filter_text else "No external remote connections currently active."
            self._safe_addstr(win, 3, 2, msg, curses.color_pair(self.P_MUTED))
            return

        self.selected_talker_idx = max(0, min(self.selected_talker_idx, len(talkers) - 1))
        visible_rows = max(1, h - 3)
        start_idx = max(0, self.selected_talker_idx - visible_rows + 1)

        row = 2
        for idx in range(start_idx, len(talkers)):
            if row >= h - 1:
                break
            t = talkers[idx]
            if t.risk in ("WHITELIST", "ADMIN", "INTERNAL", "HOST", "SERVICE", "BACKEND"):
                attr = curses.color_pair(self.P_WHITELIST) | curses.A_BOLD
            elif t.risk in ("FLOOD", "BLOCKED"):
                attr = curses.color_pair(self.P_DANGER) | curses.A_BOLD
            elif t.risk == "WARN":
                attr = curses.color_pair(self.P_WARN) | curses.A_BOLD
            else:
                attr = curses.color_pair(self.P_TEXT)
            if idx == self.selected_talker_idx:
                attr |= curses.A_REVERSE
            if t.risk == "WHITELIST":
                badge = "✓ WL"
            elif t.risk == "ADMIN":
                badge = "🛡 ADM"
            elif t.risk == "INTERNAL":
                badge = "🛡 INT"
            elif t.risk in ("SERVICE", "HOST", "BACKEND"):
                badge = "🛡 SVC"
            elif t.risk == "BLOCKED":
                badge = "⛔ BLK"
            elif t.risk in ("FLOOD", "WARN") and t.threat_score > 0:
                badge = f"{t.risk}({t.threat_score})"
            else:
                badge = t.risk
            line = (
                f"{t.ip[:16]:<16} {t.total_conns:>4} {t.established:>4} {t.syn_recv:>4} "
                f"{t.time_wait:>3} {t.udp_conns:>4} {t.ports[:10]:<10} {t.process[:8]:<8} {badge}"
            )
            self._safe_addstr(win, row, 2, line, attr)
            row += 1

    # -- Pane 4: Dedicated Blocklist & Whitelist Manager -----------------------

    def _filtered_blocked(self, snap: DashboardSnapshot) -> List[PolicyIpEntry]:
        if not self.filter_text:
            return snap.blocked_ips
        q = self.filter_text.lower()
        return [
            b for b in snap.blocked_ips
            if q in b.ip.lower()
            or q in b.source.lower()
            or q in b.note.lower()
            or q in b.reason.lower()
            or q in b.attempted.lower()
            or q in b.country.lower()
            or q in b.region.lower()
            or q in b.city.lower()
            or q in b.isp.lower()
        ]

    def _render_blocked_entries(
        self,
        win,
        blocked: List[PolicyIpEntry],
        start_row: int,
        max_row: int,
        allow_select: bool = False,
    ) -> int:
        """Render rich blocklist entries with Ban Reason, Attempted Action, Country/Region, and ISP."""
        row = start_row
        if not blocked:
            if row < max_row:
                self._safe_addstr(win, row, 2, "  0 IPs currently blocklisted", curses.color_pair(self.P_MUTED))
                row += 1
            return row

        avail_rows = max(1, max_row - row)
        # Use 3-line full cards when zoomed or when all entries fit at 3 lines; otherwise compact 2-line cards
        lines_per_item = 3 if (self.focused_pane == 4 or avail_rows >= len(blocked) * 3) else 2
        if avail_rows < 2:
            lines_per_item = 1

        max_visible = max(1, avail_rows // lines_per_item)
        if allow_select:
            self.selected_block_idx = max(0, min(self.selected_block_idx, len(blocked) - 1))
            start_idx = max(0, self.selected_block_idx - max_visible + 1)
        else:
            start_idx = 0

        shown = 0
        for idx in range(start_idx, len(blocked)):
            if row + lines_per_item > max_row:
                break
            b = blocked[idx]
            is_sel = allow_select and idx == self.selected_block_idx
            base_pair = self.P_XDP if b.source == "XDP" else self.P_DANGER
            head_attr = curses.color_pair(base_pair) | curses.A_BOLD | (curses.A_REVERSE if is_sel else 0)
            reason_txt = b.reason or b.note or "Security Policy Ban"
            tried_txt = b.attempted or "Blocked by active firewall policy"
            loc_full = b.location_label
            loc_short = b.compact_location
            isp_txt = b.isp_label

            if lines_per_item >= 3:
                self._safe_addstr(win, row, 2, f"  {b.ip:<15} [{b.source:<4}] Reason: {reason_txt}", head_attr)
                row += 1
                self._safe_addstr(
                    win, row, 2,
                    f"    ↳ Tried: {tried_txt}",
                    curses.color_pair(self.P_WARN),
                )
                row += 1
                self._safe_addstr(
                    win, row, 2,
                    f"    ↳ Geo  : {loc_full} │ ISP: {isp_txt}",
                    curses.color_pair(self.P_ACCENT),
                )
                row += 1
            elif lines_per_item == 2:
                self._safe_addstr(win, row, 2, f"  {b.ip:<15} [{b.source:<4}] {reason_txt}", head_attr)
                row += 1
                self._safe_addstr(
                    win, row, 2,
                    f"    ↳ {loc_short} · {isp_txt} │ {tried_txt}",
                    curses.color_pair(self.P_WARN),
                )
                row += 1
            else:
                self._safe_addstr(
                    win, row, 2,
                    f"  {b.ip:<15} [{b.source:<4}] {reason_txt} ({loc_short} · {isp_txt})",
                    head_attr,
                )
                row += 1
            shown += 1

        remaining = len(blocked) - (start_idx + shown)
        if remaining > 0 and row < max_row:
            hint = "use [↑/↓] to scroll" if allow_select else "press [4] to zoom / [t] Blocklist view"
            self._safe_addstr(
                win, row, 2,
                f"  … +{remaining} more blocked IP(s) ({hint})",
                curses.color_pair(self.P_MUTED),
            )
            row += 1
        return row

    def _render_pane_policies(self, win, snap: DashboardSnapshot) -> None:
        if win is None:
            return
        h, w = win.getmaxyx()
        inner_w = max(10, w - 4)

        blocked = self._filtered_blocked(snap)
        whitelisted = snap.whitelisted_ips
        if self.filter_text:
            q = self.filter_text.lower()
            whitelisted = [x for x in whitelisted if q in x.ip.lower() or q in x.source.lower() or q in x.note.lower()]

        row = 1
        allow_bl_select = self.focused_pane == 4 or self.policy_view == 1

        if self.policy_view == 0:
            # SPLIT VIEW: Dynamic height allocation so empty Whitelist gives full room to rich Blocklist cards
            avail = max(2, h - 2)
            wl_needed = 2 if not whitelisted else min(max(3, avail // 3), len(whitelisted) + 1)
            # Reserve 1 line for divider + wl_needed for Whitelist section
            bl_max_row = max(row + 2, h - 1 - (wl_needed + 1))

            hdr_hint = "[b] Ban  [u] Unban  [4] Zoom" if self.focused_pane != 4 else "[b] Ban  [u] Unban  [↑/↓] Select"
            self._safe_addstr(
                win, row, 2,
                f"⛔ BLOCKLISTED ({len(blocked)})  {hdr_hint}",
                curses.color_pair(self.P_DANGER) | curses.A_BOLD,
            )
            row += 1
            row = self._render_blocked_entries(win, blocked, row, bl_max_row, allow_select=allow_bl_select)

            if row < h - 2:
                self._safe_addstr(win, row, 2, "╌" * inner_w, curses.color_pair(self.P_MUTED))
                row += 1

            if row < h - 1:
                self._safe_addstr(
                    win, row, 2,
                    f"✓ WHITELISTED ({len(whitelisted)})  [w] Allow  [W] Remove",
                    curses.color_pair(self.P_WHITELIST) | curses.A_BOLD,
                )
                row += 1
            if not whitelisted:
                if row < h - 1:
                    self._safe_addstr(win, row, 2, "  0 IPs whitelisted (press [w] to trust an IP)", curses.color_pair(self.P_MUTED))
            else:
                for x in whitelisted:
                    if row >= h - 1:
                        break
                    self._safe_addstr(
                        win, row, 2,
                        f"  {x.ip:<16} [{x.source:<4}] {x.note}",
                        curses.color_pair(self.P_WHITELIST),
                    )
                    row += 1

        elif self.policy_view == 1:
            # BLOCKLIST ONLY VIEW
            self._safe_addstr(
                win, row, 2,
                f"⛔ BLOCKLISTED ({len(blocked)}) — Reason · Attempted Action · Country/Region · ISP  [t] View",
                curses.color_pair(self.P_DANGER) | curses.A_BOLD,
            )
            row += 1
            self._render_blocked_entries(win, blocked, row, h - 1, allow_select=True)
        else:
            # WHITELIST ONLY VIEW
            self._safe_addstr(
                win, row, 2,
                f"✓ WHITELISTED ({len(whitelisted)}) — [t] Toggle Split/Blocklist",
                curses.color_pair(self.P_WHITELIST) | curses.A_BOLD,
            )
            row += 1
            if not whitelisted:
                self._safe_addstr(win, row + 1, 2, "0 IPs whitelisted. Press [w] to add a trusted IP.", curses.color_pair(self.P_MUTED))
            for x in whitelisted:
                if row >= h - 1:
                    break
                self._safe_addstr(win, row, 2, f"  {x.ip:<16} [{x.source:<4}] {x.note}", curses.color_pair(self.P_WHITELIST))
                row += 1

    # -- Pane 5: Live Security & Filtration Event Stream -----------------------

    def _render_pane_logs(self, win, snap: DashboardSnapshot) -> None:
        if win is None:
            return
        h, w = win.getmaxyx()
        logs = snap.logs
        if self.filter_text:
            q = self.filter_text.lower()
            logs = [e for e in logs if q in e.message.lower() or q in e.tag.lower()]

        max_lines = max(1, h - 2)
        recent = logs[-max_lines:]
        row = 1
        for ev in recent:
            if row >= h - 1:
                break
            if ev.tag in ("DROP", "BAN"):
                tag_attr = curses.color_pair(self.P_DANGER) | curses.A_BOLD
            elif ev.tag in ("WHT", "SAFE"):
                tag_attr = curses.color_pair(self.P_WHITELIST) | curses.A_BOLD
            elif ev.tag == "XDP":
                tag_attr = curses.color_pair(self.P_XDP) | curses.A_BOLD
            elif ev.tag in ("WAF", "AUTH"):
                tag_attr = curses.color_pair(self.P_WARN) | curses.A_BOLD
            elif ev.tag == "WG":
                tag_attr = curses.color_pair(self.P_GOOD) | curses.A_BOLD
            else:
                tag_attr = curses.color_pair(self.P_ACCENT)
            prefix = f"{ev.ts} [{ev.tag:<4}] "
            self._safe_addstr(win, row, 2, prefix, tag_attr)
            self._safe_addstr(win, row, 2 + len(prefix), ev.message, curses.color_pair(self.P_TEXT))
            row += 1

    # -- Footer Keybind Bar ----------------------------------------------------

    def _render_footer(self, stdscr, h: int, w: int) -> None:
        if self.status_banner and time.monotonic() < self.status_banner_until:
            bar = f" ➤ {self.status_banner} "
            attr = curses.color_pair(self.P_BADGE_AMBER) | curses.A_BOLD
        else:
            pause_lbl = "RESUME" if self.paused else "PAUSE"
            filt_lbl = f" FILTER='{self.filter_text}'" if self.filter_text else ""
            bar = (
                f" [1-5/0] Pane  [b] Ban  [u] Unban  [w] WL  [W] UnWL  [a] AutoGuard  "
                f"[x] StrictSYN  [d] Discord  [t] View  [c] Theme  [i] NIC  [p] {pause_lbl}  [/] Filter  [q] Quit{filt_lbl}"
            )
            attr = curses.color_pair(self.P_HEADER_BAR) | curses.A_BOLD
        self._safe_addstr(stdscr, h - 1, 0, bar.ljust(max(1, w - 1)), attr)

    # -- Modal Input Prompt Inside Footer --------------------------------------

    def _prompt_input(self, stdscr, prompt: str, prefill: str = "") -> Optional[str]:
        h, w = stdscr.getmaxyx()
        curses.echo()
        try:
            curses.curs_set(1)
        except curses.error:
            pass
        stdscr.nodelay(False)
        buf = list(prefill)
        while True:
            line = f" {prompt}{''.join(buf)}"
            self._safe_addstr(stdscr, h - 1, 0, line.ljust(max(1, w - 1)), curses.color_pair(self.P_BADGE_AMBER) | curses.A_BOLD)
            stdscr.move(h - 1, min(w - 2, len(line)))
            stdscr.refresh()
            ch = stdscr.getch()
            if ch == 27:
                result = None
                break
            if ch in (10, 13):
                result = "".join(buf).strip()
                break
            if ch in (curses.KEY_BACKSPACE, 127, 8):
                if buf:
                    buf.pop()
            elif 32 <= ch <= 126 and len(buf) < 64:
                buf.append(chr(ch))
        curses.noecho()
        try:
            curses.curs_set(0)
        except curses.error:
            pass
        stdscr.nodelay(True)
        return result

    # -- Main Event Loop -------------------------------------------------------

    def run(self, stdscr) -> None:
        self._apply_theme()
        try:
            curses.curs_set(0)
        except curses.error:
            pass
        stdscr.nodelay(True)
        stdscr.timeout(100)

        self.snapshot = self.collector.collect()
        last_collect = time.monotonic()

        while True:
            now = time.monotonic()
            if not self.paused and (now - last_collect >= self.interval):
                self.snapshot = self.collector.collect()
                last_collect = now

            snap = self.snapshot
            h, w = stdscr.getmaxyx()
            stdscr.erase()

            if h < 20 or w < 76:
                self._safe_addstr(
                    stdscr, 1, 2,
                    f"Terminal too small ({w}x{h}). Resize to at least 76x20 (press q to quit).",
                    curses.color_pair(self.P_DANGER) | curses.A_BOLD,
                )
            else:
                self._render_header(stdscr, snap, w)
                body_y = 2
                body_h = h - 3
                view_names = ("SPLIT", "BLOCKLIST", "WHITELIST")

                if self.focused_pane in (1, 2, 3, 4, 5):
                    titles = {
                        1: "[1] TRAFFIC & KERNEL/XDP PACKET FILTRATION (ZOOMED — press 0)",
                        2: "[2] PROTECTED DOWNSTREAM SERVERS & WIREGUARD TUNNELS (ZOOMED — press 0)",
                        3: "[3] LIVE ACTIVE IP CONNECTIONS & TOP TALKERS (ZOOMED — press 0)",
                        4: f"[4] WHITELIST & BLOCKLIST MANAGER [{view_names[self.policy_view]}] (ZOOMED — press 0)",
                        5: "[5] LIVE SECURITY & FILTRATION EVENT STREAM (ZOOMED — press 0)",
                    }
                    win = self._draw_rounded_box(stdscr, body_y, 0, body_h, w, titles[self.focused_pane], active=True)
                    if self.focused_pane == 1:
                        self._render_pane_traffic(win, snap)
                    elif self.focused_pane == 2:
                        self._render_pane_backends(win, snap)
                    elif self.focused_pane == 3:
                        self._render_pane_connections(win, snap)
                    elif self.focused_pane == 4:
                        self._render_pane_policies(win, snap)
                    elif self.focused_pane == 5:
                        self._render_pane_logs(win, snap)
                else:
                    top_h = max(11, min(13, body_h // 3 + 1))
                    bot_h = max(6, min(10, body_h // 3 - 1))
                    mid_h = max(7, body_h - top_h - bot_h)
                    left_w = int(w * 0.56)
                    right_w = w - left_w

                    w1 = self._draw_rounded_box(
                        stdscr, body_y, 0, top_h, left_w,
                        f"[1] TRAFFIC & XDP FILTRATION ({snap.nic.iface})",
                    )
                    w2 = self._draw_rounded_box(
                        stdscr, body_y, left_w, top_h, right_w,
                        f"[2] PROTECTED SERVERS & TUNNELS ({len(snap.backends)})",
                    )
                    w3 = self._draw_rounded_box(
                        stdscr, body_y + top_h, 0, mid_h, left_w,
                        f"[3] ACTIVE CONNECTIONS ({len(snap.talkers)} IPs / {snap.filtration.total_sockets} sock)",
                    )
                    w4 = self._draw_rounded_box(
                        stdscr, body_y + top_h, left_w, mid_h, right_w,
                        f"[4] BLOCKLIST ({len(snap.blocked_ips)}) & WHITELIST ({len(snap.whitelisted_ips)}) [{view_names[self.policy_view]}]",
                    )
                    w5 = self._draw_rounded_box(
                        stdscr, body_y + top_h + mid_h, 0, bot_h, w,
                        f"[5] LIVE SECURITY & FILTRATION LOGS {'[PAUSED]' if self.paused else '[LIVE]'}",
                    )

                    self._render_pane_traffic(w1, snap)
                    self._render_pane_backends(w2, snap)
                    self._render_pane_connections(w3, snap)
                    self._render_pane_policies(w4, snap)
                    self._render_pane_logs(w5, snap)

                self._render_footer(stdscr, h, w)

            stdscr.refresh()

            ch = stdscr.getch()
            if ch == -1:
                continue
            if ch in (ord("q"), ord("Q")):
                break
            elif ch == ord("0") or ch == 27:
                self.focused_pane = 0
            elif ch in (ord("1"), ord("2"), ord("3"), ord("4"), ord("5")):
                num = ch - ord("0")
                self.focused_pane = 0 if self.focused_pane == num else num
            elif ch == 9:  # Tab
                self.focused_pane = (self.focused_pane + 1) % 6
            elif ch in (ord("c"), ord("C")):
                self.theme_idx = (self.theme_idx + 1) % len(THEMES)
                self._apply_theme()
                self.set_banner(f"Theme switched to {self.theme_name.upper()}")
            elif ch in (ord("t"), ord("T")):
                self.policy_view = (self.policy_view + 1) % 3
                labels = ("SPLIT (Blocklist + Whitelist)", "BLOCKLIST ONLY", "WHITELIST ONLY")
                self.set_banner(f"Pane 4 view: {labels[self.policy_view]}")
            elif ch in (ord("p"), ord("P")):
                self.paused = not self.paused
                self.set_banner("Live telemetry PAUSED" if self.paused else "Live telemetry RESUMED")
            elif ch in (ord("r"), ord("R")):
                self.snapshot = self.collector.collect()
                last_collect = time.monotonic()
                self.set_banner("Refreshed live kernel & network telemetry")
            elif ch in (ord("i"), ord("I")):
                new_if = self.collector.cycle_interface()
                self.snapshot = self.collector.collect()
                last_collect = time.monotonic()
                self.set_banner(f"Monitoring interface: {new_if}")
            elif ch in (ord("a"), ord("A")):
                msg = self.collector.cycle_autoguard()
                self.snapshot = self.collector.collect()
                self.set_banner(msg, duration=6.0)
            elif ch in (ord("x"), ord("X")):
                msg = self.collector.toggle_strict_mode()
                self.snapshot = self.collector.collect()
                self.set_banner(msg)
            elif ch in (ord("d"), ord("D")):
                msg = self.collector.send_discord_snapshot(sync=False)
                self.set_banner(msg, duration=5.0)
            elif ch == curses.KEY_UP:
                if self.focused_pane == 4 or self.policy_view == 1:
                    self.selected_block_idx = max(0, self.selected_block_idx - 1)
                else:
                    self.selected_talker_idx = max(0, self.selected_talker_idx - 1)
            elif ch == curses.KEY_DOWN:
                if self.focused_pane == 4 or self.policy_view == 1:
                    self.selected_block_idx += 1
                else:
                    self.selected_talker_idx += 1
            elif ch in (ord("b"), ord("B")):
                talkers = self._filtered_talkers(snap)
                sel_tk = talkers[self.selected_talker_idx] if talkers and self.selected_talker_idx < len(talkers) else None
                prefill = sel_tk.ip if sel_tk else ""
                target = self._prompt_input(stdscr, "BAN IPv4 (XDP+nft+UFW): ", prefill=prefill)
                if target:
                    tried_ctx = ""
                    if sel_tk and sel_tk.ip == target:
                        tried_ctx = (
                            f"Active {sel_tk.risk} traffic: {sel_tk.total_conns} conn "
                            f"(SYN:{sel_tk.syn_recv}, UDP:{sel_tk.udp_conns}) on :{sel_tk.ports} ({sel_tk.process})"
                        )
                    msg = self.collector.ban_ip(target, attempted=tried_ctx)
                    self.snapshot = self.collector.collect()
                    self.set_banner(msg)
            elif ch in (ord("u"), ord("U")):
                bl_list = self._filtered_blocked(snap)
                if bl_list:
                    idx = max(0, min(self.selected_block_idx, len(bl_list) - 1))
                    prefill = bl_list[idx].ip
                else:
                    prefill = ""
                target = self._prompt_input(stdscr, "UNBAN IPv4: ", prefill=prefill)
                if target:
                    msg = self.collector.unban_ip(target)
                    self.snapshot = self.collector.collect()
                    self.set_banner(msg)
            elif ch == ord("w"):
                talkers = self._filtered_talkers(snap)
                prefill = talkers[self.selected_talker_idx].ip if talkers and self.selected_talker_idx < len(talkers) else ""
                target = self._prompt_input(stdscr, "WHITELIST IPv4 (XDP+nft+UFW): ", prefill=prefill)
                if target:
                    msg = self.collector.whitelist_ip(target)
                    self.snapshot = self.collector.collect()
                    self.set_banner(msg)
            elif ch == ord("W"):
                prefill = snap.whitelisted_ips[0].ip if snap.whitelisted_ips else ""
                target = self._prompt_input(stdscr, "REMOVE WHITELIST IPv4: ", prefill=prefill)
                if target:
                    msg = self.collector.unwhitelist_ip(target)
                    self.snapshot = self.collector.collect()
                    self.set_banner(msg)
            elif ch == ord("/"):
                q = self._prompt_input(stdscr, "FILTER (IP/port/tag, blank to clear): ", prefill=self.filter_text)
                if q is not None:
                    self.filter_text = q
                    self.set_banner(f"Filter set: '{q}'" if q else "Filter cleared")


# ------------------------------------------------------------------------------
# Non-Interactive Aesthetic ANSI Snapshot Renderer (--once)
# ------------------------------------------------------------------------------

def render_ansi_snapshot(snap: DashboardSnapshot, use_color: bool = True, theme: str = "cyber") -> str:
    if not use_color:
        C = {k: "" for k in ("rst", "bold", "accent", "good", "warn", "danger", "xdp", "wl", "dim")}
    elif theme == "emerald":
        C = {
            "rst": "\033[0m", "bold": "\033[1m",
            "accent": "\033[38;5;46m", "good": "\033[38;5;82m", "warn": "\033[38;5;220m",
            "danger": "\033[38;5;196m", "xdp": "\033[38;5;50m", "wl": "\033[38;5;120m", "dim": "\033[38;5;244m",
        }
    elif theme == "crimson":
        C = {
            "rst": "\033[0m", "bold": "\033[1m",
            "accent": "\033[38;5;204m", "good": "\033[38;5;80m", "warn": "\033[38;5;214m",
            "danger": "\033[38;5;196m", "xdp": "\033[38;5;213m", "wl": "\033[38;5;86m", "dim": "\033[38;5;245m",
        }
    else:
        C = {
            "rst": "\033[0m", "bold": "\033[1m",
            "accent": "\033[38;5;45m", "good": "\033[38;5;48m", "warn": "\033[38;5;214m",
            "danger": "\033[38;5;197m", "xdp": "\033[38;5;177m", "wl": "\033[38;5;84m", "dim": "\033[38;5;245m",
        }

    f = snap.filtration
    nic = snap.nic
    t_col = C["danger"] if f.threat_level == "UNDER ATTACK" else (C["warn"] if f.threat_level == "ELEVATED" else C["good"])
    demo_badge = " [DEMO]" if snap.demo_mode else " [LIVE]"
    plain_title = f" ◆ SPARROWX MASTER CYBERSECURITY & DDoS FILTRATION NOC v{VERSION}{demo_badge} │ THREAT: {f.threat_level:<12} │ {snap.timestamp} "
    box_w = len(plain_title)
    color_title = f" ◆ SPARROWX MASTER CYBERSECURITY & DDoS FILTRATION NOC v{VERSION}{demo_badge} │ THREAT: {t_col}{f.threat_level:<12}{C['accent']} │ {snap.timestamp} "

    cpu_bar = make_bar(snap.host.cpu_pct / 100.0, 8)
    ram_bar = make_bar(snap.host.mem_pct / 100.0, 8)
    total_xdp = f.xdp_passed + f.xdp_dropped
    scrub_pct = (f.xdp_dropped / total_xdp * 100.0) if total_xdp > 0 else 0.0

    lines = [
        f"{C['accent']}{C['bold']}╭{'─' * box_w}╮{C['rst']}",
        f"{C['accent']}{C['bold']}│{color_title}│{C['rst']}",
        f"{C['accent']}{C['bold']}╰{'─' * box_w}╯{C['rst']}",
        f" Host: {C['bold']}{snap.host.hostname}{C['rst']} ({snap.host.kernel}) │ NIC: {C['accent']}{nic.iface}{C['rst']} ({nic.ipv4} · {nic.link_speed}) │ Up: {snap.host.uptime_str}",
        f" CPU [{C['good']}{cpu_bar}{C['rst']}] {snap.host.cpu_pct:.1f}% ({snap.host.cpu_cores}c) │ RAM [{C['accent']}{ram_bar}{C['rst']}] {snap.host.mem_used_gb:.1f}/{snap.host.mem_total_gb:.1f}GB │ Load: {snap.host.load_1m:.2f}/{snap.host.load_5m:.2f}/{snap.host.load_15m:.2f} │ {C['danger']}⛔ {len(snap.blocked_ips)} Blocked{C['rst']} · {C['wl']}✓ {len(snap.whitelisted_ips)} Whitelisted{C['rst']}",
        "",
        f"{C['accent']}{C['bold']}╭─ ◆ [1] REAL-TIME TRAFFIC, KERNEL SNMP & XDP FILTRATION{C['rst']}",
        f"│  {C['good']}IN  (RX): {fmt_bps(nic.rx_bps):>10} │ {fmt_pps(nic.rx_pps):>9} │ Peak: {fmt_bps(nic.peak_rx_bps):>10} │ Drops: {fmt_pps(nic.rx_drop_ps)}{C['rst']}",
        f"│  {C['warn']}OUT (TX): {fmt_bps(nic.tx_bps):>10} │ {fmt_pps(nic.tx_pps):>9} │ Peak: {fmt_bps(nic.peak_tx_bps):>10} │ Totals: {fmt_bytes(nic.rx_bytes_total)} / {fmt_bytes(nic.tx_bytes_total)}{C['rst']}",
        f"│  {C['xdp']}XDP/eBPF: {f.xdp_mode:<9} (prog:{f.xdp_prog_id}) │ Pass:{fmt_count(f.xdp_passed)} Chal:{fmt_count(f.xdp_challenged)} Drop:{fmt_count(f.xdp_dropped)} ({scrub_pct:.1f}%) WL:{fmt_count(f.xdp_whitelisted)}{C['rst']}",
        f"│  Firewall: nftDrops={fmt_count(f.nft_drops)} │ iptDrops={fmt_count(f.iptables_drops)} │ UFW={'ON' if f.ufw_active else 'OFF'} │ Fail2Ban={f.fail2ban_banned} ({f.fail2ban_jails} jails) │ StrictSYN={'ON' if f.strict_mode else 'STD'}",
        f"│  L3/L4   : UDP={fmt_pps(f.udp_in_ps)} (err {f.udp_err_ps:.0f}/s) │ TCP-Retrans={f.tcp_retrans_ps:.1f}/s │ ICMP={f.icmp_in_ps:.1f}/s │ CT={fmt_count(f.conntrack_count)}/{fmt_count(f.conntrack_max)} │ SYN={f.syn_recv_count} TW={f.time_wait_count} EST={f.established_count}",
        "",
        f"{C['accent']}{C['bold']}╭─ ◆ [2] PROTECTED DOWNSTREAM SERVERS, WIREGUARD TUNNELS ({len(snap.backends)}) & OPEN PORTS{C['rst']}",
    ]
    if snap.backends:
        lines.append(f"│  {'TARGET':<16} {'TYPE':<10} {'TUNNEL IP':<16} {'ENDPOINT':<22} {'STATUS':<10} {'AGE'}")
        for b in snap.backends[:10]:
            sc = C["good"] if b.status == "PROTECTED" else C["warn"]
            lines.append(f"│  {b.name:<16} {b.kind:<10} {b.tunnel_ip:<16} {b.endpoint:<22} {sc}{b.status:<10}{C['rst']} {b.handshake_age}")
    else:
        lines.append("│  No active WireGuard tunnels or Docker backends detected.")
    if snap.listening_ports:
        lines.append(f"│  {C['dim']}Open Ports: {', '.join(snap.listening_ports)}{C['rst']}")

    lines.append("")
    lines.append(f"{C['accent']}{C['bold']}╭─ ◆ [3] LIVE ACTIVE IP CONNECTIONS & TOP TALKERS ({len(snap.talkers)} remote){C['rst']}")
    if snap.talkers:
        lines.append(f"│  {'REMOTE IP':<17} {'TOT':>4} {'EST':>4} {'SYN':>4} {'TW':>3} {'UDP':>4} {'PORTS':<12} {'PROC':<10} {'STATE'}")
        for t in snap.talkers[:10]:
            rc = C["wl"] if t.risk == "WHITELIST" else (C["danger"] if t.risk in ("FLOOD", "BLOCKED") else (C["warn"] if t.risk == "WARN" else C["good"]))
            lbl = "✓ WHITELIST" if t.risk == "WHITELIST" else ("⛔ BLOCKED" if t.risk == "BLOCKED" else t.risk)
            lines.append(f"│  {t.ip:<17} {t.total_conns:>4} {t.established:>4} {t.syn_recv:>4} {t.time_wait:>3} {t.udp_conns:>4} {t.ports:<12} {t.process:<10} {rc}{lbl}{C['rst']}")
    else:
        lines.append("│  No external active IP connections.")

    lines.append("")
    lines.append(f"{C['accent']}{C['bold']}╭─ ◆ [4] BLOCKLIST ({len(snap.blocked_ips)}) & WHITELIST ({len(snap.whitelisted_ips)}) POLICY MANAGER{C['rst']}")
    lines.append(f"│  {C['danger']}{C['bold']}⛔ BLOCKLISTED ({len(snap.blocked_ips)}):{C['rst']}")
    if snap.blocked_ips:
        for b in snap.blocked_ips[:12]:
            reason_txt = b.reason or b.note or "Security Policy Ban"
            tried_txt = b.attempted or "Blocked by active firewall policy"
            lines.append(
                f"│    {C['danger']}{C['bold']}{b.ip:<17}{C['rst']} [{b.source:<4}]  Reason: {reason_txt}"
            )
            lines.append(
                f"│      {C['warn']}↳ Tried  :{C['rst']} {tried_txt}"
            )
            lines.append(
                f"│      {C['accent']}↳ Geo/ISP:{C['rst']} {b.location_label} │ ISP: {b.isp_label}"
            )
    else:
        lines.append(f"│    {C['dim']}0 IPs currently blocklisted.{C['rst']}")

    lines.append(f"│  {C['wl']}{C['bold']}✓ WHITELISTED ({len(snap.whitelisted_ips)}):{C['rst']}")
    if snap.whitelisted_ips:
        for x in snap.whitelisted_ips[:8]:
            lines.append(f"│    {C['wl']}{x.ip:<17}{C['rst']} [{x.source:<4}]  {x.note}")
    else:
        lines.append(f"│    {C['dim']}0 IPs currently whitelisted.{C['rst']}")

    lines.append("")
    lines.append(f"{C['accent']}{C['bold']}╭─ ◆ [5] LIVE SECURITY & FILTRATION EVENT STREAM{C['rst']}")
    for ev in snap.logs[-8:]:
        tc = (
            C["danger"] if ev.tag in ("DROP", "BAN")
            else (C["wl"] if ev.tag == "WHT" else (C["xdp"] if ev.tag == "XDP" else C["warn"]))
        )
        lines.append(f"│  {C['dim']}{ev.ts}{C['rst']} {tc}[{ev.tag:<4}]{C['rst']} {ev.message}")

    return "\n".join(lines)


# ------------------------------------------------------------------------------
# CLI Entrypoint
# ------------------------------------------------------------------------------

def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        prog="sparrowx-noc",
        description="SparrowX Linux Master Cybersecurity, Whitelist/Blocklist & DDoS Filtration Terminal Dashboard",
    )
    parser.add_argument("--iface", "-i", default=None, help="Network interface to monitor (default: auto-detect)")
    parser.add_argument("--interval", "-t", type=float, default=1.0, help="Refresh interval in seconds (default: 1.0)")
    parser.add_argument("--theme", choices=THEMES, default="cyber", help="Aesthetic SOC color theme (cyber|emerald|crimson)")
    parser.add_argument(
        "--autoguard",
        choices=AUTOGUARD_MODES,
        default="monitor",
        help="Smart zero-FP defense mode: monitor (default advisory), protect (30m temp-ban confirmed floods), or off",
    )
    parser.add_argument("--once", action="store_true", help="Print a single ANSI terminal snapshot and exit")
    parser.add_argument("--no-color", action="store_true", help="Disable ANSI colors in --once mode")
    parser.add_argument("--demo", action="store_true", help="Run with simulated DDoS telemetry (opt-in preview)")
    parser.add_argument(
        "--discord-webhook",
        default=None,
        help="Discord webhook URL (auto-discovered from SPARROWX_DISCORD_WEBHOOK_URL or .env if omitted)",
    )
    parser.add_argument(
        "--discord-interval",
        type=float,
        default=DISCORD_DEFAULT_DIGEST_SEC,
        help=f"Seconds between periodic Discord status digests (default: {DISCORD_DEFAULT_DIGEST_SEC}, 0 to disable)",
    )
    parser.add_argument("--no-discord", action="store_true", help="Disable Discord webhook alerts")
    parser.add_argument(
        "--discord-test",
        action="store_true",
        help="Send a live NOC snapshot embed to the configured Discord webhook and exit",
    )
    parser.add_argument(
        "--daemon",
        action="store_true",
        help="Run headless 24/7 background monitor pushing real-time Discord security alerts & periodic status updates",
    )
    args = parser.parse_args(argv)

    collector = TelemetryCollector(
        iface=args.iface,
        demo=args.demo,
        autoguard=args.autoguard,
        discord_webhook=args.discord_webhook,
        discord_interval=args.discord_interval,
        no_discord=args.no_discord,
    )

    if args.discord_test:
        if not collector.discord.enabled:
            print("ERROR: Discord webhook URL not found. Set SPARROWX_DISCORD_WEBHOOK_URL in .env or pass --discord-webhook.")
            return 1
        if not args.demo and IS_LINUX:
            collector.collect(sync_geo=False)
            time.sleep(0.35)
        snap = collector.collect(sync_geo=not args.demo)
        ok, detail = collector.discord.send_snapshot(
            snap,
            title=f"Live NOC Connection Verified ({snap.host.hostname})",
            sync=True,
        )
        print(f"Discord test {'SUCCEEDED' if ok else 'FAILED'}: {detail}")
        return 0 if ok else 1

    if args.daemon:
        poll_sec = max(2.0, float(args.interval))
        print(
            f"[sparrowx-noc v{VERSION}] Starting headless daemon (iface={collector.active_iface}, "
            f"autoguard={collector.autoguard_mode}, discord={'ON' if collector.discord.enabled else 'OFF'}, "
            f"digest={int(collector.discord.digest_interval_sec)}s, poll={poll_sec}s)",
            flush=True,
        )
        snap = collector.collect(sync_geo=not args.demo)
        if collector.discord.enabled:
            collector.discord.send_snapshot(
                snap,
                title=f"SparrowX NOC Monitor Online ({snap.host.hostname})",
                sync=True,
            )
        try:
            while True:
                time.sleep(poll_sec)
                collector.collect(sync_geo=False)
        except KeyboardInterrupt:
            pass
        return 0

    if args.once or curses is None or not sys.stdout.isatty():
        if not args.demo and IS_LINUX:
            collector.collect(sync_geo=False)
            time.sleep(0.35)
        snap = collector.collect(sync_geo=not args.demo)
        print(render_ansi_snapshot(snap, use_color=not args.no_color, theme=args.theme))
        return 0

    app = SparrowxCursesApp(collector=collector, interval=args.interval, theme=args.theme)
    try:
        curses.wrapper(app.run)
    except KeyboardInterrupt:
        pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
