import { motion } from "framer-motion";
import { SERVICE_LIST, type ServiceId } from "@/lib/services";
import { cn } from "@/lib/utils";

export function ServiceSwitcher({
  value,
  onChange,
  layoutId,
  size = "md",
}: {
  value: ServiceId;
  onChange: (id: ServiceId) => void;
  layoutId: string;
  size?: "md" | "lg";
}) {
  return (
    <div role="tablist" aria-label="Choose a game" className="glass inline-flex items-center gap-1 rounded-full p-1">
      {SERVICE_LIST.map((s) => {
        const active = s.id === value;
        return (
          <button
            key={s.id}
            role="tab"
            aria-selected={active}
            onClick={() => onChange(s.id)}
            className={cn(
              "relative rounded-full font-semibold transition-colors",
              size === "lg" ? "px-5 py-2.5 text-sm" : "px-3.5 py-1.5 text-xs sm:text-sm",
              active ? "text-background" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {active && (
              <motion.span
                layoutId={layoutId}
                className="absolute inset-0 rounded-full bg-svc glow-svc"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <span className="relative z-10">{size === "lg" ? s.name : s.short}</span>
          </button>
        );
      })}
    </div>
  );
}
