const API_BASE = "https://ifsc.razorpay.com/";

const form   = document.getElementById("lookup-form");
const input  = document.getElementById("ifsc-input");
const status = document.getElementById("status");
const result = document.getElementById("result");

function setStatus(msg, kind = "loading") {
  status.textContent = msg;
  status.className = `status ${kind}`;
  status.hidden = false;
}

function clearStatus() { status.hidden = true; }

function showResult(data) {
  const rows = [
    ["IFSC",    data.IFSC],
    ["Bank",    data.BANK],
    ["Branch",  data.BRANCH],
    ["Address", data.ADDRESS],
    ["City",    data.CITY],
    ["District",data.DISTRICT],
    ["State",   data.STATE],
    ["Contact", data.CONTACT],
    ["MICR",    data.MICR],
    ["RTGS",    data.RTGS ? "Yes" : "No"],
    ["NEFT",    data.NEFT ? "Yes" : "No"],
    ["IMPS",    data.IMPS ? "Yes" : "No"],
    ["UPI",     data.UPI  ? "Yes" : "No"],
  ].filter(([, v]) => v);

  result.innerHTML = `
    <table>
      ${rows.map(([k, v]) =>
        `<tr><th>${k}</th><td>${escapeHtml(String(v))}</td></tr>`
      ).join("")}
    </table>
  `;
  result.hidden = false;
}

function escapeHtml(s) {
  return s.replace(/[&<>"']/g, c => ({
    "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"
  }[c]));
}

form.addEventListener("submit", async (e) => {
  e.preventDefault();
  result.hidden = true;

  const code = input.value.trim().toUpperCase();
  if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(code)) {
    setStatus("Invalid IFSC format. Example: HDFC0000001", "error");
    return;
  }

  setStatus(`Looking up ${code}…`);
  form.querySelector("button").disabled = true;

  try {
    const res = await fetch(API_BASE + encodeURIComponent(code));

    if (res.status === 404) {
      setStatus(`No bank found for IFSC ${code}.`, "error");
      return;
    }
    if (!res.ok) {
      setStatus(`Upstream error (HTTP ${res.status}).`, "error");
      return;
    }

    const data = await res.json();
    clearStatus();
    showResult(data);
  } catch (err) {
    setStatus(`Network error: ${err.message}`, "error");
  } finally {
    form.querySelector("button").disabled = false;
  }
});
