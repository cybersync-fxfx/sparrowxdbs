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
import re
import shutil
import socket
import struct
import subprocess
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Deque, Dict, List, Optional, Set, Tuple

try:
    import curses
except ImportError:
    curses = None  # Handled gracefully for --once mode on non-curses systems


VERSION = "2.5.0"
SPARK_CHARS = " ▁▂▃▄▅▆▇█"
IS_LINUX = sys.platform.startswith("linux")
THEMES = ("cyber", "emerald", "crimson")
WHITELIST_FILE = Path("/opt/sparrowx/xdp/whitelist_ipv4.txt")
BLOCKLIST_FILE = Path("/opt/sparrowx/xdp/blocked_ipv4.txt")


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
    risk: str  # WHITELIST | BLOCKED | FLOOD | WARN | OK


@dataclass
class PolicyIpEntry:
    ip: str
    source: str  # XDP | NFT | UFW | F2B | FILE
    note: str


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
# Linux Telemetry Collectors (100% Real Kernel/System Data in Live Mode)
# ------------------------------------------------------------------------------

class TelemetryCollector:
    def __init__(self, iface: Optional[str] = None, demo: bool = False):
        self.demo = demo
        self.forced_iface = iface
        self.active_iface = iface or self._detect_default_iface()

        self._prev_cpu: Optional[Tuple[int, int]] = None
        self._prev_net: Dict[str, Tuple[float, int, int, int, int, int, int]] = {}
        self._prev_xdp_drop: Optional[Tuple[float, int]] = None
        self._prev_snmp: Optional[Tuple[float, int, int, int, int]] = None
        self._prev_wg_bytes: Dict[str, Tuple[float, int, int]] = {}
        self._peak_rx_bps: float = 0.0
        self._peak_tx_bps: float = 0.0

        self.rx_history: Deque[float] = collections.deque(maxlen=72)
        self.tx_history: Deque[float] = collections.deque(maxlen=72)

        self.log_buffer: Deque[LogEvent] = collections.deque(maxlen=350)
        self._log_offsets: Dict[str, int] = {}
        self._demo_tick = 0
        self._demo_strict = False

        # Demo lists (ONLY used when --demo is explicitly enabled)
        self._demo_banned: List[PolicyIpEntry] = [
            PolicyIpEntry("185.220.101.42", "XDP", "482.1K pkts"),
            PolicyIpEntry("45.155.205.91", "XDP", "194.6K pkts"),
            PolicyIpEntry("91.240.118.17", "NFT", "sparrowx_shield"),
            PolicyIpEntry("194.26.135.88", "F2B", "sshd / syn-flood"),
            PolicyIpEntry("103.149.28.14", "UFW", "DENY IN"),
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

            # XDP Whitelist map (`whitelist` in sparrowx_xdp_ddos.c)
            for dump_cmd in (
                ["bpftool", "-j", "map", "dump", "pinned", "/sys/fs/bpf/sparrowx/whitelist"],
                ["bpftool", "-j", "map", "dump", "name", "whitelist"],
            ):
                rc, out, _ = run_cmd(dump_cmd, timeout=1.2)
                if rc == 0 and out.strip().startswith("["):
                    try:
                        for entry in json.loads(out)[:80]:
                            ip = parse_hex_key_to_ipv4(entry.get("key"))
                            if ip and (ip, "XDP") not in seen_white:
                                whitelisted.append(PolicyIpEntry(ip, "XDP", "XDP_PASS (fast-path)"))
                                seen_white.add((ip, "XDP"))
                        break
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

        # Threat Level calculation from real telemetry
        if fs.xdp_drop_pps >= 1000 or fs.syn_recv_count >= 50:
            fs.threat_level = "UNDER ATTACK"
        elif fs.xdp_drop_pps >= 50 or fs.syn_recv_count >= 15 or fs.fail2ban_banned >= 20:
            fs.threat_level = "ELEVATED"
        else:
            fs.threat_level = "NORMAL"

        return fs, blocked, whitelisted

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

        # 4. Exposed listening ports (`ss -tuln`)
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

        talkers: List[RemoteTalker] = []
        for ip, info in agg.items():
            if info["syn"] >= 8 or info["total"] >= 40:
                risk = "FLOOD"
            elif info["syn"] >= 3 or info["total"] >= 15:
                risk = "WARN"
            else:
                risk = "OK"
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
                )
            )

        talkers.sort(key=lambda t: (t.syn_recv * 10 + t.total_conns), reverse=True)
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

    def ban_ip(self, ip: str) -> str:
        ip = ip.strip()
        if not is_valid_ipv4(ip):
            msg = f"Invalid IPv4 address: {ip}"
            self.push_event("SYS", msg)
            return msg

        if self.demo:
            self._demo_whitelisted = [w for w in self._demo_whitelisted if w.ip != ip]
            if not any(b.ip == ip for b in self._demo_banned):
                self._demo_banned.insert(0, PolicyIpEntry(ip, "XDP", "manual ban"))
            msg = f"[DEMO] Banned {ip} across XDP + nftables + UFW"
            self.push_event("BAN", msg)
            return msg

        # Ensure IP is removed from whitelist first to avoid policy conflict
        self.unwhitelist_ip(ip, silent=True)

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

        if self._persist_ip_line(BLOCKLIST_FILE, ip):
            applied.append("file")

        if applied:
            msg = f"BANNED {ip} -> [{', '.join(applied)}]"
            self.push_event("BAN", msg)
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
        # 1. Inject into XDP whitelist map (`whitelist` per-CPU LRU or pinned)
        if shutil.which("bpftool"):
            hex_key = [f"{int(oct_):02x}" for oct_ in ip.split(".")]
            ts_ns_hex = [f"{b:02x}" for b in struct.pack("<Q", int(time.time() * 1_000_000_000))]
            rc, _, _ = run_cmd(
                ["bpftool", "map", "update", "name", "whitelist", "key", "hex", *hex_key, "value", "hex", *ts_ns_hex],
                timeout=1.5,
            )
            if rc == 0:
                applied.append("XDP:whitelist")

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
            rc, _, _ = run_cmd(["bpftool", "map", "delete", "name", "whitelist", "key", "hex", *hex_key], timeout=1.5)
            if rc == 0:
                removed.append("XDP:whitelist")

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

    def toggle_strict_mode(self) -> str:
        if self.demo:
            self._demo_strict = not self._demo_strict
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

        if not currently_strict:
            cmds = [
                ["sysctl", "-w", "net.ipv4.tcp_syncookies=1"],
                ["sysctl", "-w", "net.ipv4.tcp_synack_retries=2"],
                ["sysctl", "-w", "net.ipv4.tcp_max_syn_backlog=16384"],
            ]
            ok = all(run_cmd(c, timeout=1.0)[0] == 0 for c in cmds)
            msg = (
                "UNDER-ATTACK STRICT MODE ENABLED (SYN cookies + backlog=16384)"
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
                "Strict mode relaxed to standard SYN backlog profile"
                if ok
                else "Strict mode toggle requires root privileges"
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

    def collect(self) -> DashboardSnapshot:
        if self.demo:
            return self._collect_demo()

        host = self._collect_host()
        nic = self._collect_nic()
        talkers, syn_recv, time_wait, established, total_sockets = self._collect_connections()
        filtration, blocked, whitelisted = self._collect_filtration_and_policies(
            syn_recv=syn_recv,
            time_wait=time_wait,
            established=established,
            total_sockets=total_sockets,
        )
        # Cross-tag remote talkers with live WHITELIST / BLOCKED policy status
        wl_set = {w.ip for w in whitelisted}
        bl_set = {b.ip for b in blocked}
        for tk in talkers:
            if tk.ip in wl_set:
                tk.risk = "WHITELIST"
            elif tk.ip in bl_set and tk.risk != "FLOOD":
                tk.risk = "BLOCKED"

        backends, listening_ports = self._collect_backends_and_ports()
        self._poll_logs()

        return DashboardSnapshot(
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
        sub = (
            f" CPU [{cpu_bar}] {snap.host.cpu_pct:4.1f}% ({snap.host.cpu_cores}c)  │  "
            f"RAM [{ram_bar}] {snap.host.mem_used_gb:.1f}/{snap.host.mem_total_gb:.1f}GB  │  "
            f"LOAD {snap.host.load_1m:.2f}/{snap.host.load_5m:.2f}/{snap.host.load_15m:.2f}  │  "
            f"UP {snap.host.uptime_str}  │  "
            f"⛔ {len(snap.blocked_ips)} BLOCKED  ·  ✓ {len(snap.whitelisted_ips)} WHITELISTED"
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
            if t.risk == "WHITELIST":
                attr = curses.color_pair(self.P_WHITELIST) | curses.A_BOLD
            elif t.risk in ("FLOOD", "BLOCKED"):
                attr = curses.color_pair(self.P_DANGER) | curses.A_BOLD
            elif t.risk == "WARN":
                attr = curses.color_pair(self.P_WARN) | curses.A_BOLD
            else:
                attr = curses.color_pair(self.P_TEXT)
            if idx == self.selected_talker_idx:
                attr |= curses.A_REVERSE
            badge = "✓ WL" if t.risk == "WHITELIST" else ("⛔ BLK" if t.risk == "BLOCKED" else t.risk)
            line = (
                f"{t.ip[:16]:<16} {t.total_conns:>4} {t.established:>4} {t.syn_recv:>4} "
                f"{t.time_wait:>3} {t.udp_conns:>4} {t.ports[:10]:<10} {t.process[:8]:<8} {badge}"
            )
            self._safe_addstr(win, row, 2, line, attr)
            row += 1

    # -- Pane 4: Dedicated Blocklist & Whitelist Manager -----------------------

    def _render_pane_policies(self, win, snap: DashboardSnapshot) -> None:
        if win is None:
            return
        h, w = win.getmaxyx()
        inner_w = max(10, w - 4)

        blocked = snap.blocked_ips
        whitelisted = snap.whitelisted_ips
        if self.filter_text:
            q = self.filter_text.lower()
            blocked = [b for b in blocked if q in b.ip.lower() or q in b.source.lower() or q in b.note.lower()]
            whitelisted = [x for x in whitelisted if q in x.ip.lower() or q in x.source.lower() or q in x.note.lower()]

        row = 1
        if self.policy_view == 0:
            # SPLIT VIEW: Both current BLOCKLISTED and WHITELISTED visible simultaneously
            avail = max(2, h - 2)
            bl_budget = max(2, avail // 2)

            self._safe_addstr(
                win, row, 2,
                f"⛔ BLOCKLISTED ({len(blocked)})  [b] Ban  [u] Unban",
                curses.color_pair(self.P_DANGER) | curses.A_BOLD,
            )
            row += 1
            if not blocked:
                if row < h - 1:
                    self._safe_addstr(win, row, 2, "  0 IPs currently blocklisted", curses.color_pair(self.P_MUTED))
                    row += 1
            else:
                shown = 0
                for b in blocked:
                    if row >= min(h - 3, 1 + bl_budget):
                        break
                    attr = curses.color_pair(self.P_XDP if b.source == "XDP" else self.P_DANGER)
                    self._safe_addstr(win, row, 2, f"  {b.ip:<16} [{b.source:<4}] {b.note}", attr)
                    row += 1
                    shown += 1

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
                f"⛔ BLOCKLISTED ({len(blocked)}) — [t] Toggle Split/Whitelist",
                curses.color_pair(self.P_DANGER) | curses.A_BOLD,
            )
            row += 1
            if not blocked:
                self._safe_addstr(win, row + 1, 2, "0 IPs currently blocklisted.", curses.color_pair(self.P_GOOD))
            for b in blocked:
                if row >= h - 1:
                    break
                attr = curses.color_pair(self.P_XDP if b.source == "XDP" else self.P_DANGER)
                self._safe_addstr(win, row, 2, f"  {b.ip:<16} [{b.source:<4}] {b.note}", attr)
                row += 1
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
            elif ev.tag == "WHT":
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
                f" [1-5/0] Pane  [b] Ban  [u] Unban  [w] Whitelist  [W] UnWL  [t] WL/BL View  "
                f"[x] StrictSYN  [c] Theme  [i] NIC  [p] {pause_lbl}  [/] Filter  [q] Quit{filt_lbl}"
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
            elif ch in (ord("x"), ord("X")):
                msg = self.collector.toggle_strict_mode()
                self.snapshot = self.collector.collect()
                self.set_banner(msg)
            elif ch == curses.KEY_UP:
                self.selected_talker_idx = max(0, self.selected_talker_idx - 1)
            elif ch == curses.KEY_DOWN:
                self.selected_talker_idx += 1
            elif ch in (ord("b"), ord("B")):
                talkers = self._filtered_talkers(snap)
                prefill = talkers[self.selected_talker_idx].ip if talkers and self.selected_talker_idx < len(talkers) else ""
                target = self._prompt_input(stdscr, "BAN IPv4 (XDP+nft+UFW): ", prefill=prefill)
                if target:
                    msg = self.collector.ban_ip(target)
                    self.snapshot = self.collector.collect()
                    self.set_banner(msg)
            elif ch in (ord("u"), ord("U")):
                prefill = snap.blocked_ips[0].ip if snap.blocked_ips else ""
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
        for b in snap.blocked_ips[:8]:
            lines.append(f"│    {C['danger']}{b.ip:<17}{C['rst']} [{b.source:<4}]  {b.note}")
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
    parser.add_argument("--once", action="store_true", help="Print a single ANSI terminal snapshot and exit")
    parser.add_argument("--no-color", action="store_true", help="Disable ANSI colors in --once mode")
    parser.add_argument("--demo", action="store_true", help="Run with simulated DDoS telemetry (opt-in preview)")
    args = parser.parse_args(argv)

    collector = TelemetryCollector(iface=args.iface, demo=args.demo)

    if args.once or curses is None or not sys.stdout.isatty():
        if not args.demo and IS_LINUX:
            collector.collect()
            time.sleep(0.35)
        snap = collector.collect()
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
