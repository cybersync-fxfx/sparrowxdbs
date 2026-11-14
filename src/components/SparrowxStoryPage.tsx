import React from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  Cpu,
  Database,
  FileUp,
  Heart,
  KeyRound,
  Lock,
  Shield,
  Sparkles,
} from "lucide-react";

export function SparrowxStoryPage() {
  return (
    <div className="min-h-screen bg-[#070A12] text-[#F3F4F6] font-sans antialiased selection:bg-sky-500 selection:text-black flex flex-col">
      {/* Sticky Header */}
      <header className="border-b border-sky-500/15 bg-[#0B1020]/95 px-4 sm:px-6 py-3.5 sticky top-0 z-40 backdrop-blur-md shadow-[0_4px_20px_rgba(0,0,0,0.3)]">
        <div className="max-w-6xl mx-auto flex items-center justify-between gap-4">
          <a href="/" className="flex items-center gap-2.5 shrink-0">
            <img
              src="/sparrowx-logo.png"
              alt="SparrowX"
              className="size-9 object-contain shrink-0 drop-shadow-[0_4px_12px_rgba(56,189,248,0.25)]"
            />
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-sm sm:text-base tracking-tight text-white">
                SPARROWX
              </span>
              <span className="hidden sm:inline text-[10px] text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/30 font-mono font-semibold uppercase">
                OUR STORY &amp; MANIFESTO
              </span>
            </div>
          </a>

          <nav
            aria-label="Story sections"
            className="hidden lg:flex items-center gap-5 text-xs font-mono text-[#A3B1C6]"
          >
            <a href="#origin" className="hover:text-white transition-colors">
              Why We Started
            </a>
            <a href="#security" className="hover:text-white transition-colors">
              Security
            </a>
            <a href="#files" className="hover:text-white transition-colors">
              Private File Sharing
            </a>
            <a href="#database" className="hover:text-white transition-colors">
              Low-Cost DB &amp; Cloud
            </a>
            <a href="#pledge" className="hover:text-white transition-colors">
              Our Pledge
            </a>
          </nav>

          <a
            href="/"
            className="px-3.5 py-1.5 rounded bg-[#111A30] border border-sky-500/25 hover:border-sky-400 text-xs font-mono text-white transition-all inline-flex items-center gap-1.5 shrink-0"
          >
            <ArrowLeft className="size-3.5 text-sky-400" />
            <span>Back to Home</span>
          </a>
        </div>
      </header>

      <main className="flex-1">
        {/* Hero & Emotional Origin Story */}
        <section
          id="origin"
          className="scroll-mt-24 px-4 sm:px-6 pt-14 pb-12 border-b border-sky-500/15 bg-gradient-to-b from-[#0B1122] to-[#070A12]"
        >
          <div className="max-w-4xl mx-auto space-y-8">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-rose-500/10 border border-rose-500/25 text-xs font-mono text-rose-300">
              <Heart className="size-3.5 text-rose-400" />
              <span>A LETTER FROM THE FOUNDERS</span>
            </div>

            <div className="space-y-4">
              <h1 className="text-3xl sm:text-5xl font-extrabold text-white tracking-tight leading-[1.12]">
                Why We Started SparrowX: Cloud Infrastructure Built with Heart, Not Billing Traps
              </h1>
              <p className="text-base sm:text-lg text-sky-300/90 font-medium leading-relaxed">
                Every big cloud platform started small—until spreadsheets, investors, and artificial paywalls forgot the builders who keep the internet alive.
              </p>
            </div>

            <div className="rounded-xl border border-sky-500/25 bg-[#0D1526] p-6 sm:p-10 space-y-5 text-sm sm:text-base text-[#C2CEE0] leading-relaxed shadow-2xl">
              <p>
                SparrowX wasn&apos;t born inside a boardroom chasing enterprise contracts. It started at 2:00 AM after watching another independent launch—months of passion, weekend commits, and stubborn belief—get buried under the weight of modern cloud complexity. Just to put a small app online safely, we were forced through twenty confusing dashboards, handed an unpredictable bandwidth meter, and told that basic protection against getting knocked offline cost hundreds or thousands of dollars a month.
              </p>
              <p>
                What hurt even more was watching how ordinary developer trust was treated as a monetization funnel. Want to generate a clean high-entropy key? A website demanded an email newsletter sign-up. Want to hand a teammate a 50 MB build archive or an environment config? You had to create an account, accept tracking cookies, and leave a plain copy sitting on someone else&apos;s storage bucket indefinitely. Want a real PostgreSQL database for a side project that might earn fifty dollars in its first year? Prepare for a surprise month-end egress tax that costs more than the server itself.
              </p>
              <p>
                We asked ourselves a simple, human question: <span className="text-white font-semibold">what if cloud tools still respected the person on the other side of the screen?</span> SparrowX is our promise in code. Small, direct, fiercely independent infrastructure—where security is a right, private file sharing leaves zero trace, and databases stay affordable enough for a student, a solo founder, or a bootstrap team building out of sheer grit.
              </p>
            </div>
          </div>
        </section>

        {/* Deep Dive Sections */}
        <section className="px-4 sm:px-6 py-14 space-y-10 max-w-4xl mx-auto">
          {/* Pillar 1: Security */}
          <article
            id="security"
            className="scroll-mt-24 rounded-xl border border-orange-500/25 bg-[#0B101D] p-6 sm:p-9 space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 text-xs font-mono text-orange-400 uppercase tracking-wider font-bold">
                <Shield className="size-4" />
                <span>Pillar 01 · Security Without Ransom</span>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href="https://sec.sparrowx.net"
                  className="text-xs font-mono text-orange-300 hover:text-white inline-flex items-center gap-1 border border-orange-500/30 bg-orange-500/10 px-2.5 py-1 rounded transition-colors"
                >
                  <span>sec.sparrowx.net</span>
                  <ArrowUpRight className="size-3" />
                </a>
                <a
                  href="https://password.sparrowx.net"
                  className="text-xs font-mono text-amber-300 hover:text-white inline-flex items-center gap-1 border border-amber-500/30 bg-amber-500/10 px-2.5 py-1 rounded transition-colors"
                >
                  <span>password.sparrowx.net</span>
                  <ArrowUpRight className="size-3" />
                </a>
              </div>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Security as a Basic Right—Not an Enterprise Upsell
            </h2>

            <div className="space-y-4 text-sm sm:text-base text-[#B8C5D9] leading-relaxed">
              <p>
                Nothing is more demoralizing than finally shipping your product to the world, only for an automated botnet or credential stuffing wave to bring it down while legacy security vendors gate real protection behind &ldquo;Contact Sales&rdquo; calls. Small teams shouldn&apos;t have to choose between staying exposed or paying a corporate ransom just to keep their origin IP hidden.
              </p>
              <p>
                That is why we built <strong className="text-white">SparrowX Shield (<span className="font-mono text-orange-300">sec.sparrowx.net</span>)</strong>—real-time Layer-7 WAF filtering, origin IP cloaking, and an instant live threat radar designed for everyday builders. You can audit a domain&apos;s exposed origin records in seconds without a credit card, deploy edge scrubbing with transparent flat rates, and sleep knowing a midnight traffic spike won&apos;t wreck your server or your wallet.
              </p>
              <p>
                And because real security starts before code ever hits production, <strong className="text-white">SparrowX Keys (<span className="font-mono text-amber-300">password.sparrowx.net</span>)</strong> gives anyone instant access to kernel-seeded WebCrypto CSPRNG passwords, Diceware passphrases, and API secrets—100% offline inside your browser&apos;s volatile heap. No accounts, no analytics scripts, and zero server round-trips: close the tab, and even we never know a key existed.
              </p>
            </div>
          </article>

          {/* Pillar 2: Private File Sharing */}
          <article
            id="files"
            className="scroll-mt-24 rounded-xl border border-emerald-500/25 bg-[#0B101D] p-6 sm:p-9 space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 text-xs font-mono text-emerald-400 uppercase tracking-wider font-bold">
                <FileUp className="size-4" />
                <span>Pillar 02 · Zero-Knowledge File Sharing</span>
              </div>
              <a
                href="https://file.sparrowx.net"
                className="text-xs font-mono text-emerald-300 hover:text-white inline-flex items-center gap-1 border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 rounded transition-colors"
              >
                <span>file.sparrowx.net</span>
                <ArrowUpRight className="size-3" />
              </a>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Send Sensitive Files Like Whispering in a Locked Room
            </h2>

            <div className="space-y-4 text-sm sm:text-base text-[#B8C5D9] leading-relaxed">
              <p>
                Think about how often developers paste database credentials, signing certificates, client contracts, or private release zips into chat apps just because proper file transfer takes too many clicks. Once uploaded there, those files live forever in searchable cloud backups you don&apos;t control. Privacy fails most often not because people don&apos;t care, but because safe tools made them jump through too many hoops.
              </p>
              <p>
                <strong className="text-white">SparrowX Drop (<span className="font-mono text-emerald-300">file.sparrowx.net</span>)</strong> removes the friction while keeping cryptographic custody strictly in your hands. Every file you drag onto the page is sealed locally inside your browser using <strong className="text-white">AES-256-GCM</strong> before a single byte touches the wire. The decryption key stays in the URL fragment or your chosen passcode—our servers only relay opaque ciphertext we couldn&apos;t read even if forced to.
              </p>
              <p>
                For quick one-off handoffs, Ephemeral RAM mode needs zero login, holds payloads strictly in volatile memory, and burns them cleanly after download or timeout. And when a startup needs durable encrypted links with download counters and instant revocation, every user gets a <strong className="text-white">free 10 GB persistent vault</strong>—upgradable cleanly without egress traps.
              </p>
            </div>
          </article>

          {/* Pillar 3: Low-Cost Cloud DB & VPS */}
          <article
            id="database"
            className="scroll-mt-24 rounded-xl border border-sky-500/25 bg-[#0B101D] p-6 sm:p-9 space-y-5"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="inline-flex items-center gap-2 text-xs font-mono text-sky-400 uppercase tracking-wider font-bold">
                <Database className="size-4" />
                <span>Pillar 03 · Low-Cost Cloud DB &amp; NVMe Compute</span>
              </div>
              <a
                href="https://db.sparrowx.net"
                className="text-xs font-mono text-sky-300 hover:text-white inline-flex items-center gap-1 border border-sky-500/30 bg-sky-500/10 px-2.5 py-1 rounded transition-colors"
              >
                <span>db.sparrowx.net</span>
                <ArrowUpRight className="size-3" />
              </a>
            </div>

            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Honest Low-Cost Databases &amp; Fast NVMe Compute—With Zero Egress Shock
            </h2>

            <div className="space-y-4 text-sm sm:text-base text-[#B8C5D9] leading-relaxed">
              <p>
                The biggest hidden tax in modern software isn&apos;t compute—it&apos;s fear of the invoice. Too many brilliant prototypes die on localhost because hosted PostgreSQL providers quickly jump from a restrictive free hobby box to $50–$100/month minimums, then tack on per-GB bandwidth overages if your app goes viral overnight.
              </p>
              <p>
                <strong className="text-white">SparrowX Cloud DB (<span className="font-mono text-sky-300">db.sparrowx.net</span>)</strong> puts real, uncompromising bare-metal <strong className="text-white">PostgreSQL + pgvector</strong> within reach of every builder. You get a clean SQL studio, instant PostgREST REST APIs, and isolated tenant databases without bloated cold starts or predatory egress meters. Start learning and prototyping in the developer sandbox for free, and scale cleanly when revenue—not arbitrary row limits—actually grows.
              </p>
              <p>
                And when you need dedicated Linux compute right alongside your database, <strong className="text-white">SparrowX Compute VPS</strong> runs on ECC memory and high-speed NVMe drives starting at a flat <strong className="text-white">$4/mo ({"\u20B9"}340/mo)</strong> with generous included Anycast bandwidth. No surprise multipliers, no quiet renewal hikes—just raw speed priced honestly in both USD and INR.
              </p>
            </div>
          </article>

          {/* Section 4: The Builder's Pledge */}
          <article
            id="pledge"
            className="scroll-mt-24 rounded-xl border border-sky-500/30 bg-gradient-to-br from-[#0F182E] to-[#090F1E] p-6 sm:p-10 space-y-6 shadow-2xl"
          >
            <div className="inline-flex items-center gap-2 text-xs font-mono text-sky-400">
              <Sparkles className="size-4" />
              <span>THE SPARROWX BUILDER&apos;S PLEDGE</span>
            </div>

            <h2 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              No Dark Patterns. No Surprise Bills. Built for People Who Make Things.
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs">
              <div className="rounded-lg border border-white/10 bg-black/25 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-orange-300 font-mono font-bold">
                  <Lock className="size-3.5" />
                  <span>Privacy First</span>
                </div>
                <p className="text-[#A3B1C6] leading-relaxed">
                  Zero ad trackers, offline password keys, and browser-encrypted file transit by default.
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/25 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-emerald-300 font-mono font-bold">
                  <KeyRound className="size-3.5" />
                  <span>Zero Lock-In</span>
                </div>
                <p className="text-[#A3B1C6] leading-relaxed">
                  Standard PostgreSQL dumps, standard REST APIs, and instant tools that work without begging support.
                </p>
              </div>
              <div className="rounded-lg border border-white/10 bg-black/25 p-4 space-y-1.5">
                <div className="flex items-center gap-2 text-sky-300 font-mono font-bold">
                  <Cpu className="size-3.5" />
                  <span>Honest Pricing</span>
                </div>
                <p className="text-[#A3B1C6] leading-relaxed">
                  Free forever utilities plus flat low-cost DB and NVMe compute starting at $4/mo ({"\u20B9"}340/mo).
                </p>
              </div>
            </div>

            <div className="pt-4 border-t border-sky-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="font-mono text-xs space-y-0.5">
                <div className="text-white font-bold">— The SparrowX Team</div>
                <div className="text-sky-400">Built with passion for builders</div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 text-xs font-mono">
                <a
                  href="/"
                  className="px-4 py-2 rounded bg-sky-500 hover:bg-sky-400 text-black font-bold transition-colors"
                >
                  Explore All Services
                </a>
                <a
                  href="https://db.sparrowx.net"
                  className="px-3.5 py-2 rounded bg-[#111A30] border border-sky-500/30 hover:border-sky-400 text-white transition-colors inline-flex items-center gap-1"
                >
                  <span>Cloud DB</span>
                  <ArrowUpRight className="size-3" />
                </a>
                <a
                  href="https://file.sparrowx.net"
                  className="px-3.5 py-2 rounded bg-[#111A30] border border-emerald-500/30 hover:border-emerald-400 text-white transition-colors inline-flex items-center gap-1"
                >
                  <span>Drop</span>
                  <ArrowUpRight className="size-3" />
                </a>
                <a
                  href="https://sec.sparrowx.net"
                  className="px-3.5 py-2 rounded bg-[#111A30] border border-orange-500/30 hover:border-orange-400 text-white transition-colors inline-flex items-center gap-1"
                >
                  <span>Shield</span>
                  <ArrowUpRight className="size-3" />
                </a>
              </div>
            </div>
          </article>
        </section>
      </main>

      <footer className="border-t border-sky-500/15 bg-[#05070D] px-6 py-8 text-xs font-mono text-[#8795AB]">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-white font-bold">
            <span>SPARROWX TECHNOLOGIES</span>
            <span className="text-[10px] text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/30">
              INDEPENDENT STARTUP
            </span>
          </div>
          <div className="flex items-center gap-4">
            <a href="/" className="hover:text-white transition-colors">
              sparrowx.net
            </a>
            <span>&bull;</span>
            <a href="/#vps" className="hover:text-white transition-colors">
              Low-Cost VPS
            </a>
            <span>&bull;</span>
            <a href="/#contact" className="hover:text-white transition-colors">
              Contact
            </a>
            <span>&bull;</span>
            <span>&copy; {new Date().getFullYear()} SparrowX</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
