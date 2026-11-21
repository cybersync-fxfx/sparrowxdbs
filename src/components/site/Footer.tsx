import { Brand, LOGIN_HREF } from "./Navbar";

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
          <a href={LOGIN_HREF} className="hover:text-foreground">Sign In</a>
          <a href="https://gamesec.sparrowx.net" className="hover:text-foreground">Game DDoS Defense</a>
          <a href="/shield" className="hover:text-foreground">Web &amp; API Shield</a>
          <a href="https://sparrowx.net" className="hover:text-foreground">SparrowX Cloud</a>
        </nav>
      </div>
      <p className="pb-8 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} SparrowX Game Hosting · sparrowx.net</p>
    </footer>
  );
}
