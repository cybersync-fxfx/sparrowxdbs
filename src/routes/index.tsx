import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import {
  Activity,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  Boxes,
  Check,
  ChevronDown,
  CircleHelp,
  Clock3,
  Command,
  Download,
  Ellipsis,
  FileSearch,
  Filter,
  Globe2,
  Layers3,
  LockKeyhole,
  Menu,
  Search,
  ShieldAlert,
  ShieldCheck,
  Siren,
  Sparkles,
  Users,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

type Severity = "Critical" | "High" | "Medium";
type IncidentStatus = "Investigating" | "Open" | "Contained";

type Incident = {
  id: string;
  title: string;
  source: string;
  time: string;
  severity: Severity;
  status: IncidentStatus;
};

const navigation = [
  { label: "Overview", icon: Activity },
  { label: "Incidents", icon: Siren, count: "6" },
  { label: "Threat intel", icon: Globe2 },
  { label: "Assets", icon: Boxes },
  { label: "Vulnerabilities", icon: ShieldAlert, count: "12" },
  { label: "Reports", icon: FileSearch },
];

const initialIncidents: Incident[] = [
  {
    id: "INC-2847",
    title: "Unusual sign-in activity detected",
    source: "Identity · accounts.sparrowx.io",
    time: "2 min ago",
    severity: "Critical",
    status: "Investigating",
  },
  {
    id: "INC-2846",
    title: "Possible data exfiltration over DNS",
    source: "Network · 10.24.8.142",
    time: "18 min ago",
    severity: "High",
    status: "Open",
  },
  {
    id: "INC-2845",
    title: "Outdated OpenSSL on production host",
    source: "Vulnerability · prod-api-03",
    time: "41 min ago",
    severity: "High",
    status: "Open",
  },
  {
    id: "INC-2844",
    title: "Suspicious PowerShell execution",
    source: "Endpoint · FINANCE-LAPTOP-12",
    time: "1 hr ago",
    severity: "Medium",
    status: "Contained",
  },
  {
    id: "INC-2843",
    title: "New admin token used from unknown IP",
    source: "Identity · admin.sparrowx.io",
    time: "2 hrs ago",
    severity: "Medium",
    status: "Investigating",
  },
];

const riskPoints = [22, 28, 25, 34, 31, 45, 39, 44, 36, 50, 48, 58, 47, 54, 49, 65, 58, 69, 57, 64, 55, 71, 65, 76];
const chartPath = riskPoints
  .map((value, index) => `${index === 0 ? "M" : "L"} ${(index / (riskPoints.length - 1)) * 720} ${126 - value}`)
  .join(" ");

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "SparrowX | Security operations" },
      {
        name: "description",
        content: "A clear view of SparrowX security health, live incidents, and threat activity.",
      },
      { property: "og:title", content: "SparrowX | Security operations" },
      {
        property: "og:description",
        content: "A clear view of SparrowX security health, live incidents, and threat activity.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Dashboard,
});

function Dashboard() {
  const [incidents, setIncidents] = useState(initialIncidents);
  const [activeNav, setActiveNav] = useState("Overview");
  const [incidentFilter, setIncidentFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [range, setRange] = useState("24 hours");
  const [notice, setNotice] = useState("");
  const [menuOpen, setMenuOpen] = useState(false);

  const filteredIncidents = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();
    return incidents.filter((incident) => {
      const matchesFilter =
        incidentFilter === "All" ||
        incident.severity === incidentFilter ||
        incident.status === incidentFilter;
      const matchesSearch =
        !normalizedSearch ||
        `${incident.title} ${incident.id} ${incident.source}`.toLowerCase().includes(normalizedSearch);
      return matchesFilter && matchesSearch;
    });
  }, [incidents, incidentFilter, search]);

  const resolveIncident = (id: string) => {
    setIncidents((current) =>
      current.map((incident) =>
        incident.id === id ? { ...incident, status: "Contained" } : incident,
      ),
    );
    setNotice(`${id} marked as contained`);
    window.setTimeout(() => setNotice(""), 3000);
  };

  const exportIncidents = () => {
    const rows = [
      ["ID", "Incident", "Source", "Severity", "Status"],
      ...filteredIncidents.map((incident) => [incident.id, incident.title, incident.source, incident.severity, incident.status]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replaceAll('"', '""')}"`).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "sparrowx-incidents.csv";
    link.click();
    URL.revokeObjectURL(url);
    setNotice("Incident report exported");
    window.setTimeout(() => setNotice(""), 3000);
  };

  return (
    <SidebarProvider defaultOpen>
      <div className="min-h-svh w-full bg-background">
        <AppSidebar activeNav={activeNav} onNavigate={setActiveNav} />
        <SidebarInset className="min-h-svh bg-background">
          <header className="sticky top-0 z-20 flex h-16 items-center justify-between gap-4 border-b border-border bg-background/95 px-4 backdrop-blur-md sm:px-7">
            <div className="flex min-w-0 items-center gap-3">
              <SidebarTrigger aria-label="Toggle navigation" className="size-9" />
              <span className="hidden text-muted-foreground sm:block">Workspace</span>
              <span className="hidden text-muted-foreground/60 sm:block">/</span>
              <span className="truncate text-sm font-semibold text-foreground">{activeNav}</span>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="hidden h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-muted-foreground lg:flex">
                <Search className="size-4" />
                <input
                  aria-label="Search incidents"
                  className="w-36 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search anything..."
                  value={search}
                />
                <kbd className="rounded border border-border px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  <Command className="inline size-3" /> K
                </kbd>
              </div>
              <Button
                aria-label="Notifications"
                className="relative size-9"
                onClick={() => setNotice("You’re all caught up on notifications")}
                size="icon"
                variant="outline"
              >
                <Bell />
                <span className="absolute right-2 top-2 size-1.5 rounded-full bg-primary" />
              </Button>
              <button
                aria-label="Open workspace menu"
                className="flex size-9 items-center justify-center rounded-full border border-border bg-secondary text-xs font-bold text-secondary-foreground"
                onClick={() => setMenuOpen(!menuOpen)}
                type="button"
              >
                SX
              </button>
            </div>
          </header>

          {menuOpen && (
            <div className="absolute right-5 top-14 z-30 w-56 border border-border bg-card p-3 shadow-xl">
              <p className="text-sm font-semibold">SparrowX workspace</p>
              <p className="mt-1 text-xs text-muted-foreground">Security team · 8 members</p>
              <Button className="mt-3 w-full justify-start" onClick={() => setMenuOpen(false)} variant="secondary">
                <Users /> Team settings
              </Button>
            </div>
          )}

          <main className="mx-auto flex w-full max-w-[1480px] flex-col gap-6 px-4 py-7 sm:px-7 lg:px-9">
            <section className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <div className="mb-2 flex items-center gap-2 text-xs font-medium uppercase text-success">
                  <span className="size-2 animate-pulse rounded-full bg-success" />
                  All systems operational
                </div>
                <h1 className="text-2xl font-semibold text-foreground sm:text-[28px]">Security overview</h1>
                <p className="mt-1 text-sm text-muted-foreground">Your security posture at a glance.</p>
              </div>
              <div className="flex items-center gap-2 self-start sm:self-auto">
                <label className="sr-only" htmlFor="range-select">Time range</label>
                <select
                  className="h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  id="range-select"
                  onChange={(event) => setRange(event.target.value)}
                  value={range}
                >
                  <option>24 hours</option>
                  <option>7 days</option>
                  <option>30 days</option>
                </select>
                <Button onClick={() => setNotice("Security scan queued") }>
                  <Sparkles />
                  <span className="hidden sm:inline">Run a scan</span>
                  <span className="sm:hidden">Scan</span>
                </Button>
              </div>
            </section>

            <section aria-label="Security metrics" className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricCard icon={<ShieldCheck />} label="Security score" value="92" suffix="/ 100" change="+4.2%" trend="up" footnote="vs. last week" />
              <MetricCard icon={<Siren />} label="Open incidents" value="06" change="2 critical" trend="alert" footnote="Needs attention" />
              <MetricCard icon={<LockKeyhole />} label="Protected assets" value="248" change="+12" trend="up" footnote="this month" />
              <MetricCard icon={<Clock3 />} label="Mean response" value="14" suffix="min" change="−18%" trend="up" footnote="vs. last month" />
            </section>

            <section className="grid gap-4 xl:grid-cols-[minmax(0,1.65fr)_minmax(280px,0.85fr)]">
              <div className="min-w-0 border border-border bg-card p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-base font-semibold">Threat activity</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Events detected across your environment</p>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="size-2 rounded-full bg-primary" /> Threat events
                    <Button aria-label="Threat activity options" className="ml-1 size-8" size="icon" variant="ghost">
                      <Ellipsis />
                    </Button>
                  </div>
                </div>
                <div className="mt-3 flex items-baseline gap-2">
                  <span className="font-display text-3xl font-semibold">1,284</span>
                  <span className="inline-flex items-center text-xs font-medium text-destructive"><ArrowUpRight className="size-3.5" /> 12.8%</span>
                  <span className="text-xs text-muted-foreground">vs. previous period</span>
                </div>
                <div className="mt-3 w-full overflow-hidden">
                  <svg aria-label={`Threat activity trend over the last ${range}`} className="h-[170px] w-full overflow-visible text-primary" preserveAspectRatio="none" role="img" viewBox="0 0 720 140">
                    {[25, 58, 91, 124].map((y) => <line key={y} x1="0" x2="720" y1={y} y2={y} className="stroke-border" strokeDasharray="3 6" />)}
                    <path d={chartPath} fill="none" stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
                    <circle cx="720" cy={126 - (riskPoints.at(-1) ?? 0)} r="4.5" fill="currentColor" />
                  </svg>
                </div>
                <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
                  <span>{range === "24 hours" ? "12:00 AM" : range === "7 days" ? "Mon" : "Oct 1"}</span>
                  <span>{range === "24 hours" ? "6:00 AM" : range === "7 days" ? "Tue" : "Oct 8"}</span>
                  <span>{range === "24 hours" ? "12:00 PM" : range === "7 days" ? "Wed" : "Oct 15"}</span>
                  <span>{range === "24 hours" ? "6:00 PM" : range === "7 days" ? "Thu" : "Oct 22"}</span>
                  <span>Now</span>
                </div>
              </div>

              <div className="border border-border bg-card p-4 sm:p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-base font-semibold">Risk posture</h2>
                    <p className="mt-1 text-xs text-muted-foreground">Asset exposure by severity</p>
                  </div>
                  <Button aria-label="Risk posture details" className="size-8" size="icon" variant="ghost"><ArrowRight /></Button>
                </div>
                <div className="my-6 flex items-center gap-5">
                  <div className="relative grid size-28 shrink-0 place-items-center rounded-full" style={{ background: "conic-gradient(var(--color-destructive) 0% 8%, var(--color-primary) 8% 29%, var(--color-warning) 29% 58%, var(--color-success) 58% 100%)" }}>
                    <div className="grid size-[82px] place-items-center rounded-full bg-card">
                      <div className="text-center"><div className="font-display text-2xl font-semibold">92</div><div className="text-[10px] text-muted-foreground">/ 100 score</div></div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 text-xs">
                    <RiskLegend label="Critical" count="3" color="bg-destructive" />
                    <RiskLegend label="High" count="12" color="bg-primary" />
                    <RiskLegend label="Medium" count="28" color="bg-warning" />
                    <RiskLegend label="Low" count="91" color="bg-success" />
                  </div>
                </div>
                <div className="flex items-center justify-between border-t border-border pt-4 text-xs">
                  <span className="text-muted-foreground">Compared to last week</span>
                  <span className="inline-flex items-center gap-1 font-medium text-success"><ArrowDownRight className="size-3.5" /> Improving</span>
                </div>
              </div>
            </section>

            <section className="border border-border bg-card">
              <div className="flex flex-col gap-4 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-base font-semibold">Recent incidents</h2>
                    <span className="grid size-5 place-items-center rounded-full bg-secondary text-[10px] font-semibold text-secondary-foreground">{incidents.filter((item) => item.status !== "Contained").length}</span>
                  </div>
                  <p className="mt-1 text-xs text-muted-foreground">Review and respond to security events.</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <div className="flex items-center gap-1 rounded-md border border-border p-1">
                    {["All", "Critical", "High", "Medium"].map((filter) => (
                      <Button
                        aria-pressed={incidentFilter === filter}
                        className="h-7 px-2.5 text-xs"
                        key={filter}
                        onClick={() => setIncidentFilter(filter)}
                        size="sm"
                        variant={incidentFilter === filter ? "secondary" : "ghost"}
                      >{filter}</Button>
                    ))}
                  </div>
                  <Button aria-label="Filter incidents by status" className="size-9" onClick={() => setIncidentFilter(incidentFilter === "Open" ? "All" : "Open")} size="icon" variant="outline"><Filter /></Button>
                  <Button aria-label="Export incidents as CSV" className="size-9" onClick={exportIncidents} size="icon" variant="outline"><Download /></Button>
                </div>
              </div>
              <div className="divide-y divide-border">
                {filteredIncidents.length > 0 ? filteredIncidents.map((incident) => (
                  <article className="flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5" key={incident.id}>
                    <div className="flex min-w-0 items-start gap-3">
                      <span className={`mt-1.5 size-2 shrink-0 rounded-full ${incident.severity === "Critical" ? "bg-destructive" : incident.severity === "High" ? "bg-primary" : "bg-warning"}`} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <h3 className="text-sm font-medium">{incident.title}</h3>
                          <SeverityTag severity={incident.severity} />
                        </div>
                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                          <span>{incident.id}</span><span aria-hidden="true">·</span><span>{incident.source}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-3 pl-5 sm:justify-end sm:pl-0">
                      <span className="whitespace-nowrap text-xs text-muted-foreground">{incident.time}</span>
                      <StatusTag status={incident.status} />
                      {incident.status !== "Contained" ? (
                        <Button aria-label={`Mark ${incident.id} as contained`} className="h-8 px-3 text-xs" onClick={() => resolveIncident(incident.id)} size="sm" variant="outline">
                          <Check /> Contain
                        </Button>
                      ) : (
                        <Button aria-label={`${incident.id} contained`} className="size-8 text-success" disabled size="icon" variant="ghost"><Check /></Button>
                      )}
                    </div>
                  </article>
                )) : (
                  <div className="px-5 py-12 text-center">
                    <Search className="mx-auto size-5 text-muted-foreground" />
                    <p className="mt-3 text-sm font-medium">No matching incidents</p>
                    <p className="mt-1 text-xs text-muted-foreground">Adjust your search or choose another severity.</p>
                  </div>
                )}
              </div>
              <div className="flex items-center justify-between border-t border-border px-4 py-3 text-xs sm:px-5">
                <span className="text-muted-foreground">Showing {filteredIncidents.length} of {incidents.length} recent incidents</span>
                <Button className="h-8 px-2 text-xs" onClick={() => { setIncidentFilter("All"); setSearch(""); setActiveNav("Incidents"); }} variant="ghost">View all incidents <ArrowRight /></Button>
              </div>
            </section>

            <section className="grid gap-3 pb-4 sm:grid-cols-3">
              <SignalItem icon={<Globe2 />} label="Threat intelligence" detail="Feeds up to date" state="Operational" />
              <SignalItem icon={<Layers3 />} label="Endpoint protection" detail="248 devices protected" state="Healthy" />
              <SignalItem icon={<CircleHelp />} label="Need a hand?" detail="Your security team is here" state="Contact support" />
            </section>
          </main>

          {notice && (
            <div className="fixed bottom-5 right-5 z-50 flex max-w-[calc(100vw-2.5rem)] items-center gap-3 border border-border bg-popover px-4 py-3 text-sm text-popover-foreground shadow-lg" role="status">
              <Check className="size-4 shrink-0 text-success" />
              <span>{notice}</span>
              <Button aria-label="Dismiss notification" className="ml-1 size-7" onClick={() => setNotice("")} size="icon" variant="ghost"><X /></Button>
            </div>
          )}
        </SidebarInset>
      </div>
    </SidebarProvider>
  );
}

function AppSidebar({ activeNav, onNavigate }: { activeNav: string; onNavigate: (label: string) => void }) {
  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      <SidebarHeader className="px-4 pb-3 pt-5">
        <div className="flex items-center gap-3 px-1">
          <div className="grid size-9 shrink-0 place-items-center rounded-md bg-primary text-primary-foreground"><ShieldCheck className="size-5" /></div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden">
            <div className="font-display text-base font-semibold">sparrow<span className="text-primary">x</span></div>
            <div className="text-[10px] uppercase text-muted-foreground">Security platform</div>
          </div>
          <Button aria-label="Workspace options" className="ml-auto size-8 group-data-[collapsible=icon]:hidden" size="icon" variant="ghost"><ChevronDown /></Button>
        </div>
        <div className="mt-4 flex items-center gap-2 rounded-md border border-sidebar-border bg-sidebar-accent/40 px-3 py-2 group-data-[collapsible=icon]:hidden">
          <span className="size-2 rounded-full bg-success" />
          <span className="text-xs font-medium">Production</span>
          <span className="ml-auto text-[10px] text-muted-foreground">LIVE</span>
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Workspace</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map(({ label, icon: Icon, count }) => (
                <SidebarMenuItem key={label}>
                  <SidebarMenuButton
                    isActive={activeNav === label}
                    onClick={() => onNavigate(label)}
                    tooltip={label}
                  >
                    <Icon />
                    <span>{label}</span>
                    {count && <SidebarMenuBadge>{count}</SidebarMenuBadge>}
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <SidebarGroup className="mt-2">
          <SidebarGroupLabel>Manage</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => onNavigate("Team & access")} tooltip="Team & access"><Users /><span>Team & access</span></SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton onClick={() => onNavigate("Integrations")} tooltip="Integrations"><Boxes /><span>Integrations</span></SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
        <div className="mx-4 mt-4 border-t border-sidebar-border group-data-[collapsible=icon]:mx-2" />
        <div className="mx-3 mt-3 border border-sidebar-border bg-sidebar-accent/35 p-3 group-data-[collapsible=icon]:hidden">
          <div className="flex items-center gap-2 text-xs font-medium"><Sparkles className="size-3.5 text-primary" /> Security health</div>
          <div className="mt-3 flex items-end justify-between"><span className="font-display text-2xl font-semibold">92<span className="text-sm text-muted-foreground">/100</span></span><span className="text-[10px] text-success">+4.2%</span></div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary"><div className="h-full w-[92%] rounded-full bg-primary" /></div>
          <div className="mt-2 text-[10px] text-muted-foreground">Your environment is looking good.</div>
        </div>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => onNavigate("Help center")} tooltip="Help center"><CircleHelp /><span>Help center</span></SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={() => onNavigate("Settings")} tooltip="Settings"><Menu /><span>Settings</span></SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        <div className="mt-2 flex items-center gap-2 border-t border-sidebar-border px-1 pt-3 group-data-[collapsible=icon]:justify-center">
          <div className="grid size-8 shrink-0 place-items-center rounded-full bg-secondary text-[10px] font-semibold">JD</div>
          <div className="min-w-0 group-data-[collapsible=icon]:hidden"><div className="truncate text-xs font-medium">Jordan Davis</div><div className="text-[10px] text-muted-foreground">Security admin</div></div>
          <Button aria-label="Account menu" className="ml-auto size-7 group-data-[collapsible=icon]:hidden" size="icon" variant="ghost"><Ellipsis /></Button>
        </div>
      </SidebarFooter>
    </Sidebar>
  );
}

function MetricCard({ icon, label, value, suffix, change, trend, footnote }: { icon: React.ReactNode; label: string; value: string; suffix?: string; change: string; trend: "up" | "alert"; footnote: string }) {
  return (
    <article className="border border-border bg-card p-4 sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted-foreground">{label}</span>
        <span className="grid size-8 place-items-center rounded-md bg-secondary text-muted-foreground [&_svg]:size-4">{icon}</span>
      </div>
      <div className="mt-4 flex items-baseline gap-1.5">
        <span className="font-display text-3xl font-semibold">{value}</span>
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className={`font-semibold ${trend === "alert" ? "text-destructive" : "text-success"}`}>{change}</span>
        <span className="text-muted-foreground">{footnote}</span>
      </div>
    </article>
  );
}

function RiskLegend({ label, count, color }: { label: string; count: string; color: string }) {
  return <div className="flex min-w-28 items-center gap-2"><span className={`size-2 rounded-full ${color}`} /><span className="text-muted-foreground">{label}</span><span className="ml-auto font-medium text-foreground">{count}</span></div>;
}

function SeverityTag({ severity }: { severity: Severity }) {
  const style = severity === "Critical" ? "border-destructive/30 bg-destructive/10 text-destructive" : severity === "High" ? "border-primary/30 bg-primary/10 text-primary" : "border-warning/30 bg-warning/10 text-warning";
  return <span className={`rounded-sm border px-1.5 py-0.5 text-[10px] font-semibold ${style}`}>{severity}</span>;
}

function StatusTag({ status }: { status: IncidentStatus }) {
  const style = status === "Contained" ? "border-success/30 bg-success/10 text-success" : status === "Investigating" ? "border-info/30 bg-info/10 text-info" : "border-border bg-secondary text-muted-foreground";
  return <span className={`min-w-[91px] rounded-sm border px-2 py-1 text-center text-[10px] font-medium ${style}`}>{status}</span>;
}

function SignalItem({ icon, label, detail, state }: { icon: React.ReactNode; label: string; detail: string; state: string }) {
  return (
    <article className="flex items-center gap-3 border border-border bg-card p-4">
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-secondary text-muted-foreground [&_svg]:size-4">{icon}</span>
      <div className="min-w-0 flex-1"><div className="truncate text-xs font-medium">{label}</div><div className="mt-1 truncate text-[10px] text-muted-foreground">{detail}</div></div>
      <span className="hidden items-center gap-1 text-[10px] text-success sm:flex"><span className="size-1.5 rounded-full bg-success" />{state}</span>
    </article>
  );
}