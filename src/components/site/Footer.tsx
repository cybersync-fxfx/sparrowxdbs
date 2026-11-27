import { Brand, LOGIN_HREF } from "./Navbar";
import { buildMasterHref, buildProductHref } from "@/lib/routing";

export function Footer() {
  return (
    <footer className="border-t border-white/[0.08] bg-[#05060a]">
      <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-12 md:flex-row md:items-center md:justify-between">
        <div>
          <Brand />
          <p className="mt-3 max-w-sm text-sm text-slate-400">
            321+ game servers, bots, managed databases, and cloud runtimes hosted on Indian NVMe Gen4 infrastructure.
          </p>
        </div>
        <nav aria-label="Footer navigation" className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-slate-400">
          <a href="#catalog" className="hover:text-white transition-colors">Games &amp; Apps</a>
          <a href="#features" className="hover:text-white transition-colors">Features</a>
          <a href="#performance" className="hover:text-white transition-colors">Benchmarks</a>
          <a href={LOGIN_HREF} className="hover:text-white transition-colors">Client Area</a>
          <a href={buildProductHref("shield")} className="hover:text-white transition-colors">DDoS Shield</a>
          <a href={buildMasterHref("/")} className="hover:text-white transition-colors">SparrowX Cloud</a>
        </nav>
      </div>
      <p className="pb-8 text-center text-sm text-slate-500">
        © {new Date().getFullYear()} SparrowX Game Hosting · sparrowx.net
      </p>
    </footer>
  );
}
