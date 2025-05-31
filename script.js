// Global variables for canvas transformation and interaction
let canvas = document.getElementById("canvas");
let canvasContent = document.getElementById("canvas-content");
let canvasOffsetX = 0,
    canvasOffsetY = 0,
    canvasScale = 1;
let snapEnabled = false;
const gridSpacing = 20;
let currentInteraction = { type: null, target: null };

// Use a variable to track grid visibility reliably.
let gridVisible = true;

// --- Helper Functions ---

// Update the overall transform of the canvas-content (pan/zoom)
function updateCanvasTransform() {
  canvasContent.style.transform = `translate(${canvasOffsetX}px, ${canvasOffsetY}px) scale(${canvasScale})`;
}

// Convert page (client) coordinates to canvas-content coordinates.
function pageToCanvas(clientX, clientY) {
  let rect = canvas.getBoundingClientRect();
  let x = (clientX - rect.left - canvasOffsetX) / canvasScale;
  let y = (clientY - rect.top - canvasOffsetY) / canvasScale;
  return { x, y };
}

// Update a canvas item's transform from its dataset values.
function updateItemTransform(item) {
  let x = parseFloat(item.dataset.x) || 0;
  let y = parseFloat(item.dataset.y) || 0;
  let rotation = parseFloat(item.dataset.rotation) || 0;
  let scale = parseFloat(item.dataset.scale) || 1;
  item.style.transform = `translate(${x}px, ${y}px) rotate(${rotation}deg) scale(${scale})`;
}

// Deselect all canvas items (remove handles and outline).
function deselectAll() {
  document.querySelectorAll(".canvas-item.selected").forEach((ele) => {
    ele.classList.remove("selected");
    let rh = ele.querySelector(".rotate-handle");
    if (rh) rh.remove();
    let sh = ele.querySelector(".scale-handle");
    if (sh) sh.remove();
  });
}

// When a canvas item is selected, add rotate and scale handles.
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

// Create and add a new canvas item of the given type.
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
    // Set to non-editable initially; enable via double-click.
    item.contentEditable = false;
    item.innerText = "Double-click to edit";
    item.addEventListener("dblclick", (e) => {
      e.stopPropagation();
      item.contentEditable = true;
      item.focus();
    });
    item.addEventListener("blur", (e) => {
      item.contentEditable = false;
    });
  } else {
    let img = document.createElement("img");
    img.src = "images/" + itemType + ".png";
    img.draggable = false;
    img.style.width = "100px";
    img.style.height = "auto";
    item.appendChild(img);
  }
  // Prevent any OS drag behavior.
  item.addEventListener("dragstart", e => e.preventDefault());
  // Set up dragging.
  item.addEventListener("mousedown", onItemMouseDown);
  canvasContent.appendChild(item);
  return item;
}

// --- Library Loading and Drag-to-Canvas ---

// Load available items from items.txt and populate the library panel.
function loadLibrary() {
  fetch("items.txt")
    .then(response => response.text())
    .then(text => {
      let items = text
        .split("\n")
        .map(item => item.trim())
        .filter(item => item.length > 0);
      let libraryDiv = document.getElementById("library-items");
      items.forEach(itemType => {
        let libItem = document.createElement("div");
        libItem.className = "library-item";
        libItem.dataset.itemType = itemType;
        if (itemType === "custom-text") {
          libItem.innerHTML = '<div class="item-icon">Text</div><div class="item-label">Custom Text</div>';
        } else {
          libItem.innerHTML = '<img src="images/' + itemType + '.png" alt="' + itemType +
                             '"><div class="item-label">' + itemType + '</div>';
        }
        libItem.addEventListener("dragstart", e => e.preventDefault());
        libItem.addEventListener("mousedown", libraryItemMouseDown);
        libraryDiv.appendChild(libItem);
      });
    })
    .catch(err => {
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
  // Apply grid snapping if enabled.
  if (snapEnabled) {
    newX = Math.round(newX / gridSpacing) * gridSpacing;
    newY = Math.round(newY / gridSpacing) * gridSpacing;
  }
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
  currentInteraction.target = this.parentElement;
  let rect = currentInteraction.target.getBoundingClientRect();
  let centerX = rect.left + rect.width / 2;
  let centerY = rect.top + rect.height / 2;
  currentInteraction.center = { x: centerX, y: centerY };
  currentInteraction.startAngle = Math.atan2(e.clientY - centerY, e.clientX - centerX);
  currentInteraction.origRotation = parseFloat(currentInteraction.target.dataset.rotation) || 0;
  
  document.addEventListener("mousemove", onRotateDrag);
  document.addEventListener("mouseup", onRotateEnd);
}

function onRotateDrag(e) {
  let angle = Math.atan2(e.clientY - currentInteraction.center.y, e.clientX - currentInteraction.center.x);
  let deltaAngle = angle - currentInteraction.startAngle;
  let newRotation = currentInteraction.origRotation + (deltaAngle * 180) / Math.PI;
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
  currentInteraction.startDistance = Math.hypot(e.clientX - centerX, e.clientY - centerY);
  currentInteraction.origScale = parseFloat(currentInteraction.target.dataset.scale) || 1;
  
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

// Panning when clicking on the canvas background (not on an item)
canvas.addEventListener("mousedown", function (e) {
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

// --- Canvas Zooming (Centered Around the Mouse Cursor) ---

canvas.addEventListener("wheel", function (e) {
  e.preventDefault();
  const zoomFactor = 0.001;
  let delta = -e.deltaY * zoomFactor;
  let newScale = canvasScale * (1 + delta);
  newScale = Math.max(0.5, Math.min(2, newScale));
  
  // Get mouse coordinates relative to the canvas.
  let rect = canvas.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  
  // Adjust pan offsets so the point under the cursor remains fixed.
  const scaleFactor = newScale / canvasScale;
  canvasOffsetX = x - scaleFactor * (x - canvasOffsetX);
  canvasOffsetY = y - scaleFactor * (y - canvasOffsetY);
  canvasScale = newScale;
  updateCanvasTransform();
});

// Zoom buttons (centered on the canvas).
document.getElementById("zoom-in-btn").addEventListener("click", () => {
  let rect = canvas.getBoundingClientRect();
  const x = rect.width / 2;
  const y = rect.height / 2;
  const newScale = Math.min(2, canvasScale + 0.1);
  const scaleFactor = newScale / canvasScale;
  canvasOffsetX = x - scaleFactor * (x - canvasOffsetX);
  canvasOffsetY = y - scaleFactor * (y - canvasOffsetY);
  canvasScale = newScale;
  updateCanvasTransform();
});

document.getElementById("zoom-out-btn").addEventListener("click", () => {
  let rect = canvas.getBoundingClientRect();
  const x = rect.width / 2;
  const y = rect.height / 2;
  const newScale = Math.max(0.5, canvasScale - 0.1);
  const scaleFactor = newScale / canvasScale;
  canvasOffsetX = x - scaleFactor * (x - canvasOffsetX);
  canvasOffsetY = y - scaleFactor * (y - canvasOffsetY);
  canvasScale = newScale;
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
      // Re-add the grid element; default now is visible.
      canvasContent.innerHTML = '<div id="grid" style="display:block;"></div>';
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
    canvasContent.innerHTML = '<div id="grid" style="display:block;"></div>';
  }
});

// --- Toggle Grid & Snap Buttons ---

document.getElementById("toggle-grid-btn").addEventListener("click", (e) => {
  let gridEl = document.getElementById("grid");
  gridVisible = !gridVisible;
  gridEl.style.display = gridVisible ? "block" : "none";
  if (gridVisible) {
    e.target.classList.add("active");
  } else {
    e.target.classList.remove("active");
  }
});

document.getElementById("toggle-snap-btn").addEventListener("click", (e) => {
  snapEnabled = !snapEnabled;
  if (snapEnabled) {
    e.target.classList.add("active");
  } else {
    e.target.classList.remove("active");
  }
});

// --- Delete Selected Item with Backspace/Delete ---

document.addEventListener("keydown", function(e) {
  if ((e.key === "Delete" || e.key === "Backspace") && !e.target.isContentEditable) {
    let selectedItems = document.querySelectorAll(".canvas-item.selected");
    if (selectedItems.length > 0) {
      selectedItems.forEach(item => item.remove());
      e.preventDefault();
    }
  }
});

// --- Initialization ---
document.addEventListener("DOMContentLoaded", () => {
  loadLibrary();
  updateCanvasTransform();
});
