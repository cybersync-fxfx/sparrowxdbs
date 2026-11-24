import React, { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { buildGoogleLoginHref } from "@/components/GoogleSignInButton";
import {
  clearSessionToken,
  issueSignedSessionToken,
  verifySessionToken,
} from "@/lib/advanced-features";
import {
  clearMasterSsoSession,
  fetchMasterSsoUser,
} from "@/lib/developer-connection";

export function SubdomainAuthChip({ nextPath }: { nextPath: string }) {
  const [user, setUser] = useState<{ email: string; fullName: string } | null>(null);

  useEffect(() => {
    const local = verifySessionToken();
    if (local?.email) {
      setUser({
        email: local.email,
        fullName: local.fullName || local.email.split("@")[0] || "Operator",
      });
      return;
    }
    let active = true;
    void fetchMasterSsoUser().then((sso) => {
      if (!active || !sso?.email) return;
      issueSignedSessionToken({
        id: sso.id,
        email: sso.email,
        fullName: sso.fullName,
        role: sso.role,
        tenantId: sso.tenantId,
      });
      setUser({
        email: sso.email,
        fullName: sso.fullName || sso.email.split("@")[0] || "Operator",
      });
    });
    return () => {
      active = false;
    };
  }, []);

  if (user) {
    return (
      <div className="hidden md:inline-flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-mono text-emerald-200">
        <span className="size-1.5 rounded-full bg-emerald-400" aria-hidden="true" />
        <span className="max-w-[150px] truncate">{user.email}</span>
        <button
          type="button"
          onClick={() => {
            clearSessionToken();
            void clearMasterSsoSession();
            setUser(null);
          }}
          title="Sign out"
          aria-label="Sign out"
          className="text-zinc-400 hover:text-white cursor-pointer"
        >
          <LogOut className="size-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        if (typeof window !== "undefined") {
          window.location.href = buildGoogleLoginHref(nextPath);
        }
      }}
      className="hidden sm:inline-flex min-h-[34px] items-center gap-1.5 rounded-md border border-[#262626] bg-[#0A0A0A] hover:bg-[#161616] px-3 text-xs font-medium text-zinc-200 hover:text-white transition-colors cursor-pointer"
    >
      <svg className="size-3.5 shrink-0" viewBox="0 0 24 24" aria-hidden="true">
        <path fill="#4285F4" d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z" />
        <path fill="#34A853" d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z" />
        <path fill="#FBBC05" d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 0 0 0 10.76l3.98-3.09z" />
        <path fill="#EA4335" d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z" />
      </svg>
      <span>Google Sign-In</span>
    </button>
  );
}
