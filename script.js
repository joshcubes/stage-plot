// Global variables for canvas transformation and current interaction
let canvas = document.getElementById("canvas");
let canvasContent = document.getElementById("canvas-content");
let canvasOffsetX = 0,
  canvasOffsetY = 0,
  canvasScale = 1;
let currentInteraction = { type: null, target: null };

// --- Helper Functions ---

// Update overall canvas-content transform for pan/zoom
function updateCanvasTransform() {
  canvasContent.style.transform = `translate(${canvasOffsetX}px, ${canvasOffsetY}px) scale(${canvasScale})`;
}

// Convert page (client) coordinates to canvas-content coordinates (accounting for pan/zoom)
function pageToCanvas(clientX, clientY) {
  let rect = canvas.getBoundingClientRect();
  let x = (clientX - rect.left - canvasOffsetX) / canvasScale;
  let y = (clientY - rect.top - canvasOffsetY) / canvasScale;
  return { x, y };
}

// Update an individual canvas item's transform from its dataset values.
function updateItemTransform(item) {
  let x = parseFloat(item.dataset.x) || 0;
  let y = parseFloat(item.dataset.y) || 0;
  let rotation = parseFloat(item.dataset.rotation) || 0;
  let scale = parseFloat(item.dataset.scale) || 1;
  item.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale})`;
}

// Deselect all canvas items (and remove any handles)
function deselectAll() {
  document.querySelectorAll(".canvas-item.selected").forEach((ele) => {
    ele.classList.remove("selected");
    let rh = ele.querySelector(".rotate-handle");
    if (rh) rh.remove();
    let sh = ele.querySelector(".scale-handle");
    if (sh) sh.remove();
  });
}

// When an item is selected, add transformation handles.
function selectCanvasItem(item) {
  deselectAll();
  item.classList.add("selected");
  if (!item.querySelector(".rotate-handle")) {
    let rotateHandle = document.createElement("div");
    rotateHandle.className = "rotate-handle";
    rotateHandle.addEventListener("mousedown", onRotateMouseDown);
    item.appendChild(rotateHandle);
  }
  if (!item.querySelector(".scale-handle")) {
    let scaleHandle = document.createElement("div");
    scaleHandle.className = "scale-handle";
    scaleHandle.addEventListener("mousedown", onScaleMouseDown);
    item.appendChild(scaleHandle);
  }
}

// --- Canvas Item Creation ---

// Create and add a new canvas item of a given type.
// The boolean isImport distinguishes between our drag-from-library and import operations.
function createCanvasItem(itemType, isImport = false) {
  let item = document.createElement("div");
  item.className = "canvas-item";
  item.dataset.type = itemType;
  item.dataset.x = 0;
  item.dataset.y = 0;
  item.dataset.rotation = 0;
  item.dataset.scale = 1;
  if (itemType === "custom-text") {
    item.classList.add("text-item");
    item.contentEditable = true;
    item.innerText = "Double-click to edit";
  } else {
    // Create an image element with normalized width.
    let img = document.createElement("img");
    img.src = "images/" + itemType + ".png";
    img.draggable = false;
    img.style.width = "100px";
    img.style.height = "auto";
    item.appendChild(img);
  }
  // Prevent the default drag behavior on canvas items.
  item.addEventListener("dragstart", e => e.preventDefault());
  // Add the event listener for dragging the item.
  item.addEventListener("mousedown", onItemMouseDown);
  canvasContent.appendChild(item);
  return item;
}

// --- Library Loading and Drag-to-Canvas ---

// Load available items from items.txt and populate the library panel.
function loadLibrary() {
  fetch("items.txt")
    .then((response) => response.text())
    .then((text) => {
      let items = text
        .split("\n")
        .map((item) => item.trim())
        .filter((item) => item.length > 0);
      let libraryDiv = document.getElementById("library-items");
      items.forEach((itemType) => {
        let libItem = document.createElement("div");
        libItem.className = "library-item";
        libItem.dataset.itemType = itemType;
        if (itemType === "custom-text") {
          libItem.innerHTML =
            '<div class="item-icon">Text</div><div class="item-label">Custom Text</div>';
        } else {
          libItem.innerHTML =
            '<img src="images/' +
            itemType +
            '.png" alt="' +
            itemType +
            '">' +
            '<div class="item-label">' +
            itemType +
            "</div>";
        }
        // Prevent default OS dragging of library items.
        libItem.addEventListener("dragstart", (e) => e.preventDefault());
        // Start the drag-to-canvas process when mousing down on a library item.
        libItem.addEventListener("mousedown", libraryItemMouseDown);
        libraryDiv.appendChild(libItem);
      });
    })
    .catch((err) => {
      console.error("Failed to load items.txt", err);
    });
}

// When a library item is pressed, create a corresponding canvas item and begin dragging it.
function libraryItemMouseDown(e) {
  e.preventDefault();
  let itemType = this.dataset.itemType;
  let canvasPos = pageToCanvas(e.clientX, e.clientY);
  let newItem = createCanvasItem(itemType);
  newItem.dataset.x = canvasPos.x;
  newItem.dataset.y = canvasPos.y;
  updateItemTransform(newItem);

  // Set up dragging for the new item.
  currentInteraction.type = "move";
  currentInteraction.target = newItem;
  currentInteraction.startX = canvasPos.x;
  currentInteraction.startY = canvasPos.y;
  currentInteraction.origX = canvasPos.x;
  currentInteraction.origY = canvasPos.y;

  selectCanvasItem(newItem);
  document.addEventListener("mousemove", onItemDrag);
  document.addEventListener("mouseup", onItemDragEnd);
}

// --- Dragging a Canvas Item (Moving) ---

function onItemMouseDown(e) {
  // If already handling a handle action, do nothing.
  if (
    e.target.classList.contains("rotate-handle") ||
    e.target.classList.contains("scale-handle")
  ) {
    return;
  }
  e.stopPropagation();
  currentInteraction.type = "move";
  currentInteraction.target = this;
  let pos = pageToCanvas(e.clientX, e.clientY);
  currentInteraction.startX = pos.x;
  currentInteraction.startY = pos.y;
  currentInteraction.origX = parseFloat(this.dataset.x) || 0;
  currentInteraction.origY = parseFloat(this.dataset.y) || 0;

  selectCanvasItem(this);
  document.addEventListener("mousemove", onItemDrag);
  document.addEventListener("mouseup", onItemDragEnd);
}

function onItemDrag(e) {
  let pos = pageToCanvas(e.clientX, e.clientY);
  let dx = pos.x - currentInteraction.startX;
  let dy = pos.y - currentInteraction.startY;
  let newX = currentInteraction.origX + dx;
  let newY = currentInteraction.origY + dy;
  currentInteraction.target.dataset.x = newX;
  currentInteraction.target.dataset.y = newY;
  updateItemTransform(currentInteraction.target);
}

function onItemDragEnd(e) {
  document.removeEventListener("mousemove", onItemDrag);
  document.removeEventListener("mouseup", onItemDragEnd);
  currentInteraction.type = null;
  currentInteraction.target = null;
}

// --- Rotate Handle Interaction ---

function onRotateMouseDown(e) {
  e.stopPropagation();
  currentInteraction.type = "rotate";
  // The rotate handle is inside the canvas item.
  currentInteraction.target = this.parentElement;
  let rect = currentInteraction.target.getBoundingClientRect();
  let centerX = rect.left + rect.width / 2;
  let centerY = rect.top + rect.height / 2;
  currentInteraction.center = { x: centerX, y: centerY };
  currentInteraction.startAngle = Math.atan2(
    e.clientY - centerY,
    e.clientX - centerX
  );
  currentInteraction.origRotation =
    parseFloat(currentInteraction.target.dataset.rotation) || 0;

  document.addEventListener("mousemove", onRotateDrag);
  document.addEventListener("mouseup", onRotateEnd);
}

function onRotateDrag(e) {
  let angle = Math.atan2(
    e.clientY - currentInteraction.center.y,
    e.clientX - currentInteraction.center.x
  );
  let deltaAngle = angle - currentInteraction.startAngle;
  let newRotation =
    currentInteraction.origRotation + (deltaAngle * 180) / Math.PI;
  currentInteraction.target.dataset.rotation = newRotation;
  updateItemTransform(currentInteraction.target);
}

function onRotateEnd(e) {
  document.removeEventListener("mousemove", onRotateDrag);
  document.removeEventListener("mouseup", onRotateEnd);
  currentInteraction.type = null;
  currentInteraction.target = null;
}

// --- Scale Handle Interaction ---

function onScaleMouseDown(e) {
  e.stopPropagation();
  currentInteraction.type = "scale";
  currentInteraction.target = this.parentElement;
  let rect = currentInteraction.target.getBoundingClientRect();
  let centerX = rect.left + rect.width / 2;
  let centerY = rect.top + rect.height / 2;
  currentInteraction.center = { x: centerX, y: centerY };
  currentInteraction.startDistance = Math.hypot(
    e.clientX - centerX,
    e.clientY - centerY
  );
  currentInteraction.origScale =
    parseFloat(currentInteraction.target.dataset.scale) || 1;

  document.addEventListener("mousemove", onScaleDrag);
  document.addEventListener("mouseup", onScaleEnd);
}

function onScaleDrag(e) {
  let center = currentInteraction.center;
  let currentDistance = Math.hypot(e.clientX - center.x, e.clientY - center.y);
  let scaleFactor = currentDistance / currentInteraction.startDistance;
  let newScale = currentInteraction.origScale * scaleFactor;
  currentInteraction.target.dataset.scale = newScale;
  updateItemTransform(currentInteraction.target);
}

function onScaleEnd(e) {
  document.removeEventListener("mousemove", onScaleDrag);
  document.removeEventListener("mouseup", onScaleEnd);
  currentInteraction.type = null;
  currentInteraction.target = null;
}

// --- Canvas Background Panning ---

// When clicking on the canvas background (not on an item), allow panning.
canvas.addEventListener("mousedown", function (e) {
  // If the click did not start on a canvas item...
  if (!e.target.closest(".canvas-item")) {
    deselectAll();
    currentInteraction.type = "pan";
    currentInteraction.startX = e.clientX;
    currentInteraction.startY = e.clientY;
    currentInteraction.origOffsetX = canvasOffsetX;
    currentInteraction.origOffsetY = canvasOffsetY;
    document.addEventListener("mousemove", onCanvasPan);
    document.addEventListener("mouseup", onCanvasPanEnd);
  }
});

function onCanvasPan(e) {
  let dx = e.clientX - currentInteraction.startX;
  let dy = e.clientY - currentInteraction.startY;
  canvasOffsetX = currentInteraction.origOffsetX + dx;
  canvasOffsetY = currentInteraction.origOffsetY + dy;
  updateCanvasTransform();
}

function onCanvasPanEnd(e) {
  document.removeEventListener("mousemove", onCanvasPan);
  document.removeEventListener("mouseup", onCanvasPanEnd);
  currentInteraction.type = null;
}

// --- Canvas Zooming ---

// Zoom with the mouse wheel.
canvas.addEventListener("wheel", function (e) {
  e.preventDefault();
  const zoomFactor = 0.001;
  let delta = -e.deltaY * zoomFactor;
  let newScale = canvasScale * (1 + delta);
  newScale = Math.max(0.5, Math.min(2, newScale));
  canvasScale = newScale;
  updateCanvasTransform();
});

// Also add zoom via control-panel buttons.
document.getElementById("zoom-in-btn").addEventListener("click", () => {
  canvasScale = Math.min(2, canvasScale + 0.1);
  updateCanvasTransform();
});
document.getElementById("zoom-out-btn").addEventListener("click", () => {
  canvasScale = Math.max(0.5, canvasScale - 0.1);
  updateCanvasTransform();
});

// --- Import / Export and Clear ---

document.getElementById("export-btn").addEventListener("click", () => {
  let items = [];
  document.querySelectorAll("#canvas-content > .canvas-item").forEach((item) => {
    items.push({
      type: item.dataset.type,
      x: parseFloat(item.dataset.x) || 0,
      y: parseFloat(item.dataset.y) || 0,
      rotation: parseFloat(item.dataset.rotation) || 0,
      scale: parseFloat(item.dataset.scale) || 1,
      text: item.dataset.type === "custom-text" ? item.innerText : undefined,
    });
  });
  let json = JSON.stringify(items, null, 2);
  prompt("Copy your exported JSON:", json);
});

document.getElementById("import-btn").addEventListener("click", () => {
  let json = prompt("Paste your JSON here:");
  if (json) {
    try {
      let items = JSON.parse(json);
      canvasContent.innerHTML = "";
      items.forEach((data) => {
        let newItem = createCanvasItem(data.type, true);
        newItem.dataset.x = data.x;
        newItem.dataset.y = data.y;
        newItem.dataset.rotation = data.rotation;
        newItem.dataset.scale = data.scale;
        updateItemTransform(newItem);
        if (data.type === "custom-text") {
          newItem.innerText = data.text || "Double-click to edit";
        }
      });
    } catch (err) {
      alert("Invalid JSON");
    }
  }
});

document.getElementById("clear-btn").addEventListener("click", () => {
  if (confirm("Are you sure you want to clear the canvas?")) {
    canvasContent.innerHTML = "";
  }
});

// --- Toggle Grid ---

document.getElementById("toggle-grid-btn").addEventListener("click", () => {
  canvas.classList.toggle("grid");
});

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  loadLibrary();
  updateCanvasTransform();
});
