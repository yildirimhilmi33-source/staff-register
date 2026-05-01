const clock = document.querySelector("#clock");
const form = document.querySelector("#attendanceForm");
const accessNotice = document.querySelector("#accessNotice");
const staffCard = document.querySelector("#staffCard");
const staffName = document.querySelector("#staffName");
const canvas = document.querySelector("#signatureCanvas");
const clearSignatureButton = document.querySelector("#clearSignature");
const statusBox = document.querySelector("#status");
const submitButtons = [...document.querySelectorAll("[data-action]")];

const supabaseConfig = window.ATTENDANCE_CONFIG || {};
const supabaseClient =
  supabaseConfig.url && supabaseConfig.anonKey
    ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey)
    : null;

const urlParams = new URLSearchParams(window.location.search);
const staffToken = urlParams.get("staff") || urlParams.get("t") || "";

let selectedAction = "";
let isDrawing = false;
let hasSignature = false;
let lastPoint = null;
let activeStaff = null;

const context = canvas.getContext("2d");

function updateClock() {
  const now = new Date();
  clock.textContent = now.toLocaleTimeString("en-ZA", {
    timeZone: "Africa/Johannesburg",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit"
  });
}

function setCanvasSize() {
  const ratio = Math.max(window.devicePixelRatio || 1, 1);
  const rect = canvas.getBoundingClientRect();
  const currentImage = hasSignature ? canvas.toDataURL("image/png") : null;

  canvas.width = Math.round(rect.width * ratio);
  canvas.height = Math.round(rect.height * ratio);
  context.setTransform(ratio, 0, 0, ratio, 0, 0);
  context.lineWidth = 2.6;
  context.lineCap = "round";
  context.lineJoin = "round";
  context.strokeStyle = "#1f2733";

  if (currentImage) {
    const image = new Image();
    image.onload = () => context.drawImage(image, 0, 0, rect.width, rect.height);
    image.src = currentImage;
  }
}

function getPoint(event) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: event.clientX - rect.left,
    y: event.clientY - rect.top
  };
}

function drawLine(from, to) {
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(to.x, to.y);
  context.stroke();
}

function startDrawing(event) {
  if (!activeStaff) return;

  isDrawing = true;
  hasSignature = true;
  lastPoint = getPoint(event);
  canvas.setPointerCapture(event.pointerId);
}

function keepDrawing(event) {
  if (!isDrawing || !lastPoint) return;
  const nextPoint = getPoint(event);
  drawLine(lastPoint, nextPoint);
  lastPoint = nextPoint;
}

function stopDrawing(event) {
  if (!isDrawing) return;

  isDrawing = false;
  lastPoint = null;
  try {
    canvas.releasePointerCapture(event.pointerId);
  } catch {
    // Some mobile browsers release the pointer automatically.
  }
}

function clearSignature() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  hasSignature = false;
}

function showStatus(message, isError = false) {
  statusBox.textContent = message;
  statusBox.classList.toggle("error", isError);
}

function setReady(isReady) {
  submitButtons.forEach((button) => {
    button.disabled = !isReady;
  });
}

function setBusy(isBusy) {
  submitButtons.forEach((button) => {
    button.disabled = isBusy || !activeStaff;
  });
}

async function loadStaffLink() {
  if (!supabaseClient) {
    accessNotice.textContent = "Supabase connection is missing.";
    accessNotice.classList.add("error");
    return;
  }

  if (!staffToken) {
    accessNotice.textContent = "This page needs a personal staff link. Please scan your QR code.";
    accessNotice.classList.add("error");
    return;
  }

  const { data, error } = await supabaseClient.rpc("get_teacher_by_token", {
    staff_token: staffToken
  });

  const staff = Array.isArray(data) ? data[0] : data;

  if (error || !staff) {
    accessNotice.textContent = "This staff link is not valid. Please contact the office.";
    accessNotice.classList.add("error");
    return;
  }

  if (!staff.network_allowed) {
    accessNotice.textContent = "This register only works on the school Wi-Fi.";
    accessNotice.classList.add("error");
    return;
  }

  activeStaff = staff;
  staffName.textContent = staff.name;
  staffCard.hidden = false;
  accessNotice.textContent = "School network verified.";
  accessNotice.classList.remove("error");
  setReady(true);
}

submitButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedAction = button.dataset.action;
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!activeStaff) {
    showStatus("Please open your personal staff link.", true);
    return;
  }

  if (!hasSignature) {
    showStatus("Please add a signature.", true);
    return;
  }

  setBusy(true);
  showStatus("Saving record...");

  const action = selectedAction || "Check In";
  const { error } = await supabaseClient.rpc("save_attendance_record", {
    staff_token: staffToken,
    input_action: action,
    signature_data_url: canvas.toDataURL("image/png"),
    browser_user_agent: navigator.userAgent.slice(0, 300)
  });

  if (error) {
    const message = error.message && error.message.includes("school network")
      ? "This register only works on the school Wi-Fi."
      : "Could not save the record. Please contact the office.";
    showStatus(message, true);
    setBusy(false);
    return;
  }

  showStatus(`${action} saved for ${activeStaff.name}.`);
  clearSignature();
  setBusy(false);
});

canvas.addEventListener("pointerdown", startDrawing);
canvas.addEventListener("pointermove", keepDrawing);
canvas.addEventListener("pointerup", stopDrawing);
canvas.addEventListener("pointercancel", stopDrawing);
canvas.addEventListener("pointerleave", stopDrawing);
clearSignatureButton.addEventListener("click", clearSignature);
window.addEventListener("resize", setCanvasSize);

updateClock();
setInterval(updateClock, 1000);
requestAnimationFrame(setCanvasSize);
loadStaffLink();
