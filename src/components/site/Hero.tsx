import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SERVICES, type Service, type ServiceId } from "@/lib/services";
import { useSessionSummary } from "./Navbar";

interface HeroScene {
  id: string;
  label: string;
  image: string;
  serviceId?: ServiceId;
  eggQuery: string;
  section: "games" | "applications" | "generic";
}

const HERO_SCENES: HeroScene[] = [
  {
    id: "minecraft",
    label: "Minecraft",
    image: SERVICES.minecraft.image,
    serviceId: "minecraft",
    eggQuery: "paper",
    section: "games",
  },
  {
    id: "fivem",
    label: "FiveM",
    image: SERVICES.fivem.image,
    serviceId: "fivem",
    eggQuery: "fivem",
    section: "games",
  },
  {
    id: "samp",
    label: "SA-MP",
    image: SERVICES.samp.image,
    serviceId: "samp",
    eggQuery: "samp",
    section: "games",
  },
  {
    id: "rust",
    label: "Rust",
    image: "/images/game-showcase/rust-hero.jpg",
    eggQuery: "rust",
    section: "games",
  },
  {
    id: "apps",
    label: "Apps & Runtimes",
    image: "/images/game-showcase/apps-stack.jpg",
    serviceId: "discord",
    eggQuery: "python",
    section: "generic",
  },
];

export function Hero({
  service,
  onService,
}: {
  service: Service;
  onService: (s: ServiceId) => void;
}) {
  const { data: me } = useSessionSummary();
  const [sceneId, setSceneId] = useState<string>(
    HERO_SCENES.find((s) => s.serviceId === service.id)?.id ?? "minecraft",
  );

  const activeScene = HERO_SCENES.find((s) => s.id === sceneId) ?? HERO_SCENES[0]!;
  const targetDashboard = `/game/dashboard?egg=${encodeURIComponent(activeScene.eggQuery)}&section=${activeScene.section}`;
  const primaryHref = me ? targetDashboard : `/login?next=${encodeURIComponent(targetDashboard)}`;

  const handleSelectScene = (scene: HeroScene) => {
    setSceneId(scene.id);
    if (scene.serviceId) onService(scene.serviceId);
  };

  return (
    <section className="relative isolate flex min-h-[92svh] flex-col justify-between overflow-hidden bg-[#05060a] pt-28 pb-10">
      {/* Full-bleed atmospheric backdrop bleeding seamlessly behind navbar (y = 0) */}
      <img
        key={activeScene.id}
        src={activeScene.image}
        alt=""
        aria-hidden="true"
        fetchPriority="high"
        decoding="sync"
        className="pointer-events-none absolute inset-0 -z-20 h-full w-full object-cover opacity-55 transition-opacity duration-500 ease-out"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-[#05060a]/80 via-[#05060a]/55 to-[#05060a]"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_center,transparent_25%,#05060a_92%)]"
      />

      {/* Centered monumental display typography */}
      <div className="mx-auto my-auto flex w-full max-w-5xl flex-col items-center px-5 text-center">
        <h1 className="font-display text-[clamp(2.5rem,6.4vw,5.25rem)] font-bold leading-[0.98] tracking-[-0.03em] text-white">
          Host 321+ Games, Bots and Cloud Runtimes
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-slate-200 sm:text-lg">
          Indian NVMe Gen4 nodes with automatic smart sizing, guided server setup, and instant panel sync.
        </p>

        <div className="mt-9">
          <Button asChild variant="ivory" size="xl" className="h-13 rounded-2xl px-7 text-base font-semibold">
            <a href={primaryHref}>
              <span>{me ? "Open Client Area" : "Sign In to Launch Server"}</span>
              <ArrowRight className="size-4" aria-hidden="true" />
            </a>
          </Button>
        </div>
      </div>

      {/* Interactive world backdrop switcher anchored cleanly along the lower horizon */}
      <div className="mx-auto mt-12 w-full max-w-3xl px-5">
        <div
          role="radiogroup"
          aria-label="Preview featured server worlds"
          className="flex items-center justify-center gap-1 rounded-2xl border border-white/10 bg-[#080a10]/85 p-1.5 backdrop-blur-md overflow-x-auto"
        >
          {HERO_SCENES.map((scene) => {
            const active = scene.id === activeScene.id;
            return (
              <label
                key={scene.id}
                className={`relative shrink-0 cursor-pointer rounded-xl px-4 py-2 text-sm font-medium transition-colors duration-200 ${
                  active
                    ? "bg-white text-zinc-950 font-semibold"
                    : "text-slate-300 hover:text-white"
                }`}
              >
                <input
                  type="radio"
                  name="hero-scene"
                  value={scene.id}
                  checked={active}
                  onChange={() => handleSelectScene(scene)}
                  className="sr-only"
                />
                <span>{scene.label}</span>
              </label>
            );
          })}
        </div>
      </div>
    </section>
  );
}
