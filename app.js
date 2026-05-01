const clock = document.querySelector("#clock");
const form = document.querySelector("#attendanceForm");
const teacherSelect = document.querySelector("#teacherName");
const otherNameField = document.querySelector("#otherNameField");
const otherNameInput = document.querySelector("#otherName");
const canvas = document.querySelector("#signatureCanvas");
const clearSignatureButton = document.querySelector("#clearSignature");
const statusBox = document.querySelector("#status");
const submitButtons = [...document.querySelectorAll("[data-action]")];

const supabaseConfig = window.ATTENDANCE_CONFIG || {};
const supabaseClient =
  supabaseConfig.url && supabaseConfig.anonKey
    ? window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey)
    : null;

let selectedAction = "";
let isDrawing = false;
let hasSignature = false;
let lastPoint = null;

const context = canvas.getContext("2d");

function updateClock() {
  const now = new Date();
  clock.textContent = now.toLocaleTimeString("tr-TR", {
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

function setBusy(isBusy) {
  submitButtons.forEach((button) => {
    button.disabled = isBusy;
  });
}

function getSelectedName() {
  if (teacherSelect.value === "__other") {
    return otherNameInput.value.trim();
  }

  return teacherSelect.value.trim();
}

async function loadTeachers() {
  if (!supabaseClient) {
    showStatus("Fill in the Supabase details in config.js.", true);
    return;
  }

  const { data, error } = await supabaseClient
    .from("teachers")
    .select("name")
    .eq("active", true)
    .order("name", { ascending: true });

  if (error) {
    showStatus("Could not load the staff list.", true);
    return;
  }

  data.forEach((teacher) => {
    const option = document.createElement("option");
    option.value = teacher.name;
    option.textContent = teacher.name;
    teacherSelect.append(option);
  });

  const otherOption = document.createElement("option");
  otherOption.value = "__other";
  otherOption.textContent = "Not on the list";
  teacherSelect.append(otherOption);
}

teacherSelect.addEventListener("change", () => {
  const showOtherName = teacherSelect.value === "__other";
  otherNameField.hidden = !showOtherName;
  otherNameInput.required = showOtherName;
  if (showOtherName) otherNameInput.focus();
});

submitButtons.forEach((button) => {
  button.addEventListener("click", () => {
    selectedAction = button.dataset.action;
  });
});

form.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!supabaseClient) {
    showStatus("Supabase connection is missing.", true);
    return;
  }

  const name = getSelectedName();
  if (!name) {
    showStatus("Please select a name.", true);
    return;
  }

  if (!hasSignature) {
    showStatus("Please add a signature.", true);
    return;
  }

  setBusy(true);
  showStatus("Saving record...");

  const { error } = await supabaseClient.from("attendance_records").insert({
    teacher_name: name,
    action: selectedAction || "Check In",
    signature_data_url: canvas.toDataURL("image/png"),
    user_agent: navigator.userAgent.slice(0, 300)
  });

  if (error) {
    showStatus("Could not save the record. Check the Supabase settings.", true);
    setBusy(false);
    return;
  }

  showStatus(`${selectedAction || "Check In"} saved for ${name}.`);
  form.reset();
  otherNameField.hidden = true;
  otherNameInput.required = false;
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
loadTeachers();
