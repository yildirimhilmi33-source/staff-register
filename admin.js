const clock = document.querySelector("#clock");
const reportForm = document.querySelector("#reportForm");
const reportPin = document.querySelector("#reportPin");
const reportActions = document.querySelector("#reportActions");
const downloadHtmlButton = document.querySelector("#downloadHtml");
const printReportButton = document.querySelector("#printReport");
const statusBox = document.querySelector("#status");
const reportArea = document.querySelector("#reportArea");
const reportRows = document.querySelector("#reportRows");
const reportMeta = document.querySelector("#reportMeta");

const supabaseConfig = window.ATTENDANCE_CONFIG || {};
const supabaseClient =
  supabaseConfig.url && supabaseConfig.anonKey
    ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey)
    : null;

let reportData = [];

function updateClock() {
  const now = new Date();
  clock.textContent = now.toLocaleTimeString("tr-TR", {
    timeZone: "Africa/Johannesburg",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function showStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.classList.toggle("error", isError);
}

function safeText(value) {
  return String(value || "");
}

function escapeHtml(value) {
  return safeText(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderRows(rows) {
  reportRows.innerHTML = "";

  rows.forEach((record) => {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${escapeHtml(record.Date)}</td>
      <td>${escapeHtml(record.Time)}</td>
      <td>${escapeHtml(record["Staff Member"])}</td>
      <td>${escapeHtml(record.Action)}</td>
      <td><img class="signature-image" src="${escapeHtml(record.Signature)}" alt="Signature" /></td>
    `;
    reportRows.append(row);
  });

  reportMeta.textContent = `${rows.length} records`;
  reportArea.hidden = false;
  reportActions.hidden = false;
}

function buildHtmlReport(rows) {
  const createdAt = new Date().toLocaleString("en-ZA", {
    timeZone: "Africa/Johannesburg"
  });
  const bodyRows = rows
    .map(
      (record) => `
        <tr>
          <td>${escapeHtml(record.Date)}</td>
          <td>${escapeHtml(record.Time)}</td>
          <td>${escapeHtml(record["Staff Member"])}</td>
          <td>${escapeHtml(record.Action)}</td>
          <td><img src="${escapeHtml(record.Signature)}" alt="Signature" /></td>
        </tr>`
    )
    .join("");

  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Signed Attendance Report</title>
  <style>
    body { font-family: Arial, sans-serif; color: #1f2733; margin: 28px; }
    h1 { margin: 0 0 8px; }
    p { margin: 0 0 18px; color: #687386; font-weight: 700; }
    table { width: 100%; border-collapse: collapse; }
    th, td { border: 1px solid #d9dde5; padding: 10px; text-align: left; vertical-align: middle; }
    th { background: #eef4f1; font-size: 12px; text-transform: uppercase; }
    img { width: 190px; height: 74px; object-fit: contain; background: #fff; }
  </style>
</head>
<body>
  <h1>Signed Attendance Report</h1>
  <p>Downloaded on ${escapeHtml(createdAt)}. Total records: ${rows.length}.</p>
  <table>
    <thead>
      <tr>
        <th>Date</th>
        <th>Time</th>
        <th>Staff Member</th>
        <th>Action</th>
        <th>Signature</th>
      </tr>
    </thead>
    <tbody>${bodyRows}</tbody>
  </table>
</body>
</html>`;
}

function downloadHtmlReport() {
  const html = buildHtmlReport(reportData);
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "signed-attendance-report.html";
  link.click();
  URL.revokeObjectURL(url);
}

reportForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!supabaseClient) {
    showStatus("Fill in the Supabase details in config.js.", true);
    return;
  }

  showStatus("Preparing report...");

  const { data, error } = await supabaseClient.rpc("get_attendance_report", {
    input_pin: reportPin.value.trim()
  });

  if (error) {
    reportArea.hidden = true;
    reportActions.hidden = true;
    showStatus("Could not open the report. Check the PIN or Supabase settings.", true);
    return;
  }

  reportData = data || [];
  renderRows(reportData);
  showStatus("Report ready.");
});

downloadHtmlButton.addEventListener("click", downloadHtmlReport);
printReportButton.addEventListener("click", () => window.print());

updateClock();
setInterval(updateClock, 1000);
