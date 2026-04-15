/* Admin dashboard — password-gated, reads visit data from localStorage
 * and (if configured) from a deployed Cloudflare Worker backend. */

(() => {
  /* ---------- Configuration ---------- */
  // SHA-256 hex of the admin password. Change by editing this line AND
  // secrets/ADMIN_CREDENTIALS.md.
  // Current password is stored in secrets/ADMIN_CREDENTIALS.md (gitignored).
  const ADMIN_PW_HASH =
    "d09384d581b48fcd8de4c7bcbd5bad408ce634132a7d8e642f929fee9cd4955d";

  // Optional: set BEFORE this script loads (or in admin/admin.local.js) to
  // pull aggregated data from the Cloudflare Worker.
  //   window.PG_ANALYTICS_BACKEND = "https://pg-analytics.<you>.workers.dev";
  //   window.PG_ANALYTICS_ADMIN_TOKEN = "<wrangler secret value>";
  const backend = window.PG_ANALYTICS_BACKEND || null;
  const adminToken = window.PG_ANALYTICS_ADMIN_TOKEN || null;

  const SESSION_KEY = "pg-admin-session";
  const VISITS_LOCAL_KEY = "pg-visits";

  /* ---------- DOM refs ---------- */
  const $ = (id) => document.getElementById(id);
  const gate = $("gate");
  const dash = $("dash");
  const loginForm = $("loginForm");
  const pwInput = $("pw");
  const pwError = $("pwError");

  /* ---------- Hashing ---------- */
  const sha256 = async (s) => {
    const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
    return Array.from(new Uint8Array(buf))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  };

  /* ---------- Gate ---------- */
  const showDash = () => {
    gate.hidden = true;
    dash.hidden = false;
    document.body.classList.add("is-authed");
    render();
    wireActions();
  };

  // Show/hide password toggle
  const showBtn = document.getElementById("pwShow");
  if (showBtn) {
    showBtn.addEventListener("click", () => {
      const isPw = pwInput.type === "password";
      pwInput.type = isPw ? "text" : "password";
      showBtn.textContent = isPw ? "hide" : "show";
      pwInput.focus();
    });
  }

  // Auto-restore session
  (async () => {
    const saved = sessionStorage.getItem(SESSION_KEY);
    if (saved && saved === ADMIN_PW_HASH) showDash();
  })();

  // Normalize input: strip leading/trailing whitespace + Unicode NFC so that
  // stray copy-paste spaces or IME-inserted full-width chars don't silently
  // fail. We do NOT modify the password itself — the hash is still the hash
  // of the original password string.
  const normalize = (s) => {
    try { return String(s).normalize("NFC").trim(); }
    catch { return String(s).trim(); }
  };

  loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    pwError.hidden = true;
    const pw = normalize(pwInput.value);
    if (!pw) { pwError.hidden = false; pwInput.focus(); return; }
    const hash = await sha256(pw);
    if (hash === ADMIN_PW_HASH) {
      sessionStorage.setItem(SESSION_KEY, hash);
      pwInput.value = "";
      showDash();
    } else {
      pwError.hidden = false;
      pwInput.select();
    }
  });

  /* ---------- Actions ---------- */
  const wireActions = () => {
    $("refreshBtn").onclick = () => render();
    $("logoutBtn").onclick = () => {
      sessionStorage.removeItem(SESSION_KEY);
      location.reload();
    };
    $("clearBtn").onclick = () => {
      if (!confirm("Clear ALL locally-stored visits from this browser?")) return;
      localStorage.removeItem(VISITS_LOCAL_KEY);
      render();
    };
    $("exportBtn").onclick = async () => {
      const data = await loadVisits();
      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `pg-visits-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    };
  };

  /* ---------- Data loading ---------- */
  const loadLocal = () => {
    try {
      return JSON.parse(localStorage.getItem(VISITS_LOCAL_KEY) || "[]");
    } catch {
      return [];
    }
  };

  const loadBackend = async () => {
    if (!backend) return null;
    const url = backend.replace(/\/$/, "") + "/visits";
    try {
      const r = await fetch(url, {
        headers: adminToken ? { "X-Admin-Token": adminToken } : {},
        cache: "no-store",
      });
      if (!r.ok) return null;
      return await r.json();
    } catch {
      return null;
    }
  };

  const loadVisits = async () => {
    const local = loadLocal();
    const remote = await loadBackend();
    if (remote && Array.isArray(remote)) {
      // Merge, dedupe by visit.id
      const byId = new Map();
      [...local, ...remote].forEach((v) => {
        if (v && v.id) byId.set(v.id, v);
      });
      return Array.from(byId.values()).sort((a, b) =>
        (b.ts || "").localeCompare(a.ts || "")
      );
    }
    return local.slice().sort((a, b) => (b.ts || "").localeCompare(a.ts || ""));
  };

  /* ---------- Rendering helpers ---------- */
  const uniqueBy = (arr, key) => {
    const s = new Set();
    arr.forEach((v) => { if (v?.[key]) s.add(v[key]); });
    return s;
  };

  const countBy = (arr, fn) => {
    const m = new Map();
    arr.forEach((v) => {
      const k = fn(v);
      if (k == null || k === "") return;
      m.set(k, (m.get(k) || 0) + 1);
    });
    return Array.from(m.entries()).sort((a, b) => b[1] - a[1]);
  };

  const hostname = (url) => {
    if (!url) return null;
    try { return new URL(url).hostname; } catch { return url; }
  };

  const fmtDate = (iso) => {
    if (!iso) return "—";
    try {
      const d = new Date(iso);
      return (
        d.getFullYear() +
        "-" + String(d.getMonth() + 1).padStart(2, "0") +
        "-" + String(d.getDate()).padStart(2, "0") +
        " " + String(d.getHours()).padStart(2, "0") +
        ":" + String(d.getMinutes()).padStart(2, "0")
      );
    } catch { return iso; }
  };

  const parseUA = (ua) => {
    if (!ua) return { browser: "Unknown", os: "Unknown" };
    const b =
      /Edg\/[\d.]+/.test(ua) ? "Edge"
      : /OPR\/[\d.]+/.test(ua) ? "Opera"
      : /Firefox\/[\d.]+/.test(ua) ? "Firefox"
      : /Chrome\/[\d.]+/.test(ua) ? "Chrome"
      : /Safari\/[\d.]+/.test(ua) ? "Safari"
      : "Other";
    const o =
      /Windows/.test(ua) ? "Windows"
      : /Mac OS X|Macintosh/.test(ua) ? "macOS"
      : /Android/.test(ua) ? "Android"
      : /iPhone|iPad|iOS/.test(ua) ? "iOS"
      : /Linux/.test(ua) ? "Linux"
      : "Other";
    return { browser: b, os: o };
  };

  const escapeHtml = (s) =>
    String(s ?? "")
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;").replace(/'/g, "&#039;");

  const shortId = (s) => (s ? String(s).slice(0, 8) : "—");

  /* ---------- Renderers ---------- */
  const renderKpis = (visits) => {
    const now = Date.now();
    const DAY = 24 * 3600 * 1000;
    const totalVisitors = uniqueBy(visits, "visitor").size;
    const sessions = uniqueBy(visits, "session").size;

    // Repeat: visitors whose visits span more than one session
    const byVisitor = new Map();
    visits.forEach((v) => {
      if (!v.visitor) return;
      const set = byVisitor.get(v.visitor) || new Set();
      if (v.session) set.add(v.session);
      byVisitor.set(v.visitor, set);
    });
    let repeatVisitors = 0;
    byVisitor.forEach((sessSet) => {
      if (sessSet.size > 1) repeatVisitors++;
    });

    const today = new Date(); today.setHours(0, 0, 0, 0);
    const countSince = (cutoff) =>
      visits.filter((v) => v.ts && Date.parse(v.ts) >= cutoff).length;

    $("kpiTotal").textContent     = visits.length.toLocaleString();
    $("kpiVisitors").textContent  = totalVisitors.toLocaleString();
    $("kpiSessions").textContent  = sessions.toLocaleString();
    $("kpiRepeat").textContent    = repeatVisitors.toLocaleString();
    $("kpiToday").textContent     = countSince(today.getTime()).toLocaleString();
    $("kpi7d").textContent        = countSince(now - 7 * DAY).toLocaleString();
    $("kpi30d").textContent       = countSince(now - 30 * DAY).toLocaleString();
    $("kpiCountries").textContent = uniqueBy(visits, "country").size.toLocaleString();
  };

  const renderDailyChart = (visits) => {
    const el = $("dailyChart");
    const N = 30;
    const buckets = [];
    const now = new Date(); now.setHours(0, 0, 0, 0);
    for (let i = N - 1; i >= 0; i--) {
      const d = new Date(now.getTime() - i * 86400000);
      buckets.push({
        key: d.toISOString().slice(0, 10),
        label: String(d.getMonth() + 1).padStart(2, "0") + "/" + String(d.getDate()).padStart(2, "0"),
        count: 0,
      });
    }
    const idx = new Map(buckets.map((b, i) => [b.key, i]));
    visits.forEach((v) => {
      if (!v.ts) return;
      const day = new Date(v.ts);
      day.setHours(0, 0, 0, 0);
      const k = day.toISOString().slice(0, 10);
      const i = idx.get(k);
      if (i != null) buckets[i].count++;
    });
    const max = Math.max(1, ...buckets.map((b) => b.count));
    const rendered = buckets.map((b) => {
      const h = (b.count / max) * 100;
      return `
        <div class="bar-col" title="${b.label}: ${b.count}">
          <span class="bar-tip">${b.label} — ${b.count}</span>
          <span class="bar-bar" style="height:${h.toFixed(1)}%"></span>
          <span class="bar-x">${b.label}</span>
        </div>`;
    }).join("");
    if (buckets.every((b) => b.count === 0)) {
      el.innerHTML = `<div class="bar-chart-empty">No visits in the last ${N} days.</div>`;
    } else {
      el.innerHTML = rendered;
    }
  };

  const renderRanked = (targetId, rows, { emptyMsg = "No data." } = {}) => {
    const el = $(targetId);
    if (!rows.length) {
      el.innerHTML = `<div class="ranked-empty">${emptyMsg}</div>`;
      return;
    }
    const max = rows[0][1];
    el.innerHTML = rows
      .slice(0, 8)
      .map(([label, n], i) => {
        const pct = (n / max) * 100;
        return `
          <div class="ranked-row">
            <span class="rk">${i + 1}</span>
            <span class="lbl">
              ${escapeHtml(label)}
              <span class="lbl-bar" style="width:${pct.toFixed(1)}%"></span>
            </span>
            <span class="val">${n}</span>
          </div>`;
      })
      .join("");
  };

  const renderCountries = (visits) => {
    const rows = countBy(visits, (v) =>
      v.country || v.countryCode || (v.country_cf ? v.country_cf : null)
    );
    renderRanked("countriesList", rows, { emptyMsg: "No country data yet." });
  };

  const renderReferrers = (visits) => {
    const rows = countBy(visits, (v) => hostname(v.referrer) || "(direct)");
    renderRanked("referrersList", rows, { emptyMsg: "No referrer data yet." });
  };

  const renderDevices = (visits) => {
    const rows = countBy(visits, (v) => {
      const { browser, os } = parseUA(v.ua);
      return `${browser} · ${os}`;
    });
    renderRanked("devicesList", rows, { emptyMsg: "No device data yet." });
  };

  const renderTable = (visits) => {
    const tbody = $("visitsBody");
    const sub = $("recentSub");
    sub.textContent = visits.length
      ? `showing ${Math.min(100, visits.length)} of ${visits.length}`
      : "—";
    if (!visits.length) {
      tbody.innerHTML = `<tr><td colspan="9" class="empty">No visits recorded on this browser yet. Open the site in a new tab to generate one.</td></tr>`;
      return;
    }
    tbody.innerHTML = visits
      .slice(0, 100)
      .map((v) => {
        const ref = hostname(v.referrer) || "(direct)";
        const ispAsn = v.isp || v.org || v.asn || "—";
        return `
          <tr>
            <td>${escapeHtml(fmtDate(v.ts))}</td>
            <td class="mono">${escapeHtml(v.ip || v.ip_cf || "—")}</td>
            <td>${escapeHtml(v.country || v.country_cf || "—")}</td>
            <td>${escapeHtml(v.city || "—")}</td>
            <td class="dim">${escapeHtml(ispAsn)}</td>
            <td class="mono">${escapeHtml(v.path || "/")}</td>
            <td class="dim">${escapeHtml(ref)}</td>
            <td><span class="tag">${shortId(v.session)}</span></td>
            <td><span class="tag">${shortId(v.visitor)}</span></td>
          </tr>`;
      })
      .join("");
  };

  const setMeta = (visits) => {
    $("dataSource").textContent = backend
      ? "Cloudflare Worker + localStorage"
      : "localStorage only";
    $("srcTxt").textContent = backend ? "worker+localStorage" : "localStorage";
    $("lastSync").textContent = visits.length
      ? `latest visit · ${fmtDate(visits[0].ts)}`
      : "no visits yet";
  };

  /* ---------- Main render ---------- */
  const render = async () => {
    const visits = await loadVisits();
    setMeta(visits);
    renderKpis(visits);
    renderDailyChart(visits);
    renderCountries(visits);
    renderReferrers(visits);
    renderDevices(visits);
    renderTable(visits);
  };
})();
