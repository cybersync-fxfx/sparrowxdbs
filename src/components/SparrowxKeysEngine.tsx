import React, { useState, useEffect, useCallback } from "react";
import {
  Key,
  Shield,
  Copy,
  Check,
  RefreshCw,
  Zap,
  Sliders,
  Lock,
  Terminal,
  Database,
  ArrowRight,
  Eye,
  EyeOff,
  Sparkles,
  Info,
} from "lucide-react";

// Secure Diceware-style curated cryptographic wordlist
const DICEWARE_WORDS = [
  "falcon", "quantum", "cipher", "vault", "sparrow", "nebula", "zenith", "vortex",
  "shield", "crypto", "matrix", "beacon", "vector", "sovereign", "horizon", "aurora",
  "citadel", "sentinel", "kinetic", "vertex", "cascade", "bastion", "phantom", "spectral",
  "obsidian", "titan", "stellar", "prism", "glacier", "chronos", "pulsar", "solaris",
  "enigma", "dynamo", "vertex", "arcane", "strata", "helix", "apogee", "vertex",
  "shadow", "timber", "granite", "quartz", "anchor", "orbit", "tundra", "canyon"
];

export function SparrowxKeysEngine() {
  const [activeTab, setActiveTab] = useState<"password" | "passphrase" | "developer">("password");
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Password generator state
  const [passwordLength, setPasswordLength] = useState<number>(24);
  const [includeUpper, setIncludeUpper] = useState<boolean>(true);
  const [includeLower, setIncludeLower] = useState<boolean>(true);
  const [includeNumbers, setIncludeNumbers] = useState<boolean>(true);
  const [includeSymbols, setIncludeSymbols] = useState<boolean>(true);
  const [avoidAmbiguous, setAvoidAmbiguous] = useState<boolean>(true);
  const [generatedPassword, setGeneratedPassword] = useState<string>("");
  const [showPassword, setShowPassword] = useState<boolean>(true);

  // Passphrase generator state
  const [passphraseWordCount, setPassphraseWordCount] = useState<number>(5);
  const [passphraseSeparator, setPassphraseSeparator] = useState<string>("-");
  const [passphraseCapitalize, setPassphraseCapitalize] = useState<boolean>(false);
  const [includeNumberInPhrase, setIncludeNumberInPhrase] = useState<boolean>(true);
  const [generatedPassphrase, setGeneratedPassphrase] = useState<string>("");

  // Developer secrets state
  const [hexSalt, setHexSalt] = useState<string>("");
  const [jwtSecret, setJwtSecret] = useState<string>("");
  const [uriPassword, setUriPassword] = useState<string>("");

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(id);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  // Secure Random Generator using window.crypto
  const getCryptoRandomInt = (max: number): number => {
    const array = new Uint32Array(1);
    window.crypto.getRandomValues(array);
    return array[0] % max;
  };

  // Generate High-Entropy Password
  const generatePassword = useCallback(() => {
    let charset = "";
    const lower = "abcdefghijklmnopqrstuvwxyz";
    const upper = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const numbers = "0123456789";
    const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";
    const ambiguous = "il1Lo0O";

    if (includeLower) charset += lower;
    if (includeUpper) charset += upper;
    if (includeNumbers) charset += numbers;
    if (includeSymbols) charset += symbols;

    if (avoidAmbiguous) {
      charset = charset
        .split("")
        .filter((c) => !ambiguous.includes(c))
        .join("");
    }

    if (!charset) charset = lower;

    const values = new Uint32Array(passwordLength);
    window.crypto.getRandomValues(values);
    let pwd = "";
    for (let i = 0; i < passwordLength; i++) {
      pwd += charset[values[i] % charset.length];
    }
    setGeneratedPassword(pwd);
  }, [passwordLength, includeUpper, includeLower, includeNumbers, includeSymbols, avoidAmbiguous]);

  // Generate Passphrase
  const generatePassphrase = useCallback(() => {
    const words: string[] = [];
    for (let i = 0; i < passphraseWordCount; i++) {
      let w = DICEWARE_WORDS[getCryptoRandomInt(DICEWARE_WORDS.length)];
      if (passphraseCapitalize) {
        w = w.charAt(0).toUpperCase() + w.slice(1);
      }
      words.push(w);
    }
    if (includeNumberInPhrase) {
      const num = getCryptoRandomInt(900) + 100;
      words.push(String(num));
    }
    setGeneratedPassphrase(words.join(passphraseSeparator));
  }, [passphraseWordCount, passphraseSeparator, passphraseCapitalize, includeNumberInPhrase]);

  // Generate Developer Secrets
  const generateDevSecrets = useCallback(() => {
    // 1. 256-bit Hex Salt (32 bytes)
    const saltBytes = new Uint8Array(32);
    window.crypto.getRandomValues(saltBytes);
    const saltHex = Array.from(saltBytes)
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
    setHexSalt(saltHex);

    // 2. Base64 512-bit JWT Secret Key (64 bytes)
    const jwtBytes = new Uint8Array(64);
    window.crypto.getRandomValues(jwtBytes);
    let binary = "";
    for (let i = 0; i < jwtBytes.byteLength; i++) {
      binary += String.fromCharCode(jwtBytes[i]);
    }
    setJwtSecret(btoa(binary));

    // 3. URI-Safe Database Password
    const uriSafeCharset = "abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_-";
    const uriBytes = new Uint32Array(32);
    window.crypto.getRandomValues(uriBytes);
    let uriPwd = "";
    for (let i = 0; i < 32; i++) {
      uriPwd += uriSafeCharset[uriBytes[i] % uriSafeCharset.length];
    }
    setUriPassword(uriPwd);
  }, []);

  useEffect(() => {
    generatePassword();
    generatePassphrase();
    generateDevSecrets();
  }, [generatePassword, generatePassphrase, generateDevSecrets]);

  // Entropy Calculation (Shannon Entropy / Pool Size)
  const calculatePasswordEntropy = (): number => {
    let pool = 0;
    if (includeLower) pool += 26;
    if (includeUpper) pool += 26;
    if (includeNumbers) pool += 10;
    if (includeSymbols) pool += 28;
    if (avoidAmbiguous) pool -= 7;
    if (pool <= 1) return 0;
    return Math.round(passwordLength * (Math.log(pool) / Math.LN2));
  };

  const calculatePassphraseEntropy = (): number => {
    return Math.round(passphraseWordCount * (Math.log(DICEWARE_WORDS.length) / Math.LN2) + (includeNumberInPhrase ? 10 : 0));
  };

  const passwordEntropy = calculatePasswordEntropy();
  const passphraseEntropy = calculatePassphraseEntropy();

  return (
    <div className="min-h-screen bg-[#05070B] text-zinc-100 font-sans selection:bg-[#00F2FE] selection:text-black">
      {/* Header */}
      <header className="border-b border-zinc-800/80 bg-[#0B0F17]/90 backdrop-blur sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <a href="/" className="flex items-center gap-2 group">
              <div className="size-8 rounded-lg bg-emerald-500/15 border border-emerald-500/30 grid place-items-center text-emerald-400 group-hover:scale-105 transition-transform">
                <Key className="size-4" />
              </div>
              <div>
                <span className="font-extrabold text-base tracking-tight text-white group-hover:text-emerald-400 transition-colors">
                  SparrowX <span className="text-emerald-400">Keys</span>
                </span>
                <span className="text-[10px] ml-2 px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-mono">
                  100% Client-Side CSPRNG
                </span>
              </div>
            </a>
          </div>

          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="hidden sm:inline-flex items-center gap-1.5 text-zinc-400">
              <Lock className="size-3 text-emerald-400" />
              Zero Server Calls
            </span>
            <a
              href="/"
              className="px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700 text-zinc-200 transition-colors"
            >
              Back to Hub
            </a>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 py-12 space-y-8">
        {/* Hero Section */}
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-xs font-mono text-emerald-400">
            <Zap className="size-3.5" />
            <span>Cryptographic Pseudorandom Number Generator (Web Crypto API)</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            Client-Side Secrets & High-Entropy Keys
          </h1>
          <p className="text-sm text-zinc-400 max-w-xl mx-auto">
            Generated directly in your browser's memory using cryptographically secure hardware entropy.
            No data ever touches a network socket or server log.
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex items-center justify-center p-1 rounded-xl bg-zinc-900 border border-zinc-800 max-w-md mx-auto">
          {[
            { id: "password", label: "Password" },
            { id: "passphrase", label: "Passphrase" },
            { id: "developer", label: "Developer Keys" },
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex-1 py-2 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeTab === tab.id
                  ? "bg-emerald-500 text-zinc-950 shadow-md font-bold"
                  : "text-zinc-400 hover:text-zinc-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* TAB 1: HIGH-ENTROPY PASSWORD */}
        {activeTab === "password" && (
          <div className="rounded-2xl border border-zinc-800 bg-[#0B0F17] p-6 sm:p-8 space-y-6 shadow-xl">
            {/* Display Box */}
            <div className="relative rounded-xl border border-zinc-700 bg-zinc-950 p-4 font-mono text-base text-emerald-300 break-all select-all flex items-center justify-between gap-4">
              <span className="tracking-wider">
                {showPassword ? generatedPassword : "•".repeat(generatedPassword.length)}
              </span>
              <div className="flex items-center gap-2 shrink-0 select-none">
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-white transition-colors cursor-pointer"
                  title="Toggle Visibility"
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
                <button
                  type="button"
                  onClick={generatePassword}
                  className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-emerald-400 transition-colors cursor-pointer"
                  title="Generate New Password"
                >
                  <RefreshCw className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(generatedPassword, "password")}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold text-xs shadow-md transition-colors cursor-pointer"
                >
                  {copiedKey === "password" ? <Check className="size-4" /> : <Copy className="size-4" />}
                  <span>{copiedKey === "password" ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>

            {/* Entropy Meter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400">Entropy Strength:</span>
                <span className="text-emerald-400 font-bold">
                  {passwordEntropy} bits ({passwordEntropy > 100 ? "Quantum-Resistant" : passwordEntropy > 70 ? "Excellent" : "Moderate"})
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-emerald-500 to-cyan-400 transition-all duration-300"
                  style={{ width: `${Math.min(100, (passwordEntropy / 128) * 100)}%` }}
                />
              </div>
            </div>

            {/* Controls */}
            <div className="space-y-5 pt-4 border-t border-zinc-800">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-zinc-300">Length: {passwordLength} characters</span>
                  <span className="text-zinc-500">Range: 8–128</span>
                </div>
                <input
                  type="range"
                  min={8}
                  max={128}
                  value={passwordLength}
                  onChange={(e) => setPasswordLength(Number(e.target.value))}
                  className="w-full accent-emerald-400 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                {[
                  { label: "Uppercase (A-Z)", state: includeUpper, set: setIncludeUpper },
                  { label: "Lowercase (a-z)", state: includeLower, set: setIncludeLower },
                  { label: "Numbers (0-9)", state: includeNumbers, set: setIncludeNumbers },
                  { label: "Symbols (!@#$)", state: includeSymbols, set: setIncludeSymbols },
                  { label: "Avoid Ambiguous (1, l, O, 0)", state: avoidAmbiguous, set: setAvoidAmbiguous },
                ].map((opt) => (
                  <label
                    key={opt.label}
                    className="flex items-center gap-2 p-3 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 cursor-pointer select-none"
                  >
                    <input
                      type="checkbox"
                      checked={opt.state}
                      onChange={(e) => opt.set(e.target.checked)}
                      className="size-4 accent-emerald-400 rounded"
                    />
                    <span className="text-zinc-300">{opt.label}</span>
                  </label>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* TAB 2: MEMORABLE PASSPHRASE */}
        {activeTab === "passphrase" && (
          <div className="rounded-2xl border border-zinc-800 bg-[#0B0F17] p-6 sm:p-8 space-y-6 shadow-xl">
            {/* Display Box */}
            <div className="relative rounded-xl border border-zinc-700 bg-zinc-950 p-4 font-mono text-base text-cyan-300 break-all select-all flex items-center justify-between gap-4">
              <span className="tracking-wider">{generatedPassphrase}</span>
              <div className="flex items-center gap-2 shrink-0 select-none">
                <button
                  type="button"
                  onClick={generatePassphrase}
                  className="p-2 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-400 hover:text-cyan-400 transition-colors cursor-pointer"
                  title="Generate New Passphrase"
                >
                  <RefreshCw className="size-4" />
                </button>
                <button
                  type="button"
                  onClick={() => copyToClipboard(generatedPassphrase, "passphrase")}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-cyan-400 hover:bg-cyan-300 text-zinc-950 font-bold text-xs shadow-md transition-colors cursor-pointer"
                >
                  {copiedKey === "passphrase" ? <Check className="size-4" /> : <Copy className="size-4" />}
                  <span>{copiedKey === "passphrase" ? "Copied" : "Copy"}</span>
                </button>
              </div>
            </div>

            {/* Entropy Meter */}
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="text-zinc-400">Diceware Entropy:</span>
                <span className="text-cyan-400 font-bold">
                  {passphraseEntropy} bits ({passphraseWordCount} Diceware words)
                </span>
              </div>
              <div className="h-2 w-full rounded-full bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-emerald-400 transition-all duration-300"
                  style={{ width: `${Math.min(100, (passphraseEntropy / 100) * 100)}%` }}
                />
              </div>
            </div>

            {/* Controls */}
            <div className="space-y-5 pt-4 border-t border-zinc-800">
              <div className="space-y-2">
                <div className="flex justify-between text-xs font-mono">
                  <span className="text-zinc-300">Word Count: {passphraseWordCount} words</span>
                  <span className="text-zinc-500">Range: 3–10</span>
                </div>
                <input
                  type="range"
                  min={3}
                  max={10}
                  value={passphraseWordCount}
                  onChange={(e) => setPassphraseWordCount(Number(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div className="p-3 rounded-lg border border-zinc-800 bg-zinc-900/60 space-y-1">
                  <label className="text-zinc-400 block font-mono">Separator</label>
                  <input
                    type="text"
                    maxLength={3}
                    value={passphraseSeparator}
                    onChange={(e) => setPassphraseSeparator(e.target.value)}
                    className="w-full rounded bg-zinc-800 border border-zinc-700 px-2 py-1 font-mono text-zinc-100 outline-none"
                  />
                </div>
                <label className="flex items-center gap-2 p-3 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={passphraseCapitalize}
                    onChange={(e) => setPassphraseCapitalize(e.target.checked)}
                    className="size-4 accent-cyan-400 rounded"
                  />
                  <span className="text-zinc-300">Capitalize Words</span>
                </label>
                <label className="flex items-center gap-2 p-3 rounded-lg border border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeNumberInPhrase}
                    onChange={(e) => setIncludeNumberInPhrase(e.target.checked)}
                    className="size-4 accent-cyan-400 rounded"
                  />
                  <span className="text-zinc-300">Append Random Number</span>
                </label>
              </div>
            </div>
          </div>
        )}

        {/* TAB 3: DEVELOPER SECRETS */}
        {activeTab === "developer" && (
          <div className="rounded-2xl border border-zinc-800 bg-[#0B0F17] p-6 sm:p-8 space-y-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-4">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Terminal className="size-4 text-emerald-400" />
                  <span>Infrastructure & Backend Tokens</span>
                </h3>
                <p className="text-xs text-zinc-400">
                  Pre-configured cryptographic keys for PostgreSQL, PostgREST, and JWT authentication.
                </p>
              </div>
              <button
                type="button"
                onClick={generateDevSecrets}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-xs font-semibold text-zinc-200 cursor-pointer"
              >
                <RefreshCw className="size-3.5" />
                <span>Regenerate All</span>
              </button>
            </div>

            <div className="space-y-4">
              {/* 256-bit Hex Salt */}
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/70 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">256-Bit Cryptographic Hex Salt (32 Bytes)</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(hexSalt, "hex-salt")}
                    className="text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === "hex-salt" ? <Check className="size-3" /> : <Copy className="size-3" />}
                    <span>{copiedKey === "hex-salt" ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div className="font-mono text-xs text-zinc-300 bg-zinc-900 border border-zinc-800 rounded p-2.5 break-all select-all">
                  {hexSalt}
                </div>
              </div>

              {/* 512-bit Base64 JWT Secret */}
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/70 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">Base64 512-Bit JWT Secret (PostgREST / Gotrue)</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(jwtSecret, "jwt-secret")}
                    className="text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === "jwt-secret" ? <Check className="size-3" /> : <Copy className="size-3" />}
                    <span>{copiedKey === "jwt-secret" ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div className="font-mono text-xs text-zinc-300 bg-zinc-900 border border-zinc-800 rounded p-2.5 break-all select-all">
                  {jwtSecret}
                </div>
              </div>

              {/* URI-Safe DB Password */}
              <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/70 space-y-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="text-zinc-400">URI-Safe Database Password (No escaped characters)</span>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(uriPassword, "uri-pwd")}
                    className="text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === "uri-pwd" ? <Check className="size-3" /> : <Copy className="size-3" />}
                    <span>{copiedKey === "uri-pwd" ? "Copied" : "Copy"}</span>
                  </button>
                </div>
                <div className="font-mono text-xs text-zinc-300 bg-zinc-900 border border-zinc-800 rounded p-2.5 break-all select-all">
                  {uriPassword}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Security Disclosure Notice */}
        <div className="rounded-xl border border-zinc-800/80 bg-zinc-900/30 p-4 flex items-start gap-3 text-xs text-zinc-400">
          <Info className="size-4 text-emerald-400 shrink-0 mt-0.5" />
          <p>
            <strong>Security Guarantee:</strong> This utility runs 100% in local browser memory.
            All keys are produced via <code className="text-zinc-200">crypto.getRandomValues()</code> and
            never leave your browser session. You can safely disconnect your internet and generate keys offline.
          </p>
        </div>
      </main>
    </div>
  );
}
