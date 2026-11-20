"use strict";

const MAX_SOURCE_BYTES = 20 * 1024 * 1024;
const MAX_SOURCE_PIXELS = 32_000_000;
const MAX_WORKING_EDGE = 2048;
const MAX_SAVED_BYTES = 3 * 1024 * 1024;
const OUTPUT_EDGES = [1600, 1200, 800];
const MIN_CROP = .12;
const PNG = [137, 80, 78, 71, 13, 10, 26, 10];
const HEIF_BRANDS = new Set(["heic", "heix", "hevc", "hevx", "mif1", "msf1"]);

const byId = id => document.getElementById(id);
const start = byId("start");
const editor = byId("editor");
const stage = byId("stage");
const photo = byId("photo");
const cropFrame = byId("crop-frame");
const handles = [...stage.querySelectorAll(".handle")];
const take = byId("take");
const choose = byId("choose");
const save = byId("save");
const reset = byId("reset");
const cancel = byId("cancel");
const capture = byId("capture");
const picker = byId("picker");
const savedSection = byId("saved");
const savedImage = byId("saved-image");
const download = byId("download");
const deleteButton = byId("delete");
const deleteDialog = byId("delete-dialog");
const notice = byId("notice");

let crop = null;
let drag = null;
let currentSelection = 0;
let openingPhoto = false;
let writing = false;
let savedUrl = null;
const database = openDatabase();

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("little-pencil-paper-photo", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("drawings");
    request.onsuccess = () => {
      const db = request.result;
      db.onversionchange = () => db.close();
      resolve(db);
    };
    request.onerror = () => reject(request.error);
  });
}

async function accessSaved(mode, action) {
  const db = await database;
  return new Promise((resolve, reject) => {
    const transaction = db.transaction("drawings", mode);
    const request = action(transaction.objectStore("drawings"));
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error);
  });
}

function announce(message) {
  notice.textContent = message;
}

function updateControls() {
  const editing = crop !== null;
  start.hidden = editing || savedUrl !== null;
  editor.hidden = !editing;
  byId("take-label").textContent = editing ? "Retake photo" : "Take a photo";
  byId("choose-label").textContent = editing ? "Choose another photo" : "Choose a photo";
  byId("replace-hint").hidden = !savedUrl;
  save.textContent = savedUrl ? "Replace saved copy" : "Save here";
  save.disabled = !editing || openingPhoto || writing;
  take.disabled = choose.disabled = reset.disabled = cancel.disabled = deleteButton.disabled = writing;
  for (const handle of handles) handle.disabled = writing;
}

function showSaved(bytes) {
  if (savedUrl) URL.revokeObjectURL(savedUrl);
  savedUrl = bytes ? URL.createObjectURL(new Blob([bytes], { type: "image/png" })) : null;
  if (savedUrl) {
    savedImage.src = savedUrl;
    download.href = savedUrl;
  } else {
    savedImage.removeAttribute("src");
    download.removeAttribute("href");
  }
  savedSection.hidden = !savedUrl;
  updateControls();
}

function imageType(bytes) {
  const fourCC = offset => String.fromCharCode(...bytes.subarray(offset, offset + 4));
  if (PNG.every((value, index) => bytes[index] === value)) return "image/png";
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (fourCC(0) === "RIFF" && fourCC(8) === "WEBP") return "image/webp";
  if (fourCC(4) === "ftyp") {
    if (HEIF_BRANDS.has(fourCC(8))) return "image/heic";
    for (let offset = 16; offset + 4 <= bytes.length; offset += 4) {
      if (HEIF_BRANDS.has(fourCC(offset))) return "image/heic";
    }
  }
  return null;
}

function withinInputBounds(width, height) {
  return width > 0 && height > 0 && width * height <= MAX_SOURCE_PIXELS;
}

function fit(width, height, limit) {
  const scale = Math.min(1, limit / Math.max(width, height));
  return [Math.max(1, Math.round(width * scale)), Math.max(1, Math.round(height * scale))];
}

async function decodePhoto(file) {
  if (!file.size || file.size > MAX_SOURCE_BYTES) {
    throw new Error("Choose a photo smaller than 20 MB.");
  }
  let header;
  try {
    header = await file.slice(0, 64).arrayBuffer();
  } catch {
    throw new Error("Could not read this photo. Choose it again or choose another photo.");
  }
  const type = imageType(new Uint8Array(header));
  if (!type) throw new Error("Choose a JPEG, PNG, WebP, or HEIF photo.");
  if (type === "image/png" && header.byteLength >= 24) {
    const dimensions = new DataView(header);
    if (!withinInputBounds(dimensions.getUint32(16), dimensions.getUint32(20))) {
      throw new Error("That photo is too large. Choose a smaller copy.");
    }
  }

  const image = new Image();
  const url = URL.createObjectURL(file.slice(0, file.size, type));
  try {
    image.src = url;
    try {
      await image.decode();
    } catch {
      throw new Error("This browser could not open that photo. Try another photo or a JPEG or PNG copy.");
    }
    const { naturalWidth: width, naturalHeight: height } = image;
    if (!withinInputBounds(width, height)) {
      throw new Error("That photo is too large. Choose a smaller copy.");
    }
    const canvas = document.createElement("canvas");
    [canvas.width, canvas.height] = fit(width, height, MAX_WORKING_EDGE);
    const context = canvas.getContext("2d", { alpha: false });
    if (!context) throw new Error("The preview is unavailable. Try reopening this page.");
    context.fillStyle = "white";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image, 0, 0, canvas.width, canvas.height);
    return canvas;
  } finally {
    image.removeAttribute("src");
    URL.revokeObjectURL(url);
  }
}

async function selectPhoto(event) {
  const input = event.currentTarget;
  const [file] = input.files;
  if (!file || writing) return;

  const selection = ++currentSelection;
  openingPhoto = true;
  updateControls();
  announce("Opening photo…");
  try {
    const decoded = await decodePhoto(file);
    if (selection !== currentSelection) return;
    const context = photo.getContext("2d", { alpha: false });
    if (!context) throw new Error("The preview is unavailable. Try reopening this page.");
    [photo.width, photo.height] = [decoded.width, decoded.height];
    context.drawImage(decoded, 0, 0);
    stage.style.setProperty("--ratio", photo.width / photo.height);
    resetCrop();
    announce("");
    updateControls();
    byId("crop-heading").focus();
  } catch (error) {
    if (selection === currentSelection) announce(error.message);
  } finally {
    if (input.files[0] === file) input.value = "";
    if (selection === currentSelection) {
      openingPhoto = false;
      updateControls();
    }
  }
}

function resetCrop() {
  crop = { left: 0, top: 0, right: 1, bottom: 1 };
  drawCrop();
}

function drawCrop() {
  const percent = value => (value * 100) + "%";
  cropFrame.style.left = percent(crop.left);
  cropFrame.style.top = percent(crop.top);
  cropFrame.style.width = percent(crop.right - crop.left);
  cropFrame.style.height = percent(crop.bottom - crop.top);
  for (const handle of handles) {
    handle.style.left = percent(crop[handle.dataset.x]);
    handle.style.top = percent(crop[handle.dataset.y]);
  }
}

const clamp = (value, lower, upper) => Math.min(upper, Math.max(lower, value));

function moveCorner(handle, left, top) {
  const { x, y } = handle.dataset;
  crop[x] = x === "left" ? clamp(left, 0, crop.right - MIN_CROP) : clamp(left, crop.left + MIN_CROP, 1);
  crop[y] = y === "top" ? clamp(top, 0, crop.bottom - MIN_CROP) : clamp(top, crop.top + MIN_CROP, 1);
  drawCrop();
}

function pointerPosition(event) {
  const { left, top, width, height } = stage.getBoundingClientRect();
  return [(event.clientX - left) / width, (event.clientY - top) / height];
}

for (const handle of handles) {
  handle.addEventListener("pointerdown", event => {
    if (writing || drag || event.button !== 0) return;
    const [x, y] = pointerPosition(event);
    drag = {
      id: event.pointerId,
      offsetX: crop[handle.dataset.x] - x,
      offsetY: crop[handle.dataset.y] - y,
    };
    handle.setPointerCapture(event.pointerId);
  });
  handle.addEventListener("pointermove", event => {
    if (event.pointerId !== drag?.id) return;
    const [x, y] = pointerPosition(event);
    moveCorner(handle, x + drag.offsetX, y + drag.offsetY);
  });
  handle.addEventListener("lostpointercapture", event => {
    if (event.pointerId === drag?.id) drag = null;
  });
  handle.addEventListener("keydown", event => {
    const directions = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const direction = directions[event.key];
    if (!direction || writing) return;
    event.preventDefault();
    const step = event.shiftKey ? .10 : .02;
    const { x, y } = handle.dataset;
    moveCorner(handle, crop[x] + step * direction[0], crop[y] + step * direction[1]);
  });
}

function discardDraft() {
  currentSelection++;
  openingPhoto = false;
  crop = null;
  drag = null;
  photo.width = photo.height = 1;
  updateControls();
}

async function keepPngPixels(blob) {
  // Some WebKit versions add an EXIF block even to a freshly drawn canvas.
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const kept = [bytes.subarray(0, 8)];
  const pixelChunks = new Set(["IHDR", "PLTE", "tRNS", "IDAT", "IEND", "sRGB", "gAMA", "cHRM"]);
  for (let offset = 8; offset < bytes.length;) {
    const length = view.getUint32(offset);
    const end = offset + length + 12;
    if (end > bytes.length) throw new Error("Incomplete encoded PNG.");
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    if (pixelChunks.has(type)) kept.push(bytes.subarray(offset, end));
    if (type === "IEND") return new Blob(kept, { type: "image/png" });
    offset = end;
  }
  throw new Error("Incomplete encoded PNG.");
}

async function encodeCrop() {
  const left = Math.min(photo.width - 1, Math.round(crop.left * photo.width));
  const top = Math.min(photo.height - 1, Math.round(crop.top * photo.height));
  const width = Math.max(1, Math.round(crop.right * photo.width) - left);
  const height = Math.max(1, Math.round(crop.bottom * photo.height) - top);
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d", { alpha: false });
  if (!context) throw new Error("PNG encoding is unavailable.");

  // Render pixels into a fresh canvas so the source file and its metadata are never saved.
  let previousSize = "";
  for (const limit of OUTPUT_EDGES) {
    const [outputWidth, outputHeight] = fit(width, height, limit);
    const size = outputWidth + "x" + outputHeight;
    if (previousSize === size) continue;
    previousSize = size;
    [canvas.width, canvas.height] = [outputWidth, outputHeight];
    context.drawImage(photo, left, top, width, height, 0, 0, outputWidth, outputHeight);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    if (blob?.type === "image/png" && blob.size <= MAX_SAVED_BYTES) return keepPngPixels(blob);
  }
  throw new Error("The cropped image could not be saved within the size limit.");
}

async function saveDrawing() {
  if (writing || openingPhoto || !crop) return;
  writing = true;
  updateControls();
  announce("Saving drawing…");
  try {
    const blob = await encodeCrop();
    // Keep PNG bytes in IndexedDB without relying on browser-backed Blob files.
    const bytes = await blob.arrayBuffer();
    await accessSaved("readwrite", store => store.put(bytes, "current"));
    showSaved(bytes);
    discardDraft();
    announce("Drawing saved here.");
    byId("saved-heading").focus();
  } catch {
    announce("Could not save the drawing in this browser. Your crop is still here.");
  } finally {
    writing = false;
    updateControls();
  }
}

async function deleteDrawing() {
  if (deleteDialog.returnValue !== "delete" || writing) return;
  writing = true;
  updateControls();
  try {
    await accessSaved("readwrite", store => store.delete("current"));
    showSaved(null);
    announce("Saved drawing deleted.");
  } catch {
    announce("Could not delete the saved drawing. Try again.");
  } finally {
    writing = false;
    updateControls();
    if (!savedUrl) (crop ? save : take).focus();
  }
}

take.addEventListener("click", () => capture.click());
choose.addEventListener("click", () => picker.click());
for (const input of [capture, picker]) input.addEventListener("change", selectPhoto);
reset.addEventListener("click", resetCrop);
cancel.addEventListener("click", () => {
  discardDraft();
  announce("Crop canceled.");
  choose.focus();
});
save.addEventListener("click", saveDrawing);
deleteButton.addEventListener("click", () => {
  deleteDialog.returnValue = "";
  deleteDialog.showModal();
});
deleteDialog.addEventListener("close", deleteDrawing);

accessSaved("readonly", store => store.get("current"))
  .then(showSaved)
  .catch(() => announce("Saved drawings are unavailable in this browser session."));
updateControls();
