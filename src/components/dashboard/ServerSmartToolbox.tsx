import { useState } from "react";
import { toast } from "sonner";
import {
  Bot,
  Check,
  Copy,
  Cpu,
  Download,
  Package,
  Sliders,
  Sparkles,
  Users,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ServerView } from "@/lib/portal-types";

interface CatalogAddOn {
  id: string;
  name: string;
  category: string;
  description: string;
  version: string;
}

const MINECRAFT_PLUGINS: CatalogAddOn[] = [
  { id: "essentialsx", name: "EssentialsX", category: "Core", description: "Homes, warps, economy, kits & moderation commands", version: "2.21.0" },
  { id: "luckperms", name: "LuckPerms", category: "Permissions", description: "High-performance rank & permission web editor", version: "5.4.145" },
  { id: "worldedit", name: "FastAsyncWorldEdit", category: "Building", description: "Blazing-fast async terrain & schematic editing", version: "2.11.2" },
  { id: "geyser", name: "GeyserMC + Floodgate", category: "Crossplay", description: "Allow Bedrock Edition players to join Java servers", version: "2.4.2" },
  { id: "spark", name: "Spark Profiler", category: "Performance", description: "Live 20.0 TPS & CPU/memory lag profiler", version: "1.10.109" },
  { id: "vault", name: "Vault", category: "API", description: "Universal economy, chat & permissions bridge", version: "1.7.3" },
];

const FIVEM_RESOURCES: CatalogAddOn[] = [
  { id: "ox_lib", name: "ox_lib", category: "Framework", description: "Modern UI, callbacks, zones & shared FiveM library", version: "3.27.0" },
  { id: "oxmysql", name: "oxmysql", category: "Database", description: "High-throughput async MySQL driver for RP cities", version: "2.12.0" },
  { id: "qb-core", name: "QBCore Framework", category: "RP Core", description: "Modular GTA V RP framework with jobs & inventory", version: "1.2.6" },
  { id: "pma-voice", name: "pma-voice", category: "Voice", description: "Native Mumble proximity voice & radio channels", version: "6.7.3" },
];

const SAMP_PLUGINS: CatalogAddOn[] = [
  { id: "streamer", name: "Incognito Streamer", category: "World", description: "Dynamic objects, pickups, checkpoints & map icons", version: "2.9.6" },
  { id: "sscanf2", name: "sscanf2", category: "Commands", description: "Fast C++ command parameter parser for Pawn", version: "2.13.8" },
  { id: "mysql-r41", name: "BlueG MySQL R41-4", category: "Database", description: "Threaded MySQL plugin for player accounts & saves", version: "R41-4" },
  { id: "crashdetect", name: "CrashDetect", category: "Diagnostics", description: "Prints exact Pawn backtraces on runtime errors", version: "4.22" },
];

const BOT_PRESETS: CatalogAddOn[] = [
  { id: "discordjs-v14", name: "discord.js v14 Starter", category: "Node.js 22", description: "Slash commands, sharding & auto-reconnect template", version: "14.16.3" },
  { id: "discordpy-v2", name: "discord.py 2.4 Cogs", category: "Python 3.12", description: "Async slash commands & modular cog loader", version: "2.4.0" },
  { id: "lavalink-v4", name: "Lavalink v4 Audio Node", category: "Music", description: "Low-latency standalone audio streaming server", version: "4.0.8" },
];

function buildAiConfigForServer(server: ServerView): { filename: string; content: string; tip: string } {
  const ramMb = server.ramLimitMb || 4096;
  const heapMb = Math.max(1024, Math.floor(ramMb * 0.8));

  if (server.service === "minecraft") {
    return {
      filename: "server.properties + Aikar JVM Flags",
      tip: `Tuned for ${ramMb}MB RAM (${heapMb}MB Xmx) to lock 20.0 TPS on Paper/Purpur.`,
      content: `# SparrowX AI Optimized Minecraft Config (${server.name})
view-distance=10
simulation-distance=7
max-players=100
online-mode=true
sync-chunk-writes=false
network-compression-threshold=256

# Startup JVM Flags (Aikar's G1GC)
java -Xms${heapMb}M -Xmx${heapMb}M -XX:+UseG1GC -XX:+ParallelRefProcEnabled -XX:MaxGCPauseMillis=200 -jar server.jar nogui`,
    };
  }

  if (server.service === "fivem") {
    return {
      filename: "server.cfg (txAdmin + OneSync Infinity)",
      tip: `Optimized for ${server.cpuLimit}% vCPU & ${ramMb}MB RAM with OneSync Infinity enabled.`,
      content: `# SparrowX AI Optimized FiveM Config (${server.name})
sv_hostname "${server.name} | Powered by SparrowX"
sets onesync on
sv_maxclients 128
set steam_webApiKey "YOUR_STEAM_API_KEY"
sv_licenseKey "YOUR_CFX_LICENSE_KEY"

ensure oxmysql
ensure ox_lib
ensure pma-voice`,
    };
  }

  if (server.service === "samp") {
    return {
      filename: "server.cfg / open.mp config.json",
      tip: "Zero-lag Pawn tickrate config with essential SA-MP/open.mp plugins pre-ordered.",
      content: `# SparrowX AI Optimized SA-MP / open.mp Config (${server.name})
hostname ${server.name} | SparrowX Asia-IN
maxplayers 200
gamemode0 main 1
plugins crashdetect.so streamer.so sscanf.so mysql.so
stream_rate 1000
stream_distance 200.0
onfoot_rate 40
incar_rate 40`,
    };
  }

  return {
    filename: ".env + Bot Startup Config",
    tip: `Configured for 24/7 zero-sleep bot hosting (${ramMb}MB RAM limit).`,
    content: `# SparrowX AI Optimized Discord Bot Config (${server.name})
NODE_ENV=production
DISCORD_TOKEN=PASTE_YOUR_BOT_TOKEN_HERE
AUTO_RESTART=true
NODE_OPTIONS=--max-old-space-size=${heapMb}`,
  };
}

export function ServerSmartToolbox({ server }: { server: ServerView }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"addons" | "ai-config" | "connections">("addons");
  const [installedIds, setInstalledIds] = useState<string[]>([]);
  const [copiedConfig, setCopiedConfig] = useState(false);

  const service = server.service ?? "minecraft";
  const catalog =
    service === "minecraft"
      ? { title: "Minecraft Mod & Plugin Manager", badge: "Paper / Purpur / Modrinth", items: MINECRAFT_PLUGINS }
      : service === "fivem"
        ? { title: "FiveM Resource & txAdmin Manager", badge: "Cfx.re / OneSync", items: FIVEM_RESOURCES }
        : service === "samp"
          ? { title: "SA-MP / open.mp Plugin Manager", badge: "Pawn / open.mp", items: SAMP_PLUGINS }
          : { title: "Discord Bot Runtime & Packages", badge: "Node.js / Python / Lavalink", items: BOT_PRESETS };

  const aiConfig = buildAiConfigForServer(server);

  const handleInstallAddon = (item: CatalogAddOn) => {
    if (installedIds.includes(item.id)) return;
    setInstalledIds((prev) => [...prev, item.id]);
    toast.success(`Queued ${item.name} v${item.version}`, {
      description: `Open Pterodactyl Panel on ${server.name} to apply & restart cleanly.`,
    });
  };

  const handleCopyAiConfig = async () => {
    try {
      await navigator.clipboard.writeText(aiConfig.content);
      setCopiedConfig(true);
      toast.success(`Copied ${aiConfig.filename}`);
      setTimeout(() => setCopiedConfig(false), 1800);
    } catch {
      toast.error("Clipboard unavailable");
    }
  };

  return (
    <div className="mt-3 border-t border-border/60 pt-3">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between rounded-xl border border-border/80 bg-card/50 px-3 py-2 text-xs font-medium text-foreground hover:border-sheen/60 transition-colors cursor-pointer"
      >
        <span className="inline-flex items-center gap-2">
          {service === "discord" ? (
            <Bot className="size-3.5 text-indigo-400" />
          ) : (
            <Wrench className="size-3.5 text-sheen" />
          )}
          <span>{catalog.title} · AI Config · Active Users</span>
        </span>
        <span className="font-mono text-[10px] text-muted-foreground">{open ? "Hide" : "Manage"}</span>
      </button>

      {open && (
        <div className="mt-3 space-y-3 rounded-xl border border-border bg-[#07090F] p-3.5 text-xs">
          {/* Isolated Tool Tabs */}
          <div className="flex flex-wrap items-center gap-1.5 border-b border-border/70 pb-2.5">
            <button
              type="button"
              onClick={() => setTab("addons")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-colors cursor-pointer ${
                tab === "addons" ? "bg-white text-black font-semibold" : "text-muted-foreground hover:text-white"
              }`}
            >
              <Package className="size-3.5" />
              <span>{service === "minecraft" ? "Plugins & Mods" : service === "fivem" ? "Resources" : service === "samp" ? "SA-MP Plugins" : "Bot Runtimes"}</span>
            </button>
            <button
              type="button"
              onClick={() => setTab("ai-config")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-colors cursor-pointer ${
                tab === "ai-config" ? "bg-white text-black font-semibold" : "text-muted-foreground hover:text-white"
              }`}
            >
              <Sparkles className="size-3.5" />
              <span>AI Config Helper</span>
            </button>
            <button
              type="button"
              onClick={() => setTab("connections")}
              className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 font-medium transition-colors cursor-pointer ${
                tab === "connections" ? "bg-white text-black font-semibold" : "text-muted-foreground hover:text-white"
              }`}
            >
              <Users className="size-3.5" />
              <span>Active Connections</span>
            </button>
          </div>

          {tab === "addons" && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-[11px] text-muted-foreground">
                <span>{catalog.title}</span>
                <span className="font-mono text-sheen">{catalog.badge}</span>
              </div>
              <div className="grid grid-cols-1 gap-2">
                {catalog.items.map((item) => {
                  const isInstalled = installedIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      className="flex items-center justify-between gap-2 rounded-lg border border-border/70 bg-background/50 px-3 py-2"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-white">{item.name}</span>
                          <span className="rounded bg-white/10 px-1.5 py-0.5 font-mono text-[10px] text-zinc-300">
                            v{item.version}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">{item.description}</p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant={isInstalled ? "secondary" : "outline"}
                        className="h-7 shrink-0 rounded-lg px-2.5 text-[11px]"
                        onClick={() => handleInstallAddon(item)}
                      >
                        {isInstalled ? <Check className="size-3 text-emerald-400" /> : <Download className="size-3" />}
                        <span>{isInstalled ? "Queued" : "Install"}</span>
                      </Button>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {tab === "ai-config" && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <p className="font-semibold text-white flex items-center gap-1.5">
                    <Sliders className="size-3.5 text-sheen" /> {aiConfig.filename}
                  </p>
                  <p className="text-[11px] text-muted-foreground">{aiConfig.tip}</p>
                </div>
                <Button type="button" size="sm" variant="outline" className="h-7 text-[11px]" onClick={handleCopyAiConfig}>
                  {copiedConfig ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                  <span>{copiedConfig ? "Copied" : "Copy"}</span>
                </Button>
              </div>
              <pre className="overflow-x-auto rounded-lg border border-border bg-black/70 p-3 font-mono text-[11px] leading-relaxed text-emerald-300">
                {aiConfig.content}
              </pre>
            </div>
          )}

          {tab === "connections" && (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between rounded-lg border border-border/70 bg-background/50 p-3">
                <div className="space-y-0.5">
                  <p className="font-semibold text-white flex items-center gap-1.5">
                    <Cpu className="size-3.5 text-emerald-400" /> Live Node Session Manager
                  </p>
                  <p className="text-[11px] text-muted-foreground">
                    Endpoint: <span className="font-mono text-zinc-200">{server.address ?? "Allocating…"}</span> · Status:{" "}
                    <span className="font-mono text-emerald-300">{server.status}</span>
                  </p>
                </div>
                <Button asChild size="sm" variant="secondary" className="h-7 text-[11px]">
                  <a
                    href={`/api/game/panel-sso?next=${encodeURIComponent(`/server/${server.identifier}/users`)}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Manage Sub-Users
                  </a>
                </Button>
              </div>
              <p className="text-[11px] text-muted-foreground">
                Invite staff/co-owners with scoped permissions (Console, Files, Startup, Backups) or inspect live active player connections directly inside the Pterodactyl Console.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
