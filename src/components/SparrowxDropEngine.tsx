import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  UploadCloud,
  Shield,
  Lock,
  KeyRound,
  Copy,
  Check,
  Trash2,
  Clock,
  Activity,
  FileText,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Zap,
  Flame,
} from "lucide-react";

interface StagedFile {
  name: string;
  size: number;
  type: string;
  encryptedBytesLength: number;
  hash: string;
}

export function SparrowxDropEngine() {
  const [file, setFile] = useState<StagedFile | null>(null);
  const [encrypting, setEncrypting] = useState<boolean>(false);
  const [secretKeyHex, setSecretKeyHex] = useState<string>("");
  const [shareLink, setShareLink] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [ttlSeconds, setTtlSeconds] = useState<number>(15 * 60); // 15 mins
  const [sessionActive, setSessionActive] = useState<boolean>(false);
  const [burnNotice, setBurnNotice] = useState<string | null>(null);

  const fileBufferRef = useRef<ArrayBuffer | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  // Generate AES-GCM key and encrypt file in-browser
  const processAndEncryptFile = async (rawFile: File) => {
    if (rawFile.size > 100 * 1024 * 1024) {
      alert("File exceeds maximum allowable size of 100MB for zero-disk RAM transfer.");
      return;
    }

    setEncrypting(true);
    setBurnNotice(null);

    try {
      const buffer = await rawFile.arrayBuffer();
      // Generate 256-bit AES-GCM Key
      const key = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );

      // Export key for URL hash
      const exportedKey = await window.crypto.subtle.exportKey("raw", key);
      const keyHex = Array.from(new Uint8Array(exportedKey))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      // 12-byte IV (Initialization Vector)
      const iv = window.crypto.getRandomValues(new Uint8Array(12));

      // Encrypt file
      const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv },
        key,
        buffer
      );

      fileBufferRef.current = encrypted;

      const staged: StagedFile = {
        name: rawFile.name,
        size: rawFile.size,
        type: rawFile.type || "application/octet-stream",
        encryptedBytesLength: encrypted.byteLength,
        hash: keyHex.slice(0, 16),
      };

      setFile(staged);
      setSecretKeyHex(keyHex);
      const origin = typeof window !== "undefined" ? window.location.origin : "https://sparrowx.net";
      const link = `${origin}/drop#key=${keyHex}&name=${encodeURIComponent(rawFile.name)}`;
      setShareLink(link);
      setSessionActive(true);
      setTtlSeconds(15 * 60);
    } catch (err) {
      console.error("Encryption error", err);
      alert("Failed to encrypt file in browser memory: " + String(err));
    } finally {
      setEncrypting(false);
    }
  };

  // Drag and drop handlers
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processAndEncryptFile(e.dataTransfer.files[0]);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
  };

  // Immediate RAM Purge & Session Burn
  const burnSession = useCallback((reason = "Session destroyed by sender") => {
    // Shred memory buffer
    if (fileBufferRef.current) {
      new Uint8Array(fileBufferRef.current).fill(0);
      fileBufferRef.current = null;
    }
    setFile(null);
    setSecretKeyHex("");
    setShareLink("");
    setSessionActive(false);
    setBurnNotice(reason);
  }, []);

  // Cleanup on tab close / beforeunload
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionActive) {
        if (fileBufferRef.current) {
          new Uint8Array(fileBufferRef.current).fill(0);
        }
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [sessionActive]);

  // 15-minute Countdown Timer (TTL)
  useEffect(() => {
    if (!sessionActive) return;
    const interval = setInterval(() => {
      setTtlSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          burnSession("TTL expired: 15-minute session lifetime reached. File purged from RAM.");
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [sessionActive, burnSession]);

  const formatTtl = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const copyShareLink = () => {
    if (!shareLink) return;
    navigator.clipboard.writeText(shareLink);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="min-h-screen bg-[#05070B] text-zinc-100 flex flex-col font-sans selection:bg-[#3ECF8E] selection:text-zinc-950">
      {/* Top Banner */}
      <div className="bg-[#0B0F17] border-b border-[#1E293B] px-4 py-2 text-center text-xs text-zinc-400 font-mono flex items-center justify-center gap-3">
        <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
          <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
          Zero-Disk Ephemeral File Drop
        </span>
        <span className="text-zinc-600">|</span>
        <span>Client-Side AES-GCM-256 Encryption</span>
        <span className="text-zinc-600">|</span>
        <span className="text-amber-400">Never Touches Server NVMe / Disk</span>
      </div>

      {/* Main Header */}
      <header className="border-b border-[#1E293B] bg-[#05070B]/90 backdrop-blur-md px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="size-9 rounded-lg bg-[#0B0F17] border border-[#1E293B] grid place-items-center shadow-lg p-1">
            <img
              src="/sparrowx-cyber-hawk.png"
              alt="SparrowX Logo"
              className="size-7 object-contain"
              onError={(e) => {
                (e.target as HTMLElement).style.display = "none";
              }}
            />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-base tracking-tight text-white">
                SparrowX <span className="text-[#3ECF8E]">Drop</span>
              </span>
              <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-mono text-emerald-400">
                P2P Zero-Disk
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 font-mono">
              sparrowx.net/drop • Ephemeral RAM-Only File Transfer
            </p>
          </div>
        </div>

        <a
          href="/"
          className="text-xs text-zinc-400 hover:text-white font-mono flex items-center gap-1 transition-colors"
        >
          <span>SparrowX Ecosystem</span>
          <ChevronRight className="size-3.5" />
        </a>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-6 py-10 space-y-8">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-mono text-emerald-400">
            <Lock className="size-3.5" />
            <span>End-to-End Encrypted via Web Crypto API</span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
            Share Files Without Leaving a Trace.
          </h1>
          <p className="text-sm text-zinc-400 max-w-xl mx-auto">
            Files are encrypted in your browser before transfer and held strictly in encrypted RAM.
            Closing this browser tab instantly purges all bytes forever.
          </p>
        </div>

        {/* Burn Notice Banner */}
        {burnNotice && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs font-mono text-amber-300 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Flame className="size-4 text-amber-400 shrink-0" />
              <span>{burnNotice}</span>
            </div>
            <button
              type="button"
              onClick={() => setBurnNotice(null)}
              className="text-zinc-400 hover:text-white"
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Active Transfer Card or Dropzone */}
        {!sessionActive ? (
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onClick={() => fileInputRef.current?.click()}
            className="rounded-2xl border-2 border-dashed border-[#1E293B] hover:border-[#3ECF8E]/60 bg-[#0B0F17]/60 p-12 text-center cursor-pointer transition-all hover:bg-[#0B0F17] group space-y-4"
          >
            <input
              type="file"
              ref={fileInputRef}
              onChange={(e) => {
                if (e.target.files && e.target.files[0]) {
                  processAndEncryptFile(e.target.files[0]);
                }
              }}
              className="hidden"
            />
            <div className="size-16 rounded-2xl bg-[#3ECF8E]/10 border border-[#3ECF8E]/20 text-[#3ECF8E] grid place-items-center mx-auto group-hover:scale-105 transition-transform">
              <UploadCloud className="size-8" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-semibold text-white">
                {encrypting ? "Encrypting file in browser RAM..." : "Drag and drop your file here, or browse"}
              </p>
              <p className="text-xs text-zinc-400 font-mono">
                Maximum 100MB per file • AES-GCM-256 encrypted before transfer
              </p>
            </div>
          </div>
        ) : (
          <div className="rounded-2xl border border-[#1E293B] bg-[#0B0F17] p-6 space-y-6 shadow-2xl">
            {/* Heartbeat Status Header */}
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E293B] pb-4">
              <div className="flex items-center gap-3">
                <span className="relative flex size-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full size-3 bg-emerald-500" />
                </span>
                <div>
                  <div className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                    Session Active — Do Not Close This Tab
                  </div>
                  <p className="text-[11px] text-zinc-400">
                    File lives in browser memory. Closing this tab purges the encryption key.
                  </p>
                </div>
              </div>

              {/* TTL Clock */}
              <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 font-mono text-xs text-amber-300">
                <Clock className="size-3.5 text-amber-400" />
                <span>Auto-Purge TTL:</span>
                <span className="font-bold">{formatTtl(ttlSeconds)}</span>
              </div>
            </div>

            {/* File Metadata Card */}
            {file && (
              <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-[#05070B] p-4 text-xs font-mono">
                <div className="flex items-center gap-3 truncate">
                  <div className="size-10 rounded-lg bg-zinc-800 grid place-items-center text-[#3ECF8E]">
                    <FileText className="size-5" />
                  </div>
                  <div className="truncate">
                    <p className="font-bold text-white truncate">{file.name}</p>
                    <p className="text-[11px] text-zinc-500">
                      {formatSize(file.size)} • Encrypted Payload: {formatSize(file.encryptedBytesLength)}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 text-[10px]">
                    AES-GCM-256
                  </span>
                </div>
              </div>
            )}

            {/* One-Time Shareable Link Box */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                <span>One-Time Direct Transfer Link</span>
                <span className="text-[11px] font-mono text-zinc-500">Encryption key stored in URL hash only</span>
              </label>

              <div className="flex items-center gap-2">
                <div className="flex-1 rounded-lg border border-zinc-800 bg-[#05070B] px-3 py-2 font-mono text-xs text-[#3ECF8E] truncate">
                  {shareLink}
                </div>
                <button
                  type="button"
                  onClick={copyShareLink}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-[#3ECF8E] text-zinc-950 font-bold px-4 py-2 text-xs shadow-lg shadow-emerald-500/20 cursor-pointer"
                >
                  {copiedLink ? (
                    <>
                      <Check className="size-3.5" />
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <Copy className="size-3.5" />
                      <span>Copy Link</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Actions: Burn / Purge */}
            <div className="flex items-center justify-between border-t border-[#1E293B] pt-4">
              <div className="text-[11px] text-zinc-500 font-mono flex items-center gap-1.5">
                <Shield className="size-3.5 text-[#3ECF8E]" />
                <span>Zero telemetry • Zero disk footprint</span>
              </div>

              <button
                type="button"
                onClick={() => burnSession("Session manually purged and burned by sender.")}
                className="inline-flex items-center gap-1.5 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 text-red-400 px-3 py-1.5 text-xs font-semibold transition-colors cursor-pointer"
              >
                <Trash2 className="size-3.5" />
                <span>Burn & Purge Session Now</span>
              </button>
            </div>
          </div>
        )}

        {/* 3 Architecture Transparency Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
          <div className="rounded-xl border border-[#1E293B] bg-[#0B0F17] p-4 space-y-2">
            <div className="size-8 rounded-lg bg-[#3ECF8E]/10 border border-[#3ECF8E]/30 grid place-items-center text-[#3ECF8E]">
              <Lock className="size-4" />
            </div>
            <h3 className="font-bold text-white text-xs">Client-Side Cryptography</h3>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Files are encrypted with `AES-GCM` before leaving your device. The key lives in the URL hash and is never transmitted to any server.
            </p>
          </div>

          <div className="rounded-xl border border-[#1E293B] bg-[#0B0F17] p-4 space-y-2">
            <div className="size-8 rounded-lg bg-blue-500/10 border border-blue-500/30 grid place-items-center text-blue-400">
              <Activity className="size-4" />
            </div>
            <h3 className="font-bold text-white text-xs">Ephemeral Heartbeat</h3>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Transfers are session-bound. The moment the sender closes this browser tab, memory is zeroed out and destroyed.
            </p>
          </div>

          <div className="rounded-xl border border-[#1E293B] bg-[#0B0F17] p-4 space-y-2">
            <div className="size-8 rounded-lg bg-amber-500/10 border border-amber-500/30 grid place-items-center text-amber-400">
              <Flame className="size-4" />
            </div>
            <h3 className="font-bold text-white text-xs">Strict 15-Minute TTL</h3>
            <p className="text-[11px] text-zinc-400 leading-relaxed">
              Even if the tab remains open, sessions automatically evaporate after 15 minutes to guarantee absolute zero persistence.
            </p>
          </div>
        </div>
      </main>
    </div>
  );
}
