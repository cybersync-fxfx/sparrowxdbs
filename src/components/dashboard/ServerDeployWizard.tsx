import { useEffect, useId, useMemo, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Coins,
  Cpu,
  Dices,
  ExternalLink,
  Eye,
  EyeOff,
  HardDrive,
  Layers,
  Loader2,
  Lock,
  MessageCircle,
  Rocket,
  Server,
  ShieldAlert,
  ShieldCheck,
  Sliders,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PurchasePolicyNotice } from "@/components/PurchasePolicyNotice";
import { deployPlan, getEggConfigDetails } from "@/lib/portal.functions";
import { formatRam, planCostCoins, SERVICES, type ServiceId } from "@/lib/services";
import type { EggResourceProfile, SmartPlanTier } from "@/lib/egg-smart-plans";
import {
  analyzeEggVariables,
  generateStrongConfigPassword,
  validateAnalyzedVariables,
  type AnalyzedEggVariable,
} from "@/lib/egg-variable-intelligence";
import { buildWhatsAppSupportUrl, WHATSAPP_SUPPORT_DISPLAY } from "@/lib/whatsapp-support";
import type { EggCatalogItem } from "@/routes/api/game/eggs-catalog";
import { cn } from "@/lib/utils";
import { errorText, useRefreshAll } from "./hooks";

type WizardStep = 1 | 2 | 3;

export function ServerDeployWizard({
  open,
  onClose,
  coins,
  service,
  profile,
  initialPlan,
  selectedEgg,
  onNeedCoins,
  onDeployed,
}: {
  open: boolean;
  onClose: () => void;
  coins: number;
  service: ServiceId;
  profile: EggResourceProfile;
  initialPlan: SmartPlanTier;
  selectedEgg?: EggCatalogItem | null;
  onNeedCoins: () => void;
  onDeployed?: () => void;
}) {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const stepHeadingRef = useRef<HTMLHeadingElement | null>(null);
  const titleId = useId();
  const baseId = useId();
  const refresh = useRefreshAll();

  const [step, setStep] = useState<WizardStep>(1);
  const [activePlan, setActivePlan] = useState<SmartPlanTier>(initialPlan);
  const [serverName, setServerName] = useState("");
  const [nameError, setNameError] = useState("");
  const [dockerImage, setDockerImage] = useState("");
  const [envValues, setEnvValues] = useState<Record<string, string>>({});
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [touchedFields, setTouchedFields] = useState<Record<string, boolean>>({});
  const [revealedKeys, setRevealedKeys] = useState<Record<string, boolean>>({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  const eggQueryParams = useMemo(() => {
    if (selectedEgg?.installed && selectedEgg.nestId && selectedEgg.eggId) {
      return { nestId: selectedEgg.nestId, eggId: selectedEgg.eggId };
    }
    return { service };
  }, [selectedEgg, service]);

  const {
    data: eggDetails,
    isLoading: eggLoading,
    error: eggLoadError,
  } = useQuery({
    queryKey: ["wizard-egg-details", eggQueryParams],
    queryFn: () => getEggConfigDetails({ data: eggQueryParams }),
    enabled: open,
    staleTime: 60_000,
  });

  // Reset wizard state cleanly whenever opened with a new plan/egg
  useEffect(() => {
    if (!open) return;
    setStep(1);
    setActivePlan(initialPlan);
    setServerName("");
    setNameError("");
    setFieldErrors({});
    setTouchedFields({});
    setRevealedKeys({});
    setShowAdvanced(false);
  }, [open, initialPlan, selectedEgg?.id]);

  // Native <dialog> open/close control
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      if (typeof dialog.showModal === "function") dialog.showModal();
      else dialog.setAttribute("open", "");
    } else if (!open && dialog.open) {
      if (typeof dialog.close === "function") dialog.close();
      else dialog.removeAttribute("open");
    }
  }, [open]);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) return;
    const onNativeClose = () => {
      dialog.returnValue = "";
      onClose();
    };
    dialog.addEventListener("close", onNativeClose);
    return () => dialog.removeEventListener("close", onNativeClose);
  }, [open, onClose]);

  // Analyze live egg variables whenever egg details load
  const analyzedVars = useMemo(() => {
    if (!eggDetails) return [];
    return analyzeEggVariables(eggDetails.variables, {
      serverName: serverName.trim() || undefined,
      planSlots: activePlan.slots,
      eggName: selectedEgg?.name ?? eggDetails.name,
    });
  }, [eggDetails, activePlan.slots, selectedEgg?.name, serverName]);

  // Seed initial docker image & variable values once egg details arrive
  const seededEggKeyRef = useRef<string>("");
  useEffect(() => {
    if (!open || !eggDetails) return;
    const seedKey = `${eggDetails.nestId}:${eggDetails.eggId}:${initialPlan.id}`;
    if (seededEggKeyRef.current === seedKey) return;
    seededEggKeyRef.current = seedKey;

    setDockerImage(eggDetails.dockerImage || Object.values(eggDetails.dockerImages)[0] || "");
    const initialMap: Record<string, string> = {};
    const initialAnalyzed = analyzeEggVariables(eggDetails.variables, {
      serverName: serverName.trim() || undefined,
      planSlots: activePlan.slots,
      eggName: selectedEgg?.name ?? eggDetails.name,
    });
    for (const item of initialAnalyzed) {
      initialMap[item.variable.envVariable] = item.initialValue;
    }
    setEnvValues(initialMap);
  }, [open, eggDetails, initialPlan.id, activePlan.slots, selectedEgg?.name, serverName]);

  // Reset seed key when wizard closes so reopening refreshes defaults cleanly
  useEffect(() => {
    if (!open) seededEggKeyRef.current = "";
  }, [open]);

  // Sync user's custom Server Name into HOSTNAME / SERVER_NAME / SV_HOSTNAME if untouched
  useEffect(() => {
    const cleanName = serverName.trim();
    if (!cleanName || analyzedVars.length === 0) return;
    setEnvValues((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const item of analyzedVars) {
        const key = item.variable.envVariable;
        if (
          /(^HOSTNAME$|^SERVER_NAME$|^SV_HOSTNAME$|^SERVER_TITLE$)/i.test(key) &&
          !touchedFields[key]
        ) {
          if (next[key] !== cleanName) {
            next[key] = cleanName;
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [serverName, analyzedVars, touchedFields]);

  // Sync plan slot limits into MAX_PLAYERS / MAX_CLIENTS when user changes plan tier in Step 1
  useEffect(() => {
    if (!activePlan.slots || analyzedVars.length === 0) return;
    setEnvValues((prev) => {
      let changed = false;
      const next = { ...prev };
      for (const item of analyzedVars) {
        const key = item.variable.envVariable;
        if (/(^MAX_PLAYERS$|^MAX_CLIENTS$|^SERVER_SLOTS$|^MAXPLAYERS$|^SV_MAXCLIENTS$)/i.test(key) && !touchedFields[key]) {
          const val = String(activePlan.slots);
          if (next[key] !== val) {
            next[key] = val;
            changed = true;
          }
        }
      }
      return changed ? next : prev;
    });
  }, [activePlan.slots, analyzedVars, touchedFields]);

  const requiredVars = useMemo(() => analyzedVars.filter((v) => v.priority === "required"), [analyzedVars]);
  const recommendedVars = useMemo(() => analyzedVars.filter((v) => v.priority === "recommended"), [analyzedVars]);
  const advancedVars = useMemo(() => analyzedVars.filter((v) => v.priority === "advanced"), [analyzedVars]);

  const liveValidationErrors = useMemo(
    () => validateAnalyzedVariables(analyzedVars, envValues),
    [analyzedVars, envValues],
  );

  const requiredReadyCount = useMemo(
    () => requiredVars.filter((v) => !liveValidationErrors[v.variable.envVariable]).length,
    [requiredVars, liveValidationErrors],
  );
  const missingRequiredCount = requiredVars.length - requiredReadyCount;

  const deploy = useMutation({
    mutationFn: () => {
      const cleanName = serverName.trim();
      const targetNestId = selectedEgg?.installed && selectedEgg.nestId ? selectedEgg.nestId : eggDetails?.nestId;
      const targetEggId = selectedEgg?.installed && selectedEgg.eggId ? selectedEgg.eggId : eggDetails?.eggId;

      return deployPlan({
        data: {
          planId: activePlan.id,
          serverName: cleanName,
          ...(targetNestId && targetEggId
            ? {
                eggOverride: {
                  nestId: targetNestId,
                  eggId: targetEggId,
                  ...(dockerImage ? { dockerImage } : {}),
                  ...(Object.keys(envValues).length > 0 ? { environment: envValues } : {}),
                },
              }
            : {}),
        },
      });
    },
    onSuccess: async (r) => {
      await refresh();
      toast.success(`${r.serverName} provisioned & starting!`, {
        description: `All custom variables synced to Pterodactyl Panel · Balance: ${r.coins} SparrowCoins.`,
      });
      onDeployed?.();
      dialogRef.current?.close();
      onClose();
      document.getElementById("servers")?.scrollIntoView({ behavior: "smooth" });
    },
    onError: (e) => toast.error(errorText(e)),
  });

  const goToStep = (next: WizardStep) => {
    setStep(next);
    requestAnimationFrame(() => stepHeadingRef.current?.focus());
  };

  const handleStep1Next = () => {
    const trimmed = serverName.trim();
    if (trimmed.length < 2) {
      setNameError("Enter a custom server name (at least 2 characters) — don't leave it blank.");
      document.getElementById(`${baseId}-server-name`)?.focus();
      return;
    }
    if (!/^[\w .\-']*$/.test(trimmed)) {
      setNameError("Use letters, numbers, spaces, hyphens, periods, or apostrophes only.");
      document.getElementById(`${baseId}-server-name`)?.focus();
      return;
    }
    setNameError("");
    goToStep(2);
  };

  const handleStep2Next = () => {
    const errors = validateAnalyzedVariables(analyzedVars, envValues);
    setFieldErrors(errors);
    const firstKey = Object.keys(errors)[0];
    if (firstKey) {
      // Expand advanced section if error lives inside an advanced field
      if (advancedVars.some((v) => v.variable.envVariable === firstKey)) {
        setShowAdvanced(true);
      }
      toast.error("Complete required server configuration first", {
        description: errors[firstKey],
      });
      requestAnimationFrame(() => {
        document.getElementById(`${baseId}-var-${firstKey}`)?.focus();
      });
      return;
    }
    goToStep(3);
  };

  const updateVarValue = (key: string, value: string) => {
    setTouchedFields((prev) => ({ ...prev, [key]: true }));
    setEnvValues((prev) => ({ ...prev, [key]: value }));
    // Clear existing inline error on input as soon as user edits (modern-web-guidance: forms)
    setFieldErrors((prev) => {
      if (!prev[key]) return prev;
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
  };

  const validateSingleVarOnBlur = (item: AnalyzedEggVariable) => {
    const key = item.variable.envVariable;
    const singleErr = validateAnalyzedVariables([item], envValues)[key];
    setFieldErrors((prev) => {
      const next = { ...prev };
      if (singleErr) next[key] = singleErr;
      else delete next[key];
      return next;
    });
  };

  const handleGeneratePassword = (key: string, label: string) => {
    const pw = generateStrongConfigPassword(16);
    updateVarValue(key, pw);
    setRevealedKeys((prev) => ({ ...prev, [key]: true }));
    toast.success(`Generated strong ${label}`, {
      description: "Saved into your server config — you can view or edit it anytime in Panel & Client Area.",
    });
  };

  const handleGenerateAllRequiredPasswords = () => {
    let generated = 0;
    for (const item of requiredVars) {
      const key = item.variable.envVariable;
      if (item.canGeneratePassword && !(envValues[key] ?? "").trim()) {
        const pw = generateStrongConfigPassword(16);
        updateVarValue(key, pw);
        setRevealedKeys((prev) => ({ ...prev, [key]: true }));
        generated += 1;
      }
    }
    if (generated > 0) {
      toast.success(`Generated ${generated} secure password${generated > 1 ? "s" : ""}`);
    }
  };

  const renderVariableField = (item: AnalyzedEggVariable) => {
    const v = item.variable;
    const key = v.envVariable;
    const inputId = `${baseId}-var-${key}`;
    const helpId = `${inputId}-help`;
    const errId = `${inputId}-err`;
    const val = envValues[key] ?? "";
    const err = fieldErrors[key];
    const revealed = Boolean(revealedKeys[key]);
    const isSecret = item.controlKind === "password" || item.controlKind === "secret-key";

    return (
      <div
        key={key}
        className={cn(
          "rounded-2xl border p-4 space-y-2 transition-colors",
          err
            ? "border-rose-500/60 bg-rose-500/[0.06]"
            : item.isRequired && !val.trim()
              ? "border-amber-500/45 bg-amber-500/[0.05]"
              : item.isRequired && val.trim()
                ? "border-emerald-500/40 bg-emerald-500/[0.04]"
                : "border-border bg-[#0b0e17]",
        )}
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <label htmlFor={inputId} className="text-xs font-semibold text-foreground">
              {v.name}
            </label>
            {item.isRequired && (
              <span className="rounded-full bg-amber-500/20 px-1.5 py-0.5 font-mono text-[9px] font-semibold uppercase text-amber-200">
                Required
              </span>
            )}
            {item.wasPlaceholderDefault && !val.trim() && (
              <span className="rounded-full bg-rose-500/20 px-1.5 py-0.5 font-mono text-[9px] font-semibold text-rose-200">
                Default Cleared
              </span>
            )}
          </div>
          <code className="rounded bg-[#05060a] px-1.5 py-0.5 font-mono text-[10px] text-sky-300">
            {key}
          </code>
        </div>

        {/* Smart Control Renderer */}
        {item.controlKind === "boolean" && item.booleanFormat ? (
          <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-[#05060a] px-3 py-2.5">
            <label htmlFor={inputId} className="text-xs text-secondary-foreground cursor-pointer flex-1">
              {val.toLowerCase() === item.booleanFormat.trueVal.toLowerCase() ? "Enabled" : "Disabled"}{" "}
              <span className="font-mono text-[10px] text-muted-foreground">({val || item.booleanFormat.falseVal})</span>
            </label>
            <input
              id={inputId}
              name={key}
              type="checkbox"
              checked={val.toLowerCase() === item.booleanFormat.trueVal.toLowerCase()}
              onChange={(e) =>
                updateVarValue(
                  key,
                  e.target.checked ? item.booleanFormat!.trueVal : item.booleanFormat!.falseVal,
                )
              }
              className="size-4 accent-emerald-500 cursor-pointer"
            />
          </div>
        ) : item.controlKind === "radio" && item.options ? (
          <div className="flex flex-wrap gap-2" role="radiogroup" aria-labelledby={inputId}>
            {item.options.map((opt) => {
              const optId = `${inputId}-${opt}`;
              const checked = val === opt;
              return (
                <label
                  key={opt}
                  htmlFor={optId}
                  className={cn(
                    "inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-mono cursor-pointer transition-colors",
                    checked
                      ? "border-emerald-400 bg-emerald-500/15 text-emerald-200"
                      : "border-border bg-[#05060a] text-muted-foreground hover:text-foreground",
                  )}
                >
                  <input
                    id={optId}
                    type="radio"
                    name={key}
                    value={opt}
                    checked={checked}
                    onChange={() => updateVarValue(key, opt)}
                    className="accent-emerald-500"
                  />
                  <span>{opt}</span>
                </label>
              );
            })}
          </div>
        ) : item.controlKind === "select" && item.options ? (
          <select
            id={inputId}
            name={key}
            value={val}
            required={item.isRequired}
            aria-invalid={err ? "true" : undefined}
            aria-describedby={`${helpId}${err ? ` ${errId}` : ""}`}
            onChange={(e) => updateVarValue(key, e.target.value)}
            onBlur={() => validateSingleVarOnBlur(item)}
            className="h-10 w-full rounded-xl border border-border bg-[#05060a] px-3 font-mono text-xs text-foreground"
          >
            {!item.options.includes(val) && <option value="">Select {v.name}…</option>}
            {item.options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        ) : (
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                id={inputId}
                name={key}
                type={isSecret && !revealed ? "password" : "text"}
                inputMode={item.controlKind === "numeric" ? "numeric" : undefined}
                value={val}
                required={item.isRequired}
                autoCorrect="off"
                autoCapitalize="none"
                spellCheck={false}
                aria-invalid={err ? "true" : undefined}
                aria-describedby={`${helpId}${err ? ` ${errId}` : ""}`}
                placeholder={
                  item.wasPlaceholderDefault
                    ? `Enter your own ${v.name.toLowerCase()}…`
                    : item.controlKind === "password"
                      ? `Set secure ${v.name.toLowerCase()}…`
                      : `Enter ${v.name.toLowerCase()}…`
                }
                onChange={(e) => updateVarValue(key, e.target.value)}
                onBlur={() => validateSingleVarOnBlur(item)}
                className="spx-field-input h-10 w-full rounded-xl border border-border bg-[#05060a] px-3 pr-9 font-mono text-xs text-foreground placeholder:text-muted-foreground"
              />
              {isSecret && (
                <button
                  type="button"
                  aria-pressed={revealed}
                  aria-label={revealed ? `Hide ${v.name}` : `Show ${v.name}`}
                  onClick={() => setRevealedKeys((prev) => ({ ...prev, [key]: !prev[key] }))}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {revealed ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                </button>
              )}
            </div>

            {item.canGeneratePassword && (
              <Button
                type="button"
                size="sm"
                variant="secondary"
                className="h-10 shrink-0 rounded-xl px-3 text-xs border border-emerald-500/35 text-emerald-200 hover:bg-emerald-500/15"
                onClick={() => handleGeneratePassword(key, v.name)}
              >
                <Dices className="size-3.5" aria-hidden="true" />
                <span>Generate</span>
              </Button>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <p id={helpId} className="text-[11px] leading-relaxed text-muted-foreground">
            {item.smartHint}
          </p>
          {item.helperLink && (
            <a
              href={item.helperLink.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-300 hover:underline shrink-0"
            >
              <span>{item.helperLink.label}</span>
              <ExternalLink className="size-3" aria-hidden="true" />
            </a>
          )}
        </div>

        {err && (
          <p id={errId} role="alert" className="flex items-center gap-1.5 text-[11px] font-medium text-rose-300">
            <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
            <span>{err}</span>
          </p>
        )}
      </div>
    );
  };

  const eggTitle = selectedEgg?.name ?? eggDetails?.name ?? SERVICES[service].name;
  const cost = planCostCoins(activePlan);
  const short = Math.max(0, cost - coins);
  const hasBlankAutoGenPasswords = requiredVars.some(
    (item) => item.canGeneratePassword && !(envValues[item.variable.envVariable] ?? "").trim(),
  );

  const stepsMeta: Array<{ num: WizardStep; title: string; subtitle: string }> = [
    { num: 1, title: "Identity & Plan", subtitle: "Name, Tier & Runtime" },
    { num: 2, title: "Required Setup", subtitle: requiredVars.length > 0 ? `${requiredReadyCount}/${requiredVars.length} Required` : "Egg Variables" },
    { num: 3, title: "Review & Launch", subtitle: `${cost} Coins` },
  ];

  const closedByProps = { closedby: "none" } as Record<string, string>;

  return (
    <dialog
      ref={dialogRef}
      aria-labelledby={titleId}
      className="spx-native-dialog theme-dashboard"
      {...closedByProps}
    >
      {/* Top Wizard Header + Stepper */}
      <header className="shrink-0 border-b border-border bg-[#05060a] px-6 py-4 space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-400/50 bg-emerald-500/15 px-2.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider text-emerald-200">
                <Sparkles className="size-3" aria-hidden="true" />
                <span>Smart Server Creator · {eggTitle}</span>
              </span>
              <span className="rounded-full border border-border bg-[#0b0e17] px-2.5 py-0.5 font-mono text-[10px] text-sky-300">
                {activePlan.name} · {formatRam(activePlan.ramMb)} · {activePlan.vcpu} vCPU
              </span>
            </div>
            <h1 id={titleId} className="font-display text-lg font-bold text-foreground truncate">
              Configure &amp; Create Your {eggTitle} Server
            </h1>
          </div>
          <button
            type="button"
            onClick={() => {
              dialogRef.current?.close();
              onClose();
            }}
            aria-label="Close server creation wizard"
            className="grid size-8 place-items-center rounded-lg border border-border bg-secondary text-muted-foreground hover:text-foreground shrink-0"
          >
            <X className="size-4" aria-hidden="true" />
          </button>
        </div>

        {/* Accessible 3-Step Progress Tracker */}
        <nav aria-label="Server creation steps">
          <ol className="grid grid-cols-3 gap-2">
            {stepsMeta.map((s) => {
              const active = step === s.num;
              const completed = step > s.num;
              return (
                <li key={s.num} aria-current={active ? "step" : undefined}>
                  <button
                    type="button"
                    onClick={() => {
                      if (s.num < step) goToStep(s.num);
                      else if (s.num === 2 && step === 1) handleStep1Next();
                      else if (s.num === 3 && step === 2) handleStep2Next();
                    }}
                    className={cn(
                      "w-full rounded-xl border px-3 py-2 text-left transition-all flex items-center gap-2.5",
                      active
                        ? "border-emerald-400/70 bg-emerald-500/12 text-white"
                        : completed
                          ? "border-emerald-500/35 bg-[#0b0e17] text-emerald-200 hover:border-emerald-400/60"
                          : "border-border bg-[#080a10] text-muted-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "grid size-6 shrink-0 place-items-center rounded-full font-mono text-[11px] font-bold",
                        completed
                          ? "bg-emerald-500 text-black"
                          : active
                            ? "bg-emerald-400/20 text-emerald-200 ring-1 ring-emerald-400"
                            : "bg-secondary text-muted-foreground",
                      )}
                    >
                      {completed ? <Check className="size-3.5" aria-hidden="true" /> : s.num}
                    </span>
                    <div className="min-w-0">
                      <p className="text-xs font-semibold truncate">{s.title}</p>
                      <p className="font-mono text-[10px] text-muted-foreground truncate">{s.subtitle}</p>
                    </div>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>
      </header>

      {/* Scrollable Step Body */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
        {/* STEP 1: Identity, Smart Plan Tier & Runtime */}
        {step === 1 && (
          <div className="space-y-5">
            <h2 ref={stepHeadingRef} tabIndex={-1} className="text-sm font-bold text-foreground focus:outline-none">
              Step 1 · Name Your Server &amp; Pick Hardware Runtime
            </h2>

            {/* Server Name Input (Never Left Blank/Default) */}
            <div className="rounded-2xl border border-border bg-[#0b0e17] p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={`${baseId}-server-name`} className="text-xs font-semibold text-foreground">
                  Custom Server Name <span className="text-amber-300 font-mono text-[10px] ml-1">REQUIRED</span>
                </label>
                <span className="font-mono text-[10px] text-muted-foreground">Auto-syncs to Panel &amp; Hostname</span>
              </div>
              <input
                id={`${baseId}-server-name`}
                name="serverName"
                type="text"
                autoFocus
                required
                maxLength={60}
                value={serverName}
                aria-invalid={nameError ? "true" : undefined}
                placeholder={`e.g. My ${eggTitle} Community Server`}
                onChange={(e) => {
                  setServerName(e.target.value);
                  if (nameError) setNameError("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.nativeEvent.isComposing) {
                    e.preventDefault();
                    handleStep1Next();
                  }
                }}
                className="spx-field-input h-11 w-full rounded-xl border border-border bg-[#05060a] px-3.5 text-sm text-foreground placeholder:text-muted-foreground"
              />
              {nameError ? (
                <p role="alert" className="flex items-center gap-1.5 text-xs text-rose-300">
                  <AlertCircle className="size-3.5 shrink-0" aria-hidden="true" />
                  <span>{nameError}</span>
                </p>
              ) : (
                <p className="text-[11px] text-muted-foreground">
                  Give your server a real identity — we&apos;ll automatically populate your game hostname with it too.
                </p>
              )}
            </div>

            {/* 5 Smart Egg-Themed Plan Tiers (Switchable Live Inside Wizard) */}
            <fieldset className="space-y-2.5">
              <legend className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Selected {profile.themeLabel ?? eggTitle} Plan ({profile.ramRangeLabel})
              </legend>
              <div className="grid gap-2 sm:grid-cols-5">
                {profile.plans.map((tier) => {
                  const picked = tier.id === activePlan.id;
                  return (
                    <button
                      key={tier.id}
                      type="button"
                      onClick={() => setActivePlan(tier)}
                      className={cn(
                        "rounded-xl border p-3 text-left transition-all",
                        picked
                          ? "border-emerald-400 bg-emerald-500/15 ring-1 ring-emerald-400/50"
                          : "border-border bg-[#0b0e17] hover:border-emerald-400/40",
                      )}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span className="font-display text-xs font-bold text-foreground truncate">{tier.name}</span>
                        {picked && <CheckCircle2 className="size-3.5 text-emerald-400 shrink-0" aria-hidden="true" />}
                      </div>
                      <p className="mt-1 font-mono text-xs font-bold text-emerald-300">{formatRam(tier.ramMb)}</p>
                      <p className="font-mono text-[10px] text-muted-foreground">
                        {tier.vcpu} vCPU · {tier.diskGb}GB
                      </p>
                      <p className="mt-1.5 font-mono text-xs font-semibold text-white">
                        {planCostCoins(tier)} <span className="text-[10px] text-muted-foreground">coins</span>
                      </p>
                    </button>
                  );
                })}
              </div>
            </fieldset>

            {/* Live Container Runtime / Docker Image Selector */}
            <div className="rounded-2xl border border-border bg-[#0b0e17] p-4 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={`${baseId}-docker`} className="text-xs font-semibold text-foreground">
                  Container Runtime / Docker Image
                </label>
                {eggLoading ? (
                  <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-sky-300">
                    <Loader2 className="size-3 animate-spin" /> Syncing egg from Panel…
                  </span>
                ) : eggDetails ? (
                  <span className="font-mono text-[10px] text-emerald-300">
                    {eggDetails.variables.length} egg variables loaded live
                  </span>
                ) : null}
              </div>

              {eggDetails && Object.keys(eggDetails.dockerImages).length > 0 ? (
                <select
                  id={`${baseId}-docker`}
                  value={dockerImage}
                  onChange={(e) => setDockerImage(e.target.value)}
                  className="h-10 w-full rounded-xl border border-border bg-[#05060a] px-3 font-mono text-xs text-foreground"
                >
                  {Object.entries(eggDetails.dockerImages).map(([label, img]) => (
                    <option key={img} value={img}>
                      {label} — {img}
                    </option>
                  ))}
                </select>
              ) : (
                <p className="rounded-xl border border-border bg-[#05060a] px-3 py-2.5 font-mono text-[11px] text-muted-foreground">
                  {selectedEgg?.dockerImage || "Runtime image will sync from your active Pterodactyl Panel egg."}
                </p>
              )}
            </div>
          </div>
        )}

        {/* STEP 2: Required & Egg-Specific Configuration (Zero Blind Defaults!) */}
        {step === 2 && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 ref={stepHeadingRef} tabIndex={-1} className="text-sm font-bold text-foreground focus:outline-none">
                  Step 2 · Required {eggTitle} Configuration
                </h2>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Every required input and unsafe default (like RCON passwords, tokens, or licenses) must be configured before launch.
                </p>
              </div>

              {requiredVars.length > 0 && (
                <div
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono text-[11px] font-semibold",
                    missingRequiredCount === 0
                      ? "border-emerald-400/50 bg-emerald-500/15 text-emerald-200"
                      : "border-amber-400/50 bg-amber-500/15 text-amber-200",
                  )}
                >
                  {missingRequiredCount === 0 ? (
                    <>
                      <ShieldCheck className="size-3.5" aria-hidden="true" />
                      <span>All {requiredVars.length} Required Ready</span>
                    </>
                  ) : (
                    <>
                      <ShieldAlert className="size-3.5" aria-hidden="true" />
                      <span>{missingRequiredCount} Required Missing</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {eggLoading ? (
              <div className="flex flex-col items-center justify-center gap-3 py-12 text-muted-foreground">
                <Loader2 className="size-6 animate-spin text-emerald-400" />
                <p className="font-mono text-xs">Loading live {eggTitle} variables from Pterodactyl Panel…</p>
              </div>
            ) : eggLoadError ? (
              <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 text-xs space-y-1.5">
                <p className="font-semibold text-amber-200">Panel Egg Variables Unavailable Offline</p>
                <p className="text-muted-foreground">
                  {errorText(eggLoadError)} — Ensure you ran <code className="font-mono text-amber-200">sudo sparrowx-eggs sync</code> on your VPS so this egg&apos;s variables are available in Panel.
                </p>
              </div>
            ) : analyzedVars.length === 0 ? (
              <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/10 p-5 text-xs text-emerald-200">
                <p className="font-semibold flex items-center gap-2">
                  <CheckCircle2 className="size-4" aria-hidden="true" /> No manual startup variables required for {eggTitle}
                </p>
                <p className="mt-1 text-muted-foreground">
                  This runtime is ready to boot immediately with your selected hardware tier ({formatRam(activePlan.ramMb)} RAM).
                </p>
              </div>
            ) : (
              <>
                {/* 2A. REQUIRED VARIABLES */}
                {requiredVars.length > 0 && (
                  <section className="space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                        <Lock className="size-3.5" aria-hidden="true" />
                        <span>Required Setup ({requiredVars.length})</span>
                      </h3>
                      {hasBlankAutoGenPasswords && (
                        <Button
                          type="button"
                          size="sm"
                          variant="secondary"
                          className="h-7 rounded-lg px-2.5 text-[11px] border border-emerald-500/40 text-emerald-200"
                          onClick={handleGenerateAllRequiredPasswords}
                        >
                          <Dices className="size-3" aria-hidden="true" />
                          <span>Auto-Generate Secure Passwords</span>
                        </Button>
                      )}
                    </div>
                    <div className="grid gap-3 md:grid-cols-2">
                      {requiredVars.map(renderVariableField)}
                    </div>
                  </section>
                )}

                {/* 2B. RECOMMENDED VARIABLES */}
                {recommendedVars.length > 0 && (
                  <section className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-sky-300 flex items-center gap-1.5">
                      <Sliders className="size-3.5" aria-hidden="true" />
                      <span>Recommended Customization ({recommendedVars.length})</span>
                    </h3>
                    <div className="grid gap-3 md:grid-cols-2">
                      {recommendedVars.map(renderVariableField)}
                    </div>
                  </section>
                )}

                {/* 2C. ALL REMAINING ADVANCED VARIABLES (Zero Truncation!) */}
                {advancedVars.length > 0 && (
                  <section className="space-y-3">
                    <button
                      type="button"
                      aria-expanded={showAdvanced}
                      onClick={() => setShowAdvanced((v) => !v)}
                      className="flex w-full items-center justify-between rounded-xl border border-border bg-[#0b0e17] px-4 py-2.5 text-xs font-semibold text-secondary-foreground hover:border-sky-400/50"
                    >
                      <span>Advanced Egg Options ({advancedVars.length} additional variables)</span>
                      {showAdvanced ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                    </button>
                    {showAdvanced && (
                      <div className="grid gap-3 md:grid-cols-2">
                        {advancedVars.map(renderVariableField)}
                      </div>
                    )}
                  </section>
                )}
              </>
            )}
          </div>
        )}

        {/* STEP 3: Pre-Flight Review, Summary & Deploy */}
        {step === 3 && (
          <div className="space-y-5">
            <h2 ref={stepHeadingRef} tabIndex={-1} className="text-sm font-bold text-foreground focus:outline-none">
              Step 3 · Review Configuration &amp; Launch Server
            </h2>

            {/* Server & Hardware Summary Card */}
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-emerald-500/35 bg-emerald-500/[0.06] p-4 space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                  <Server className="size-3" aria-hidden="true" /> Server Blueprint
                </p>
                <p className="font-display text-base font-bold text-white">{serverName}</p>
                <p className="text-xs text-secondary-foreground flex items-center gap-1.5">
                  <Layers className="size-3.5 text-emerald-300" aria-hidden="true" />
                  <span>{eggTitle}</span>
                  {selectedEgg?.nestName && <span className="text-muted-foreground">({selectedEgg.nestName})</span>}
                </p>
                {dockerImage && (
                  <p className="font-mono text-[10px] text-muted-foreground truncate">{dockerImage}</p>
                )}
              </div>

              <div className="rounded-2xl border border-border bg-[#0b0e17] p-4 space-y-2">
                <p className="font-mono text-[10px] uppercase tracking-wider text-sky-300">
                  {activePlan.name} · {profile.themeLabel ?? profile.label}
                </p>
                <div className="grid grid-cols-3 gap-2 pt-1 font-mono text-xs">
                  <div className="rounded-lg bg-[#05060a] p-2">
                    <p className="text-[10px] text-muted-foreground">RAM</p>
                    <p className="font-bold text-white">{formatRam(activePlan.ramMb)}</p>
                  </div>
                  <div className="rounded-lg bg-[#05060a] p-2">
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1"><Cpu className="size-2.5" /> CPU</p>
                    <p className="font-bold text-white">{activePlan.vcpu} vCPU</p>
                  </div>
                  <div className="rounded-lg bg-[#05060a] p-2">
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1"><HardDrive className="size-2.5" /> NVMe</p>
                    <p className="font-bold text-white">{activePlan.diskGb} GB</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Configured Startup Variables Audit */}
            {analyzedVars.length > 0 && (
              <div className="rounded-2xl border border-border bg-[#0b0e17] p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-xs font-semibold text-foreground">
                    Configured Startup Variables ({analyzedVars.length})
                  </p>
                  <button
                    type="button"
                    onClick={() => goToStep(2)}
                    className="text-[11px] font-medium text-sky-300 hover:underline"
                  >
                    ← Edit Variables
                  </button>
                </div>
                <div className="grid gap-2 sm:grid-cols-2 max-h-44 overflow-y-auto pr-1">
                  {analyzedVars.map((item) => {
                    const key = item.variable.envVariable;
                    const val = envValues[key] ?? "";
                    const isSecret = item.controlKind === "password" || item.controlKind === "secret-key";
                    return (
                      <div key={key} className="flex items-center justify-between gap-2 rounded-lg bg-[#05060a] px-3 py-1.5 text-[11px]">
                        <span className="text-muted-foreground truncate">{item.variable.name}</span>
                        <span className="font-mono text-emerald-300 truncate max-w-[55%]">
                          {!val ? "—" : isSecret ? "••••••••••" : val}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Billing & Coin Balance Summary */}
            <div className="rounded-2xl border border-border bg-[#05060a] p-4 text-sm space-y-1.5">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Plan Cost (30 days)</span>
                <span className="font-mono font-semibold flex items-center gap-1">
                  <Coins className="size-3.5 text-emerald-400" /> {cost} SparrowCoins
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Your Wallet Balance</span>
                <span className="font-mono">{coins} coins</span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 font-semibold">
                <span>Balance After Creation</span>
                <span className={cn("font-mono", short > 0 ? "text-rose-400" : "text-emerald-400")}>
                  {coins - cost} coins
                </span>
              </div>
            </div>

            <PurchasePolicyNotice compact />
          </div>
        )}
      </div>

      {/* Wizard Footer Controls */}
      <footer className="shrink-0 border-t border-border bg-[#05060a] px-6 py-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          {step > 1 ? (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="rounded-xl"
              onClick={() => goToStep((step - 1) as WizardStep)}
            >
              <ArrowLeft className="size-3.5" />
              <span>Back</span>
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-xl text-muted-foreground"
              onClick={() => {
                dialogRef.current?.close();
                onClose();
              }}
            >
              Cancel
            </Button>
          )}
          {step === 3 && (
            <a
              href={buildWhatsAppSupportUrl(
                `Hi SparrowX, I want help launching ${eggTitle} - ${activePlan.name} (${cost} Coins / 30d, Server: ${serverName || eggTitle}).`,
              )}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden sm:inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/35 bg-emerald-500/10 px-3 py-2 text-xs font-medium text-emerald-300 hover:bg-emerald-500/20"
            >
              <MessageCircle className="size-3.5" />
              <span>WhatsApp ({WHATSAPP_SUPPORT_DISPLAY})</span>
            </a>
          )}
        </div>

        <div className="flex items-center gap-2">
          {step === 1 && (
            <Button type="button" variant="ivory" size="sm" className="rounded-xl px-4" onClick={handleStep1Next}>
              <span>Next: Required Setup</span>
              <ArrowRight className="size-3.5" />
            </Button>
          )}

          {step === 2 && (
            <Button type="button" variant="ivory" size="sm" className="rounded-xl px-4" onClick={handleStep2Next}>
              <span>Next: Review &amp; Launch</span>
              <ArrowRight className="size-3.5" />
            </Button>
          )}

          {step === 3 && (
            short > 0 ? (
              <Button
                type="button"
                variant="discord"
                size="sm"
                className="rounded-xl px-4"
                onClick={() => {
                  dialogRef.current?.close();
                  onClose();
                  onNeedCoins();
                }}
              >
                <Coins className="size-3.5" />
                <span>Top Up {short} Coins to Create</span>
              </Button>
            ) : (
              <Button
                type="button"
                variant="ivory"
                size="sm"
                className="rounded-xl px-5 font-semibold"
                disabled={deploy.isPending}
                onClick={() => deploy.mutate()}
              >
                {deploy.isPending ? <Loader2 className="size-4 animate-spin" /> : <Rocket className="size-4" />}
                <span>Create &amp; Launch Server ({cost} Coins)</span>
              </Button>
            )
          )}
        </div>
      </footer>
    </dialog>
  );
}
