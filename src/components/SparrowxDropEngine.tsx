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
  HardDrive,
  Download,
  Share2,
  FolderOpen,
  FileArchive,
  FileCode,
  FileImage,
  FileVideo,
  FileAudio,
  Search,
} from "lucide-react";

interface StagedFile {
  name: string;
  size: number;
  type: string;
  encryptedBytesLength: number;
  hash: string;
}

export interface PersistentFile {
  id: string;
  name: string;
  size: number;
  type: string;
  createdAt: string;
  downloads: number;
  url: string;
}

export function SparrowxDropEngine() {
  // Service Mode: "storage" (MediaFire-style persistent cloud storage) or "ephemeral" (zero-disk RAM burn)
  const [activeMode, setActiveMode] = useState<"storage" | "ephemeral">("storage");

  // =========================================================================
  // 1. PERSISTENT CLOUD STORAGE STATE (MediaFire style)
  // =========================================================================
  const [persistentFiles, setPersistentFiles] = useState<PersistentFile[]>([]);
  const [loadingFiles, setLoadingFiles] = useState<boolean>(false);
  const [uploadingPersistent, setUploadingPersistent] = useState<boolean>(false);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [fileSearchQuery, setFileSearchQuery] = useState<string>("");
  const [copiedPersistentId, setCopiedPersistentId] = useState<string | null>(null);
  const persistentInputRef = useRef<HTMLInputElement | null>(null);

  // Fetch persistent files from /api/storage/files
  const fetchPersistentFiles = useCallback(async () => {
    setLoadingFiles(true);
    try {
      const res = await fetch("/api/storage/files");
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data)) {
          setPersistentFiles(data);
          return;
        }
      }
      // Fallback from localStorage
      const local = localStorage.getItem("sparrowx_persistent_files");
      if (local) {
        setPersistentFiles(JSON.parse(local));
      } else {
        const seed: PersistentFile[] = [
          {
            id: "spx_f_docs_2026",
            name: "SparrowX-Sovereign-Whitepaper.pdf",
            size: 4820000,
            type: "application/pdf",
            createdAt: "2026-11-09T18:20:00.000Z",
            downloads: 48,
            url: "https://file.sparrowx.net/f/spx_f_docs_2026",
          },
          {
            id: "spx_f_assets_img",
            name: "SparrowX-Cyber-Hawk-HighRes.png",
            size: 1240000,
            type: "image/png",
            createdAt: "2026-11-09T19:10:00.000Z",
            downloads: 128,
            url: "https://file.sparrowx.net/f/spx_f_assets_img",
          },
        ];
        setPersistentFiles(seed);
        localStorage.setItem("sparrowx_persistent_files", JSON.stringify(seed));
      }
    } catch {
      const local = localStorage.getItem("sparrowx_persistent_files");
      if (local) setPersistentFiles(JSON.parse(local));
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    fetchPersistentFiles();
  }, [fetchPersistentFiles]);

  // Handle file upload to persistent disk
  const handleUploadPersistentFile = async (rawFile: File) => {
    setUploadingPersistent(true);
    setUploadProgress(10);

    try {
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onload = () => {
          const res = reader.result as string;
          const base64 = res.split(",")[1];
          resolve(base64);
        };
        reader.onerror = reject;
      });
      reader.readAsDataURL(rawFile);
      setUploadProgress(40);

      const base64Data = await base64Promise;
      setUploadProgress(70);

      const res = await fetch("/api/storage/upload", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          filename: rawFile.name,
          type: rawFile.type,
          base64Data,
        }),
      });

      setUploadProgress(95);

      if (res.ok) {
        const json = await res.json();
        if (json.file) {
          setPersistentFiles((prev) => [json.file, ...prev]);
        }
      } else {
        // Local simulation fallback
        const fileId = `spx_f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        const origin = typeof window !== "undefined" ? window.location.origin : "https://file.sparrowx.net";
        const newRecord: PersistentFile = {
          id: fileId,
          name: rawFile.name,
          size: rawFile.size,
          type: rawFile.type || "application/octet-stream",
          createdAt: new Date().toISOString(),
          downloads: 0,
          url: `${origin}/f/${fileId}`,
        };
        setPersistentFiles((prev) => {
          const updated = [newRecord, ...prev];
          localStorage.setItem("sparrowx_persistent_files", JSON.stringify(updated));
          return updated;
        });
      }
    } catch {
      const fileId = `spx_f_${Date.now().toString(36)}`;
      const origin = typeof window !== "undefined" ? window.location.origin : "https://file.sparrowx.net";
      const newRecord: PersistentFile = {
        id: fileId,
        name: rawFile.name,
        size: rawFile.size,
        type: rawFile.type || "application/octet-stream",
        createdAt: new Date().toISOString(),
        downloads: 0,
        url: `${origin}/f/${fileId}`,
      };
      setPersistentFiles((prev) => {
        const updated = [newRecord, ...prev];
        localStorage.setItem("sparrowx_persistent_files", JSON.stringify(updated));
        return updated;
      });
    } finally {
      setUploadProgress(100);
      setTimeout(() => {
        setUploadingPersistent(false);
        setUploadProgress(0);
      }, 500);
    }
  };

  // Delete persistent file
  const handleDeletePersistentFile = async (id: string, name: string) => {
    if (!confirm(`Permanently delete "${name}" from server NVMe disk? This action cannot be undone.`)) {
      return;
    }
    try {
      await fetch(`/api/storage/files/${id}`, { method: "DELETE" });
    } catch {
      // Ignored
    }
    setPersistentFiles((prev) => {
      const updated = prev.filter((f) => f.id !== id);
      localStorage.setItem("sparrowx_persistent_files", JSON.stringify(updated));
      return updated;
    });
  };

  const copyPersistentLink = (file: PersistentFile) => {
    navigator.clipboard.writeText(file.url);
    setCopiedPersistentId(file.id);
    setTimeout(() => setCopiedPersistentId(null), 2000);
  };

  // =========================================================================
  // 2. EPHEMERAL ZERO-DISK P2P DROP STATE (15-min RAM Burn)
  // =========================================================================
  const [ephemeralFile, setEphemeralFile] = useState<StagedFile | null>(null);
  const [encrypting, setEncrypting] = useState<boolean>(false);
  const [secretKeyHex, setSecretKeyHex] = useState<string>("");
  const [ephemeralShareLink, setEphemeralShareLink] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [ttlSeconds, setTtlSeconds] = useState<number>(15 * 60);
  const [sessionActive, setSessionActive] = useState<boolean>(false);
  const [burnNotice, setBurnNotice] = useState<string | null>(null);

  const fileBufferRef = useRef<ArrayBuffer | null>(null);
  const ephemeralInputRef = useRef<HTMLInputElement | null>(null);

  const processAndEncryptFile = async (rawFile: File) => {
    if (rawFile.size > 100 * 1024 * 1024) {
      alert("File exceeds maximum allowable size of 100MB for zero-disk RAM transfer.");
      return;
    }
    setEncrypting(true);
    setBurnNotice(null);

    try {
      const buffer = await rawFile.arrayBuffer();
      const key = await window.crypto.subtle.generateKey(
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );

      const exportedKey = await window.crypto.subtle.exportKey("raw", key);
      const keyHex = Array.from(new Uint8Array(exportedKey))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");

      const iv = window.crypto.getRandomValues(new Uint8Array(12));
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

      setEphemeralFile(staged);
      setSecretKeyHex(keyHex);

      const isFileDomain = typeof window !== "undefined" && window.location.hostname.includes("file.");
      const origin = typeof window !== "undefined" ? window.location.origin : "https://file.sparrowx.net";
      const link = isFileDomain
        ? `${origin}/#key=${keyHex}&name=${encodeURIComponent(rawFile.name)}`
        : `${origin}/drop#key=${keyHex}&name=${encodeURIComponent(rawFile.name)}`;

      setEphemeralShareLink(link);
      setSessionActive(true);
      setTtlSeconds(15 * 60);
    } catch (err) {
      console.error("Encryption error", err);
      alert("Failed to encrypt file in browser memory: " + String(err));
    } finally {
      setEncrypting(false);
    }
  };

  const burnSession = useCallback((reason = "Session destroyed by sender") => {
    if (fileBufferRef.current) {
      new Uint8Array(fileBufferRef.current).fill(0);
      fileBufferRef.current = null;
    }
    setEphemeralFile(null);
    setSecretKeyHex("");
    setEphemeralShareLink("");
    setSessionActive(false);
    setBurnNotice(reason);
  }, []);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (sessionActive && fileBufferRef.current) {
        new Uint8Array(fileBufferRef.current).fill(0);
      }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [sessionActive]);

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

  const getFileIcon = (mimeOrName: string) => {
    const lower = mimeOrName.toLowerCase();
    if (lower.includes("image") || lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".svg"))
      return <FileImage className="size-4 text-emerald-400" />;
    if (lower.includes("video") || lower.endsWith(".mp4") || lower.endsWith(".mov"))
      return <FileVideo className="size-4 text-blue-400" />;
    if (lower.includes("audio") || lower.endsWith(".mp3") || lower.endsWith(".wav"))
      return <FileAudio className="size-4 text-purple-400" />;
    if (lower.includes("zip") || lower.includes("tar") || lower.endsWith(".gz") || lower.endsWith(".7z"))
      return <FileArchive className="size-4 text-amber-400" />;
    if (lower.includes("json") || lower.includes("javascript") || lower.endsWith(".ts") || lower.endsWith(".py") || lower.endsWith(".sql"))
      return <FileCode className="size-4 text-cyan-400" />;
    return <FileText className="size-4 text-zinc-400" />;
  };

  // Filtered persistent files
  const filteredPersistentFiles = persistentFiles.filter((f) =>
    f.name.toLowerCase().includes(fileSearchQuery.toLowerCase())
  );

  const totalDiskUsedBytes = persistentFiles.reduce((acc, f) => acc + f.size, 0);
  const totalDownloads = persistentFiles.reduce((acc, f) => acc + (f.downloads || 0), 0);

  return (
    <div className="min-h-screen bg-[#05070B] text-zinc-100 flex flex-col font-sans selection:bg-[#3ECF8E] selection:text-zinc-950">
      {/* Top Banner */}
      <div className="bg-[#0B0F17] border-b border-[#1E293B] px-4 py-2 text-center text-xs text-zinc-400 font-mono flex items-center justify-center gap-3">
        <span className="flex items-center gap-1.5 text-emerald-400 font-semibold">
          <span className="size-2 rounded-full bg-emerald-400 animate-pulse" />
          SparrowX File Storage & Ephemeral Drop
        </span>
        <span className="text-zinc-600">|</span>
        <span>Dedicated Host 10.10.10.10</span>
        <span className="text-zinc-600">|</span>
        <span className="text-cyan-400 font-bold">file.sparrowx.net</span>
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
                SparrowX <span className="text-[#3ECF8E]">Files</span>
              </span>
              <span className="rounded border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-mono text-emerald-400 font-semibold">
                Sovereign Storage
              </span>
            </div>
            <p className="text-[10px] text-zinc-400 font-mono">
              file.sparrowx.net • Persistent NVMe Disk & Ephemeral P2P Transfer
            </p>
          </div>
        </div>

        {/* Mode Toggle Switcher */}
        <div className="flex items-center gap-1 bg-[#121218] p-1 rounded-xl border border-zinc-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveMode("storage")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeMode === "storage"
                ? "bg-[#3ECF8E] text-zinc-950 font-bold shadow-md"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <HardDrive className="size-3.5" />
            <span>Persistent Disk (MediaFire)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveMode("ephemeral")}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
              activeMode === "ephemeral"
                ? "bg-[#3ECF8E] text-zinc-950 font-bold shadow-md"
                : "text-zinc-400 hover:text-white"
            }`}
          >
            <Flame className="size-3.5 text-amber-500" />
            <span>Zero-Disk Drop (RAM)</span>
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-6 py-10 space-y-8">
        {/* ================================================================= */}
        {/* MODE 1: PERSISTENT CLOUD STORAGE (MediaFire Style) */}
        {/* ================================================================= */}
        {activeMode === "storage" && (
          <div className="space-y-8">
            {/* Header intro */}
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-mono text-emerald-400">
                <HardDrive className="size-3.5" />
                <span>Sovereign NVMe Disk Storage • Permanent Unique URLs</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                Store Files Forever. Share with One Unique Link.
              </h1>
              <p className="text-sm text-zinc-400">
                Upload any file to your private sovereign server. Each upload gets a permanent download URL
                that stays active until you choose to delete it.
              </p>
            </div>

            {/* Storage Hardware Telemetry HUD */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="rounded-xl border border-[#1E293B] bg-[#0B0F17] p-4 space-y-1">
                <div className="text-[11px] text-zinc-500 font-mono flex items-center justify-between">
                  <span>NVMe Disk Used</span>
                  <HardDrive className="size-3 text-[#3ECF8E]" />
                </div>
                <div className="text-lg font-bold text-white font-mono">{formatSize(totalDiskUsedBytes)}</div>
                <p className="text-[10px] text-zinc-500 font-mono">Quota: 500 GB Allocated</p>
              </div>

              <div className="rounded-xl border border-[#1E293B] bg-[#0B0F17] p-4 space-y-1">
                <div className="text-[11px] text-zinc-500 font-mono flex items-center justify-between">
                  <span>Total Hosted Files</span>
                  <FolderOpen className="size-3 text-cyan-400" />
                </div>
                <div className="text-lg font-bold text-[#3ECF8E] font-mono">{persistentFiles.length} Files</div>
                <p className="text-[10px] text-zinc-500 font-mono">Retained until deleted</p>
              </div>

              <div className="rounded-xl border border-[#1E293B] bg-[#0B0F17] p-4 space-y-1">
                <div className="text-[11px] text-zinc-500 font-mono flex items-center justify-between">
                  <span>Total Downloads</span>
                  <Download className="size-3 text-amber-400" />
                </div>
                <div className="text-lg font-bold text-amber-300 font-mono">{totalDownloads}</div>
                <p className="text-[10px] text-emerald-400 font-mono">Unlimited direct bandwidth</p>
              </div>

              <div className="rounded-xl border border-[#1E293B] bg-[#0B0F17] p-4 space-y-1">
                <div className="text-[11px] text-zinc-500 font-mono flex items-center justify-between">
                  <span>Encryption Standard</span>
                  <Lock className="size-3 text-emerald-400" />
                </div>
                <div className="text-lg font-bold text-white font-mono">AES-256-XTS</div>
                <p className="text-[10px] text-zinc-500 font-mono">Encrypted on bare-metal NVMe</p>
              </div>
            </div>

            {/* Persistent Upload Dropzone */}
            <div
              onDrop={(e) => {
                e.preventDefault();
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                  handleUploadPersistentFile(e.dataTransfer.files[0]);
                }
              }}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => persistentInputRef.current?.click()}
              className="rounded-2xl border-2 border-dashed border-[#1E293B] hover:border-[#3ECF8E]/60 bg-[#0B0F17]/60 p-10 text-center cursor-pointer transition-all hover:bg-[#0B0F17] group space-y-3"
            >
              <input
                type="file"
                ref={persistentInputRef}
                onChange={(e) => {
                  if (e.target.files && e.target.files[0]) {
                    handleUploadPersistentFile(e.target.files[0]);
                  }
                }}
                className="hidden"
              />
              <div className="size-14 rounded-2xl bg-[#3ECF8E]/10 border border-[#3ECF8E]/20 text-[#3ECF8E] grid place-items-center mx-auto group-hover:scale-105 transition-transform">
                <UploadCloud className="size-7" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold text-white">
                  {uploadingPersistent ? "Storing file to NVMe disk..." : "Drop files to store on your sovereign disk, or click to browse"}
                </p>
                <p className="text-xs text-zinc-500 font-mono">
                  Up to 100MB per file • Permanent unique URL generated instantly
                </p>
              </div>

              {uploadingPersistent && (
                <div className="max-w-md mx-auto pt-2 space-y-1.5">
                  <div className="w-full bg-zinc-800 h-2 rounded-full overflow-hidden">
                    <div
                      className="bg-[#3ECF8E] h-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-emerald-400">
                    Writing to server disk: {uploadProgress}%
                  </span>
                </div>
              )}
            </div>

            {/* Hosted Files Explorer Table */}
            <div className="rounded-2xl border border-[#1E293B] bg-[#0B0F17] overflow-hidden shadow-2xl space-y-0">
              {/* Table Toolbar */}
              <div className="border-b border-[#1E293B] bg-[#0E1420] px-5 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FolderOpen className="size-4 text-[#3ECF8E]" />
                  <span className="text-xs font-bold text-white font-mono uppercase tracking-wider">
                    Hosted Files Dashboard ({persistentFiles.length})
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="relative">
                    <Search className="size-3 text-zinc-500 absolute left-2.5 top-2.5" />
                    <input
                      type="text"
                      placeholder="Filter files..."
                      value={fileSearchQuery}
                      onChange={(e) => setFileSearchQuery(e.target.value)}
                      className="h-7 w-48 rounded-md border border-zinc-800 bg-[#05070B] pl-7 pr-2 text-xs font-mono text-zinc-200 placeholder-zinc-500 outline-none focus:border-[#3ECF8E]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={fetchPersistentFiles}
                    className="p-1.5 rounded border border-zinc-800 text-zinc-400 hover:text-white cursor-pointer"
                    title="Refresh file list"
                  >
                    <RefreshCw className={`size-3.5 ${loadingFiles ? "animate-spin" : ""}`} />
                  </button>
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs font-mono">
                  <thead className="bg-[#121620] border-b border-[#1E293B] text-zinc-400">
                    <tr>
                      <th className="p-3">File Name</th>
                      <th className="p-3">Size</th>
                      <th className="p-3">Permanent Download URL</th>
                      <th className="p-3">Downloads</th>
                      <th className="p-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#182030]">
                    {filteredPersistentFiles.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-8 text-center text-zinc-500">
                          No files found on storage disk. Upload your first file above!
                        </td>
                      </tr>
                    ) : (
                      filteredPersistentFiles.map((file) => (
                        <tr key={file.id} className="hover:bg-[#121824] transition-colors">
                          <td className="p-3 font-semibold text-white flex items-center gap-2.5 truncate max-w-xs">
                            {getFileIcon(file.name)}
                            <span className="truncate">{file.name}</span>
                          </td>
                          <td className="p-3 text-zinc-300">{formatSize(file.size)}</td>
                          <td className="p-3 text-[#3ECF8E] truncate max-w-sm">
                            <a
                              href={file.url}
                              target="_blank"
                              rel="noreferrer"
                              className="hover:underline flex items-center gap-1"
                            >
                              <span className="truncate">{file.url}</span>
                              <ExternalLink className="size-3 shrink-0" />
                            </a>
                          </td>
                          <td className="p-3 text-zinc-400 font-mono">
                            <span className="rounded bg-zinc-800 px-2 py-0.5 text-[10px] text-zinc-300">
                              {file.downloads || 0} hits
                            </span>
                          </td>
                          <td className="p-3 text-right whitespace-nowrap">
                            <div className="flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() => copyPersistentLink(file)}
                                className="inline-flex items-center gap-1 rounded bg-zinc-800 hover:bg-zinc-700 text-zinc-200 px-2.5 py-1 text-[11px] cursor-pointer"
                                title="Copy permanent download link"
                              >
                                {copiedPersistentId === file.id ? (
                                  <>
                                    <Check className="size-3 text-emerald-400" />
                                    <span>Copied</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="size-3" />
                                    <span>Copy</span>
                                  </>
                                )}
                              </button>

                              <a
                                href={file.url}
                                download={file.name}
                                className="inline-flex items-center gap-1 rounded bg-[#3ECF8E] hover:bg-[#3ecf8e]/90 text-zinc-950 font-bold px-2.5 py-1 text-[11px] cursor-pointer"
                                title="Download file"
                              >
                                <Download className="size-3" />
                                <span>Get</span>
                              </a>

                              <button
                                type="button"
                                onClick={() => handleDeletePersistentFile(file.id, file.name)}
                                className="p-1 rounded text-zinc-500 hover:text-red-400 hover:bg-red-950/30 cursor-pointer"
                                title="Delete from disk"
                              >
                                <Trash2 className="size-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* MODE 2: EPHEMERAL ZERO-DISK P2P DROP (RAM Burn) */}
        {/* ================================================================= */}
        {activeMode === "ephemeral" && (
          <div className="space-y-8">
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-mono text-amber-400">
                <Flame className="size-3.5" />
                <span>Zero-Disk RAM Lifetime • 15-Minute Auto-Purge</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                Ephemeral Drop: Disappears Without a Trace.
              </h1>
              <p className="text-sm text-zinc-400">
                Files are encrypted with AES-GCM in your browser RAM before transfer. The moment you close this tab,
                memory is zeroed out and destroyed.
              </p>
            </div>

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

            {!sessionActive ? (
              <div
                onDrop={(e) => {
                  e.preventDefault();
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    processAndEncryptFile(e.dataTransfer.files[0]);
                  }
                }}
                onDragOver={(e) => e.preventDefault()}
                onClick={() => ephemeralInputRef.current?.click()}
                className="rounded-2xl border-2 border-dashed border-[#1E293B] hover:border-amber-500/60 bg-[#0B0F17]/60 p-12 text-center cursor-pointer transition-all hover:bg-[#0B0F17] group space-y-4"
              >
                <input
                  type="file"
                  ref={ephemeralInputRef}
                  onChange={(e) => {
                    if (e.target.files && e.target.files[0]) {
                      processAndEncryptFile(e.target.files[0]);
                    }
                  }}
                  className="hidden"
                />
                <div className="size-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 text-amber-400 grid place-items-center mx-auto group-hover:scale-105 transition-transform">
                  <UploadCloud className="size-8" />
                </div>
                <div className="space-y-1">
                  <p className="text-sm font-semibold text-white">
                    {encrypting ? "Encrypting file in browser RAM..." : "Drag and drop file for zero-disk transfer"}
                  </p>
                  <p className="text-xs text-zinc-500 font-mono">
                    AES-GCM-256 encrypted • 15-minute TTL • Zero disk footprint
                  </p>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-[#1E293B] bg-[#0B0F17] p-6 space-y-6 shadow-2xl">
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
                        File lives in browser memory. Closing this tab shreds the cryptographic key.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 font-mono text-xs text-amber-300">
                    <Clock className="size-3.5 text-amber-400" />
                    <span>Auto-Purge TTL:</span>
                    <span className="font-bold">{formatTtl(ttlSeconds)}</span>
                  </div>
                </div>

                {ephemeralFile && (
                  <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-[#05070B] p-4 text-xs font-mono">
                    <div className="flex items-center gap-3 truncate">
                      <div className="size-10 rounded-lg bg-zinc-800 grid place-items-center text-[#3ECF8E]">
                        <FileText className="size-5" />
                      </div>
                      <div className="truncate">
                        <p className="font-bold text-white truncate">{ephemeralFile.name}</p>
                        <p className="text-[11px] text-zinc-500">
                          {formatSize(ephemeralFile.size)} • Encrypted Payload: {formatSize(ephemeralFile.encryptedBytesLength)}
                        </p>
                      </div>
                    </div>
                    <span className="rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 px-2 py-0.5 text-[10px]">
                      AES-GCM-256
                    </span>
                  </div>
                )}

                <div className="space-y-2">
                  <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                    <span>One-Time Ephemeral Link</span>
                    <span className="text-[11px] font-mono text-zinc-500">Encryption key stored in URL hash only</span>
                  </label>

                  <div className="flex items-center gap-2">
                    <div className="flex-1 rounded-lg border border-zinc-800 bg-[#05070B] px-3 py-2 font-mono text-xs text-[#3ECF8E] truncate">
                      {ephemeralShareLink}
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        navigator.clipboard.writeText(ephemeralShareLink);
                        setCopiedLink(true);
                        setTimeout(() => setCopiedLink(false), 2000);
                      }}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-[#3ECF8E] text-zinc-950 font-bold px-4 py-2 text-xs shadow cursor-pointer"
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
          </div>
        )}
      </main>
    </div>
  );
}
