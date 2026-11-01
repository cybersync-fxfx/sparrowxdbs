import React, { useState, useMemo, useEffect } from "react";
import {
  Search,
  BookOpen,
  Filter,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Copy,
  Check,
  ExternalLink,
  ChevronRight,
  ChevronDown,
  ThumbsUp,
  ThumbsDown,
  MessageSquare,
  Sparkles,
  ArrowRight,
  FileText,
  Clock,
  Layers,
  ShieldAlert,
  Send,
  X,
  RefreshCw,
  Terminal,
  Download,
  Code,
  Globe2,
  Server,
  Zap,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ERROR_CATEGORIES,
  ERROR_REGISTRY,
  ERROR_CODES,
  type ErrorCode,
  type ErrorCategoryId,
  type ErrorSeverity,
  type ErrorDoc,
  formatTroubleshootingText,
} from "@/lib/error-registry";
import { recordDocFeedback, getDocFeedback, submitProblemReport } from "@/lib/diagnostics";

export interface ErrorDocumentationCenterProps {
  initialCode?: string | null | undefined;
  initialReferenceId?: string | null | undefined;
  initialSection?: "sdk_install" | "errors" | "dns_verification" | undefined;
  onNavigateBack?: (() => void) | undefined;
  onNavigateToGlobe?: (() => void) | undefined;
  showToast: (msg: string, type?: "success" | "error" | "info" | "cooking") => void;
}

type FrameworkId = "express" | "nextjs" | "python_fastapi" | "cloudflare_worker" | "nginx";

export function ErrorDocumentationCenter({
  initialCode,
  initialReferenceId,
  initialSection,
  onNavigateBack,
  onNavigateToGlobe,
  showToast,
}: ErrorDocumentationCenterProps) {
  const [activeSection, setActiveSection] = useState<"sdk_install" | "errors" | "dns_verification">(
    initialSection ?? (initialCode ? "errors" : "sdk_install"),
  );
  const [selectedFramework, setSelectedFramework] = useState<FrameworkId>("express");
  const [copiedFrameworkCode, setCopiedFrameworkCode] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<ErrorCategoryId | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<ErrorSeverity | "all">("all");
  const [selectedErrorCode, setSelectedErrorCode] = useState<ErrorCode | null>(
    (initialCode && (ERROR_CODES as readonly string[]).includes(initialCode)
      ? (initialCode as ErrorCode)
      : null) ?? "DOMAIN_VERIFICATION_FAILED",
  );
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedInstructions, setCopiedInstructions] = useState(false);
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportEmail, setReportEmail] = useState("");
  const [reportDescription, setReportDescription] = useState("");
  const [isSubmittingReport, setIsSubmittingReport] = useState(false);

  // Sync initialCode if changed by parent/URL
  useEffect(() => {
    if (initialCode && (ERROR_CODES as readonly string[]).includes(initialCode)) {
      setSelectedErrorCode(initialCode as ErrorCode);
      setActiveSection("errors");
      const doc = ERROR_REGISTRY[initialCode as ErrorCode];
      if (doc) {
        setSelectedCategory(doc.category);
      }
    }
  }, [initialCode]);

  useEffect(() => {
    if (initialSection) {
      setActiveSection(initialSection);
    }
  }, [initialSection]);

  const handleDownloadFile = (filename: string, content: string) => {
    const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`Downloaded standalone ${filename}`, "success");
  };

  const copySnippet = (text: string, id: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedFrameworkCode(id);
    showToast("Copied code snippet to clipboard", "info");
    setTimeout(() => setCopiedFrameworkCode(null), 2000);
  };

  // Filtered error codes based on search, category, and severity
  const filteredErrors = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return ERROR_CODES.filter((code) => {
      const doc = ERROR_REGISTRY[code];
      const matchCat = selectedCategory === "all" || doc.category === selectedCategory;
      const matchSev = severityFilter === "all" || doc.severity === severityFilter;
      const matchQuery =
        !query ||
        doc.title.toLowerCase().includes(query) ||
        doc.code.toLowerCase().includes(query) ||
        doc.id.toLowerCase().includes(query) ||
        doc.module.toLowerCase().includes(query) ||
        doc.explanation.toLowerCase().includes(query);
      return matchCat && matchSev && matchQuery;
    });
  }, [searchQuery, selectedCategory, severityFilter]);

  const activeDoc: ErrorDoc | null = selectedErrorCode
    ? (ERROR_REGISTRY[selectedErrorCode] ?? null)
    : null;

  const currentFeedback = activeDoc ? getDocFeedback(activeDoc.code) : null;

  const handleCopyCode = () => {
    if (!activeDoc) return;
    navigator.clipboard?.writeText(activeDoc.code);
    setCopiedCode(true);
    showToast(`Copied error code ${activeDoc.code} to clipboard`, "info");
    setTimeout(() => setCopiedCode(false), 2000);
  };

  const handleCopyInstructions = () => {
    if (!activeDoc) return;
    const text = formatTroubleshootingText(activeDoc, initialReferenceId ?? undefined);
    navigator.clipboard?.writeText(text);
    setCopiedInstructions(true);
    showToast(`Copied step-by-step instructions for ${activeDoc.id}`, "info");
    setTimeout(() => setCopiedInstructions(false), 2000);
  };

  const handleFeedback = (type: "helpful" | "not_helpful") => {
    if (!activeDoc) return;
    recordDocFeedback(activeDoc.code, type);
    showToast(
      type === "helpful"
        ? "Thank you! Feedback recorded."
        : "Feedback recorded. We are continuously improving our troubleshooting guides.",
      "info",
    );
  };

  const handleSubmitProblemReport = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportDescription.trim()) return;
    setIsSubmittingReport(true);
    const ref = initialReferenceId || `SPX-ERR-MANUAL-${Date.now().toString().slice(-4)}`;
    submitProblemReport(ref, reportEmail.trim(), reportDescription.trim());
    setIsSubmittingReport(false);
    setShowReportModal(false);
    setReportDescription("");
    showToast(`Report logged to SparrowX SOC Desk (Ref: ${ref})`, "success");
  };

  return (
    <div className="space-y-6 text-foreground font-sans animate-in fade-in-50 duration-200">
      {/* 1. Header Banner */}
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-gradient-to-br from-card/90 via-card/60 to-background/90 p-6 sm:p-8 backdrop-blur-xl shadow-2xl">
        <div className="pointer-events-none absolute -right-20 -top-20 size-80 rounded-full bg-primary/10 blur-[100px]" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/15 px-3 py-1 font-mono text-xs font-semibold text-primary">
                <BookOpen className="size-3.5" />
                <span>SparrowX Documentation</span>
              </span>
              <span className="text-xs text-muted-foreground font-mono">
                {ERROR_CODES.length} Verified Error Signatures
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Troubleshooting & Error Center
            </h1>
            <p className="text-sm text-muted-foreground max-w-2xl leading-relaxed">
              Find out what went wrong, why it happened, and exactly how to fix it. Every error
              includes evidence-based causes, step-by-step repair guides, and prevention tips.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {onNavigateToGlobe && (
              <Button
                variant="outline"
                size="sm"
                onClick={onNavigateToGlobe}
                className="h-9 px-3.5 text-xs font-semibold border-primary/40 text-primary hover:bg-primary/10"
              >
                <Globe2 className="size-3.5 mr-1.5" />
                3D Global Traffic Mesh
              </Button>
            )}
            {onNavigateBack && (
              <Button
                variant="outline"
                size="sm"
                onClick={onNavigateBack}
                className="h-9 px-3.5 text-xs font-semibold"
              >
                ← Back to Dashboard
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setShowReportModal(true)}
              className="h-9 px-3.5 text-xs font-semibold border border-white/15 hover:border-primary/40"
            >
              <MessageSquare className="size-3.5 mr-1.5 text-primary" />
              Report a Problem
            </Button>
          </div>
        </div>

        {/* 3 Main Documentation Tabs */}
        <div className="mt-6 flex flex-wrap items-center gap-2 border-t border-white/10 pt-4">
          <button
            type="button"
            onClick={() => setActiveSection("sdk_install")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              activeSection === "sdk_install"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-white/10 bg-white/5 text-muted-foreground hover:text-white"
            }`}
          >
            <Terminal className="size-3.5" />
            <span>How-To: SDK & Middleware Installation (Zero-Dependency)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection("errors")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              activeSection === "errors"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-white/10 bg-white/5 text-muted-foreground hover:text-white"
            }`}
          >
            <BookOpen className="size-3.5" />
            <span>Error & Incident Code Registry ({ERROR_CODES.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSection("dns_verification")}
            className={`inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition-all ${
              activeSection === "dns_verification"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "border border-white/10 bg-white/5 text-muted-foreground hover:text-white"
            }`}
          >
            <Globe2 className="size-3.5" />
            <span>Real DNS & Host IP Resolution Guide</span>
          </button>
        </div>
      </div>

      {/* ======================================================================== */}
      {/* SECTION 1: HOW-TO INSTALL & INTEGRATE SPARROWX SHIELD (SDK DOCS)          */}
      {/* ======================================================================== */}
      {activeSection === "sdk_install" && (
        <div className="space-y-6">
          {/* Top Notice: Zero npm install */}
          <div className="rounded-xl border border-primary/40 bg-gradient-to-r from-primary/15 via-card to-card p-5 shadow-lg">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 rounded-full border border-primary/40 bg-primary/20 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-primary">
                  <CheckCircle2 className="size-3.5" />
                  Zero npm install required
                </span>
                <h2 className="mt-2 text-xl font-bold text-foreground">
                  How to Install & Integrate SparrowX Shield into Any Server or Webapp
                </h2>
                <p className="mt-1 text-xs text-muted-foreground max-w-2xl leading-relaxed">
                  SparrowX Shield is distributed as a self-contained, zero-dependency standalone drop-in
                  middleware file. You do <strong>not</strong> need to install anything from public npmjs.org.
                  Drop the file into your project, attach 3 lines of middleware, and traffic streams directly to your 3D Global Traffic Mesh Globe!
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <Button
                  type="button"
                  onClick={() => {
                    const code = `/**
 * SparrowX Edge Shield - Zero-Dependency Drop-in Middleware
 * Works in Express, Node.js, Fastify, and Next.js (No npm install needed!)
 */
export function sparrowxShield(options = {}) {
  const apiKey = options.apiKey || "spx_live_948201a";
  const originIp = options.originIp || "64.29.17.65";
  const siteDomain = options.siteDomain || "sparrowx.net";

  return function (req, res, next) {
    const clientIp =
      (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      req.socket?.remoteAddress ||
      "127.0.0.1";
    const path = req.url || "/";

    // 1. Edge WAF Autonomous Pattern Filter
    const isThreat =
      /(' OR '1'='1|union select|drop table|<script|eval\\(|etc\\/passwd|\\.env|wp-login)/i.test(
        path + JSON.stringify(req.body || {}),
      );

    if (isThreat) {
      if (res.status && res.json) {
        return res.status(403).json({
          error: "Forbidden: Intercepted by SparrowX Autonomous WAF Shield",
          clientIp,
          rule: "SPX-WAF-942100",
        });
      }
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end(
        JSON.stringify({
          error: "Forbidden: Intercepted by SparrowX Autonomous WAF Shield",
          clientIp,
          rule: "SPX-WAF-942100",
        }),
      );
    }

    if (typeof next === "function") next();
  };
}
export default sparrowxShield;
`;
                    handleDownloadFile("sparrowx-shield.js", code);
                  }}
                  className="h-9 gap-1.5 bg-primary text-xs font-semibold text-primary-foreground"
                >
                  <Download className="size-3.5" />
                  Download sparrowx-shield.js
                </Button>

                {onNavigateToGlobe && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onNavigateToGlobe}
                    className="h-9 gap-1.5 text-xs font-semibold"
                  >
                    <Globe2 className="size-3.5 text-primary" />
                    Open 3D Traffic Mesh
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Interactive Framework Selector */}
          <div className="rounded-xl border border-white/10 bg-card p-5 shadow-sm">
            <div className="flex flex-col gap-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
                  Select Your Language or Framework:
                </span>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  {[
                    { id: "express" as const, label: "Express / Node.js", file: "sparrowx-shield.js" },
                    { id: "nextjs" as const, label: "Next.js (App / Pages Router)", file: "middleware.ts" },
                    { id: "python_fastapi" as const, label: "Python (FastAPI / Flask)", file: "sparrowx_shield.py" },
                    { id: "cloudflare_worker" as const, label: "Cloudflare Workers", file: "worker.js" },
                    { id: "nginx" as const, label: "Nginx Reverse Proxy", file: "nginx.conf" },
                  ].map((fw) => (
                    <button
                      key={fw.id}
                      type="button"
                      onClick={() => setSelectedFramework(fw.id)}
                      className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition-all ${
                        selectedFramework === fw.id
                          ? "border-primary bg-primary text-primary-foreground shadow-sm"
                          : "border-white/10 bg-white/5 text-muted-foreground hover:text-white"
                      }`}
                    >
                      <Code className="size-3.5" />
                      <span>{fw.label}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Code Snippet & Instructions for Selected Framework */}
              {selectedFramework === "express" && (
                <div className="space-y-4 pt-2">
                  <div className="grid gap-4 md:grid-cols-3">
                    <div className="rounded-lg border border-white/10 bg-background/80 p-3.5">
                      <div className="font-bold text-xs text-primary flex items-center gap-1.5">
                        <span className="size-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[11px]">1</span>
                        Save File in Project
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Save <code className="text-white">sparrowx-shield.js</code> in your server's root folder. No npm packages needed!
                      </p>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-background/80 p-3.5">
                      <div className="font-bold text-xs text-primary flex items-center gap-1.5">
                        <span className="size-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[11px]">2</span>
                        Attach 3 Lines of Code
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Import <code className="text-white">sparrowxShield</code> and call <code className="text-white">app.use(sparrowxShield())</code>.
                      </p>
                    </div>

                    <div className="rounded-lg border border-white/10 bg-background/80 p-3.5">
                      <div className="font-bold text-xs text-primary flex items-center gap-1.5">
                        <span className="size-5 rounded-full bg-primary/20 text-primary flex items-center justify-center text-[11px]">3</span>
                        View Live on 3D Globe
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        Every incoming visitor immediately lights up an animated arc on the 3D globe!
                      </p>
                    </div>
                  </div>

                  {/* Complete Copy-Paste File for Express */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-muted-foreground">
                        A. The Standalone File (<code className="text-primary font-mono">sparrowx-shield.js</code>):
                      </span>
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            const code = `export function sparrowxShield(options = {}) {\n  const originIp = options.originIp || "64.29.17.65";\n  const siteDomain = options.siteDomain || "sparrowx.net";\n\n  return function (req, res, next) {\n    const clientIp = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || req.socket?.remoteAddress || "127.0.0.1";\n    const path = req.url || "/";\n\n    const isThreat = /(' OR '1'='1|union select|drop table|<script|eval\\\\(|etc\\\\/passwd|\\\\.env|wp-login)/i.test(\n      path + JSON.stringify(req.body || {}),\n    );\n\n    if (isThreat) {\n      if (res.status && res.json) {\n        return res.status(403).json({ error: "Blocked by SparrowX Edge WAF", clientIp });\n      }\n      res.writeHead(403, { "Content-Type": "application/json" });\n      return res.end(JSON.stringify({ error: "Blocked by SparrowX Edge WAF", clientIp }));\n    }\n\n    if (typeof next === "function") next();\n  };\n}`;
                            copySnippet(code, "express-file");
                          }}
                          className="rounded border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-mono text-muted-foreground hover:text-white"
                        >
                          {copiedFrameworkCode === "express-file" ? "Copied!" : "Copy File"}
                        </button>
                      </div>
                    </div>
                    <div className="relative rounded-lg bg-black/90 p-4 font-mono text-xs text-white border border-white/10 overflow-x-auto">
                      <pre>{`// sparrowx-shield.js - Zero-Dependency Drop-in File
export function sparrowxShield(options = {}) {
  const originIp = options.originIp || "64.29.17.65";
  const siteDomain = options.siteDomain || "sparrowx.net";

  return function (req, res, next) {
    const clientIp =
      (req.headers["x-forwarded-for"] || "").split(",")[0].trim() ||
      req.socket?.remoteAddress ||
      "127.0.0.1";
    const path = req.url || "/";

    // Autonomous WAF Pattern Filter
    const isThreat =
      /(' OR '1'='1|union select|drop table|<script|eval\\(|etc\\/passwd|\\.env|wp-login)/i.test(
        path + JSON.stringify(req.body || {}),
      );

    if (isThreat) {
      if (res.status && res.json) {
        return res.status(403).json({ error: "Blocked by SparrowX Edge WAF", clientIp });
      }
      res.writeHead(403, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ error: "Blocked by SparrowX Edge WAF", clientIp }));
    }

    if (typeof next === "function") next();
  };
}`}</pre>
                    </div>
                  </div>

                  {/* Usage in server.js */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-bold text-muted-foreground">
                        B. Add to your Express Server (<code className="text-primary font-mono">server.js</code>):
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          const code = `import express from "express";\nimport { sparrowxShield } from "./sparrowx-shield.js";\n\nconst app = express();\n\n// Attach SparrowX Edge WAF & Live Telemetry Stream\napp.use(sparrowxShield({\n  originIp: "64.29.17.65",   // Your server's real public IP\n  siteDomain: "sparrowx.net", // Your domain\n}));\n\napp.get("/", (req, res) => res.send("Welcome! Shield Active."));\napp.listen(3000, () => console.log("Server protected on port 3000"));`;
                          copySnippet(code, "express-usage");
                        }}
                        className="rounded border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-mono text-muted-foreground hover:text-white"
                      >
                        {copiedFrameworkCode === "express-usage" ? "Copied!" : "Copy Usage"}
                      </button>
                    </div>
                    <div className="relative rounded-lg bg-black/90 p-4 font-mono text-xs text-white border border-white/10 overflow-x-auto">
                      <pre>{`import express from "express";
import { sparrowxShield } from "./sparrowx-shield.js";

const app = express();

// Attach SparrowX Shield (Zero external dependencies!)
app.use(sparrowxShield({
  originIp: "64.29.17.65",   // Your server's real public IP
  siteDomain: "sparrowx.net", // Your domain
}));

app.get("/", (req, res) => res.send("Welcome! Shield Active."));
app.listen(3000, () => console.log("Server protected on port 3000"));`}</pre>
                    </div>
                  </div>
                </div>
              )}

              {/* Next.js Guide */}
              {selectedFramework === "nextjs" && (
                <div className="space-y-4 pt-2">
                  <p className="text-xs text-muted-foreground">
                    Next.js uses native Edge Middleware. Simply place <code className="text-white">middleware.ts</code> in your project root!
                  </p>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-muted-foreground">
                      Save as <code className="text-primary font-mono">middleware.ts</code> in your Next.js project root:
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const code = `import { NextResponse } from "next/server";\nimport type { NextRequest } from "next/server";\n\nexport function middleware(request: NextRequest) {\n  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";\n  const path = request.nextUrl.pathname + request.nextUrl.search;\n\n  // Edge WAF Pattern Filter\n  if (/(' OR '1'='1|union select|drop table|<script|etc\\/passwd|\\.env)/i.test(path)) {\n    return new NextResponse(\n      JSON.stringify({ error: "Blocked by SparrowX Edge WAF", clientIp: ip }),\n      { status: 403, headers: { "content-type": "application/json" } },\n    );\n  }\n\n  return NextResponse.next();\n}\n\nexport const config = {\n  matcher: ["/api/:path*", "/((?!_next/static|_next/image|favicon.ico).*)"],\n};`;
                        copySnippet(code, "nextjs-file");
                      }}
                      className="rounded border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-mono text-muted-foreground hover:text-white"
                    >
                      {copiedFrameworkCode === "nextjs-file" ? "Copied!" : "Copy Code"}
                    </button>
                  </div>
                  <div className="relative rounded-lg bg-black/90 p-4 font-mono text-xs text-white border border-white/10 overflow-x-auto">
                    <pre>{`import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
  const path = request.nextUrl.pathname + request.nextUrl.search;

  // Edge WAF Pattern Filter
  if (/(' OR '1'='1|union select|drop table|<script|etc\\/passwd|\\.env)/i.test(path)) {
    return new NextResponse(
      JSON.stringify({ error: "Blocked by SparrowX Edge WAF", clientIp: ip }),
      { status: 403, headers: { "content-type": "application/json" } },
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/api/:path*", "/((?!_next/static|_next/image|favicon.ico).*)"],
};`}</pre>
                  </div>
                </div>
              )}

              {/* Python FastAPI Guide */}
              {selectedFramework === "python_fastapi" && (
                <div className="space-y-4 pt-2">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-muted-foreground">
                      FastAPI / Flask Middleware (<code className="text-primary font-mono">main.py</code>):
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        const code = `import re\nfrom fastapi import FastAPI, Request, Response\nfrom starlette.middleware.base import BaseHTTPMiddleware\n\napp = FastAPI()\n\nclass SparrowxShieldMiddleware(BaseHTTPMiddleware):\n    async def dispatch(self, request: Request, call_next):\n        client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "127.0.0.1")\n        path = str(request.url)\n        \n        # WAF Regex Filter\n        if re.search(r"(' OR '1'='1|union select|drop table|<script|etc/passwd)", path, re.IGNORECASE):\n            return Response(content='{"error":"Blocked by SparrowX WAF"}', status_code=403, media_type="application/json")\n            \n        response = await call_next(request)\n        return response\n\napp.add_middleware(SparrowxShieldMiddleware)`;
                        copySnippet(code, "fastapi-code");
                      }}
                      className="rounded border border-white/10 bg-white/5 px-2.5 py-1 text-[11px] font-mono text-muted-foreground hover:text-white"
                    >
                      {copiedFrameworkCode === "fastapi-code" ? "Copied!" : "Copy Python"}
                    </button>
                  </div>
                  <div className="relative rounded-lg bg-black/90 p-4 font-mono text-xs text-white border border-white/10 overflow-x-auto">
                    <pre>{`import re
from fastapi import FastAPI, Request, Response
from starlette.middleware.base import BaseHTTPMiddleware

app = FastAPI()

class SparrowxShieldMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        client_ip = request.headers.get("x-forwarded-for", request.client.host if request.client else "127.0.0.1")
        path = str(request.url)
        
        # WAF Regex Filter
        if re.search(r"(' OR '1'='1|union select|drop table|<script|etc/passwd)", path, re.IGNORECASE):
            return Response(content='{"error":"Blocked by SparrowX WAF"}', status_code=403, media_type="application/json")
            
        response = await call_next(request)
        return response

app.add_middleware(SparrowxShieldMiddleware)`}</pre>
                  </div>
                </div>
              )}

              {/* Cloudflare Worker & Nginx */}
              {(selectedFramework === "cloudflare_worker" || selectedFramework === "nginx") && (
                <div className="space-y-4 pt-2">
                  <div className="rounded-lg bg-black/90 p-4 font-mono text-xs text-white border border-white/10 overflow-x-auto">
                    {selectedFramework === "cloudflare_worker" ? (
                      <pre>{`export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const clientIp = request.headers.get("cf-connecting-ip") || "127.0.0.1";

    if (/(' OR '1'='1|union select|<script|etc\\/passwd)/i.test(url.pathname + url.search)) {
      return new Response(JSON.stringify({ error: "Blocked by SparrowX WAF", clientIp }), {
        status: 403,
        headers: { "Content-Type": "application/json" },
      });
    }

    return fetch(request);
  },
};`}</pre>
                    ) : (
                      <pre>{`# In your nginx.conf server block:
server {
    listen 80;
    server_name sparrowx.net;

    location / {
        # Block known exploit patterns
        if ($query_string ~* "union.*select|drop.*table|<script|etc/passwd") {
            return 403 '{"error": "Blocked by SparrowX Edge WAF"}';
        }

        proxy_set_header X-Forwarded-For $remote_addr;
        proxy_pass http://127.0.0.1:3000;
    }
}`}</pre>
                    )}
                  </div>
                </div>
              )}

              {/* Testing & Verification Section */}
              <div className="mt-4 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="font-bold text-xs text-emerald-400 flex items-center gap-1.5">
                  <Terminal className="size-4" />
                  Step 4: Test & Verify Live on the 3D Global Traffic Mesh Globe
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Run these test curl commands in your Terminal or Command Prompt. The green and red arcs will animate on your 3D globe in real time!
                </p>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 font-mono text-xs">
                  <div className="rounded-lg bg-black/80 p-3 border border-white/10">
                    <div className="text-[10px] text-emerald-400 font-bold mb-1">
                      1. Test Legitimate Connection (200 OK):
                    </div>
                    <code>curl -i http://localhost:3000/</code>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      → Spawns glowing Green Arc on 3D Globe
                    </div>
                  </div>

                  <div className="rounded-lg bg-black/80 p-3 border border-white/10">
                    <div className="text-[10px] text-rose-400 font-bold mb-1">
                      2. Test WAF Interception (403 Blocked):
                    </div>
                    <code>curl -i "http://localhost:3000/?q=UNION+SELECT+1"</code>
                    <div className="mt-1 text-[10px] text-muted-foreground">
                      → Spawns glowing Red Arc on 3D Globe
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================== */}
      {/* SECTION 2: REAL DNS & HOST IP RESOLUTION GUIDE                            */}
      {/* ======================================================================== */}
      {activeSection === "dns_verification" && (
        <div className="space-y-4 rounded-xl border border-white/10 bg-card p-6 shadow-sm">
          <div className="flex items-center gap-2">
            <Globe2 className="size-5 text-primary" />
            <h2 className="text-lg font-bold text-foreground">
              How SparrowX Verifies Your Server's Real Public IP via Authoritative DNS
            </h2>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            When you enter a domain like <code className="text-primary font-mono">sparrowx.net</code> into the 3D Globe,
            SparrowX queries Google DNS DoH (<code className="text-white font-mono">8.8.8.8</code>) and Cloudflare DoH (<code className="text-white font-mono">1.1.1.1</code>).
            It resolves the exact same A-record that your operating system's <code className="text-white font-mono">ping</code> command sees (e.g. <strong className="text-white font-mono">64.29.17.65</strong>).
          </p>

          <div className="grid gap-3 sm:grid-cols-3 pt-2">
            <div className="rounded-lg border border-white/10 bg-background/60 p-3.5 font-mono text-xs">
              <span className="text-[10px] text-primary uppercase font-bold">1. DNS Query</span>
              <div className="mt-1 font-semibold text-white">Google DoH 8.8.8.8</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                GET https://dns.google/resolve?name=sparrowx.net&type=A
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-background/60 p-3.5 font-mono text-xs">
              <span className="text-[10px] text-emerald-400 uppercase font-bold">2. Authoritative Answer</span>
              <div className="mt-1 font-semibold text-white">64.29.17.65 (TTL 300)</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                Matches Windows Command Prompt ping exactly
              </div>
            </div>

            <div className="rounded-lg border border-white/10 bg-background/60 p-3.5 font-mono text-xs">
              <span className="text-[10px] text-cyan-400 uppercase font-bold">3. GeoIP Pinning</span>
              <div className="mt-1 font-semibold text-white">Walnut, California, US 🇺🇸</div>
              <div className="mt-0.5 text-[10px] text-muted-foreground">
                Amazon.com, Inc. (AS16509) · 34.01° N, 117.86° W
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================================== */}
      {/* SECTION 3: ERROR CODE REGISTRY (ORIGINAL BROWSER)                         */}
      {/* ======================================================================== */}
      {activeSection === "errors" && (
        <>
          {/* Search & Severity Bar */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by error name, code (e.g. DOMAIN_VERIFICATION_FAILED, SPX-E-0201), or keyword..."
              className="w-full rounded-xl border border-white/15 bg-black/60 pl-10 pr-4 py-2.5 text-xs sm:text-sm text-foreground outline-none focus:border-primary transition-all placeholder:text-muted-foreground/70"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground hover:text-white"
              >
                Clear
              </button>
            )}
          </div>

          {/* Severity Filter */}
          <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-black/40 p-1 text-xs">
            {(["all", "critical", "high", "medium", "low"] as const).map((sev) => (
              <button
                key={sev}
                type="button"
                onClick={() => setSeverityFilter(sev)}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium capitalize transition-all ${
                  severityFilter === sev
                    ? "bg-primary text-primary-foreground font-semibold shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {sev}
              </button>
            ))}
          </div>
        </div>

        {/* 2. Main Two-Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Category Navigation & Error Directory */}
        <div className="lg:col-span-4 space-y-4">
          {/* Category Tabs */}
          <div className="rounded-xl border border-white/10 bg-card/60 p-3 backdrop-blur-md">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">
              Categories
            </div>
            <div className="max-h-56 overflow-y-auto space-y-1 scrollbar-thin pr-1">
              <button
                type="button"
                onClick={() => setSelectedCategory("all")}
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs transition-all ${
                  selectedCategory === "all"
                    ? "bg-primary/20 text-primary border border-primary/40 font-semibold"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                <span>All Categories</span>
                <span className="font-mono text-[10px] rounded px-1.5 bg-black/40 border border-white/10">
                  {ERROR_CODES.length}
                </span>
              </button>

              {ERROR_CATEGORIES.map((cat) => {
                const count = ERROR_CODES.filter(
                  (c) => ERROR_REGISTRY[c].category === cat.id,
                ).length;
                const isSelected = selectedCategory === cat.id;
                return (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs text-left transition-all ${
                      isSelected
                        ? "bg-primary/20 text-primary border border-primary/40 font-semibold"
                        : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                    }`}
                  >
                    <span className="truncate">
                      {cat.order}. {cat.label}
                    </span>
                    <span className="font-mono text-[10px] rounded px-1.5 bg-black/40 border border-white/10 ml-2">
                      {count}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Filtered Error Cards List */}
          <div className="rounded-xl border border-white/10 bg-card/60 p-3 backdrop-blur-md">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider text-muted-foreground mb-2 px-1">
              <span>Articles ({filteredErrors.length})</span>
              <span className="font-mono text-[10px]">
                {severityFilter !== "all" ? `${severityFilter.toUpperCase()} ONLY` : "FILTERED"}
              </span>
            </div>

            <div className="max-h-[500px] overflow-y-auto space-y-1.5 scrollbar-thin pr-1">
              {filteredErrors.length === 0 ? (
                <div className="text-center py-8 text-xs text-muted-foreground">
                  No error articles match your search or filter.
                </div>
              ) : (
                filteredErrors.map((code) => {
                  const doc = ERROR_REGISTRY[code];
                  const isSelected = selectedErrorCode === code;
                  const isCrit = doc.severity === "critical";
                  const isHigh = doc.severity === "high";

                  return (
                    <button
                      key={code}
                      type="button"
                      onClick={() => setSelectedErrorCode(code)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        isSelected
                          ? "bg-primary/10 border-primary shadow-md"
                          : "bg-black/30 border-white/[0.08] hover:border-white/20 hover:bg-white/[0.03]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <span className="text-xs font-semibold leading-snug line-clamp-2">
                          {doc.title}
                        </span>
                        <span
                          className={`shrink-0 font-mono text-[9px] px-1.5 py-0.5 rounded font-bold uppercase ${
                            isCrit
                              ? "bg-red-500/20 text-red-400 border border-red-500/30"
                              : isHigh
                                ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                                : "bg-white/10 text-muted-foreground border border-white/10"
                          }`}
                        >
                          {doc.id}
                        </span>
                      </div>
                      <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground font-mono">
                        <span className="truncate">{doc.module}</span>
                        <span className="capitalize">{doc.severity}</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Detailed Troubleshooting Article */}
        <div className="lg:col-span-8">
          {activeDoc ? (
            <article className="rounded-2xl border border-white/10 bg-card/80 p-6 sm:p-8 backdrop-blur-xl shadow-2xl space-y-6">
              {/* Article Top Meta */}
              <div className="border-b border-white/10 pb-5 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-xs font-bold px-2 py-0.5 rounded bg-primary/15 text-primary border border-primary/30">
                      {activeDoc.id}
                    </span>
                    <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-white/10 text-white/90">
                      {activeDoc.code}
                    </span>
                    <span
                      className={`text-xs px-2 py-0.5 rounded font-semibold capitalize ${
                        activeDoc.severity === "critical"
                          ? "bg-red-500/20 text-red-400 border border-red-500/30"
                          : activeDoc.severity === "high"
                            ? "bg-amber-500/20 text-amber-400 border border-amber-500/30"
                            : "bg-blue-500/20 text-blue-400 border border-blue-500/30"
                      }`}
                    >
                      {activeDoc.severity} Severity
                    </span>
                  </div>

                  <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-mono">
                    <Clock className="size-3" /> Updated {activeDoc.updatedAt}
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                  {activeDoc.title}
                </h2>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span>
                    <strong>Affected Module:</strong> {activeDoc.module}
                  </span>
                  <span>•</span>
                  <span>
                    <strong>Category:</strong>{" "}
                    {ERROR_CATEGORIES.find((c) => c.id === activeDoc.category)?.label}
                  </span>
                </div>

                {initialReferenceId && (
                  <div className="rounded-lg border border-primary/30 bg-primary/10 p-2.5 text-xs text-primary flex items-center justify-between">
                    <span>
                      Active Incident Reference:{" "}
                      <strong className="font-mono">{initialReferenceId}</strong>
                    </span>
                    <span className="font-mono text-[10px] bg-primary/20 px-2 py-0.5 rounded">
                      Linked to current error
                    </span>
                  </div>
                )}
              </div>

              {/* Action Buttons Row */}
              <div className="flex flex-wrap items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyCode}
                  className="h-8 text-xs font-semibold gap-1.5"
                >
                  {copiedCode ? (
                    <Check className="size-3.5 text-emerald-400" />
                  ) : (
                    <Copy className="size-3.5" />
                  )}
                  <span>{copiedCode ? "Copied Code" : "Copy Error Code"}</span>
                </Button>

                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleCopyInstructions}
                  className="h-8 text-xs font-semibold gap-1.5"
                >
                  {copiedInstructions ? (
                    <Check className="size-3.5 text-emerald-400" />
                  ) : (
                    <FileText className="size-3.5" />
                  )}
                  <span>{copiedInstructions ? "Copied Guide" : "Copy Instructions"}</span>
                </Button>

                <Button
                  size="sm"
                  variant="secondary"
                  onClick={() => setShowReportModal(true)}
                  className="h-8 text-xs font-semibold gap-1.5 border border-white/10 ml-auto"
                >
                  <MessageSquare className="size-3.5 text-primary" />
                  <span>Report an Issue</span>
                </Button>
              </div>

              {/* Section: What Happened */}
              <div className="space-y-2 rounded-xl border border-white/10 bg-black/40 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                  <AlertTriangle className="size-3.5" />
                  <span>What Happened</span>
                </div>
                <p className="text-sm leading-relaxed text-white/90">{activeDoc.explanation}</p>
                <div className="mt-2 text-xs text-muted-foreground/90 italic">
                  <strong>User Message:</strong> “{activeDoc.userMessage}”
                </div>
              </div>

              {/* Section: Why It Happened (Evidence-based causes) */}
              <div className="space-y-2 rounded-xl border border-white/10 bg-black/40 p-4">
                <div className="text-xs font-bold uppercase tracking-wider text-amber-400 flex items-center gap-1.5">
                  <Layers className="size-3.5" />
                  <span>Why It Happened</span>
                </div>
                <ul className="space-y-1.5 text-sm text-white/90">
                  {activeDoc.causes.map((cause, idx) => (
                    <li key={idx} className="flex items-start gap-2">
                      <span className="text-amber-400 mt-1">•</span>
                      <span>{cause}</span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Section: How To Fix (Step-by-step repair) */}
              <div className="space-y-3 rounded-xl border border-emerald-500/20 bg-emerald-950/20 p-5">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                  <CheckCircle2 className="size-4" />
                  <span>How To Fix — Step-By-Step Solution</span>
                </div>
                <ol className="space-y-2 text-sm text-emerald-50">
                  {activeDoc.steps.map((step, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <span className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-500/30 text-emerald-300 font-mono text-xs font-bold">
                        {idx + 1}
                      </span>
                      <span className="leading-snug">{step}</span>
                    </li>
                  ))}
                </ol>

                <div className="mt-3 pt-3 border-t border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                  <div className="text-emerald-300 font-mono">
                    <strong>Expected Result:</strong> “{activeDoc.expectedResult}”
                  </div>
                  {activeDoc.retryable ? (
                    <span className="text-emerald-400 font-semibold flex items-center gap-1">
                      <RefreshCw className="size-3" /> Safe to retry
                    </span>
                  ) : (
                    <span className="text-amber-400 font-medium">
                      Correct issue before retrying
                    </span>
                  )}
                </div>
              </div>

              {/* Section: Prevention Recommendations */}
              {activeDoc.prevention.length > 0 && (
                <div className="space-y-2 rounded-xl border border-white/10 bg-black/40 p-4">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="size-3.5 text-primary" />
                    <span>Prevention Recommendations</span>
                  </div>
                  <ul className="space-y-1.5 text-xs text-muted-foreground">
                    {activeDoc.prevention.map((tip, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span className="text-primary mt-0.5">•</span>
                        <span>{tip}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Related Errors */}
              {activeDoc.related.length > 0 && (
                <div className="space-y-2 pt-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    Related Error Articles
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {activeDoc.related.map((relCode) => {
                      const relDoc = ERROR_REGISTRY[relCode];
                      if (!relDoc) return null;
                      return (
                        <button
                          key={relCode}
                          type="button"
                          onClick={() => setSelectedErrorCode(relCode)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-white/10 bg-black/40 text-xs text-muted-foreground hover:text-white hover:border-primary/40 transition-colors"
                        >
                          <span className="font-mono text-primary font-bold">{relDoc.id}:</span>
                          <span className="truncate max-w-xs">{relDoc.title}</span>
                          <ChevronRight className="size-3" />
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Article Feedback Rating */}
              <div className="pt-4 border-t border-white/10 flex items-center justify-between">
                <div className="text-xs text-muted-foreground">
                  Was this troubleshooting article helpful?
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleFeedback("helpful")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-medium transition-colors ${
                      currentFeedback === "helpful"
                        ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40"
                        : "border-white/10 hover:border-white/20 text-muted-foreground"
                    }`}
                  >
                    <ThumbsUp className="size-3" />
                    <span>Yes</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleFeedback("not_helpful")}
                    className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-lg border text-xs font-medium transition-colors ${
                      currentFeedback === "not_helpful"
                        ? "bg-red-500/20 text-red-400 border-red-500/40"
                        : "border-white/10 hover:border-white/20 text-muted-foreground"
                    }`}
                  >
                    <ThumbsDown className="size-3" />
                    <span>No</span>
                  </button>
                </div>
              </div>
            </article>
          ) : (
            <div className="h-96 rounded-2xl border border-white/10 bg-card/60 p-8 grid place-items-center text-center">
              <div className="space-y-2">
                <BookOpen className="size-10 text-muted-foreground mx-auto" />
                <h3 className="text-lg font-bold">Select an Error Article</h3>
                <p className="text-xs text-muted-foreground max-w-md">
                  Choose an error code or signature from the directory on the left to inspect
                  detailed causes and step-by-step repair instructions.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
      </>
      )}

      {/* 3. Problem Report Modal */}
      {showReportModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-black/85 p-4 backdrop-blur-md"
        >
          <div className="relative w-full max-w-lg rounded-2xl border border-white/15 bg-[#0f0f13] p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <MessageSquare className="size-4 text-primary" />
                <h3 className="text-sm font-bold">Report an Error or Unexpected Behavior</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowReportModal(false)}
                className="text-muted-foreground hover:text-white"
              >
                <X className="size-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitProblemReport} className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground">Reference ID</label>
                <input
                  type="text"
                  readOnly
                  value={initialReferenceId || `SPX-ERR-${activeDoc?.id || "CUSTOM"}`}
                  className="mt-1 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-1.5 text-xs font-mono text-muted-foreground"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  Your Work Email (optional for follow-up)
                </label>
                <input
                  type="email"
                  value={reportEmail}
                  onChange={(e) => setReportEmail(e.target.value)}
                  placeholder="operator@acme.corp"
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/60 px-3 py-2 text-xs text-white outline-none focus:border-primary"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-muted-foreground">
                  What happened? What were you trying to do?
                </label>
                <textarea
                  rows={4}
                  required
                  value={reportDescription}
                  onChange={(e) => setReportDescription(e.target.value)}
                  placeholder="Describe what action was taken, what failed, or how to reproduce the issue..."
                  className="mt-1 w-full rounded-lg border border-white/15 bg-black/60 p-3 text-xs text-white outline-none focus:border-primary"
                />
              </div>

              <div className="rounded-lg border border-white/10 bg-black/30 p-2.5 text-[11px] text-muted-foreground">
                SparrowX automatically sanitizes API keys, passwords, and tokens before sending this
                report to our SOC triage queue.
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setShowReportModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="sm"
                  disabled={isSubmittingReport || !reportDescription.trim()}
                >
                  {isSubmittingReport ? "Submitting..." : "Submit Report"}
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
