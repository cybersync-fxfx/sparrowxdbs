/**
 * SparrowX Layer 3/4 XDP / eBPF Anti-DDoS Kernel Program Generator & Port Matrix
 *
 * Exposes validated port profiles, protocol inspection metadata, and the
 * verifier-safe C source for attachment to Linux network interfaces.
 */

export interface XdpProtectedServiceProfile {
  name: string;
  protocol: "UDP" | "TCP/UDP";
  ports: string;
  inspection: string;
}

export const SPARROWX_XDP_PROTECTED_PROFILES: readonly XdpProtectedServiceProfile[] = [
  {
    name: "DNS Authoritative / Resolver",
    protocol: "UDP",
    ports: "53",
    inspection: "Drops invalid QR=1 responses & short headers before sk_buff allocation",
  },
  {
    name: "WireGuard & OpenVPN Tunnels",
    protocol: "UDP",
    ports: "51820, 1194",
    inspection: "Verifies Type-1 initiation & OpenVPN HARD_RESET_CLIENT_V2/V3 opcodes",
  },
  {
    name: "FiveM / RedM / AltV",
    protocol: "TCP/UDP",
    ports: "30000-32000, 7788, 2895",
    inspection: "Validates getinfo/connect OOB frames + permits TCP SYN init bypass",
  },
  {
    name: "Steam A2S / Rust / ARK / Unturned",
    protocol: "UDP",
    ports: "27000-27500, 28015, 27015-27030",
    inspection: "Matches A2S 0xFFFFFFFF headers, RakNet 0x05 & Unturned 0x05-0x0E pings",
  },
  {
    name: "SA-MP / Squad / Mordhau / Hell Let Loose",
    protocol: "UDP",
    ports: "7000-8999, 7777, 4970-4980, 9000-9999, 22000-22126",
    inspection: "Enforces stateful 5s cookie challenge + 180s per-CPU LRU whitelist",
  },
];

const STRICT_IPV4_RE = /^(?:\d{1,3}\.){3}\d{1,3}$/;

export function sanitizeStrictIpv4List(ips: string[]): string[] {
  const valid: string[] = [];
  const seen = new Set<string>();
  for (const raw of ips) {
    const trimmed = raw.trim();
    if (!STRICT_IPV4_RE.test(trimmed)) continue;
    const octets = trimmed.split(".").map((o) => Number(o));
    if (octets.length !== 4 || octets.some((n) => !Number.isInteger(n) || n < 0 || n > 255)) {
      continue;
    }
    if (!seen.has(trimmed)) {
      seen.add(trimmed);
      valid.push(trimmed);
    }
  }
  return valid;
}

function sanitizeCCommentText(value: string): string {
  return value.replace(/\*\//g, "* /").replace(/[\r\n]/g, " ").trim();
}

export function generateSparrowxXdpProgram(options?: {
  blockedIpv4s?: string[];
  serviceName?: string;
  endpoint?: string;
}): {
  cSource: string;
  deployCommands: string;
  validIpv4s: string[];
} {
  const validIpv4s = sanitizeStrictIpv4List(options?.blockedIpv4s ?? []);
  const targetBanner = options?.serviceName
    ? `Target Service: ${sanitizeCCommentText(options.serviceName)}${
        options.endpoint ? ` (${sanitizeCCommentText(options.endpoint)})` : ""
      }`
    : "SparrowX Edge L4 Anti-DDoS Perimeter";

  const bpftoolBlockCmds =
    validIpv4s.length > 0
      ? validIpv4s
          .map((ip) => {
            const hexOctets = ip
              .split(".")
              .map((o) => Number(o).toString(16).padStart(2, "0"))
              .join(" ");
            return `sudo bpftool map update name blocked_ipv4 key hex ${hexOctets} value hex 01 00 00 00 00 00 00 00`;
          })
          .join("\n")
      : "# (No blocked IPv4 IOCs queued yet — new threat indicators sync into blocked_ipv4 via bpftool)";

  const cSource = `// SPDX-License-Identifier: GPL-2.0
/*
 * SparrowX Shield — Layer 3/4 XDP / eBPF Kernel Anti-DDoS & Challenge Engine
 * ${targetBanner}
 * Queued Static IPv4 Drops in blocked_ipv4: ${validIpv4s.length}
 *
 * Build & Attach (Linux kernel 5.8+ recommended):
 *   clang -O2 -g -Wall -target bpf -c sparrowx_xdp_ddos.c -o sparrowx_xdp_ddos.o
 *   sudo ip link set dev eth0 xdp obj sparrowx_xdp_ddos.o sec xdp
 */

#include <stddef.h>
#include <linux/bpf.h>
#include <linux/if_ether.h>
#include <linux/in.h>
#include <linux/ip.h>
#include <linux/ipv6.h>
#include <linux/tcp.h>
#include <linux/udp.h>
#include <bpf/bpf_endian.h>
#include <bpf/bpf_helpers.h>

#ifndef ETH_HLEN
#define ETH_HLEN 14
#endif

#define IP_CSUM_OFF   (ETH_HLEN + offsetof(struct iphdr, check))
#define IPV6_CSUM_OFF (ETH_HLEN + sizeof(struct ipv6hdr) + offsetof(struct udphdr, check))
#define XDP_CHALLENGE_PAYLOAD_LEN 8
#define XDP_CHALLENGE_PKT_LEN (sizeof(struct ethhdr) + sizeof(struct iphdr) + sizeof(struct udphdr) + XDP_CHALLENGE_PAYLOAD_LEN)
#define SPARROWX_COOKIE_MAGIC 0x53505831U
#define WHITELIST_TTL_NS 180000000000ULL
#define CHALLENGE_TTL_NS 5000000000ULL

struct challenge {
  __u64 timestamp;
  __u32 cookie;
  __u8 mac[6];
  __u8 pad[2];
};

struct {
  __uint(type, BPF_MAP_TYPE_LRU_HASH);
  __type(key, __u32);
  __type(value, struct challenge);
  __uint(max_entries, 1000000);
} challenge_sent SEC(".maps");

struct {
  __uint(type, BPF_MAP_TYPE_LRU_PERCPU_HASH);
  __type(key, __u32);
  __type(value, __u64);
  __uint(max_entries, 2000000);
} whitelist SEC(".maps");

struct {
  __uint(type, BPF_MAP_TYPE_HASH);
  __type(key, __u32);
  __type(value, __u64);
  __uint(max_entries, 262144);
} blocked_ipv4 SEC(".maps");

struct {
  __uint(type, BPF_MAP_TYPE_PERCPU_ARRAY);
  __type(key, __u32);
  __type(value, __u64);
  __uint(max_entries, 4);
} xdp_stats SEC(".maps");

static __always_inline void stat_inc(__u32 idx) {
  __u64 *val = bpf_map_lookup_elem(&xdp_stats, &idx);
  if (val) {
    *val += 1;
  }
}

static __always_inline int is_legit_port(__u16 port_be) {
  __u16 dport = bpf_ntohs(port_be);
  if (dport == 53 || dport == 1194 || dport == 2300 || dport == 2896 ||
      dport == 3659 || dport == 28015 || dport == 51820) {
    return 1;
  }
  if (dport >= 4970 && dport <= 4980) return 1;
  if (dport >= 7000 && dport <= 8999) return 1;
  if (dport >= 9000 && dport <= 9999) return 1;
  if (dport >= 22000 && dport <= 22126) return 1;
  if (dport >= 27000 && dport <= 27500) return 1;
  if (dport >= 30000 && dport <= 32000) return 1;
  return 0;
}

static __always_inline __u32 gen_cookie(__u16 src_port_be, __u64 ts) {
  return bpf_get_prandom_u32() ^ (__u32)src_port_be ^ (__u32)(ts & 0xffffffffU);
}

static __always_inline __u16 fold_csum(__u32 sum) {
  sum = (sum & 0xffffU) + (sum >> 16);
  sum = (sum & 0xffffU) + (sum >> 16);
  return (__u16)~sum;
}

static __always_inline __u16 compute_ipv4_csum(const struct iphdr *ip) {
  const __u16 *words = (const __u16 *)ip;
  __u32 sum = 0;

#pragma unroll
  for (int i = 0; i < (int)(sizeof(struct iphdr) / 2); i++) {
    sum += words[i];
  }
  return fold_csum(sum);
}

static __always_inline __u16 compute_udp_challenge_csum(
    __u32 saddr,
    __u32 daddr,
    const struct udphdr *udp,
    const __u8 *payload) {
  __u32 sum = 0;
  const __u16 *udp_words = (const __u16 *)udp;
  const __u16 *pay_words = (const __u16 *)payload;

  sum += (saddr & 0xffffU) + (saddr >> 16);
  sum += (daddr & 0xffffU) + (daddr >> 16);
  sum += bpf_htons(IPPROTO_UDP);
  sum += udp->len;

#pragma unroll
  for (int i = 0; i < (int)(sizeof(struct udphdr) / 2); i++) {
    sum += udp_words[i];
  }

#pragma unroll
  for (int i = 0; i < (XDP_CHALLENGE_PAYLOAD_LEN / 2); i++) {
    sum += pay_words[i];
  }

  __u16 res = fold_csum(sum);
  return res == 0 ? 0xffffU : res;
}

static __always_inline int payload_looks_legit(const void *data, const void *data_end, __u16 dport) {
  const __u8 *p = (const __u8 *)data;
  const __u8 *end = (const __u8 *)data_end;

  if (dport == 53) {
    if (p + 12 > end) return 0;
    __u16 flags = ((__u16)p[2] << 8) | p[3];
    return (flags & 0x8000U) == 0;
  }

  if (dport == 1194) {
    if (p + 1 > end) return 0;
    return ((p[0] & 0x38U) >> 3) == 7;
  }

  if (dport == 51820) {
    if (p + 4 > end) return 0;
    return p[0] == 1 && p[1] == 0 && p[2] == 0 && p[3] == 0;
  }

  if (dport == 28015) {
    if (p + 1 > end) return 0;
    return p[0] == 0x05;
  }

  if (dport == 7777 || (dport >= 7000 && dport <= 8999)) {
    if (p + 1 > end) return 0;
    if (p[0] == 0x01 || p[0] == 0x02) return 1;
  }

  if (dport == 7788 || (dport >= 7000 && dport <= 8999)) {
    if (p + 4 <= end && p[0] == 'A' && p[1] == 'L' && p[2] == 'T' && p[3] == 0) {
      return 1;
    }
  }

  if (dport >= 30000 && dport <= 32000) {
    if (p + 8 <= end && p[0] == 0xff && p[1] == 0xff && p[2] == 0xff && p[3] == 0xff) {
      if (p + 11 <= end &&
          p[4] == 'g' && p[5] == 'e' && p[6] == 't' && p[7] == 'i' &&
          p[8] == 'n' && p[9] == 'f' && p[10] == 'o') {
        return 1;
      }
      if (p[4] == 'i' && p[5] == 'n' && p[6] == 'f' && p[7] == 'o') {
        return 1;
      }
    }
    if (p + 15 <= end &&
        p[0] == 0 && p[1] == 0 && p[2] == 0 && p[3] == 0 &&
        p[4] == 0 && p[5] == 0 && p[6] == 0 && p[7] == 0 &&
        p[8] == 'c' && p[9] == 'o' && p[10] == 'n' && p[11] == 'n' &&
        p[12] == 'e' && p[13] == 'c' && p[14] == 't') {
      return 1;
    }
    return 0;
  }

  if ((dport >= 7000 && dport <= 8999) || dport == 15000 || dport == 27015) {
    if (p + 4 <= end && p[0] <= 0x01 && p[1] == 0 && p[2] == 0 && p[3] == 0) {
      return 1;
    }
  }

  if (dport == 7787 || dport == 21114 || dport == 27165 || (dport >= 7000 && dport <= 8999)) {
    if (p + 2 <= end && p[0] == 0x00 && p[1] == 0x00) {
      return 1;
    }
  }

  if (dport == 8778 || dport == 27015 || (dport >= 7000 && dport <= 8999)) {
    if (p + 4 <= end && p[0] == 0 && p[1] == 0 && p[2] == 0 && p[3] == 0) {
      return 1;
    }
  }

  if (dport >= 27015 && dport <= 27030) {
    if (p + 1 <= end && p[0] >= 0x05 && p[0] <= 0x0E) {
      return 1;
    }
  }

  if (dport >= 27000 && dport <= 27500) {
    if (p + 4 <= end && p[0] == 0xff && p[1] == 0xff && p[2] == 0xff && p[3] == 0xff) {
      return 1;
    }
    return 0;
  }

  if (dport >= 19132) {
    if (p + 5 <= end &&
        p[0] == 0xff && p[1] == 0xff && p[2] == 0xff && p[3] == 0xff && p[4] == 'T') {
      return 1;
    }
  }

  return 1;
}

SEC("xdp")
int xdp_anti_ddos(struct xdp_md *ctx) {
  void *data = (void *)(long)ctx->data;
  void *data_end = (void *)(long)ctx->data_end;

  struct ethhdr *eth = data;
  if ((void *)(eth + 1) > data_end) return XDP_PASS;

  if (eth->h_proto == bpf_htons(ETH_P_IP)) {
    struct iphdr *ip = (void *)(eth + 1);
    if ((void *)(ip + 1) > data_end) return XDP_PASS;

    __u32 src_ip = ip->saddr;
    if (bpf_map_lookup_elem(&blocked_ipv4, &src_ip) != NULL) {
      stat_inc(2);
      return XDP_DROP;
    }

    if (ip->ihl < 5) {
      stat_inc(2);
      return XDP_DROP;
    }
    __u32 ihl_bytes = (__u32)ip->ihl * 4;
    if (ihl_bytes > 60) {
      stat_inc(2);
      return XDP_DROP;
    }

    if (ip->protocol == IPPROTO_UDP) {
      struct udphdr *udp = (void *)((__u8 *)ip + ihl_bytes);
      if ((void *)(udp + 1) > data_end) return XDP_PASS;

      if (!is_legit_port(udp->dest)) return XDP_PASS;

      __u16 dport = bpf_ntohs(udp->dest);
      __u64 ts = bpf_ktime_get_ns();

      __u64 *wl_ts = bpf_map_lookup_elem(&whitelist, &src_ip);
      if (wl_ts && ts > *wl_ts && (ts - *wl_ts) < WHITELIST_TTL_NS) {
        stat_inc(3);
        return XDP_PASS;
      }

      const void *payload = (const void *)(udp + 1);

      if ((const __u8 *)data_end - (const __u8 *)payload >= XDP_CHALLENGE_PAYLOAD_LEN) {
        __u32 maybe_cookie = 0;
        __builtin_memcpy(&maybe_cookie, payload, sizeof(maybe_cookie));
        struct challenge *ch = bpf_map_lookup_elem(&challenge_sent, &src_ip);
        if (ch && ch->cookie == maybe_cookie && ts >= ch->timestamp &&
            (ts - ch->timestamp) < CHALLENGE_TTL_NS) {
          __u64 now = bpf_ktime_get_ns();
          bpf_map_update_elem(&whitelist, &src_ip, &now, BPF_ANY);
          bpf_map_delete_elem(&challenge_sent, &src_ip);
          stat_inc(0);
          return XDP_PASS;
        }
      }

      if (!payload_looks_legit(payload, data_end, dport)) {
        stat_inc(2);
        return XDP_DROP;
      }

      __u32 dst_ip = ip->daddr;
      __u16 src_port_be = udp->source;
      __u16 dst_port_be = udp->dest;
      __u32 cookie = gen_cookie(src_port_be, ts);

      struct challenge ch = {
        .timestamp = ts,
        .cookie = cookie,
      };
      __builtin_memcpy(ch.mac, eth->h_source, ETH_ALEN);
      bpf_map_update_elem(&challenge_sent, &src_ip, &ch, BPF_ANY);

      int pkt_len = (int)((__u8 *)data_end - (__u8 *)data);
      int delta = (int)XDP_CHALLENGE_PKT_LEN - pkt_len;
      if (bpf_xdp_adjust_tail(ctx, delta) < 0) {
        stat_inc(2);
        return XDP_DROP;
      }

      data = (void *)(long)ctx->data;
      data_end = (void *)(long)ctx->data_end;
      eth = data;
      if ((void *)(eth + 1) > data_end) return XDP_DROP;

      __u8 tmp_mac[ETH_ALEN];
      __builtin_memcpy(tmp_mac, eth->h_dest, ETH_ALEN);
      __builtin_memcpy(eth->h_dest, eth->h_source, ETH_ALEN);
      __builtin_memcpy(eth->h_source, tmp_mac, ETH_ALEN);
      eth->h_proto = bpf_htons(ETH_P_IP);

      struct iphdr *rip = (void *)(eth + 1);
      if ((void *)(rip + 1) > data_end) return XDP_DROP;
      rip->version = 4;
      rip->ihl = 5;
      rip->tos = 0;
      rip->tot_len = bpf_htons(sizeof(struct iphdr) + sizeof(struct udphdr) + XDP_CHALLENGE_PAYLOAD_LEN);
      rip->id = 0;
      rip->frag_off = bpf_htons(0x4000);
      rip->ttl = 64;
      rip->protocol = IPPROTO_UDP;
      rip->saddr = dst_ip;
      rip->daddr = src_ip;
      rip->check = 0;
      rip->check = compute_ipv4_csum(rip);

      struct udphdr *rudp = (void *)(rip + 1);
      if ((void *)(rudp + 1) > data_end) return XDP_DROP;
      rudp->source = dst_port_be;
      rudp->dest = src_port_be;
      rudp->len = bpf_htons(sizeof(struct udphdr) + XDP_CHALLENGE_PAYLOAD_LEN);
      rudp->check = 0;

      __u8 *pay_out = (__u8 *)(rudp + 1);
      if (pay_out + XDP_CHALLENGE_PAYLOAD_LEN > (__u8 *)data_end) return XDP_DROP;

      __u32 magic_be = bpf_htonl(SPARROWX_COOKIE_MAGIC);
      __builtin_memcpy(pay_out, &cookie, sizeof(cookie));
      __builtin_memcpy(pay_out + 4, &magic_be, sizeof(magic_be));
      rudp->check = compute_udp_challenge_csum(rip->saddr, rip->daddr, rudp, pay_out);

      stat_inc(1);
      return XDP_TX;
    }

    if (ip->protocol == IPPROTO_TCP) {
      struct tcphdr *tcp = (void *)((__u8 *)ip + ihl_bytes);
      if ((void *)(tcp + 1) > data_end) return XDP_PASS;
      __u16 dport = bpf_ntohs(tcp->dest);
      if ((dport >= 30000 && dport <= 32000) || dport == 2895) {
        if (tcp->syn && !tcp->ack) {
          stat_inc(0);
          return XDP_PASS;
        }
      }
    }
  } else if (eth->h_proto == bpf_htons(ETH_P_IPV6)) {
    struct ipv6hdr *ip6 = (void *)(eth + 1);
    if ((void *)(ip6 + 1) > data_end) return XDP_PASS;

    if (ip6->nexthdr == IPPROTO_UDP) {
      struct udphdr *udp6 = (void *)(ip6 + 1);
      if ((void *)(udp6 + 1) > data_end) return XDP_PASS;
      if (!is_legit_port(udp6->dest)) return XDP_PASS;

      const void *payload6 = (const void *)(udp6 + 1);
      if (!payload_looks_legit(payload6, data_end, bpf_ntohs(udp6->dest))) {
        stat_inc(2);
        return XDP_DROP;
      }
      stat_inc(0);
      return XDP_PASS;
    }
  }

  return XDP_PASS;
}

char _license[] SEC("license") = "GPL";

/*
 * ==============================================================================
 * SparrowX SOC Threat-Feed IPv4 Map Sync Commands (bpftool)
 * ==============================================================================
${bpftoolBlockCmds}
 */
`;

  const deployCommands = `# Option A: Single-File All-in-One DDoS + XDP Setup (sysctl + UFW + Fail2Ban + XDP + systemd)
curl -sSL https://sparrowx.net/ddos-setup.sh | sudo bash

# Option B: Manual XDP eBPF Compile & NIC Attach
sudo apt-get update && sudo apt-get install -y clang llvm libbpf-dev linux-headers-$(uname -r) bpftool iproute2
clang -O2 -g -Wall -target bpf -c sparrowx_xdp_ddos.c -o sparrowx_xdp_ddos.o
IFACE=$(ip route show default | awk '/default/ {print $5; exit}')
sudo ip link set dev "$IFACE" xdp obj sparrowx_xdp_ddos.o sec xdp || sudo ip link set dev "$IFACE" xdpgeneric obj sparrowx_xdp_ddos.o sec xdp`;

  return { cSource, deployCommands, validIpv4s };
}
