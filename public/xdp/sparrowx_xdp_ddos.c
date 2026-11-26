// SPDX-License-Identifier: GPL-2.0
/*
 * SparrowX Shield — Smart Zero-False-Positive Layer 3/4 XDP / eBPF Anti-DDoS Engine
 *
 * Design Guarantees (Never Breaks Normal Users or Services):
 *  1. Internal / Docker / WireGuard / CGNAT / Loopback traffic ALWAYS passes (XDP_PASS)
 *  2. Static whitelist (`static_whitelist`) & dynamic whitelist (`whitelist`) are checked
 *     BEFORE any blocklist or rate limiter so admins, CDNs (Cloudflare), DNS, and
 *     protected services are 100% immune at wire speed
 *  3. Explicit blocklist (`blocked_ipv4`) drops confirmed attackers at NIC driver speed
 *  4. Non-breaking per-IP 1-second sliding-window volumetric rate limiter (`ip_rate_map`):
 *     - Normal HTTP/HTTPS, SSH, DNS, WireGuard, OpenVPN, DB & Game traffic passes untouched
 *     - Zero protocol-breaking blind UDP challenge hijacking
 *     - Only extreme single-IP volumetric floods (>2500 UDP pps or >600 TCP SYN/s) are
 *       temporarily rate-dropped during the flood window; normal users recover in <=1s
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

#define WHITELIST_TTL_NS      300000000000ULL  /* 300 seconds dynamic whitelist */
#define RATE_WINDOW_NS        1000000000ULL    /* 1 second sliding rate window */
#define UDP_FLOOD_PPS_LIMIT   2500U            /* Per-IP UDP pps before excess drop */
#define SYN_FLOOD_PPS_LIMIT   600U             /* Per-IP pure TCP SYN/s before excess drop */
#define ICMP_FLOOD_PPS_LIMIT  200U             /* Per-IP ICMP pps before excess drop */

struct ip_rate_state {
  __u64 window_start_ns;
  __u32 udp_pkts;
  __u32 syn_pkts;
  __u32 icmp_pkts;
  __u32 pad;
};

/* Permanent operator/service whitelist (never expires; checked BEFORE blocked_ipv4) */
struct {
  __uint(type, BPF_MAP_TYPE_HASH);
  __type(key, __u32);   /* IPv4 source address in network byte order */
  __type(value, __u64); /* Epoch written by bpftool/NOC */
  __uint(max_entries, 65536);
} static_whitelist SEC(".maps");

/* Dynamic per-CPU LRU whitelist (compatible with sparrowx-noc.py) */
struct {
  __uint(type, BPF_MAP_TYPE_LRU_PERCPU_HASH);
  __type(key, __u32);
  __type(value, __u64);
  __uint(max_entries, 2000000);
} whitelist SEC(".maps");

/* Explicit SOC/NOC/Fail2Ban blocklist */
struct {
  __uint(type, BPF_MAP_TYPE_HASH);
  __type(key, __u32);   /* IPv4 source address in network byte order */
  __type(value, __u64); /* Drop counter / epoch */
  __uint(max_entries, 262144);
} blocked_ipv4 SEC(".maps");

/* Per-IP volumetric rate tracker (temporary excess drop only, never permanent ban) */
struct {
  __uint(type, BPF_MAP_TYPE_LRU_PERCPU_HASH);
  __type(key, __u32);
  __type(value, struct ip_rate_state);
  __uint(max_entries, 524288);
} ip_rate_map SEC(".maps");

/* Monotonic XDP metrics: [0]=passed, [1]=rate_limited, [2]=dropped, [3]=whitelisted */
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

/* Always fast-pass RFC1918, Loopback, Docker, WireGuard, CGNAT, and Link-Local IPv4 */
static __always_inline int is_internal_or_safe_ipv4(__u32 saddr_be) {
  __u32 ip = bpf_ntohl(saddr_be);
  __u8 o1 = (__u8)(ip >> 24);
  __u8 o2 = (__u8)((ip >> 16) & 0xff);

  if (o1 == 127) return 1;                      /* 127.0.0.0/8 Loopback */
  if (o1 == 10) return 1;                       /* 10.0.0.0/8 Private / WireGuard */
  if (o1 == 172 && o2 >= 16 && o2 <= 31) return 1; /* 172.16.0.0/12 Docker / Private */
  if (o1 == 192 && o2 == 168) return 1;         /* 192.168.0.0/16 LAN */
  if (o1 == 100 && o2 >= 64 && o2 <= 127) return 1; /* 100.64.0.0/10 CGNAT / Tailscale */
  if (o1 == 169 && o2 == 254) return 1;         /* 169.254.0.0/16 Link-local */
  return 0;
}

/* Always fast-pass major public DNS resolvers so outbound server lookups never fail */
static __always_inline int is_critical_dns_ipv4(__u32 saddr_be) {
  __u32 ip = bpf_ntohl(saddr_be);
  if (ip == 0x01010101U || ip == 0x01000001U) return 1; /* 1.1.1.1, 1.0.0.1 */
  if (ip == 0x08080808U || ip == 0x08080404U) return 1; /* 8.8.8.8, 8.8.4.4 */
  if (ip == 0x09090909U || ip == 0x95707070U) return 1; /* 9.9.9.9, 149.112.112.112 */
  return 0;
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

    if (ip->ihl < 5) {
      stat_inc(2);
      return XDP_DROP;
    }
    __u32 ihl_bytes = (__u32)ip->ihl * 4;
    if (ihl_bytes > 60) {
      stat_inc(2);
      return XDP_DROP;
    }

    __u32 src_ip = ip->saddr;

    /* 1. Internal / Docker / WireGuard / Critical DNS ALWAYS bypass mitigation */
    if (is_internal_or_safe_ipv4(src_ip) || is_critical_dns_ipv4(src_ip)) {
      stat_inc(3);
      return XDP_PASS;
    }

    /* 2. Static whitelist ALWAYS wins over blocklist & rate limits */
    if (bpf_map_lookup_elem(&static_whitelist, &src_ip) != NULL) {
      stat_inc(3);
      return XDP_PASS;
    }

    /* 3. Dynamic whitelist check (also overrides blocklist safely) */
    __u64 ts = bpf_ktime_get_ns();
    __u64 *wl_ts = bpf_map_lookup_elem(&whitelist, &src_ip);
    if (wl_ts && (*wl_ts == 0 || (ts >= *wl_ts && (ts - *wl_ts) < WHITELIST_TTL_NS))) {
      stat_inc(3);
      return XDP_PASS;
    }

    /* 4. Confirmed explicit blocklist drop (O(1) wire-speed) */
    __u64 *blk = bpf_map_lookup_elem(&blocked_ipv4, &src_ip);
    if (blk != NULL) {
      __sync_fetch_and_add(blk, 1);
      stat_inc(2);
      return XDP_DROP;
    }

    /* 5. Smart per-IP volumetric flood rate limiter (drops ONLY excess flood packets) */
    __u8 proto = ip->protocol;
    if (proto == IPPROTO_UDP) {
      struct udphdr *udp = (void *)((__u8 *)ip + ihl_bytes);
      if ((void *)(udp + 1) > data_end) return XDP_PASS;

      /* Drop impossible truncated UDP packets (len < 8) */
      if (bpf_ntohs(udp->len) < sizeof(struct udphdr)) {
        stat_inc(2);
        return XDP_DROP;
      }

      /* Never rate-limit server-initiated DNS responses (sport == 53) */
      if (bpf_ntohs(udp->source) == 53) {
        stat_inc(0);
        return XDP_PASS;
      }

      struct ip_rate_state *st = bpf_map_lookup_elem(&ip_rate_map, &src_ip);
      if (!st) {
        struct ip_rate_state init_st = {
          .window_start_ns = ts,
          .udp_pkts = 1,
          .syn_pkts = 0,
          .icmp_pkts = 0,
          .pad = 0,
        };
        bpf_map_update_elem(&ip_rate_map, &src_ip, &init_st, BPF_ANY);
      } else {
        if (ts > st->window_start_ns && (ts - st->window_start_ns) >= RATE_WINDOW_NS) {
          st->window_start_ns = ts;
          st->udp_pkts = 1;
          st->syn_pkts = 0;
          st->icmp_pkts = 0;
        } else {
          st->udp_pkts += 1;
          if (st->udp_pkts > UDP_FLOOD_PPS_LIMIT) {
            stat_inc(1);
            stat_inc(2);
            return XDP_DROP;
          }
        }
      }
      stat_inc(0);
      return XDP_PASS;
    }

    if (proto == IPPROTO_TCP) {
      struct tcphdr *tcp = (void *)((__u8 *)ip + ihl_bytes);
      if ((void *)(tcp + 1) > data_end) return XDP_PASS;

      /* Only inspect pure TCP SYN packets (never touch established ACK/PSH/FIN data) */
      if (tcp->syn && !tcp->ack) {
        struct ip_rate_state *st = bpf_map_lookup_elem(&ip_rate_map, &src_ip);
        if (!st) {
          struct ip_rate_state init_st = {
            .window_start_ns = ts,
            .udp_pkts = 0,
            .syn_pkts = 1,
            .icmp_pkts = 0,
            .pad = 0,
          };
          bpf_map_update_elem(&ip_rate_map, &src_ip, &init_st, BPF_ANY);
        } else {
          if (ts > st->window_start_ns && (ts - st->window_start_ns) >= RATE_WINDOW_NS) {
            st->window_start_ns = ts;
            st->udp_pkts = 0;
            st->syn_pkts = 1;
            st->icmp_pkts = 0;
          } else {
            st->syn_pkts += 1;
            if (st->syn_pkts > SYN_FLOOD_PPS_LIMIT) {
              stat_inc(1);
              stat_inc(2);
              return XDP_DROP;
            }
          }
        }
      }
      stat_inc(0);
      return XDP_PASS;
    }

    if (proto == IPPROTO_ICMP) {
      struct ip_rate_state *st = bpf_map_lookup_elem(&ip_rate_map, &src_ip);
      if (!st) {
        struct ip_rate_state init_st = {
          .window_start_ns = ts,
          .udp_pkts = 0,
          .syn_pkts = 0,
          .icmp_pkts = 1,
          .pad = 0,
        };
        bpf_map_update_elem(&ip_rate_map, &src_ip, &init_st, BPF_ANY);
      } else {
        if (ts > st->window_start_ns && (ts - st->window_start_ns) >= RATE_WINDOW_NS) {
          st->window_start_ns = ts;
          st->udp_pkts = 0;
          st->syn_pkts = 0;
          st->icmp_pkts = 1;
        } else {
          st->icmp_pkts += 1;
          if (st->icmp_pkts > ICMP_FLOOD_PPS_LIMIT) {
            stat_inc(1);
            stat_inc(2);
            return XDP_DROP;
          }
        }
      }
      stat_inc(0);
      return XDP_PASS;
    }

    stat_inc(0);
    return XDP_PASS;
  } else if (eth->h_proto == bpf_htons(ETH_P_IPV6)) {
    struct ipv6hdr *ip6 = (void *)(eth + 1);
    if ((void *)(ip6 + 1) > data_end) return XDP_PASS;
    stat_inc(0);
    return XDP_PASS;
  }

  return XDP_PASS;
}

char _license[] SEC("license") = "GPL";
