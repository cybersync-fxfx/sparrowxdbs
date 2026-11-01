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

interface ErrorDocumentationCenterProps {
  initialCode?: string | null;
  initialReferenceId?: string | null;
  onNavigateBack?: () => void;
  showToast: (msg: string, type?: "success" | "error" | "info" | "cooking") => void;
}

export function ErrorDocumentationCenter({
  initialCode,
  initialReferenceId,
  onNavigateBack,
  showToast,
}: ErrorDocumentationCenterProps) {
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
      // Auto-set the category to match the selected error
      const doc = ERROR_REGISTRY[initialCode as ErrorCode];
      if (doc) {
        setSelectedCategory(doc.category);
      }
    }
  }, [initialCode]);

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

        {/* Search & Severity Bar */}
        <div className="mt-6 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
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
