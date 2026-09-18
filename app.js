/**
 * IFSC Code Lookup
 * Author: Jaimin Barot
 * License: MIT
 * Data source: https://ifsc.razorpay.com/ (public, CORS-enabled)
 */

(() => {
  "use strict";

  // ---------- Config ----------
  const API_BASE   = "https://ifsc.razorpay.com/";
  const IFSC_REGEX = /^[A-Z]{4}0[A-Z0-9]{6}$/;
  const RECENT_KEY = "ifsc.recent.v1";
  const THEME_KEY  = "ifsc.theme";
  const MAX_RECENT = 6;
  const REQUEST_TIMEOUT_MS = 12000;

  // ---------- DOM ----------
  const $ = (sel) => document.querySelector(sel);

  const form       = $("#lookup-form");
  const input      = $("#ifsc-input");
  const button     = $("#search-btn");
  const statusEl   = $("#status");
  const resultEl   = $("#result");
  const recentEl   = $("#recent");
  const themeBtn   = $("#theme-toggle");
  const yearEl     = $("#year");

  // ---------- Theme ----------
  const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
  const savedTheme  = localStorage.getItem(THEME_KEY);
  applyTheme(savedTheme || (prefersDark ? "dark" : "light"));

  function applyTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    if (themeBtn) themeBtn.textContent = theme === "dark" ? "☀️" : "🌙";
    localStorage.setItem(THEME_KEY, theme);
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0b1220" : "#2563eb");
  }

  themeBtn?.addEventListener("click", () => {
    const current = document.documentElement.getAttribute("data-theme");
    applyTheme(current === "dark" ? "light" : "dark");
  });

  // ---------- Year ----------
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  // ---------- Utilities ----------
  const escapeHtml = (s) =>
    String(s).replace(/[&<>"']/g, (c) => (
      { "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[c]
    ));

  function setStatus(message, kind = "loading") {
    if (!message) {
      statusEl.hidden = true;
      statusEl.textContent = "";
      statusEl.className = "status";
      return;
    }
    statusEl.textContent = message;
    statusEl.className = `status ${kind}`;
    statusEl.hidden = false;
  }

  function setLoading(loading) {
    button.disabled = loading;
    button.textContent = loading ? "Searching…" : "Search";
    input.setAttribute("aria-busy", String(loading));
  }

  function normalizeIfsc(v) {
    return (v || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 11);
  }

  // ---------- Recent searches ----------
  function getRecent() {
    try { return JSON.parse(localStorage.getItem(RECENT_KEY) || "[]"); }
    catch { return []; }
  }

  function saveRecent(code) {
    const list = getRecent().filter((c) => c !== code);
    list.unshift(code);
    localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
    renderRecent();
  }

  function renderRecent() {
    if (!recentEl) return;
    const list = getRecent();
    if (!list.length) { recentEl.innerHTML = ""; return; }

    recentEl.innerHTML =
      `<span>Recent:</span> ` +
      list.map((c) =>
        `<a href="#${encodeURIComponent(c)}" data-code="${escapeHtml(c)}" rel="nofollow">${escapeHtml(c)}</a>`
      ).join(" ");

    recentEl.querySelectorAll("a[data-code]").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        input.value = a.dataset.code;
        form.requestSubmit();
      });
    });
  }

  // ---------- Fetch with timeout ----------
  async function fetchIfsc(code, signal) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

    // Combine external signal (if any) with timeout
    if (signal) signal.addEventListener("abort", () => controller.abort(), { once: true });

    try {
      const res = await fetch(API_BASE + encodeURIComponent(code), {
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      if (res.status === 404) return { notFound: true };
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return { data: await res.json() };
    } finally {
      clearTimeout(timeout);
    }
  }

  // ---------- Rendering ----------
  function bankInitials(bankName) {
    return (bankName || "?")
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  }

  function row(label, value) {
    if (!value && value !== 0) return "";
    return `<tr><th scope="row">${escapeHtml(label)}</th><td>${escapeHtml(String(value))}</td></tr>`;
  }

  function pill(label, enabled) {
    const cls = enabled ? "yes" : "no";
    const txt = enabled ? "Supported" : "Not supported";
    return `<tr><th scope="row">${escapeHtml(label)}</th>
      <td><span class="pill ${cls}">${txt}</span></td></tr>`;
  }

  function renderResult(d) {
    const rows = [
      row("Bank", d.BANK),
      row("Branch", d.BRANCH),
      row("Centre", d.CENTRE),
      row("District", d.DISTRICT),
      row("City", d.CITY),
      row("State", d.STATE),
      row("Address", d.ADDRESS),
      row("Contact", d.CONTACT),
      row("MICR", d.MICR),
      row("SWIFT", d.SWIFT),
    ].join("");

    const paymentRows = [
      pill("RTGS", !!d.RTGS),
      pill("NEFT", !!d.NEFT),
      pill("IMPS", !!d.IMPS),
      pill("UPI",  !!d.UPI),
    ].join("");

    const safeIfsc   = escapeHtml(d.IFSC || "");
    const safeBank   = escapeHtml(d.BANK || "");
    const safeBranch = escapeHtml(d.BRANCH || "");

    resultEl.innerHTML = `
      <div class="result-header">
        <div class="bank-logo" aria-hidden="true">${escapeHtml(bankInitials(d.BANK))}</div>
        <div class="titles">
          <h2>${safeBank || "Bank"} — ${safeBranch || "Branch"}</h2>
          <span class="ifsc-badge">${safeIfsc}</span>
        </div>
        <button class="copy-btn" type="button" data-copy="${safeIfsc}">Copy IFSC</button>
      </div>
      <table>
        <caption class="sr-only">Bank branch details</caption>
        <tbody>${rows}</tbody>
      </table>
      <table>
        <caption class="sr-only">Payment mode support</caption>
        <tbody>${paymentRows}</tbody>
      </table>
    `;

    resultEl.hidden = false;

    const copyBtn = resultEl.querySelector(".copy-btn");
    copyBtn?.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(d.IFSC || "");
        copyBtn.textContent = "Copied!";
        setTimeout(() => (copyBtn.textContent = "Copy IFSC"), 1400);
      } catch {
        copyBtn.textContent = "Copy failed";
        setTimeout(() => (copyBtn.textContent = "Copy IFSC"), 1400);
      }
    });
  }

  // ---------- Main lookup ----------
  async function lookup(rawCode) {
    const code = normalizeIfsc(rawCode);

    input.value = code;
    input.classList.remove("is-invalid");
    resultEl.hidden = true;

    if (!code) {
      setStatus("Please enter an IFSC code.", "error");
      input.focus();
      return;
    }

    if (!IFSC_REGEX.test(code)) {
      input.classList.add("is-invalid");
      setStatus("Invalid IFSC format. Example: HDFC0000001", "error");
      input.focus();
      return;
    }

    setStatus(`Looking up ${code}…`, "loading");
    setLoading(true);

    try {
      const { data, notFound } = await fetchIfsc(code);

      if (notFound) {
        setStatus(`No bank found for IFSC ${code}.`, "error");
        return;
      }

      renderResult(data);
      saveRecent(data.IFSC || code);
      setStatus(""); // clear status on success
    } catch (err) {
      const msg =
        err.name === "AbortError"
          ? "Request timed out. Please try again."
          : `Network error: ${err.message}`;
      setStatus(msg, "error");
    } finally {
      setLoading(false);
    }
  }

  // ---------- Events ----------
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    lookup(input.value);
  });

  input.addEventListener("input", () => {
    const normalized = normalizeIfsc(input.value);
    if (input.value !== normalized) input.value = normalized;
    if (input.classList.contains("is-invalid") && IFSC_REGEX.test(normalized)) {
      input.classList.remove("is-invalid");
      setStatus("");
    }
  });

  input.addEventListener("paste", (e) => {
    // Clean pasted content
    const text = (e.clipboardData || window.clipboardData)?.getData("text") || "";
    if (text) {
      e.preventDefault();
      input.value = normalizeIfsc(text);
      input.dispatchEvent(new Event("input", { bubbles: true }));
    }
  });

  // ---------- Deep link (?ifsc=XXXX or #XXXX) ----------
  function readDeepLink() {
    const params = new URLSearchParams(location.search);
    const qp = params.get("ifsc");
    if (qp) return qp;

    const hash = decodeURIComponent(location.hash.replace(/^#/, ""));
    return hash || "";
  }

  const initial = readDeepLink();
  if (initial && IFSC_REGEX.test(normalizeIfsc(initial))) {
    input.value = normalizeIfsc(initial);
    // let the DOM settle before firing
    requestAnimationFrame(() => form.requestSubmit());
  } else {
    input.focus();
  }

  // ---------- Global error surface ----------
  window.addEventListener("error", (e) => {
    console.error("[IFSC] Uncaught error:", e.error || e.message);
  });
  window.addEventListener("unhandledrejection", (e) => {
    console.error("[IFSC] Unhandled rejection:", e.reason);
  });

  // ---------- Init ----------
  renderRecent();
})();
