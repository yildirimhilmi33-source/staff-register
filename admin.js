const clock = document.querySelector("#clock");
const reportForm = document.querySelector("#reportForm");
const reportPin = document.querySelector("#reportPin");
const statusBox = document.querySelector("#status");
const adminDashboard = document.querySelector("#adminDashboard");
const currentIp = document.querySelector("#currentIp");
const useCurrentIpButton = document.querySelector("#useCurrentIp");
const allowedIps = document.querySelector("#allowedIps");
const saveAllowedIpsButton = document.querySelector("#saveAllowedIps");
const staffForm = document.querySelector("#staffForm");
const newStaffName = document.querySelector("#newStaffName");
const staffList = document.querySelector("#staffList");
const downloadHtmlButton = document.querySelector("#downloadHtml");
const printReportButton = document.querySelector("#printReport");
const reportRows = document.querySelector("#reportRows");
const reportMeta = document.querySelector("#reportMeta");

const supabaseConfig = window.ATTENDANCE_CONFIG || {};
const supabaseClient =
  supabaseConfig.url && supabaseConfig.anonKey
    ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey)
    : null;

let reportData = [];
let teachers = [];

function updateClock() {
  const now = new Date();
  clock.textContent = now.toLocaleTimeString("en-ZA", {
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

function getPin() {
  return reportPin.value.trim();
}

function getBaseUrl() {
  const path = window.location.pathname.replace(/admin\.html$/, "");
  return `${window.location.origin}${path}`;
}

function buildStaffLink(teacher) {
  return `${getBaseUrl()}?staff=${encodeURIComponent(teacher.access_token)}`;
}

async function copyText(text) {
  if (navigator.clipboard && window.isSecureContext) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const input = document.createElement("textarea");
  input.value = text;
  input.style.position = "fixed";
  input.style.opacity = "0";
  document.body.append(input);
  input.select();
  document.execCommand("copy");
  input.remove();
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
      <td class="no-print"><button class="ghost-button delete-button" type="button">Delete</button></td>
    `;
    row.querySelector(".delete-button").addEventListener("click", () => {
      deleteAttendanceRecord(record.ID);
    });
    reportRows.append(row);
  });

  reportMeta.textContent = `${rows.length} records`;
}

async function renderTeachers() {
  staffList.innerHTML = "";

  for (const teacher of teachers) {
    const link = buildStaffLink(teacher);
    const card = document.createElement("article");
    card.className = "staff-row";

    card.innerHTML = `
      <div class="staff-main">
        <strong>${escapeHtml(teacher.name)}</strong>
        <span>${teacher.active ? "Active" : "Inactive"}</span>
        <input class="link-input" value="${escapeHtml(link)}" readonly />
        <div class="staff-actions">
          <button class="ghost-button" data-action="copy" type="button">Copy Link</button>
          <button class="ghost-button" data-action="toggle" type="button">${teacher.active ? "Deactivate" : "Activate"}</button>
          <button class="ghost-button" data-action="rotate" type="button">New QR</button>
        </div>
      </div>
      <div class="qr-box" aria-label="QR code for ${escapeHtml(teacher.name)}"></div>
    `;

    drawQr(card.querySelector(".qr-box"), link);

    card.querySelector('[data-action="copy"]').addEventListener("click", async () => {
      await copyText(link);
      showStatus(`Link copied for ${teacher.name}.`);
    });

    card.querySelector('[data-action="toggle"]').addEventListener("click", () => {
      setTeacherActive(teacher.id, !teacher.active);
    });

    card.querySelector('[data-action="rotate"]').addEventListener("click", () => {
      rotateTeacherLink(teacher.id);
    });

    staffList.append(card);
  }
}

function drawQr(target, text) {
  target.innerHTML = "";
  if (window.QRCode) {
    try {
      new window.QRCode(target, {
        text,
        width: 148,
        height: 148,
        correctLevel: window.QRCode.CorrectLevel.M
      });
      return;
    } catch {
      target.textContent = "QR unavailable";
      return;
    }
  }

  target.textContent = "QR script missing";
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
  <h1>Evim Preschool Beyerspark Signed Attendance Report</h1>
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
  link.download = "evim-preschool-signed-attendance-report.html";
  link.click();
  URL.revokeObjectURL(url);
}

async function loadAdminDashboard() {
  const [{ data: dashboard, error: dashboardError }, { data: report, error: reportError }] =
    await Promise.all([
      supabaseClient.rpc("get_admin_dashboard", { input_pin: getPin() }),
      supabaseClient.rpc("get_attendance_report", { input_pin: getPin() })
    ]);

  if (dashboardError || reportError) {
    throw new Error("Could not open admin. Check the PIN or Supabase setup.");
  }

  teachers = dashboard.teachers || [];
  reportData = report || [];
  currentIp.textContent = dashboard.client_ip || "Not detected";
  allowedIps.value = (dashboard.allowed_ips || []).join("\n");
  renderRows(reportData);
  await renderTeachers();
  adminDashboard.hidden = false;
}

async function refreshAdmin(message = "Admin updated.") {
  showStatus("Refreshing...");
  await loadAdminDashboard();
  showStatus(message);
}

async function setTeacherActive(id, active) {
  const { error } = await supabaseClient.rpc("admin_set_teacher_active", {
    input_pin: getPin(),
    teacher_id: id,
    is_active: active
  });

  if (error) {
    showStatus("Could not update staff status.", true);
    return;
  }

  await refreshAdmin("Staff status updated.");
}

async function rotateTeacherLink(id) {
  const { error } = await supabaseClient.rpc("admin_rotate_teacher_token", {
    input_pin: getPin(),
    teacher_id: id
  });

  if (error) {
    showStatus("Could not create a new QR link.", true);
    return;
  }

  await refreshAdmin("New QR link created.");
}

async function deleteAttendanceRecord(id) {
  if (!id) {
    showStatus("This record cannot be deleted yet. Run the latest SQL update first.", true);
    return;
  }

  const confirmed = window.confirm("Delete this attendance record?");
  if (!confirmed) return;

  const { error } = await supabaseClient.rpc("admin_delete_attendance_record", {
    input_pin: getPin(),
    record_id: id
  });

  if (error) {
    showStatus("Could not delete the record. Run the latest SQL update first.", true);
    return;
  }

  await refreshAdmin("Attendance record deleted.");
}

reportForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!supabaseClient) {
    showStatus("Fill in the Supabase details in config.js.", true);
    return;
  }

  try {
    showStatus("Opening admin...");
    await loadAdminDashboard();
    showStatus("Admin ready.");
  } catch (error) {
    adminDashboard.hidden = true;
    showStatus(error.message, true);
  }
});

staffForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = newStaffName.value.trim();
  if (!name) {
    showStatus("Enter a staff name.", true);
    return;
  }

  const { error } = await supabaseClient.rpc("admin_upsert_teacher", {
    input_pin: getPin(),
    teacher_id: null,
    staff_name: name,
    is_active: true
  });

  if (error) {
    showStatus("Could not add staff. The name may already exist.", true);
    return;
  }

  newStaffName.value = "";
  await refreshAdmin("Staff added.");
});

useCurrentIpButton.addEventListener("click", () => {
  const ip = currentIp.textContent.trim();
  if (!ip || ip === "Not detected") return;

  const ips = new Set(
    allowedIps.value
      .split(/\n|,/)
      .map((value) => value.trim())
      .filter(Boolean)
  );
  ips.add(ip);
  allowedIps.value = [...ips].join("\n");
});

saveAllowedIpsButton.addEventListener("click", async () => {
  const ips = allowedIps.value
    .split(/\n|,/)
    .map((value) => value.trim())
    .filter(Boolean);

  const { error } = await supabaseClient.rpc("admin_save_allowed_ips", {
    input_pin: getPin(),
    input_ips: ips
  });

  if (error) {
    showStatus("Could not save the Wi-Fi rule.", true);
    return;
  }

  await refreshAdmin("Wi-Fi rule saved.");
});

downloadHtmlButton.addEventListener("click", downloadHtmlReport);
printReportButton.addEventListener("click", () => window.print());

updateClock();
setInterval(updateClock, 1000);
