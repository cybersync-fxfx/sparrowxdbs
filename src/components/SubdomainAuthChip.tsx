import React, { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { OAuthSignInButtons } from "@/components/GoogleSignInButton";
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
    <OAuthSignInButtons
      nextPath={nextPath}
      layout="row"
      compact
      googleLabel="Google"
      githubLabel="GitHub"
      className="hidden sm:flex"
    />
  );
}
