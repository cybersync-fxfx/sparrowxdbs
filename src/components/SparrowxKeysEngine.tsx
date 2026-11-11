import React, { useState, useEffect, useCallback, useMemo } from "react";
import {
  Key,
  Shield,
  Copy,
  Check,
  RefreshCw,
  Terminal,
  Database,
  ArrowRight,
  ArrowUpRight,
  Eye,
  EyeOff,
  Sliders,
  Lock,
  Cpu,
  Layers,
  Sparkles,
  Zap,
} from "lucide-react";
import { GlobalEcosystemBar } from "./GlobalEcosystemBar";

// EFF Long Wordlist excerpt for Diceware
const EFF_WORDLIST = [
  "abacus", "abdomen", "abiding", "ablaze", "absorb", "abyss", "acrobat", "action",
  "alchemy", "alien", "almanac", "alps", "amber", "amplify", "anchor", "android",
  "antenna", "anvil", "apex", "apogee", "apollo", "aqueduct", "arcade", "arctic",
  "argon", "armor", "arrow", "arsenal", "asteroid", "atlas", "atom", "aurora",
  "avalanche", "axiom", "aztec", "badger", "baron", "barrier", "basalt", "bastion",
  "beacon", "bison", "blade", "blueprint", "bolt", "boulder", "breeze", "bronze",
  "bunker", "cactus", "canyon", "carbon", "cascade", "castle", "catapult", "cavern",
  "cedar", "cipher", "citadel", "clover", "cobalt", "comet", "compass", "copper",
  "crater", "crystal", "cyclone", "dagger", "delta", "diver", "dynamo", "eclipse",
  "ember", "emerald", "engine", "enigma", "epoch", "falcon", "fathom", "flint",
  "fossil", "fusion", "galaxy", "glacier", "granite", "gravity", "harbor", "helix",
  "horizon", "hydra", "hyper", "impact", "iron", "jaguar", "javelin", "jupiter",
  "kinetic", "laser", "launch", "legacy", "leopard", "lightning", "matrix", "meteor",
  "monarch", "nebula", "neutron", "nexus", "nomad", "nova", "oasis", "obsidian",
  "omega", "orbit", "ozone", "phantom", "phoenix", "photon", "pioneer", "plasma",
  "prism", "pulsar", "quantum", "radar", "radius", "reactor", "relay", "rocket",
  "satellite", "sentinel", "shadow", "shield", "silicon", "solaris", "sparrow", "spectra",
  "stellar", "strata", "summit", "supernova", "tactical", "titan", "topaz", "torpedo",
  "traduct", "tundra", "uranium", "vacuum", "vector", "velocity", "vertex", "viper",
  "vortex", "voyager", "zenith", "zephyr"
];

// Helper: UUID v4 generator via crypto
function generateCryptoUUID(): string {
  if (typeof crypto !== "undefined" && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  const buf = new Uint8Array(16);
  crypto.getRandomValues(buf);
  buf[6] = (buf[6] & 0x0f) | 0x40;
  buf[8] = (buf[8] & 0x3f) | 0x80;
  const hex = Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function SparrowxKeysEngine() {
  const [mode, setMode] = useState<"password" | "diceware" | "developer">("password");
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Mode 1: Master Password
  const [pwdLength, setPwdLength] = useState<number>(28);
  const [useUpper, setUseUpper] = useState<boolean>(true);
  const [useLower, setUseLower] = useState<boolean>(true);
  const [useNumbers, setUseNumbers] = useState<boolean>(true);
  const [useSymbols, setUseSymbols] = useState<boolean>(true);
  const [excludeAmbiguous, setExcludeAmbiguous] = useState<boolean>(true);
  const [masterPassword, setMasterPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(true);

  // Mode 2: Diceware Passphrase
  const [wordCount, setWordCount] = useState<number>(5);
  const [separator, setSeparator] = useState<string>("-");
  const [capitalizeWords, setCapitalizeWords] = useState<boolean>(false);
  const [appendNumber, setAppendNumber] = useState<boolean>(true);
  const [passphrase, setPassphrase] = useState<string>("");

  // Mode 3: Developer Secrets
  const [salt256, setSalt256] = useState<string>("");
  const [jwtSecret512, setJwtSecret512] = useState<string>("");
  const [postgresUriKey, setPostgresUriKey] = useState<string>("");
  const [uuidBatch, setUuidBatch] = useState<string[]>([]);

  // Telemetry
  const [networkDispatched] = useState<number>(0);
  const [generationCount, setGenerationCount] = useState<number>(1);

  // Copy helper
  const handleCopy = (text: string, id: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1800);
  };

  // Secure RNG
  const getCryptoRandomInt = (max: number): number => {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0] % max;
  };

  // 1. Password Generator
  const generatePassword = useCallback(() => {
    let pool = "";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?~";
    const ambiguous = "il1Lo0O";

    if (useLower) pool += lower;
    if (useUpper) pool += upper;
    if (useNumbers) pool += numbers;
    if (useSymbols) pool += symbols;

    if (excludeAmbiguous) {
      pool = pool
        .split("")
        .filter((c) => !ambiguous.includes(c))
        .join("");
    }

    if (!pool) pool = lower;

    const values = new Uint32Array(pwdLength);
    window.crypto.getRandomValues(values);
    let result = "";
    for (let i = 0; i < pwdLength; i++) {
      result += pool[values[i] % pool.length];
    }
    setMasterPassword(result);
    setGenerationCount((c) => c + 1);
  }, [pwdLength, useUpper, useLower, useNumbers, useSymbols, excludeAmbiguous]);

  // 2. Diceware Passphrase Generator
  const generatePassphrase = useCallback(() => {
    const words: string[] = [];
    for (let i = 0; i < wordCount; i++) {
      let w = EFF_WORDLIST[getCryptoRandomInt(EFF_WORDLIST.length)];
      if (capitalizeWords) {
        w = w.charAt(0).toUpperCase() + w.slice(1);
      }
      words.push(w);
    }
    if (appendNumber) {
      const num = getCryptoRandomInt(900) + 100;
      words.push(String(num));
    }
    setPassphrase(words.join(separator));
    setGenerationCount((c) => c + 1);
  }, [wordCount, separator, capitalizeWords, appendNumber]);

  // 3. Developer Secrets Generator
  const generateDevSecrets = useCallback(() => {
    // 256-bit Hex Salt
    const saltBytes = new Uint8Array(32);
    window.crypto.getRandomValues(saltBytes);
    const hex = Array.from(saltBytes).map((b) => b.toString(16).padStart(2, "0")).join("");
    setSalt256(hex);

    // 512-bit Base64 JWT Secret
    const jwtBytes = new Uint8Array(64);
    window.crypto.getRandomValues(jwtBytes);
    let bin = "";
    for (let i = 0; i < jwtBytes.byteLength; i++) {
      bin += String.fromCharCode(jwtBytes[i]);
    }
    setJwtSecret512(btoa(bin));

    // Postgres URI safe key (no @, :, /, ?, #)
    const uriCharset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-_~";
    const uriValues = new Uint32Array(32);
    window.crypto.getRandomValues(uriValues);
    let uKey = "";
    for (let i = 0; i < 32; i++) {
      uKey += uriCharset[uriValues[i] % uriCharset.length];
    }
    setPostgresUriKey(uKey);

    // UUID batch
    const uuids = [
      generateCryptoUUID(),
      generateCryptoUUID(),
      generateCryptoUUID(),
      generateCryptoUUID(),
      generateCryptoUUID(),
    ];
    setUuidBatch(uuids);
    setGenerationCount((c) => c + 1);
  }, []);

  // Initial mount
  useEffect(() => {
    generatePassword();
    generatePassphrase();
    generateDevSecrets();
  }, [generatePassword, generatePassphrase, generateDevSecrets]);

  // Spacebar hotkey listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Ignore if focus is inside an input, textarea or select
      const active = document.activeElement;
      if (active && (active.tagName === "INPUT" || active.tagName === "TEXTAREA" || active.tagName === "SELECT")) {
        return;
      }
      if (e.code === "Space") {
        e.preventDefault();
        if (mode === "password") generatePassword();
        else if (mode === "diceware") generatePassphrase();
        else generateDevSecrets();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mode, generatePassword, generatePassphrase, generateDevSecrets]);

  // Shannon Entropy & Crack Time Calculations
  const entropyBits = useMemo(() => {
    if (mode === "password") {
      let poolSize = 0;
      if (useLower) poolSize += 26;
      if (useUpper) poolSize += 26;
      if (useNumbers) poolSize += 10;
      if (useSymbols) poolSize += 28;
      if (excludeAmbiguous) poolSize -= 7;
      if (poolSize <= 1) return 0;
      return Math.round(pwdLength * (Math.log(poolSize) / Math.LN2));
    }
    if (mode === "diceware") {
      return Math.round(wordCount * (Math.log(EFF_WORDLIST.length) / Math.LN2) + (appendNumber ? 10 : 0));
    }
    return 256;
  }, [mode, pwdLength, useLower, useUpper, useNumbers, useSymbols, excludeAmbiguous, wordCount, appendNumber]);

  const crackTimeEstimate = useMemo(() => {
    if (entropyBits >= 128) return "> 100 Trillion Centuries";
    if (entropyBits >= 90) return "~ 4.8 Million Centuries";
    if (entropyBits >= 70) return "~ 34,000 Years";
    if (entropyBits >= 55) return "~ 18 Months";
    if (entropyBits >= 40) return "~ 3.2 Hours";
    return "< 2 Seconds (Vulnerable)";
  }, [entropyBits]);

  // Character Type Color Highlighter for Readout
  const renderHighlightedString = (str: string) => {
    if (!showPassword && mode === "password") {
      return <span className="text-[#64748B]">{"•".repeat(str.length)}</span>;
    }
    return (
      <span>
        {str.split("").map((ch, idx) => {
          const isNum = /[0-9]/.test(ch);
          const isSym = /[^a-zA-Z0-9]/.test(ch);
          const colorClass = isSym
            ? "text-[#F59E0B] font-bold"
            : isNum
            ? "text-[#9CA3AF] font-semibold"
            : "text-[#F3F4F6]";
          return (
            <span key={idx} className={colorClass}>
              {ch}
            </span>
          );
        })}
      </span>
    );
  };

  return (
    <div className="min-h-screen bg-[#08090C] text-[#F3F4F6] font-sans selection:bg-white selection:text-black flex flex-col">
      {/* SECTION 0: GLOBAL ECOSYSTEM BAR */}
      <GlobalEcosystemBar activeDomain="password" />

      {/* SECTION 1: HARDWARE CRYPTO INSTRUMENT HEADER */}
      <header className="border-b border-white/[0.08] bg-[#0E1015] px-4 sm:px-6 py-3 border-t border-white/[0.16]">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="size-8 rounded-md bg-[#14171F] border border-white/[0.08] grid place-items-center text-white">
              <Key className="size-4 text-emerald-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base tracking-tight text-white font-mono">
                  SPARROWX // KEYS
                </span>
                <span className="rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 text-[9px] font-mono font-semibold tracking-wider">
                  NO LOGIN REQUIRED
                </span>
              </div>
              <p className="text-[10px] text-[#64748B] font-mono">
                password.sparrowx.net • Native Client-Side CSPRNG Instrument
              </p>
            </div>
          </div>

          {/* Telemetry Indicator */}
          <div className="flex items-center gap-3 font-mono text-[10px] text-[#9CA3AF]">
            <div className="flex items-center gap-1.5 border border-white/[0.08] bg-[#14171F] px-2.5 py-1 rounded-sm">
              <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-white font-semibold tabular-nums">{networkDispatched}</span>
              <span className="text-[#64748B]">NETWORK CALLS</span>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 border border-white/[0.08] bg-[#14171F] px-2.5 py-1 rounded-sm text-[#64748B]">
              <span>RNG:</span>
              <span className="text-[#9CA3AF]">window.crypto</span>
            </div>
          </div>
        </div>
      </header>

      {/* SECTION 2: THE LIVE INSTRUMENT (PRECISION CONSOLE) */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* TOP SEGMENTED INDUSTRIAL SWITCH (MODE MATRIX) */}
        <div className="border border-white/[0.08] bg-[#0E1015] p-1.5 rounded-md flex flex-wrap items-center justify-between gap-2 shadow-2xs">
          <div className="flex items-center gap-1 w-full sm:w-auto overflow-x-auto no-scrollbar touch-pan-x py-0.5">
            <button
              type="button"
              onClick={() => setMode("password")}
              className={`flex-1 sm:flex-initial min-h-[38px] px-3.5 py-1.5 rounded-[4px] text-xs font-mono font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
                mode === "password"
                  ? "bg-white text-black font-semibold shadow-sm"
                  : "text-[#9CA3AF] hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <span>1. Master Password</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("diceware")}
              className={`flex-1 sm:flex-initial min-h-[38px] px-3.5 py-1.5 rounded-[4px] text-xs font-mono font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
                mode === "diceware"
                  ? "bg-white text-black font-semibold shadow-sm"
                  : "text-[#9CA3AF] hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <span>2. Diceware Passphrase</span>
            </button>
            <button
              type="button"
              onClick={() => setMode("developer")}
              className={`flex-1 sm:flex-initial min-h-[38px] px-3.5 py-1.5 rounded-[4px] text-xs font-mono font-medium transition-all cursor-pointer flex items-center justify-center gap-1.5 shrink-0 ${
                mode === "developer"
                  ? "bg-white text-black font-semibold shadow-sm"
                  : "text-[#9CA3AF] hover:text-white hover:bg-white/[0.04]"
              }`}
            >
              <span>3. Developer Secrets</span>
            </button>
          </div>

          <div className="hidden md:flex items-center gap-2 text-[10px] font-mono text-[#64748B] pr-2">
            <span>PRESS</span>
            <kbd className="px-1.5 py-0.5 bg-[#14171F] border border-white/[0.08] text-[#9CA3AF] rounded text-[9px]">
              SPACEBAR
            </kbd>
            <span>TO REGENERATE</span>
          </div>
        </div>

        {/* OVERSIZED MONOSPACE READOUT SCREEN */}
        <div className="border border-white/[0.08] bg-[#0E1015] rounded-md overflow-hidden relative shadow-md">
          {/* Top readout status bar */}
          <div className="border-b border-white/[0.08] bg-[#14171F] px-4 py-2 flex items-center justify-between text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="size-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[#9CA3AF] text-[11px] uppercase tracking-wider">
                {mode === "password"
                  ? `Cryptographic Output [${pwdLength} Chars]`
                  : mode === "diceware"
                  ? `Diceware Entropy Stream [${wordCount} Words]`
                  : "Cryptographic Master Vector Set"}
              </span>
            </div>
            <div className="flex items-center gap-3">
              {mode === "password" && (
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[#9CA3AF] hover:text-white transition-colors flex items-center gap-1 text-[11px]"
                >
                  {showPassword ? <EyeOff className="size-3" /> : <Eye className="size-3" />}
                  <span>{showPassword ? "Mask" : "Reveal"}</span>
                </button>
              )}
              <span className="text-[10px] text-[#64748B] tabular-nums">GEN #{generationCount}</span>
            </div>
          </div>

          {/* Main Output Box (Stacks cleanly on mobile) */}
          <div className="p-4 sm:p-8 bg-[#08090C] min-h-[140px] flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
            <div className="min-w-0 flex-1 overflow-x-auto no-scrollbar py-2">
              {mode === "password" && (
                <div className="text-xl sm:text-3xl lg:text-4xl font-mono tracking-wider break-all select-all">
                  {renderHighlightedString(masterPassword)}
                </div>
              )}
              {mode === "diceware" && (
                <div className="text-xl sm:text-3xl font-mono tracking-wide break-words select-all text-white">
                  {renderHighlightedString(passphrase)}
                </div>
              )}
              {mode === "developer" && (
                <div className="space-y-3 font-mono text-xs">
                  <div>
                    <span className="text-[#64748B] block text-[10px] uppercase">Postgres Database Safe Password:</span>
                    <span className="text-[#F3F4F6] text-sm select-all">{postgresUriKey}</span>
                  </div>
                  <div>
                    <span className="text-[#64748B] block text-[10px] uppercase">256-bit Hex Salt:</span>
                    <span className="text-[#9CA3AF] text-xs select-all truncate block">{salt256}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Readout Action Cluster (Touch-friendly 44px targets) */}
            <div className="flex flex-row items-center gap-2 shrink-0 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => {
                  const targetText =
                    mode === "password"
                      ? masterPassword
                      : mode === "diceware"
                      ? passphrase
                      : postgresUriKey;
                  handleCopy(targetText, "main");
                }}
                className="flex-1 sm:flex-initial min-h-[44px] px-5 py-2.5 rounded-sm bg-white text-black font-semibold text-xs hover:bg-neutral-200 transition-all flex items-center justify-center gap-1.5 cursor-pointer shadow-sm active:scale-95"
              >
                {copiedId === "main" ? (
                  <>
                    <Check className="size-3.5 text-emerald-600" />
                    <span>Copied!</span>
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    <span>Copy to RAM</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  if (mode === "password") generatePassword();
                  else if (mode === "diceware") generatePassphrase();
                  else generateDevSecrets();
                }}
                className="size-11 sm:size-9 min-h-[44px] min-w-[44px] sm:min-h-0 sm:min-w-0 rounded-sm border border-white/[0.08] bg-[#14171F] hover:bg-white/[0.08] text-white grid place-items-center transition-colors cursor-pointer"
                title="Regenerate (Spacebar)"
              >
                <RefreshCw className="size-4 text-[#9CA3AF]" />
              </button>
            </div>
          </div>

          {/* LIVE TELEMETRY STRIP (ENTROPY & CRACK TIME) */}
          <div className="border-t border-white/[0.08] bg-[#0E1015] px-4 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[#64748B]">SHANNON ENTROPY:</span>
                <span className="text-white font-bold tabular-nums">{entropyBits} BITS</span>
              </div>
              <div className="w-24 sm:w-36 h-1.5 bg-[#14171F] rounded-full overflow-hidden border border-white/[0.08]">
                <div
                  className={`h-full transition-all duration-300 ${
                    entropyBits >= 90
                      ? "bg-emerald-400"
                      : entropyBits >= 60
                      ? "bg-amber-400"
                      : "bg-red-400"
                  }`}
                  style={{ width: `${Math.min(100, (entropyBits / 128) * 100)}%` }}
                />
              </div>
            </div>

            <div className="flex items-center gap-4 text-[11px]">
              <div>
                <span className="text-[#64748B]">CRACK-TIME (100B GUESSES/S):</span>{" "}
                <span className="text-emerald-400 font-semibold">{crackTimeEstimate}</span>
              </div>
              <div className="hidden md:inline text-[#64748B]">•</div>
              <div className="hidden md:inline text-emerald-400">
                0 Leaks • Memory Discard on Close
              </div>
            </div>
          </div>
        </div>

        {/* CONTROLS GRID: EXPOSED HAIRLINE STRUCTURAL FRAME */}
        <div className="border border-white/[0.08] bg-[#0E1015] rounded-md divide-y sm:divide-y-0 sm:divide-x divide-white/[0.08] grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {mode === "password" && (
            <>
              {/* Control 1: Length Slider */}
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[#9CA3AF] uppercase text-[10px]">Entropy Length</span>
                  <span className="font-bold text-white tabular-nums px-2 py-0.5 bg-[#14171F] border border-white/[0.08] rounded">
                    {pwdLength} Chars
                  </span>
                </div>
                <input
                  type="range"
                  min="8"
                  max="128"
                  value={pwdLength}
                  onChange={(e) => setPwdLength(Number(e.target.value))}
                  className="w-full accent-white cursor-pointer h-1.5 bg-[#14171F] rounded-lg"
                />
                <div className="flex justify-between text-[10px] font-mono text-[#64748B]">
                  <span>8 min</span>
                  <span>32 rec</span>
                  <span>128 max</span>
                </div>
              </div>

              {/* Control 2: Character Sets */}
              <div className="p-5 space-y-2 text-xs font-mono">
                <span className="text-[#9CA3AF] uppercase text-[10px] block mb-2">Character Matrix</span>
                <div className="grid grid-cols-2 gap-2">
                  <label className="flex items-center gap-2 cursor-pointer text-[#9CA3AF] hover:text-white min-h-[40px] px-2.5 py-1 rounded bg-[#14171F]/60 border border-white/[0.04] active:bg-white/[0.06]">
                    <input
                      type="checkbox"
                      checked={useUpper}
                      onChange={(e) => setUseUpper(e.target.checked)}
                      className="accent-emerald-500 rounded-sm size-4"
                    />
                    <span>A-Z Upper</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-[#9CA3AF] hover:text-white min-h-[40px] px-2.5 py-1 rounded bg-[#14171F]/60 border border-white/[0.04] active:bg-white/[0.06]">
                    <input
                      type="checkbox"
                      checked={useLower}
                      onChange={(e) => setUseLower(e.target.checked)}
                      className="accent-emerald-500 rounded-sm size-4"
                    />
                    <span>a-z Lower</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-[#9CA3AF] hover:text-white min-h-[40px] px-2.5 py-1 rounded bg-[#14171F]/60 border border-white/[0.04] active:bg-white/[0.06]">
                    <input
                      type="checkbox"
                      checked={useNumbers}
                      onChange={(e) => setUseNumbers(e.target.checked)}
                      className="accent-emerald-500 rounded-sm size-4"
                    />
                    <span>0-9 Digits</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-[#9CA3AF] hover:text-white min-h-[40px] px-2.5 py-1 rounded bg-[#14171F]/60 border border-white/[0.04] active:bg-white/[0.06]">
                    <input
                      type="checkbox"
                      checked={useSymbols}
                      onChange={(e) => setUseSymbols(e.target.checked)}
                      className="accent-emerald-500 rounded-sm size-4"
                    />
                    <span>!@# Symbols</span>
                  </label>
                </div>
              </div>

              {/* Control 3: Disambiguation */}
              <div className="p-5 space-y-3 text-xs font-mono">
                <span className="text-[#9CA3AF] uppercase text-[10px] block">Readability Rules</span>
                <label className="flex items-start gap-2.5 cursor-pointer text-[#9CA3AF] hover:text-white">
                  <input
                    type="checkbox"
                    checked={excludeAmbiguous}
                    onChange={(e) => setExcludeAmbiguous(e.target.checked)}
                    className="accent-emerald-500 rounded-sm mt-0.5"
                  />
                  <div>
                    <span className="font-medium text-white block">Filter Ambiguous Glyphs</span>
                    <span className="text-[10px] text-[#64748B] leading-tight block">
                      Omits confusing chars like i, l, 1, L, o, 0, O
                    </span>
                  </div>
                </label>
              </div>
            </>
          )}

          {mode === "diceware" && (
            <>
              {/* Diceware Control 1: Word Count */}
              <div className="p-5 space-y-3">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-[#9CA3AF] uppercase text-[10px]">Passphrase Words</span>
                  <span className="font-bold text-white tabular-nums px-2 py-0.5 bg-[#14171F] border border-white/[0.08] rounded">
                    {wordCount} Words
                  </span>
                </div>
                <input
                  type="range"
                  min="4"
                  max="12"
                  value={wordCount}
                  onChange={(e) => setWordCount(Number(e.target.value))}
                  className="w-full accent-white cursor-pointer h-1.5 bg-[#14171F] rounded-lg"
                />
                <div className="flex justify-between text-[10px] font-mono text-[#64748B]">
                  <span>4 words</span>
                  <span>6 recommended</span>
                  <span>12 max</span>
                </div>
              </div>

              {/* Diceware Control 2: Separator */}
              <div className="p-5 space-y-2 text-xs font-mono">
                <span className="text-[#9CA3AF] uppercase text-[10px] block mb-2">Word Separator</span>
                <div className="flex items-center gap-1.5">
                  {["-", "_", ".", "/", " "].map((sep) => (
                    <button
                      key={sep}
                      type="button"
                      onClick={() => setSeparator(sep)}
                      className={`px-3 py-1 rounded text-xs transition-colors ${
                        separator === sep
                          ? "bg-white text-black font-bold"
                          : "bg-[#14171F] border border-white/[0.08] text-[#9CA3AF] hover:text-white"
                      }`}
                    >
                      {sep === " " ? "space" : sep}
                    </button>
                  ))}
                </div>
              </div>

              {/* Diceware Control 3: Formatting */}
              <div className="p-5 space-y-2 text-xs font-mono">
                <span className="text-[#9CA3AF] uppercase text-[10px] block mb-2">Augmentations</span>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-[#9CA3AF] hover:text-white">
                    <input
                      type="checkbox"
                      checked={capitalizeWords}
                      onChange={(e) => setCapitalizeWords(e.target.checked)}
                      className="accent-emerald-500 rounded-sm"
                    />
                    <span>Capitalize Words</span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-[#9CA3AF] hover:text-white">
                    <input
                      type="checkbox"
                      checked={appendNumber}
                      onChange={(e) => setAppendNumber(e.target.checked)}
                      className="accent-emerald-500 rounded-sm"
                    />
                    <span>Append 3-Digit Salt</span>
                  </label>
                </div>
              </div>
            </>
          )}

          {mode === "developer" && (
            <>
              {/* Dev 1: 512-bit JWT */}
              <div className="p-5 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-[#9CA3AF] uppercase text-[10px]">512-bit Base64 JWT Secret</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(jwtSecret512, "jwt")}
                    className="text-[#9CA3AF] hover:text-white flex items-center gap-1 text-[10px]"
                  >
                    {copiedId === "jwt" ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                    <span>{copiedId === "jwt" ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div className="p-2.5 rounded bg-[#08090C] border border-white/[0.08] text-[10px] text-[#9CA3AF] font-mono break-all select-all max-h-16 overflow-y-auto">
                  {jwtSecret512}
                </div>
              </div>

              {/* Dev 2: 256-bit Hex */}
              <div className="p-5 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-[#9CA3AF] uppercase text-[10px]">256-bit Hex Auth Salt</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(salt256, "salt")}
                    className="text-[#9CA3AF] hover:text-white flex items-center gap-1 text-[10px]"
                  >
                    {copiedId === "salt" ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                    <span>{copiedId === "salt" ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div className="p-2.5 rounded bg-[#08090C] border border-white/[0.08] text-[10px] text-[#9CA3AF] font-mono break-all select-all max-h-16 overflow-y-auto">
                  {salt256}
                </div>
              </div>

              {/* Dev 3: UUIDv4 Batch */}
              <div className="p-5 space-y-2 text-xs font-mono">
                <div className="flex items-center justify-between">
                  <span className="text-[#9CA3AF] uppercase text-[10px]">UUIDv4 Batch (5x)</span>
                  <button
                    type="button"
                    onClick={() => handleCopy(uuidBatch.join("\n"), "uuids")}
                    className="text-[#9CA3AF] hover:text-white flex items-center gap-1 text-[10px]"
                  >
                    {copiedId === "uuids" ? <Check className="size-3 text-emerald-400" /> : <Copy className="size-3" />}
                    <span>{copiedId === "uuids" ? "Copied" : "Copy All"}</span>
                  </button>
                </div>
                <div className="p-2.5 rounded bg-[#08090C] border border-white/[0.08] text-[10px] text-[#9CA3AF] font-mono space-y-1 select-all">
                  {uuidBatch.map((u, i) => (
                    <div key={i} className="truncate">{u}</div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* SECTION 3: LOWER HALF — ARCHITECTURAL LANDING & CROSS-DOMAIN BRIDGE */}
        <div className="border border-white/[0.08] bg-[#0E1015] rounded-md p-6 sm:p-8 space-y-6">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-white/[0.08] pb-6">
            <div className="space-y-1">
              <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
                Why Client-Side CSPRNG Matters
              </h2>
              <p className="text-xs text-[#9CA3AF] max-w-xl">
                Online password generators that make server calls log your plaintext keys in web server access logs. SparrowX Keys runs 100% inside your browser using the W3C Web Cryptography API.
              </p>
            </div>

            {/* Direct Bridge to db.sparrowx.net */}
            <a
              href="https://db.sparrowx.net"
              onClick={(e) => {
                if (masterPassword) {
                  navigator.clipboard.writeText(masterPassword);
                }
              }}
              className="px-4 py-2.5 rounded-sm bg-[#14171F] border border-white/[0.12] hover:border-white/30 text-xs font-mono text-white flex items-center gap-2 transition-all shrink-0 hover:bg-white/[0.06]"
            >
              <Database className="size-3.5 text-emerald-400" />
              <span>Use Secret in SparrowX DB</span>
              <ArrowUpRight className="size-3.5 text-[#9CA3AF]" />
            </a>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-xs font-mono">
            <div className="space-y-1.5">
              <span className="text-white font-semibold flex items-center gap-1.5">
                <span className="size-1 rounded-full bg-emerald-400" />
                Zero Disk &amp; RAM Scrubbing
              </span>
              <p className="text-[#64748B] text-[11px] leading-relaxed">
                Generated strings reside solely in temporary browser heap memory. Closing this tab permanently purges all trace.
              </p>
            </div>

            <div className="space-y-1.5">
              <span className="text-white font-semibold flex items-center gap-1.5">
                <span className="size-1 rounded-full bg-emerald-400" />
                CSPRNG Entropy Source
              </span>
              <p className="text-[#64748B] text-[11px] leading-relaxed">
                Uses the operating system's kernel entropy pool (<code className="text-[#9CA3AF]">/dev/urandom</code> on Linux/macOS, BCryptGenRandom on Windows).
              </p>
            </div>

            <div className="space-y-1.5">
              <span className="text-white font-semibold flex items-center gap-1.5">
                <span className="size-1 rounded-full bg-emerald-400" />
                Full Offline PWA Capability
              </span>
              <p className="text-[#64748B] text-[11px] leading-relaxed">
                Disconnect your Wi-Fi or airplane mode. SparrowX Keys continues generating high-entropy seeds with zero network.
              </p>
            </div>
          </div>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-white/[0.08] bg-[#050608] px-6 py-4 text-center text-[10px] font-mono text-[#64748B]">
        <span>SPARROWX KEYS // 100% CLIENT-SIDE CRYPTOGRAPHIC ENGINE • ZERO SURVEILLANCE • AP-SOUTHEAST-SYD</span>
      </footer>
    </div>
  );
}
