import { Brand } from "./Navbar";
import { buildGoogleLoginHref } from "@/components/GoogleSignInButton";
import { buildMasterHref, buildProductHref } from "@/lib/routing";

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-12 md:flex-row md:items-center md:justify-between">
        <div>
          <Brand />
          <p className="mt-3 max-w-sm text-sm text-muted-foreground">
            Premium game infrastructure from India — FiveM, SA-MP, Minecraft and Discord bots on NVMe Gen4.
          </p>
        </div>
        <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <a href="#performance" className="hover:text-foreground">Performance</a>
          <a href="#pricing" className="hover:text-foreground">Pricing</a>
          <a href={buildGoogleLoginHref("/game/dashboard")} className="hover:text-foreground">Sign In</a>
          <a href={buildProductHref("shield")} className="hover:text-foreground">DDoS &amp; Web Shield</a>
          <a href={buildProductHref("netsec")} className="hover:text-foreground">NetSec Guard</a>
          <a href={buildMasterHref("/")} className="hover:text-foreground">SparrowX Cloud</a>
        </nav>
      </div>
      <p className="pb-8 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} SparrowX Game Hosting · sparrowx.net</p>
    </footer>
  );
}
