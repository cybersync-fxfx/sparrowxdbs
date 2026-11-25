(function () {
  if (typeof window === "undefined" || window.__spxPteroBridgeLoaded) return;
  window.__spxPteroBridgeLoaded = true;

  const THEME_GUIDES = {
    minecraft: {
      badge: "Minecraft Mode",
      title: "Paper / Purpur Quick Setup",
      body: "Tip: Ensure eula=true is accepted on first boot, keep view-distance at 8–10 for 20.0 TPS, and install plugins from your SparrowX Dashboard Plugin Manager.",
    },
    fivem: {
      badge: "FiveM RP Mode",
      title: "txAdmin & OneSync Ready",
      body: "Tip: Paste your Cfx.re sv_licenseKey in Startup Variables, enable OneSync Infinity, and open the txAdmin port shown in Console.",
    },
    samp: {
      badge: "SA-MP / open.mp Mode",
      title: "Pawn & open.mp Setup",
      body: "Tip: Upload your compiled .amx gamemode to /gamemodes, verify plugins in server.cfg or config.json, and bind your SparrowX MySQL DB.",
    },
    discord: {
      badge: "Discord Bot Mode",
      title: "24/7 Bot Node Ready",
      body: "Tip: Add your DISCORD_TOKEN in Startup Variables or .env, confirm package.json / requirements.txt is uploaded, and hit Start for zero-sleep uptime.",
    },
    default: {
      badge: "SparrowX Panel",
      title: "Midnight Dark Panel Active",
      body: "Your server runs on SparrowX NVMe Gen4 hardware with L4/L7 DDoS protection. Need help configuring? Use the AI Config Helper in your Client Dashboard.",
    },
  };

  // Zero-reflow theme detection: uses textContent on small header nodes only (never innerText)
  function detectThemeFromPage() {
    const header = document.querySelector("h1, h2, [class*='SubNavigation']");
    const sample = ((document.title || "") + " " + (header ? header.textContent || "" : "")).toLowerCase();
    if (/\b(minecraft|paper|purpur|forge|fabric|spigot|velocity|bedrock)\b/.test(sample)) return "minecraft";
    if (/\b(fivem|txadmin|cfx|onesync|qbcore|esx)\b/.test(sample)) return "fivem";
    if (/\b(sa-mp|samp|open\.mp|pawn)\b/.test(sample)) return "samp";
    if (/\b(discord|bot|node\.js|python|lavalink)\b/.test(sample)) return "discord";
    return "default";
  }

  let toastTimer = null;
  function showToast(guide) {
    let root = document.getElementById("spx-ptero-toast-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "spx-ptero-toast-root";
      document.body.appendChild(root);
    }
    root.textContent = "";
    const el = document.createElement("div");
    el.className = "spx-ptero-toast";
    const head = document.createElement("div");
    head.className = "spx-ptero-toast-head";
    const titleSpan = document.createElement("span");
    titleSpan.textContent = String(guide.title || "");
    const badgeSpan = document.createElement("span");
    badgeSpan.className = "spx-ptero-toast-badge";
    badgeSpan.textContent = String(guide.badge || "");
    const closeBtn = document.createElement("button");
    closeBtn.className = "spx-ptero-toast-close";
    closeBtn.setAttribute("aria-label", "Dismiss");
    closeBtn.textContent = "\u00d7";
    closeBtn.addEventListener("click", () => el.remove(), { once: true });
    head.appendChild(titleSpan);
    head.appendChild(badgeSpan);
    head.appendChild(closeBtn);
    const bodyDiv = document.createElement("div");
    bodyDiv.textContent = String(guide.body || "");
    el.appendChild(head);
    el.appendChild(bodyDiv);
    root.appendChild(el);
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.remove(), 12000);
  }

  let lastTheme = "";
  let lastPath = "";
  let scheduled = null;

  function syncTheme() {
    const path = window.location.pathname;
    const theme = detectThemeFromPage();
    if (theme !== lastTheme) {
      lastTheme = theme;
      if (theme === "default") {
        document.documentElement.removeAttribute("data-spx-theme");
      } else {
        document.documentElement.setAttribute("data-spx-theme", theme);
      }
    }
    if (path !== lastPath && path.startsWith("/server/")) {
      lastPath = path;
      showToast(THEME_GUIDES[theme] || THEME_GUIDES.default);
    } else if (!path.startsWith("/server/")) {
      lastPath = path;
    }
  }

  function scheduleSync() {
    if (scheduled) clearTimeout(scheduled);
    scheduled = setTimeout(() => {
      scheduled = null;
      if (typeof window.requestIdleCallback === "function") {
        window.requestIdleCallback(syncTheme, { timeout: 600 });
      } else {
        syncTheme();
      }
    }, 350);
  }

  // Hook SPA navigation only (zero MutationObserver overhead on live console output)
  const origPush = history.pushState;
  const origReplace = history.replaceState;
  history.pushState = function () {
    const res = origPush.apply(this, arguments);
    scheduleSync();
    return res;
  };
  history.replaceState = function () {
    const res = origReplace.apply(this, arguments);
    scheduleSync();
    return res;
  };
  window.addEventListener("popstate", scheduleSync, { passive: true });
  scheduleSync();
})();
