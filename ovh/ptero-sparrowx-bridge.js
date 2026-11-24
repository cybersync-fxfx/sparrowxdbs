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

  function detectThemeFromPage() {
    const text = (document.title + " " + (document.body?.innerText?.slice(0, 1200) || "")).toLowerCase();
    if (/\b(minecraft|paper|purpur|forge|fabric|spigot|velocity|bedrock)\b/.test(text)) return "minecraft";
    if (/\b(fivem|txadmin|cfx|onesync|qbcore|esx)\b/.test(text)) return "fivem";
    if (/\b(sa-mp|samp|open\.mp|pawn)\b/.test(text)) return "samp";
    if (/\b(discord|bot|node\.js|python|lavalink)\b/.test(text)) return "discord";
    return "default";
  }

  function showToast(guide) {
    let root = document.getElementById("spx-ptero-toast-root");
    if (!root) {
      root = document.createElement("div");
      root.id = "spx-ptero-toast-root";
      document.body.appendChild(root);
    }
    root.innerHTML = "";
    const el = document.createElement("div");
    el.className = "spx-ptero-toast";
    el.innerHTML = `
      <div class="spx-ptero-toast-head">
        <span>${guide.title}</span>
        <span class="spx-ptero-toast-badge">${guide.badge}</span>
        <button class="spx-ptero-toast-close" aria-label="Dismiss">&times;</button>
      </div>
      <div>${guide.body}</div>
    `;
    el.querySelector(".spx-ptero-toast-close")?.addEventListener("click", () => el.remove());
    root.appendChild(el);
    setTimeout(() => el.remove(), 14000);
  }

  let lastTheme = "";
  function syncTheme() {
    const theme = detectThemeFromPage();
    if (theme !== lastTheme) {
      lastTheme = theme;
      if (theme === "default") {
        document.documentElement.removeAttribute("data-spx-theme");
      } else {
        document.documentElement.setAttribute("data-spx-theme", theme);
      }
      if (window.location.pathname.startsWith("/server/")) {
        showToast(THEME_GUIDES[theme] || THEME_GUIDES.default);
      }
    }
  }

  setTimeout(syncTheme, 900);
  const mo = new MutationObserver(() => syncTheme());
  if (document.body) {
    mo.observe(document.body, { childList: true, subtree: true });
  }
})();
