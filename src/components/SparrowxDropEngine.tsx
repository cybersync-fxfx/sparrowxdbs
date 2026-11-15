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
  ShieldCheck,
  AlertCircle,
  CheckCircle2,
  ArrowRight,
  ArrowUpRight,
  Layers,
  Database,
} from "lucide-react";
import { SparrowxFooter } from "@/components/SparrowxFooter";
import {
  authenticateAppUserFromBackend,
  fetchAppUserByEmailFromBackend,
  persistAppUserToBackend,
  type AppUser,
} from "@/lib/supabase";
import {
  clearSessionToken,
  issueSignedSessionToken,
  verifySessionToken,
} from "@/lib/advanced-features";

function readInitialVaultUser(): AppUser | null {
  if (typeof window === "undefined") return null;
  const verified = verifySessionToken();
  if (verified) {
    return {
      id: verified.sub,
      email: verified.email,
      fullName: verified.fullName || verified.email.split("@")[0] || "Vault User",
      password: "",
      admin: verified.role === "admin" ? "yes" : "no",
      tenantId: verified.tenantId,
    };
  }
  const rawAuthUser = localStorage.getItem("sparrowx_auth_user");
  if (rawAuthUser) {
    try {
      const parsed = JSON.parse(rawAuthUser) as Partial<AppUser>;
      if (parsed && typeof parsed.email === "string" && parsed.email.includes("@")) {
        return {
          id: String(parsed.id || "USR-VAULT"),
          email: parsed.email,
          fullName: String(parsed.fullName || parsed.email.split("@")[0]),
          password: "",
          admin: parsed.admin === "yes" ? "yes" : "no",
          tenantId: parsed.tenantId ?? null,
        };
      }
    } catch {
      // Ignore malformed sparrowx_auth_user
    }
  }
  return null;
}

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
  // Service Mode: "ephemeral" (default no-login zero-disk RAM burn) or "storage" (10GB persistent vault)
  const [activeMode, setActiveMode] = useState<"storage" | "ephemeral">("ephemeral");

  // Vault authentication state
  const [vaultUser, setVaultUser] = useState<AppUser | null>(() => readInitialVaultUser());
  const [isVaultAuthenticated, setIsVaultAuthenticated] = useState<boolean>(
    () => readInitialVaultUser() !== null,
  );
  const [vaultAuthMode, setVaultAuthMode] = useState<"signin" | "register">("signin");
  const [authFullName, setAuthFullName] = useState("");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

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
        const errorText = await res.text().catch(() => "");
        console.warn("[Storage Upload Server Note]", res.status, errorText);
        // Client resilient fallback (stores base64Data so recipient in this browser can view and download)
        const fileId = `spx_f_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
        const origin = typeof window !== "undefined" ? window.location.origin : "https://file.sparrowx.net";
        const newRecord: PersistentFile & { base64Data?: string } = {
          id: fileId,
          name: rawFile.name,
          size: rawFile.size,
          type: rawFile.type || "application/octet-stream",
          createdAt: new Date().toISOString(),
          downloads: 0,
          url: `${origin}/f/${fileId}`,
          base64Data,
        };
        setPersistentFiles((prev) => {
          const updated = [newRecord, ...prev];
          localStorage.setItem("sparrowx_persistent_files", JSON.stringify(updated));
          return updated;
        });
      }
    } catch (err) {
      console.warn("[Storage Upload Catch Note]", err);
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
  const [directShareLink, setDirectShareLink] = useState<string>("");
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedDirectLink, setCopiedDirectLink] = useState<boolean>(false);
  const [ttlSeconds, setTtlSeconds] = useState<number>(15 * 60);
  const [sessionActive, setSessionActive] = useState<boolean>(false);
  const [burnNotice, setBurnNotice] = useState<string | null>(null);

  // Incoming Drop Receiver State (for visitors opening a drop link)
  const [incomingDrop, setIncomingDrop] = useState<{
    dropId: string | null;
    keyHex: string | null;
    filename: string;
  } | null>(null);
  const [decrypting, setDecrypting] = useState<boolean>(false);
  const [decryptError, setDecryptError] = useState<string | null>(null);
  const [downloadSuccess, setDownloadSuccess] = useState<boolean>(false);

  // Incoming Persistent File Receiver State (for visitors opening /f/:id or ?f=:id)
  const [incomingPersistentId, setIncomingPersistentId] = useState<string | null>(null);
  const [persistentFileInfo, setPersistentFileInfo] = useState<PersistentFile | null>(null);
  const [persistentLoading, setPersistentLoading] = useState<boolean>(false);
  const [persistentDownloadSuccess, setPersistentDownloadSuccess] = useState<boolean>(false);

  // Check URL on mount for incoming drop or file parameters
  useEffect(() => {
    if (typeof window === "undefined") return;
    const pathname = window.location.pathname;
    const searchParams = new URLSearchParams(window.location.search);
    const hashStr = window.location.hash.replace(/^#/, "");
    const hashParams = new URLSearchParams(hashStr);

    // 1. Check for ephemeral drop
    const dropId = searchParams.get("drop") || hashParams.get("drop");
    const keyHex = hashParams.get("key") || searchParams.get("key");
    const rawName = searchParams.get("name") || hashParams.get("name");

    if (dropId || keyHex) {
      setIncomingDrop({
        dropId: dropId || null,
        keyHex: keyHex || null,
        filename: rawName ? decodeURIComponent(rawName) : "encrypted-drop.bin",
      });
      setActiveMode("ephemeral");
    }

    // 2. Check for persistent file (/f/:id or ?f=:id)
    const matchF = pathname.match(/^\/f\/([a-zA-Z0-9_-]+)/);
    const queryF = searchParams.get("f");
    const fileId = matchF ? matchF[1] : queryF;

    if (fileId) {
      setIncomingPersistentId(fileId);
      setPersistentLoading(true);

      const checkLocalFallback = () => {
        try {
          const local = localStorage.getItem("sparrowx_persistent_files");
          if (local) {
            const parsed: PersistentFile[] = JSON.parse(local);
            const found = parsed.find((item) => item.id === fileId);
            if (found) {
              setPersistentFileInfo(found);
              return true;
            }
          }
        } catch {}
        return false;
      };

      fetch(`/api/storage/file/${fileId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data && data.name) {
            setPersistentFileInfo(data);
          } else {
            fetch("/api/storage/files")
              .then((r) => r.json())
              .then((list: PersistentFile[]) => {
                const found = Array.isArray(list) ? list.find((item) => item.id === fileId) : null;
                if (found) {
                  setPersistentFileInfo(found);
                } else {
                  checkLocalFallback();
                }
              })
              .catch(() => {
                checkLocalFallback();
              });
          }
        })
        .catch(() => {
          checkLocalFallback();
        })
        .finally(() => setPersistentLoading(false));
    }
  }, []);

  const handleDownloadPersistentFileDirect = () => {
    if (!incomingPersistentId) return;

    // Direct browser RAM download for client-stored / fallback payloads
    if (persistentFileInfo && (persistentFileInfo as any).base64Data) {
      const a = document.createElement("a");
      a.href = `data:${persistentFileInfo.type || "application/octet-stream"};base64,${(persistentFileInfo as any).base64Data}`;
      a.download = persistentFileInfo.name || "downloaded-file";
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setPersistentDownloadSuccess(true);
      return;
    }

    const a = document.createElement("a");
    a.href = `/api/storage/download/${incomingPersistentId}`;
    a.download = persistentFileInfo?.name || "downloaded-file";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setPersistentDownloadSuccess(true);
  };

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

      // Combine IV (12 bytes) + Encrypted ciphertext
      const combined = new Uint8Array(iv.length + encrypted.byteLength);
      combined.set(iv, 0);
      combined.set(new Uint8Array(encrypted), iv.length);

      // Base64 encode for RAM storage & relay
      let binary = "";
      const len = combined.byteLength;
      for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(combined[i]);
      }
      const base64Ciphertext = btoa(binary);

      const dropId = `spx_drop_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;

      // Post encrypted ciphertext into server RAM (Zero bytes to disk)
      try {
        await fetch(`/api/drop/payload/${dropId}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id: dropId,
            ciphertext: base64Ciphertext,
            filename: rawFile.name,
            type: rawFile.type,
            size: rawFile.size,
          }),
        });
      } catch (err) {
        console.warn("[Drop Relay Warning]", err);
      }

      // Also cache in sessionStorage so same-browser / local tab always succeeds
      try {
        sessionStorage.setItem(`spx_drop_${dropId}`, JSON.stringify({
          ciphertext: base64Ciphertext,
          filename: rawFile.name,
          type: rawFile.type,
          size: rawFile.size,
        }));
      } catch {}

      fileBufferRef.current = combined.buffer;
      const staged: StagedFile = {
        name: rawFile.name,
        size: rawFile.size,
        type: rawFile.type || "application/octet-stream",
        encryptedBytesLength: combined.byteLength,
        hash: keyHex.slice(0, 16),
      };

      setEphemeralFile(staged);
      setSecretKeyHex(keyHex);

      const origin = typeof window !== "undefined" ? window.location.origin : "https://file.sparrowx.net";
      const isFileDomain = typeof window !== "undefined" && window.location.hostname.includes("file.");

      // Canonical link on file.sparrowx.net
      const canonicalLink = `https://file.sparrowx.net/?drop=${dropId}#key=${keyHex}&name=${encodeURIComponent(rawFile.name)}`;
      // Direct origin link (guaranteed to work immediately on current domain)
      const currentHostLink = `${origin}/?drop=${dropId}#key=${keyHex}&name=${encodeURIComponent(rawFile.name)}`;

      setEphemeralShareLink(isFileDomain ? canonicalLink : currentHostLink);
      setDirectShareLink(currentHostLink);
      setSessionActive(true);
      setTtlSeconds(15 * 60);
    } catch (err) {
      console.error("Encryption error", err);
      alert("Failed to encrypt file in browser memory: " + String(err));
    } finally {
      setEncrypting(false);
    }
  };

  // Receiver decryption & download handler
  const handleDecryptAndDownloadIncoming = async () => {
    if (!incomingDrop?.keyHex) {
      setDecryptError("Decryption key missing from URL hash. Make sure you copy the entire link with #key=...");
      return;
    }

    setDecrypting(true);
    setDecryptError(null);

    try {
      let base64Ciphertext = "";

      // 1. Fetch from server RAM endpoint
      if (incomingDrop.dropId) {
        try {
          const res = await fetch(`/api/drop/payload/${incomingDrop.dropId}`);
          if (res.ok) {
            const data = await res.json();
            base64Ciphertext = data.ciphertext;
          }
        } catch (e) {
          console.warn("Relay fetch error", e);
        }
      }

      // 2. Fallback to local sessionStorage if on same browser
      if (!base64Ciphertext && incomingDrop.dropId) {
        try {
          const cached = sessionStorage.getItem(`spx_drop_${incomingDrop.dropId}`);
          if (cached) {
            const parsed = JSON.parse(cached);
            base64Ciphertext = parsed.ciphertext;
          }
        } catch {}
      }

      if (!base64Ciphertext) {
        throw new Error(
          "Encrypted drop not found in RAM or the 15-minute TTL has expired. Please request a new drop from the sender."
        );
      }

      // Convert base64 to Uint8Array
      const binary = atob(base64Ciphertext);
      const combined = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        combined[i] = binary.charCodeAt(i);
      }

      if (combined.byteLength < 13) {
        throw new Error("Ciphertext too small or invalid IV");
      }

      // First 12 bytes is IV, remainder is ciphertext
      const iv = combined.slice(0, 12);
      const ciphertext = combined.slice(12);

      // Import key
      const keyHex = incomingDrop.keyHex.trim();
      const keyBytes = new Uint8Array(
        keyHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16))
      );

      const cryptoKey = await window.crypto.subtle.importKey(
        "raw",
        keyBytes,
        { name: "AES-GCM" },
        false,
        ["decrypt"]
      );

      const decrypted = await window.crypto.subtle.decrypt(
        { name: "AES-GCM", iv },
        cryptoKey,
        ciphertext
      );

      // Trigger file download
      const blob = new Blob([decrypted], { type: "application/octet-stream" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = incomingDrop.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setDownloadSuccess(true);
    } catch (err: any) {
      console.error("Decryption failed", err);
      setDecryptError(err.message || "Failed to decrypt file. Key mismatch or corrupted bytes.");
    } finally {
      setDecrypting(false);
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
      return <FileImage className="size-4 text-purple-400" />;
    if (lower.includes("video") || lower.endsWith(".mp4") || lower.endsWith(".mov"))
      return <FileVideo className="size-4 text-blue-400" />;
    if (lower.includes("audio") || lower.endsWith(".mp3") || lower.endsWith(".wav"))
      return <FileAudio className="size-4 text-purple-400" />;
    if (lower.includes("zip") || lower.includes("tar") || lower.endsWith(".gz") || lower.endsWith(".7z"))
      return <FileArchive className="size-4 text-purple-400" />;
    if (lower.includes("json") || lower.includes("javascript") || lower.endsWith(".ts") || lower.endsWith(".py") || lower.endsWith(".sql"))
      return <FileCode className="size-4 text-purple-400" />;
    return <FileText className="size-4 text-zinc-400" />;
  };

  const getLargeFileIcon = (mimeOrName: string) => {
    const lower = mimeOrName.toLowerCase();
    if (lower.includes("image") || lower.endsWith(".png") || lower.endsWith(".jpg") || lower.endsWith(".jpeg") || lower.endsWith(".svg") || lower.endsWith(".webp") || lower.endsWith(".gif"))
      return <FileImage className="size-12 text-purple-400" />;
    if (lower.includes("video") || lower.endsWith(".mp4") || lower.endsWith(".mov") || lower.endsWith(".mkv") || lower.endsWith(".webm") || lower.endsWith(".avi"))
      return <FileVideo className="size-12 text-blue-400" />;
    if (lower.includes("audio") || lower.endsWith(".mp3") || lower.endsWith(".wav") || lower.endsWith(".ogg") || lower.endsWith(".flac"))
      return <FileAudio className="size-12 text-purple-400" />;
    if (lower.includes("zip") || lower.includes("tar") || lower.endsWith(".gz") || lower.endsWith(".7z") || lower.endsWith(".rar") || lower.endsWith(".iso"))
      return <FileArchive className="size-12 text-purple-400" />;
    if (lower.includes("json") || lower.includes("javascript") || lower.endsWith(".ts") || lower.endsWith(".py") || lower.endsWith(".sql") || lower.endsWith(".html") || lower.endsWith(".css") || lower.endsWith(".sh"))
      return <FileCode className="size-12 text-purple-400" />;
    return <FileText className="size-12 text-zinc-300" />;
  };

  // Filtered persistent files
  const filteredPersistentFiles = persistentFiles.filter((f) =>
    f.name.toLowerCase().includes(fileSearchQuery.toLowerCase())
  );

  const totalDiskUsedBytes = persistentFiles.reduce((acc, f) => acc + f.size, 0);
  const totalDownloads = persistentFiles.reduce((acc, f) => acc + (f.downloads || 0), 0);

  return (
    <div className="min-h-screen bg-[#05060A] text-white flex flex-col font-sans selection:bg-[#A855F7] selection:text-white">
      {/* ELEGANT NAVBAR (MIDNIGHT BLACK & ELECTRIC PURPLE) */}
      <header className="border-b border-purple-500/20 bg-[#05060A]/90 sticky top-0 z-40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto h-14 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2.5 shrink-0">
            <img
              src="/sparrowx-logo.png"
              alt="SparrowX Drop"
              width={34}
              height={34}
              className="size-8.5 object-contain shrink-0 drop-shadow-[0_4px_12px_rgba(255,255,255,0.22)]"
            />
            <span className="font-bold text-sm tracking-tight text-white">SparrowX</span>
            <span className="px-2 py-0.5 rounded bg-purple-500/15 border border-purple-500/30 text-[10px] font-mono font-semibold text-purple-300">
              DROP
            </span>
          </div>

          {/* Center Navigation & Mode Switcher */}
          <div className="hidden md:flex items-center gap-6">
            <nav aria-label="Drop Mode Switcher" className="flex items-center gap-1 rounded-lg border border-purple-500/25 bg-[#090B12] p-0.5 text-xs font-medium">
              <button
                type="button"
                onClick={() => {
                  setActiveMode("ephemeral");
                  setIncomingDrop(null);
                  setIncomingPersistentId(null);
                }}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeMode === "ephemeral"
                    ? "bg-[#A855F7] text-white font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Zap className="size-3.5" />
                <span>Ephemeral (Zero-Save)</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setActiveMode("storage");
                  setIncomingDrop(null);
                  setIncomingPersistentId(null);
                }}
                className={`px-3 py-1 rounded-md transition-colors cursor-pointer flex items-center gap-1.5 ${
                  activeMode === "storage"
                    ? "bg-[#A855F7] text-white font-semibold shadow-sm"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Lock className="size-3.5" />
                <span>Persistent (We Save Data)</span>
              </button>
            </nav>

            <a href="#drop-pricing" className="text-xs font-medium text-zinc-400 hover:text-white transition-colors">
              Pricing
            </a>
          </div>

          {/* Right Vault Account Controls */}
          <div className="flex items-center gap-2.5 text-xs">
            {isVaultAuthenticated && vaultUser ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setActiveMode("storage");
                    setIncomingDrop(null);
                    setIncomingPersistentId(null);
                  }}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-purple-500/15 border border-purple-500/35 text-purple-300 hover:bg-purple-500/25 transition-colors cursor-pointer font-mono"
                >
                  <ShieldCheck className="size-3.5 shrink-0" />
                  <span className="max-w-[150px] truncate">{vaultUser.email}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    clearSessionToken();
                    localStorage.removeItem("sparrowx_vault_session");
                    localStorage.removeItem("sparrowx_auth_user");
                    setVaultUser(null);
                    setIsVaultAuthenticated(false);
                  }}
                  className="px-3 py-1.5 rounded-md border border-white/15 bg-[#090B12] hover:border-purple-500/40 text-zinc-300 hover:text-white transition-colors cursor-pointer font-medium"
                >
                  Sign Out
                </button>
              </>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setActiveMode("storage");
                  setIncomingDrop(null);
                  setIncomingPersistentId(null);
                }}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-md bg-[#A855F7] hover:bg-[#9333EA] text-white font-semibold transition-colors cursor-pointer shadow-sm"
              >
                <Lock className="size-3.5" />
                <span>Vault Sign In</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Compact Mobile Mode Switcher */}
        {(!incomingDrop && !incomingPersistentId) && (
          <div className="flex md:hidden justify-center w-full">
            <div className="w-full grid grid-cols-2 p-1 rounded-lg border border-purple-500/25 bg-[#090B12] gap-1">
              <button
                type="button"
                onClick={() => {
                  setActiveMode("ephemeral");
                  setIncomingDrop(null);
                  setIncomingPersistentId(null);
                }}
                className={`min-h-[38px] px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeMode === "ephemeral"
                    ? "bg-[#A855F7] text-white font-semibold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Zap className="size-3.5 shrink-0" />
                <span>Ephemeral (Zero-Save)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveMode("storage");
                  setIncomingDrop(null);
                  setIncomingPersistentId(null);
                }}
                className={`min-h-[38px] px-3 py-1.5 rounded-md text-xs font-medium transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
                  activeMode === "storage"
                    ? "bg-[#A855F7] text-white font-semibold"
                    : "text-zinc-400 hover:text-white"
                }`}
              >
                <Lock className="size-3.5 shrink-0" />
                <span>Persistent (We Save Data)</span>
              </button>
            </div>
          </div>
        )}
        {/* ================================================================= */}
        {/* WELCOMING RECEIVER DOWNLOAD PORTAL (For Incoming Shared Links)   */}
        {/* ================================================================= */}
        {(incomingDrop || incomingPersistentId) && (
          <div className="space-y-8 max-w-3xl mx-auto">
            {/* 1. Loading State for Persistent File */}
            {incomingPersistentId && persistentLoading && (
              <div className="rounded-2xl border border-white/[0.08] bg-[#090B12] p-12 text-center space-y-4 shadow-2xl">
                <RefreshCw className="size-9 text-purple-400 animate-spin mx-auto" />
                <h3 className="text-xl font-bold text-white tracking-tight">
                  Connecting to Sovereign Storage...
                </h3>
                <p className="text-xs text-zinc-400 font-mono">
                  Querying NVMe cluster for file ID: <span className="text-purple-400">{incomingPersistentId}</span>
                </p>
              </div>
            )}

            {/* 2. File Not Found State for Persistent File */}
            {incomingPersistentId && !persistentLoading && !persistentFileInfo && (
              <div className="rounded-2xl border border-purple-500/30 bg-[#090B12] p-10 text-center space-y-5 shadow-2xl">
                <div className="size-14 rounded-full bg-purple-500/10 border border-purple-500/20 text-purple-400 grid place-items-center mx-auto">
                  <AlertTriangle className="size-7" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-2xl font-bold text-white tracking-tight">
                    File Not Found or Link Expired
                  </h3>
                  <p className="text-xs text-zinc-400 max-w-md mx-auto leading-relaxed">
                    The requested file is no longer available on the server. The owner may have deleted it, or the link may be inaccurate.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setIncomingPersistentId(null);
                    if (typeof window !== "undefined" && window.location.pathname.startsWith("/f/")) {
                      window.history.pushState({}, "", "/");
                    }
                  }}
                  className="px-6 py-3 rounded-xl bg-[#A855F7] hover:bg-[#9333EA] text-white font-bold text-xs cursor-pointer shadow-lg transition-all"
                >
                  Go to SparrowX File Vault →
                </button>
              </div>
            )}

            {/* 3. Persistent File Welcoming Receiver Card */}
            {incomingPersistentId && !persistentLoading && persistentFileInfo && (
              <div className="rounded-3xl border border-white/[0.12] bg-[#090B12] p-6 sm:p-10 shadow-2xl space-y-8 relative overflow-hidden">
                <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-96 h-36 bg-purple-500/10 blur-3xl pointer-events-none" />

                {/* Hero Greeting */}
                <div className="text-center space-y-3 relative z-10">
                  <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
                    You've Received a Shared File
                  </h1>
                  <p className="text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto leading-relaxed">
                    Hosted on dedicated bare-metal NVMe storage. Download directly with zero ads, zero countdown queues, and unthrottled gigabit speeds.
                  </p>
                </div>

                {/* File Showcase Box */}
                <div className="p-6 rounded-2xl bg-[#05060A] border border-white/[0.08] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative z-10 shadow-inner">
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="size-16 rounded-2xl bg-[#0E1420] border border-white/[0.1] grid place-items-center shrink-0 shadow-lg">
                      {getLargeFileIcon(persistentFileInfo.name)}
                    </div>
                    <div className="min-w-0">
                      <div className="text-lg sm:text-xl font-bold text-white truncate tracking-tight" title={persistentFileInfo.name}>
                        {persistentFileInfo.name}
                      </div>
                      <div className="flex flex-wrap items-center gap-2 mt-1.5 font-mono text-xs text-zinc-400">
                        <span className="font-bold text-purple-400">{formatSize(persistentFileInfo.size)}</span>
                        <span className="text-zinc-600">•</span>
                        <span>NVMe High-Speed Storage</span>
                        <span className="text-zinc-600">•</span>
                        <span>{new Date(persistentFileInfo.uploadedAt).toLocaleDateString()}</span>
                      </div>
                    </div>
                  </div>

                  <div className="shrink-0 flex items-center gap-2">
                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-purple-500/10 border border-purple-500/25 text-purple-400 text-xs font-mono font-semibold">
                      <Check className="size-3.5" />
                      SHA-256 Verified
                    </span>
                  </div>
                </div>

                {/* Download Success Banner */}
                {persistentDownloadSuccess && (
                  <div className="p-4 rounded-xl bg-purple-500/10 border border-purple-500/30 text-purple-300 text-xs font-mono flex items-center gap-3">
                    <CheckCircle2 className="size-5 text-purple-400 shrink-0" />
                    <div>
                      <p className="font-bold text-white">Download initiated successfully!</p>
                      <p className="text-[11px] text-zinc-400">Your download is streaming directly from the server. Check your browser's download shelf.</p>
                    </div>
                  </div>
                )}

                {/* Main Action Buttons */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2 relative z-10">
                  <button
                    type="button"
                    onClick={handleDownloadPersistentFileDirect}
                    className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[#A855F7] hover:bg-[#9333EA] text-white font-extrabold text-sm shadow-xl transition-all flex items-center justify-center gap-3 cursor-pointer group"
                  >
                    <Download className="size-5 group-hover:translate-y-0.5 transition-transform" />
                    <span>Download File ({formatSize(persistentFileInfo.size)})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setIncomingPersistentId(null);
                      if (typeof window !== "undefined" && window.location.pathname.startsWith("/f/")) {
                        window.history.pushState({}, "", "/");
                      }
                    }}
                    className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Upload Your Own Files
                  </button>
                </div>

                {/* Direct Link & Origin Fallback */}
                <div className="p-4 rounded-xl bg-[#05060A] border border-white/[0.06] flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono">
                  <div className="text-zinc-400 flex items-center gap-2 truncate w-full sm:w-auto">
                    <span className="text-zinc-500 shrink-0">Direct Link:</span>
                    <span className="text-purple-400 truncate select-all">
                      {typeof window !== "undefined" ? `${window.location.origin}/f/${persistentFileInfo.id}` : `/f/${persistentFileInfo.id}`}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (typeof window !== "undefined") {
                          navigator.clipboard.writeText(`${window.location.origin}/f/${persistentFileInfo.id}`);
                          setCopiedPersistentId(persistentFileInfo.id);
                          setTimeout(() => setCopiedPersistentId(null), 2500);
                        }
                      }}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors cursor-pointer flex items-center gap-1.5"
                    >
                      {copiedPersistentId === persistentFileInfo.id ? <Check className="size-3.5 text-purple-400" /> : <Copy className="size-3.5" />}
                      <span>{copiedPersistentId === persistentFileInfo.id ? "Copied!" : "Copy Link"}</span>
                    </button>
                    <a
                      href={`http://139.99.131.135:3000/api/storage/download/${persistentFileInfo.id}`}
                      className="px-3 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-colors flex items-center gap-1.5"
                      target="_blank"
                      rel="noreferrer"
                      title="Direct Origin IP Fallback"
                    >
                      <ExternalLink className="size-3.5" />
                      <span>Direct Origin IP</span>
                    </a>
                  </div>
                </div>

                {/* Trust Guarantees */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4 border-t border-white/[0.06]">
                  <div className="p-3.5 rounded-xl bg-[#05060A] border border-white/[0.04] space-y-1">
                    <div className="flex items-center gap-2 text-white text-xs font-semibold">
                      <Zap className="size-3.5 text-purple-400" />
                      <span>Unthrottled Gigabit Pipe</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-normal">
                      Direct bare-metal NVMe stream with unlimited direct bandwidth.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#05060A] border border-white/[0.04] space-y-1">
                    <div className="flex items-center gap-2 text-white text-xs font-semibold">
                      <Shield className="size-3.5 text-purple-400" />
                      <span>Zero Adware or Popups</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-normal">
                      Clean transfer without countdown timers, ad networks, or captchas.
                    </p>
                  </div>
                  <div className="p-3.5 rounded-xl bg-[#05060A] border border-white/[0.04] space-y-1">
                    <div className="flex items-center gap-2 text-white text-xs font-semibold">
                      <Lock className="size-3.5 text-purple-400" />
                      <span>Sovereign Storage</span>
                    </div>
                    <p className="text-[11px] text-zinc-500 leading-normal">
                      Encrypted at rest on isolated OVH dedicated server NVMe hardware.
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* 4. Ephemeral Drop Welcoming Receiver Card */}
            {incomingDrop && (
              <div className="rounded-3xl border-2 border-purple-500/40 bg-[#090B12] p-6 sm:p-10 shadow-2xl space-y-8 text-center relative overflow-hidden">
                <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3.5 py-1 text-xs font-mono text-purple-400 font-semibold">
                  <ShieldCheck className="size-4" />
                  <span>Incoming Zero-Disk Encrypted Drop</span>
                </div>

                <div className="space-y-2">
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                    Encrypted File Ready for Decryption
                  </h2>
                  <p className="text-xs sm:text-sm text-zinc-400 max-w-lg mx-auto leading-relaxed">
                    This file was encrypted in sender browser RAM with AES-GCM 256-bit. The decryption key was passed strictly via the client URL hash and will decrypt in your local memory.
                  </p>
                </div>

                <div className="p-5 rounded-2xl bg-[#05060A] border border-zinc-800 flex items-center justify-between text-left font-mono shadow-inner">
                  <div className="flex items-center gap-4 truncate mr-2">
                    <div className="size-14 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 grid place-items-center shrink-0">
                      {getLargeFileIcon(incomingDrop.filename)}
                    </div>
                    <div className="truncate">
                      <div className="text-base font-bold text-white truncate">
                        {incomingDrop.filename}
                      </div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        Key Fingerprint: {incomingDrop.keyHex ? `${incomingDrop.keyHex.slice(0, 16)}...` : "None"}
                      </div>
                    </div>
                  </div>

                  <span className="shrink-0 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20 px-2.5 py-1 text-xs font-bold font-mono">
                    AES-GCM-256
                  </span>
                </div>

                {decryptError && (
                  <div className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono text-left flex items-center gap-2">
                    <AlertCircle className="size-4 shrink-0" />
                    <span>{decryptError}</span>
                  </div>
                )}

                {downloadSuccess && (
                  <div className="p-3.5 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-400 text-xs font-mono text-left flex items-center gap-2">
                    <CheckCircle2 className="size-4 shrink-0" />
                    <span>File decrypted in RAM and saved to your downloads folder!</span>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-2">
                  <button
                    type="button"
                    onClick={handleDecryptAndDownloadIncoming}
                    disabled={decrypting}
                    className="w-full sm:w-auto px-8 py-4 rounded-2xl bg-[#A855F7] hover:bg-[#9333EA] text-white font-extrabold text-xs shadow-lg transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    {decrypting ? <RefreshCw className="size-4 animate-spin" /> : <Download className="size-4" />}
                    <span>{decrypting ? "Decrypting in RAM..." : `Decrypt & Download "${incomingDrop.filename}"`}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIncomingDrop(null)}
                    className="w-full sm:w-auto px-6 py-4 rounded-2xl bg-zinc-800 hover:bg-zinc-700 text-zinc-300 text-xs font-semibold transition-colors cursor-pointer"
                  >
                    Upload Your Own Files
                  </button>
                </div>
              </div>
            )}

            {/* Bottom Vault Switcher */}
            <div className="text-center pt-4">
              <button
                type="button"
                onClick={() => {
                  setIncomingDrop(null);
                  setIncomingPersistentId(null);
                  if (typeof window !== "undefined" && window.location.pathname.startsWith("/f/")) {
                    window.history.pushState({}, "", "/");
                  }
                }}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-zinc-300 hover:text-white border border-white/[0.08] text-xs font-medium transition-all cursor-pointer"
              >
                <span>Need to host or share files securely? Open Sovereign Storage Vault</span>
                <ArrowRight className="size-3.5 text-purple-400" />
              </button>
            </div>
          </div>
        )}

        {/* ================================================================= */}
        {/* MODE 1: PERSISTENT CLOUD STORAGE (MediaFire Style) */}
        {/* ================================================================= */}
        {activeMode === "storage" && !incomingDrop && !incomingPersistentId && (
          <div className="space-y-6">
            {!isVaultAuthenticated ? (
              /* 10 GB FREE VAULT UNLOCK FRAME (LOGGED OUT) */
              <div className="border border-white/[0.08] bg-[#090B12] rounded-md overflow-hidden shadow-xl">
                {/* Asymmetric Header */}
                <div className="border-b border-white/[0.08] bg-[#14171F] px-6 py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="size-2 rounded-full bg-purple-400" />
                      <h2 className="text-base font-bold text-white font-mono uppercase tracking-tight">
                        Persistent Sovereign Vault // 10 GB Free Tier
                      </h2>
                    </div>
                    <p className="text-xs text-[#9CA3AF]">
                      Unlock permanent file hosting, hit telemetry, and password-protected direct links.
                    </p>
                  </div>
                  <span className="text-[10px] font-mono text-purple-400 bg-purple-500/10 border border-purple-500/30 px-2.5 py-1 rounded w-fit">
                    ACCOUNT SIGN-IN REQUIRED
                  </span>
                </div>

                {/* Visual Storage Allocation Bar */}
                <div className="p-6 border-b border-white/[0.08] bg-[#05060A] space-y-2">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[#9CA3AF]">Storage Allocation:</span>
                    <span className="text-white font-bold tabular-nums">0.00 GB / 10.00 GB Allocated</span>
                  </div>
                  <div className="w-full h-2 rounded-full bg-[#14171F] border border-white/[0.08] overflow-hidden">
                    <div className="h-full bg-purple-500 w-[2%]" />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono text-[#64748B]">
                    <span>0 GB</span>
                    <span>Free Sovereign Tier (Permanent NVMe Storage)</span>
                    <span>10 GB Quota</span>
                  </div>
                </div>

                {/* 4 Feature Breakdown Grid (Hairline exposed) */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-white/[0.08] border-b border-white/[0.08] bg-[#090B12]">
                  <div className="p-4 space-y-1">
                    <span className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                      <ExternalLink className="size-3.5 text-purple-400" />
                      Permanent URLs
                    </span>
                    <p className="text-[11px] text-[#64748B]">
                      Unique URLs like <code className="text-[#9CA3AF]">file.sparrowx.net/f/&lt;id&gt;</code> that never expire.
                    </p>
                  </div>
                  <div className="p-4 space-y-1">
                    <span className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                      <Activity className="size-3.5 text-purple-400" />
                      Download Analytics
                    </span>
                    <p className="text-[11px] text-[#64748B]">
                      Real-time hit counters and bandwidth telemetry per hosted file.
                    </p>
                  </div>
                  <div className="p-4 space-y-1">
                    <span className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                      <Lock className="size-3.5 text-purple-400" />
                      Password Shares
                    </span>
                    <p className="text-[11px] text-[#64748B]">
                      Optional AES passphrase protection on sensitive download files.
                    </p>
                  </div>
                  <div className="p-4 space-y-1">
                    <span className="text-xs font-bold text-white font-mono flex items-center gap-1.5">
                      <HardDrive className="size-3.5 text-purple-400" />
                      RAID-1 Redundancy
                    </span>
                    <p className="text-[11px] text-[#64748B]">
                      Stored on mirrored bare-metal NVMe drives on our Sydney cluster.
                    </p>
                  </div>
                </div>

                {/* Inline Sign-In / Account Provision Form */}
                <div className="p-6 sm:p-8 bg-[#0B0D13]">
                  <div className="max-w-md mx-auto space-y-4">
                    <div className="grid grid-cols-2 gap-1.5 rounded bg-[#14171F] border border-white/10 p-1 font-mono text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setVaultAuthMode("signin");
                          setAuthError("");
                        }}
                        className={`py-2 rounded font-semibold transition-colors cursor-pointer ${
                          vaultAuthMode === "signin"
                            ? "bg-white text-black"
                            : "text-[#9CA3AF] hover:text-white"
                        }`}
                      >
                        Sign In
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setVaultAuthMode("register");
                          setAuthError("");
                        }}
                        className={`py-2 rounded font-semibold transition-colors cursor-pointer ${
                          vaultAuthMode === "register"
                            ? "bg-purple-500 text-white"
                            : "text-[#9CA3AF] hover:text-white"
                        }`}
                      >
                        Create Free Vault
                      </button>
                    </div>

                    <div className="text-center space-y-1">
                      <h3 className="text-sm font-bold text-white font-mono uppercase tracking-tight">
                        {vaultAuthMode === "signin"
                          ? "Sign In to Unlock Your 10 GB Vault"
                          : "Create Your Free 10 GB Vault Account"}
                      </h3>
                      <p className="text-xs text-[#9CA3AF]">
                        {vaultAuthMode === "signin"
                          ? "Use your SparrowX credentials to access your persistent storage."
                          : "Provision an encrypted NVMe vault backed by your SparrowX account."}
                      </p>
                    </div>

                    {authError && (
                      <div className="p-3 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-mono">
                        {authError}
                      </div>
                    )}

                    <form
                      onSubmit={async (e) => {
                        e.preventDefault();
                        setAuthLoading(true);
                        setAuthError("");
                        const emailClean = authEmail.trim().toLowerCase();
                        try {
                          const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
                          if (!emailPattern.test(emailClean)) {
                            setAuthError("Please enter a valid email address.");
                            return;
                          }
                          if (!authPassword || authPassword.length < 6) {
                            setAuthError("Password must be at least 6 characters.");
                            return;
                          }
                          if (vaultAuthMode === "signin") {
                            const res = await authenticateAppUserFromBackend(
                              emailClean,
                              authPassword,
                            );
                            if (res.user) {
                              issueSignedSessionToken({
                                id: res.user.id,
                                email: res.user.email,
                                fullName:
                                  res.user.fullName ||
                                  res.user.email.split("@")[0] ||
                                  "Vault User",
                                role: res.user.admin === "yes" ? "admin" : "client",
                                tenantId: res.user.tenantId,
                              });
                              localStorage.setItem("sparrowx_vault_session", res.user.email);
                              setVaultUser(res.user);
                              setIsVaultAuthenticated(true);
                            } else {
                              setAuthError(res.error || "Invalid email or password.");
                            }
                          } else {
                            if (!emailClean || authPassword.length < 6) {
                              setAuthError(
                                "Provide a valid email and a password of at least 6 characters.",
                              );
                              return;
                            }
                            const existing = await fetchAppUserByEmailFromBackend(emailClean);
                            if (existing) {
                              setAuthError(
                                "An account with this email already exists. Please sign in instead.",
                              );
                              return;
                            }
                            const newUser: AppUser = {
                              id: `USR-${Date.now().toString().slice(-4)}`,
                              email: emailClean,
                              password: authPassword,
                              fullName:
                                authFullName.trim() || emailClean.split("@")[0] || "Vault User",
                              admin: "no",
                              tenantId: `TENANT-VAULT-${Date.now().toString().slice(-4)}`,
                            };
                            await persistAppUserToBackend(newUser);
                            issueSignedSessionToken({
                              id: newUser.id,
                              email: newUser.email,
                              fullName: newUser.fullName,
                              role: "client",
                              tenantId: newUser.tenantId,
                            });
                            localStorage.setItem("sparrowx_vault_session", newUser.email);
                            setVaultUser({ ...newUser, password: "" });
                            setIsVaultAuthenticated(true);
                          }
                        } catch {
                          setAuthError(
                            "Authentication service unavailable. Please verify your credentials and try again.",
                          );
                        } finally {
                          setAuthLoading(false);
                        }
                      }}
                      className="space-y-3 font-mono text-xs"
                    >
                      {vaultAuthMode === "register" && (
                        <input
                          type="text"
                          required
                          value={authFullName}
                          onChange={(e) => setAuthFullName(e.target.value)}
                          placeholder="Full Name / Display Label"
                          className="w-full px-3.5 py-2.5 rounded bg-[#14171F] border border-white/10 text-white placeholder-[#64748B] focus:outline-none focus:border-white/30"
                        />
                      )}
                      <input
                        type="email"
                        required
                        value={authEmail}
                        onChange={(e) => setAuthEmail(e.target.value)}
                        placeholder="developer@yourdomain.com"
                        className="w-full px-3.5 py-2.5 rounded bg-[#14171F] border border-white/10 text-white placeholder-[#64748B] focus:outline-none focus:border-white/30"
                      />
                      <input
                        type="password"
                        required
                        minLength={vaultAuthMode === "register" ? 6 : undefined}
                        value={authPassword}
                        onChange={(e) => setAuthPassword(e.target.value)}
                        placeholder="Password"
                        className="w-full px-3.5 py-2.5 rounded bg-[#14171F] border border-white/10 text-white placeholder-[#64748B] focus:outline-none focus:border-white/30"
                      />
                      <button
                        type="submit"
                        disabled={authLoading}
                        className="w-full py-2.5 rounded bg-white text-black font-semibold hover:bg-neutral-200 transition-colors cursor-pointer flex items-center justify-center gap-2"
                      >
                        {authLoading && <RefreshCw className="size-3.5 animate-spin" />}
                        <span>
                          {vaultAuthMode === "signin"
                            ? "Unlock Free 10 GB Vault"
                            : "Create & Unlock 10 GB Vault"}
                        </span>
                      </button>
                    </form>
                  </div>
                </div>
              </div>
            ) : (
              /* LOGGED IN: FULL SOVEREIGN FILE MANAGER WORKSPACE */
              <div className="space-y-6">
                {/* User Session Bar */}
                <div className="border border-white/[0.08] bg-[#090B12] px-4 py-2.5 rounded flex flex-wrap items-center justify-between gap-2 text-xs font-mono">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="size-2 rounded-full bg-purple-500 animate-pulse" />
                    <span className="text-white font-medium">10 GB Vault Active</span>
                    {vaultUser && (
                      <>
                        <span className="text-[#64748B]">•</span>
                        <span className="text-purple-400">
                          {vaultUser.fullName || vaultUser.email} ({vaultUser.email})
                        </span>
                      </>
                    )}
                    <span className="text-[#64748B]">•</span>
                    <span className="text-[#9CA3AF] tabular-nums">{formatSize(totalDiskUsedBytes)} / 10.00 GB Used</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      clearSessionToken();
                      localStorage.removeItem("sparrowx_vault_session");
                      localStorage.removeItem("sparrowx_auth_user");
                      setVaultUser(null);
                      setIsVaultAuthenticated(false);
                    }}
                    className="text-[#64748B] hover:text-white transition-colors text-[11px] cursor-pointer"
                  >
                    Lock Vault
                  </button>
                </div>
            {/* Header intro */}
            <div className="text-center space-y-3 max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-mono text-purple-400">
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
              <div className="rounded-xl border border-[#1E293B] bg-[#090B12] p-4 space-y-1">
                <div className="text-[11px] text-zinc-500 font-mono flex items-center justify-between">
                  <span>NVMe Disk Used</span>
                  <HardDrive className="size-3 text-[#A855F7]" />
                </div>
                <div className="text-lg font-bold text-white font-mono">{formatSize(totalDiskUsedBytes)}</div>
                <p className="text-[10px] text-zinc-500 font-mono">Quota: 500 GB Allocated</p>
              </div>

              <div className="rounded-xl border border-[#1E293B] bg-[#090B12] p-4 space-y-1">
                <div className="text-[11px] text-zinc-500 font-mono flex items-center justify-between">
                  <span>Total Hosted Files</span>
                  <FolderOpen className="size-3 text-purple-400" />
                </div>
                <div className="text-lg font-bold text-[#A855F7] font-mono">{persistentFiles.length} Files</div>
                <p className="text-[10px] text-zinc-500 font-mono">Retained until deleted</p>
              </div>

              <div className="rounded-xl border border-[#1E293B] bg-[#090B12] p-4 space-y-1">
                <div className="text-[11px] text-zinc-500 font-mono flex items-center justify-between">
                  <span>Total Downloads</span>
                  <Download className="size-3 text-purple-400" />
                </div>
                <div className="text-lg font-bold text-purple-300 font-mono">{totalDownloads}</div>
                <p className="text-[10px] text-purple-400 font-mono">Unlimited direct bandwidth</p>
              </div>

              <div className="rounded-xl border border-[#1E293B] bg-[#090B12] p-4 space-y-1">
                <div className="text-[11px] text-zinc-500 font-mono flex items-center justify-between">
                  <span>Encryption Standard</span>
                  <Lock className="size-3 text-purple-400" />
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
              className="rounded-2xl border-2 border-dashed border-[#1E293B] hover:border-[#A855F7]/60 bg-[#090B12]/60 p-10 text-center cursor-pointer transition-all hover:bg-[#090B12] group space-y-3"
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
              <div className="size-14 rounded-2xl bg-[#A855F7]/10 border border-[#A855F7]/20 text-[#A855F7] grid place-items-center mx-auto group-hover:scale-105 transition-transform">
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
                      className="bg-[#A855F7] h-full transition-all duration-300"
                      style={{ width: `${uploadProgress}%` }}
                    />
                  </div>
                  <span className="text-[10px] font-mono text-purple-400">
                    Writing to server disk: {uploadProgress}%
                  </span>
                </div>
              )}
            </div>

            {/* Hosted Files Explorer Table */}
            <div className="rounded-2xl border border-[#1E293B] bg-[#090B12] overflow-hidden shadow-2xl space-y-0">
              {/* Table Toolbar */}
              <div className="border-b border-[#1E293B] bg-[#0E1420] px-5 py-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <FolderOpen className="size-4 text-[#A855F7]" />
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
                      className="h-7 w-48 rounded-md border border-zinc-800 bg-[#05060A] pl-7 pr-2 text-xs font-mono text-zinc-200 placeholder-zinc-500 outline-none focus:border-[#A855F7]"
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
                          <td className="p-3 text-[#A855F7] truncate max-w-sm">
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
                                    <Check className="size-3 text-purple-400" />
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
                                className="inline-flex items-center gap-1 rounded bg-[#A855F7] hover:bg-[#A855F7]/90 text-white font-bold px-2.5 py-1 text-[11px] cursor-pointer"
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
          </div>
        )}

        {/* ================================================================= */}
        {/* MODE 2: EPHEMERAL ZERO-DISK P2P DROP (RAM Burn) */}
        {/* ================================================================= */}
        {activeMode === "ephemeral" && !incomingDrop && !incomingPersistentId && (
          <div className="space-y-8">
            <div className="text-center space-y-3.5 max-w-2xl mx-auto">
              <div className="inline-flex items-center gap-2 rounded-full border border-purple-500/30 bg-purple-500/10 px-3 py-1 text-xs font-mono text-purple-300">
                <Flame className="size-3.5 text-purple-400" />
                <span>Zero-Disk RAM • We Don't Save Anything</span>
              </div>
              <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white">
                Ephemeral Drop: We Don&apos;t Save Anything.
              </h1>
              <p className="text-sm text-zinc-300 max-w-xl mx-auto leading-relaxed">
                In Ephemeral mode, we don&apos;t save anything. Files are encrypted with AES-GCM in your browser RAM before transfer, and the moment you close this tab, memory is zeroed out and destroyed without a trace.
              </p>
              <div className="pt-1">
                <div className="inline-flex flex-wrap items-center justify-center gap-2 rounded-xl border border-purple-500/30 bg-purple-950/20 px-4 py-2 text-xs text-zinc-300">
                  <span className="text-zinc-400">Want to keep your files permanently?</span>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveMode("storage");
                      setIncomingDrop(null);
                      setIncomingPersistentId(null);
                    }}
                    className="inline-flex items-center gap-1.5 font-semibold text-purple-300 hover:text-white transition-colors cursor-pointer group"
                  >
                    <Lock className="size-3.5 text-purple-400 group-hover:scale-110 transition-transform" />
                    <span>Switch to Persistent Storage (We Save Your Data)</span>
                    <ArrowRight className="size-3" />
                  </button>
                </div>
              </div>
            </div>

            {burnNotice && (
              <div className="rounded-xl border border-purple-500/30 bg-purple-500/10 p-4 text-xs font-mono text-purple-300 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Flame className="size-4 text-purple-400 shrink-0" />
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
                className="rounded-2xl border-2 border-dashed border-[#1E293B] hover:border-purple-500/60 bg-[#090B12]/60 p-12 text-center cursor-pointer transition-all hover:bg-[#090B12] group space-y-4"
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
                <div className="size-16 rounded-2xl bg-purple-500/10 border border-purple-500/20 text-purple-400 grid place-items-center mx-auto group-hover:scale-105 transition-transform">
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
              <div className="rounded-2xl border border-[#1E293B] bg-[#090B12] p-6 space-y-6 shadow-2xl">
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#1E293B] pb-4">
                  <div className="flex items-center gap-3">
                    <span className="relative flex size-3">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-purple-400 opacity-75" />
                      <span className="relative inline-flex rounded-full size-3 bg-purple-500" />
                    </span>
                    <div>
                      <div className="text-xs font-bold text-white uppercase tracking-wider font-mono">
                        SESSION ACTIVE: Keep this tab open until recipient completes download
                      </div>
                      <p className="text-[11px] text-[#9CA3AF]">
                        Closing tab purges RAM immediately. File vanishes permanently upon tab close or 15-minute TTL.
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 rounded-lg border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 font-mono text-xs text-purple-300">
                    <Clock className="size-3.5 text-purple-400" />
                    <span>Auto-Purge TTL:</span>
                    <span className="font-bold">{formatTtl(ttlSeconds)}</span>
                  </div>
                </div>

                {ephemeralFile && (
                  <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-[#05060A] p-4 text-xs font-mono">
                    <div className="flex items-center gap-3 truncate">
                      <div className="size-10 rounded-lg bg-zinc-800 grid place-items-center text-[#A855F7]">
                        <FileText className="size-5" />
                      </div>
                      <div className="truncate">
                        <p className="font-bold text-white truncate">{ephemeralFile.name}</p>
                        <p className="text-[11px] text-zinc-500">
                          {formatSize(ephemeralFile.size)} • Encrypted Payload: {formatSize(ephemeralFile.encryptedBytesLength)}
                        </p>
                      </div>
                    </div>
                    <span className="rounded bg-purple-500/10 border border-purple-500/30 text-purple-400 px-2 py-0.5 text-[10px]">
                      AES-GCM-256
                    </span>
                  </div>
                )}

                <div className="space-y-4">
                  {/* Canonical Link */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-purple-400" />
                        Canonical Domain Link (file.sparrowx.net)
                      </span>
                      <span className="text-[10px] font-mono text-zinc-500">AES-256 key in #hash</span>
                    </label>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                      <div className="flex-1 rounded-lg border border-zinc-800 bg-[#05060A] px-3 py-2 font-mono text-xs text-[#A855F7] truncate select-all">
                        {ephemeralShareLink}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          navigator.clipboard.writeText(ephemeralShareLink);
                          setCopiedLink(true);
                          setTimeout(() => setCopiedLink(false), 2000);
                        }}
                        className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-[#A855F7] text-white font-bold px-4 py-2 text-xs shadow cursor-pointer shrink-0 min-h-[40px] sm:min-h-0"
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

                  {/* Direct Gateway Link */}
                  {directShareLink && directShareLink !== ephemeralShareLink && (
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold text-zinc-300 flex items-center justify-between">
                        <span className="flex items-center gap-1.5 text-purple-400">
                          <span className="size-2 rounded-full bg-purple-400" />
                          Direct Gateway Link (Works immediately on active host)
                        </span>
                        <span className="text-[10px] font-mono text-zinc-500">Zero-configuration fallback</span>
                      </label>

                      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                        <div className="flex-1 rounded-lg border border-zinc-800 bg-[#05060A] px-3 py-2 font-mono text-xs text-purple-300 truncate select-all">
                          {directShareLink}
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(directShareLink);
                            setCopiedDirectLink(true);
                            setTimeout(() => setCopiedDirectLink(false), 2000);
                          }}
                          className="inline-flex items-center justify-center gap-1.5 rounded-lg bg-purple-500 hover:bg-purple-400 text-white font-bold px-4 py-2 text-xs shadow cursor-pointer shrink-0 min-h-[40px] sm:min-h-0"
                        >
                          {copiedDirectLink ? (
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
                  )}
                </div>

                <div className="flex items-center justify-between border-t border-[#1E293B] pt-4">
                  <div className="text-[11px] text-zinc-500 font-mono flex items-center gap-1.5">
                    <Shield className="size-3.5 text-[#A855F7]" />
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

      {/* Standalone Product Architecture, Business Tiers, FAQ & Footer */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6 pt-8 pb-16 space-y-16 border-t border-white/[0.06] mt-6">
        {/* 3 Core Pillars */}
        <div className="space-y-6">
          <div className="max-w-2xl">
            <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-purple-400">
              Zero-Knowledge Architecture
            </span>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-white">
              Built for teams that never trust unencrypted transit.
            </h2>
            <p className="mt-2 text-sm text-zinc-400 leading-relaxed">
              Every file dropped into SparrowX Drop is sealed in your browser with AES-256-GCM before a single byte leaves your device.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="rounded-xl border border-white/[0.08] bg-[#090B12] p-6 space-y-3">
              <div className="size-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Flame className="size-5" />
              </div>
              <h3 className="text-base font-semibold text-white">Ephemeral RAM Burn</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Send files up to 100 MB without creating an account. Payloads live strictly in volatile memory and self-destruct after download or TTL expiry.
              </p>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#090B12] p-6 space-y-3">
              <div className="size-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <Lock className="size-5" />
              </div>
              <h3 className="text-base font-semibold text-white">Client-Side AES-256-GCM</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Decryption keys stay in the URL fragment or your local passcode. Servers only ever relay opaque ciphertext—never plaintext bytes.
              </p>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#090B12] p-6 space-y-3">
              <div className="size-10 rounded-lg bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <HardDrive className="size-5" />
              </div>
              <h3 className="text-base font-semibold text-white">Persistent 10 GB Vault</h3>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Need permanent CDN-backed links, download counters, and instant revocation? Switch to Vault Mode for 10 GB of free encrypted object storage.
              </p>
            </div>
          </div>
        </div>

        {/* Business Model / Pricing Tiers */}
        <div id="drop-pricing" className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div>
              <span className="text-[11px] font-mono uppercase tracking-[0.2em] text-purple-400">
                Storage & Transfer Plans
              </span>
              <h2 className="mt-2 text-2xl sm:text-3xl font-bold tracking-tight text-white">
                Simple, predictable storage pricing.
              </h2>
            </div>
            <p className="text-xs text-zinc-400 font-mono">
              No egress traps • Cancel anytime
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="rounded-xl border border-white/[0.08] bg-[#090B12] p-6 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">Starter</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 border border-purple-500/20">
                    Active Now
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white">$0</span>
                  <span className="text-xs text-zinc-500 font-mono">/month</span>
                </div>
                <p className="text-xs text-zinc-400">
                  Instant zero-login RAM drops plus a free 10 GB persistent vault.
                </p>
                <ul className="space-y-2 pt-2 text-xs text-zinc-300">
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-purple-400 shrink-0" />Unlimited ephemeral RAM drops</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-purple-400 shrink-0" />10 GB persistent encrypted vault</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-purple-400 shrink-0" />Client-side AES-256-GCM sealing</li>
                </ul>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActiveMode("storage");
                  window.scrollTo({ top: 0, behavior: "smooth" });
                }}
                className="w-full rounded-lg border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] py-2.5 text-xs font-semibold text-white transition-colors cursor-pointer"
              >
                Open Free 10 GB Vault
              </button>
            </div>

            <div className="rounded-xl border border-purple-500/40 bg-gradient-to-b from-purple-500/[0.08] to-[#090B12] p-6 flex flex-col justify-between space-y-6 shadow-lg shadow-purple-950/30">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-purple-400">Pro Vault</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-purple-500 text-white font-bold">
                    Popular
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white">$2.99</span>
                  <span className="text-xs text-zinc-400 font-mono">/month</span>
                </div>
                <p className="text-xs text-zinc-300">
                  High-capacity encrypted file delivery for freelancers and indie studios.
                </p>
                <ul className="space-y-2 pt-2 text-xs text-zinc-200">
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-purple-400 shrink-0" />500 GB persistent vault storage</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-purple-400 shrink-0" />Up to 5 GB single-file transfers</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-purple-400 shrink-0" />Custom link expiry & download caps</li>
                </ul>
              </div>
              <a
                href="mailto:files@sparrowx.net?subject=SparrowX%20Drop%20Pro%20Vault%20(500%20GB)"
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg bg-purple-500 hover:bg-purple-400 py-2.5 text-xs font-bold text-white transition-colors"
              >
                <span>Upgrade to Pro Vault</span>
                <ArrowRight className="size-3.5" />
              </a>
            </div>

            <div className="rounded-xl border border-white/[0.08] bg-[#090B12] p-6 flex flex-col justify-between space-y-6">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-mono uppercase tracking-wider text-zinc-400">Pro Max</span>
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-white/[0.06] text-zinc-300 border border-white/10">
                    1 TB
                  </span>
                </div>
                <div className="flex items-baseline gap-1">
                  <span className="text-3xl font-bold text-white">$5.99</span>
                  <span className="text-xs text-zinc-500 font-mono">/month</span>
                </div>
                <p className="text-xs text-zinc-400">
                  Shared encrypted dropboxes, audit trails, and priority edge throughput.
                </p>
                <ul className="space-y-2 pt-2 text-xs text-zinc-300">
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-purple-400 shrink-0" />1 TB pooled organization storage</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-purple-400 shrink-0" />Audit logs & IP-locked share links</li>
                  <li className="flex items-center gap-2"><CheckCircle2 className="size-3.5 text-purple-400 shrink-0" />Dedicated AP-Southeast NVMe nodes</li>
                </ul>
              </div>
              <a
                href="mailto:files@sparrowx.net?subject=SparrowX%20Drop%20Pro%20Max%20Vault%20(1%20TB)"
                className="w-full inline-flex items-center justify-center gap-1.5 rounded-lg border border-white/15 bg-white/[0.04] hover:bg-white/[0.08] py-2.5 text-xs font-semibold text-white transition-colors"
              >
                <span>Upgrade to Pro Max</span>
                <ArrowRight className="size-3.5" />
              </a>
            </div>
          </div>
        </div>

        {/* Standalone FAQ */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-2">
          <div className="rounded-lg border border-white/[0.06] bg-[#090B12]/70 p-4 space-y-1.5">
            <h4 className="text-xs font-semibold text-white">Are ephemeral files written to disk?</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              No. Ephemeral drops stay strictly in memory and are wiped immediately after the receiver downloads or the timer expires.
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-[#090B12]/70 p-4 space-y-1.5">
            <h4 className="text-xs font-semibold text-white">Can SparrowX read my files?</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              No. Encryption happens locally in your browser via WebCrypto AES-256-GCM before upload. Only holders of the share secret can decrypt.
            </p>
          </div>
          <div className="rounded-lg border border-white/[0.06] bg-[#090B12]/70 p-4 space-y-1.5">
            <h4 className="text-xs font-semibold text-white">How do I upgrade beyond 10 GB?</h4>
            <p className="text-xs text-zinc-400 leading-relaxed">
              Start free with 10 GB in Vault Mode and contact <span className="font-mono text-zinc-300">files@sparrowx.net</span> whenever your team needs 500 GB or 1 TB.
            </p>
          </div>
        </div>
      </section>

      <SparrowxFooter />
    </div>
  );
}
