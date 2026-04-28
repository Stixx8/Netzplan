const canvas = document.getElementById("canvas");
const scene = document.getElementById("scene");
const connectionsLayer = document.getElementById("connections");
const nodesLayer = document.getElementById("nodes-layer");
const nodeTemplate = document.getElementById("node-template");
const summaryElement = document.getElementById("summary");
const validationResultsElement = document.getElementById("validation-results");
const statusElement = document.getElementById("status");
const zoomLevelElement = document.getElementById("zoom-level");
const showSolutionButton = document.getElementById("show-solution-btn");
const saveBrowserButton = document.getElementById("save-browser-btn");
const loadBrowserButton = document.getElementById("load-browser-btn");
const saveProjectButton = document.getElementById("save-project-btn");
const openProjectButton = document.getElementById("open-project-btn");
const deleteProjectButton = document.getElementById("delete-project-btn");
const undoButton = document.getElementById("undo-btn");
const redoButton = document.getElementById("redo-btn");
const exportSvgButton = document.getElementById("export-svg-btn");
const exportPngButton = document.getElementById("export-png-btn");
const exportPdfButton = document.getElementById("export-pdf-btn");
const printButton = document.getElementById("print-btn");
const projectNameInput = document.getElementById("project-name-input");
const savedProjectsSelect = document.getElementById("saved-projects-select");
const taskModeButton = document.getElementById("task-mode-btn");
const solutionModeButton = document.getElementById("solution-mode-btn");
const graphicViewButton = document.getElementById("graphic-view-btn");
const tableViewButton = document.getElementById("table-view-btn");
const tableBody = document.getElementById("table-body");
const graphicPanel = document.getElementById("graphic-panel");
const tablePanel = document.getElementById("table-panel");
const connectionContextMenu = document.getElementById("connection-context-menu");
const deleteConnectionButton = document.getElementById("delete-connection-btn");

const NODE_WIDTH = 280;
const NODE_HEIGHT = 238;
const EXPORT_PADDING = 48;
const LOCAL_STORAGE_KEY = "netzplan-editor-save";
const PROJECTS_STORAGE_KEY = "netzplan-editor-projects";

const state = {
  nodes: [],
  nextSequence: 1,
  drag: null,
  pan: null,
  pendingConnectionSourceUid: null,
  selectedConnection: null,
  undoStack: [],
  redoStack: [],
  isRestoringHistory: false,
  lastErrors: [],
  lastProjectDuration: 0,
  expectedValues: new Map(),
  isDirty: false,
  zoom: 0.8,
  offsetX: 160,
  offsetY: 120,
  mode: "task",
  view: "graphic",
  projectName: "Mein Netzplan",
};

const demoNodes = [
  { id: "A", label: "Analyse", duration: 3, predecessors: "", x: 80, y: 60 },
  { id: "B", label: "Planung", duration: 2, predecessors: "A", x: 420, y: 60 },
  { id: "C", label: "Beschaffung", duration: 4, predecessors: "A", x: 420, y: 300 },
  { id: "D", label: "Umsetzung", duration: 5, predecessors: "B, C", x: 760, y: 180 },
  { id: "E", label: "Abnahme", duration: 2, predecessors: "D", x: 1100, y: 180 },
];

function createEmptyNode(x = 80, y = 80) {
  const sequence = state.nextSequence++;
  return {
    uid: `node-${Date.now()}-${sequence}`,
    id: `V${sequence}`,
    label: "",
    duration: "",
    predecessors: "",
    x,
    y,
    faz: "",
    fez: "",
    saz: "",
    sez: "",
    gp: "",
    fp: "",
    critical: false,
    error: "",
  };
}

function cloneSerializableState() {
  return JSON.parse(JSON.stringify(getSerializableState()));
}

function pushHistorySnapshot() {
  if (state.isRestoringHistory) {
    return;
  }

  state.undoStack.push(cloneSerializableState());
  if (state.undoStack.length > 10) {
    state.undoStack.shift();
  }
  state.redoStack = [];
  syncHistoryButtons();
}

function applySnapshot(snapshot, message) {
  state.isRestoringHistory = true;
  state.projectName = snapshot.projectName || "Mein Netzplan";
  state.nodes = normalizeNodes(snapshot.nodes || []);
  state.zoom = typeof snapshot.zoom === "number" ? snapshot.zoom : 0.8;
  state.offsetX = typeof snapshot.offsetX === "number" ? snapshot.offsetX : 160;
  state.offsetY = typeof snapshot.offsetY === "number" ? snapshot.offsetY : 120;
  state.mode = snapshot.mode === "solution" ? "solution" : "task";
  state.view = snapshot.view === "table" ? "table" : "graphic";
  state.lastErrors = [];
  state.lastProjectDuration = 0;
  state.expectedValues = new Map();
  state.isDirty = true;
  clearPendingConnection();
  clearSelectedConnection();
  closeConnectionContextMenu();
  clearCalculatedFields();
  statusElement.textContent = message;
  render();
  state.isRestoringHistory = false;
  syncHistoryButtons();
}

function undoLastChange() {
  if (state.undoStack.length === 0) {
    statusElement.textContent = "Nichts zum RÃ¼ckgÃ¤ngig machen.";
    return false;
  }

  const snapshot = state.undoStack.pop();
  state.redoStack.push(cloneSerializableState());
  if (state.redoStack.length > 10) {
    state.redoStack.shift();
  }
  applySnapshot(snapshot, "Ã„nderung rÃ¼ckgÃ¤ngig gemacht.");
  syncHistoryButtons();
  return true;
}

function redoLastChange() {
  if (state.redoStack.length === 0) {
    statusElement.textContent = "Nichts zum Wiederherstellen.";
    return false;
  }

  const snapshot = state.redoStack.pop();
  state.undoStack.push(cloneSerializableState());
  if (state.undoStack.length > 10) {
    state.undoStack.shift();
  }
  applySnapshot(snapshot, "Ã„nderung wiederhergestellt.");
  syncHistoryButtons();
  return true;
}

function attachHistoryToEditableInput(element) {
  element.addEventListener("focus", () => {
    if (element.dataset.historyCaptured === "true") {
      return;
    }
    pushHistorySnapshot();
    element.dataset.historyCaptured = "true";
  });

  element.addEventListener("blur", () => {
    delete element.dataset.historyCaptured;
  });
}

function syncHistoryButtons() {
  if (undoButton) {
    undoButton.disabled = state.undoStack.length === 0;
  }
  if (redoButton) {
    redoButton.disabled = state.redoStack.length === 0;
  }
}

function captureFocusState() {
  const activeElement = document.activeElement;
  if (!activeElement || activeElement === document.body) {
    return null;
  }

  if (activeElement === projectNameInput) {
    return {
      type: "project-name",
      selectionStart: activeElement.selectionStart ?? null,
      selectionEnd: activeElement.selectionEnd ?? null,
    };
  }

  const field = activeElement.dataset?.field;
  if (!field) {
    return null;
  }

  const card = activeElement.closest(".node-card");
  if (card?.dataset.uid) {
    return {
      type: "node-field",
      uid: card.dataset.uid,
      field,
      selectionStart: activeElement.selectionStart ?? null,
      selectionEnd: activeElement.selectionEnd ?? null,
    };
  }

  if (activeElement.dataset.uid) {
    return {
      type: "table-field",
      uid: activeElement.dataset.uid,
      field,
      selectionStart: activeElement.selectionStart ?? null,
      selectionEnd: activeElement.selectionEnd ?? null,
    };
  }

  return null;
}

function restoreFocusState(focusState) {
  if (!focusState) {
    return;
  }

  let target = null;
  if (focusState.type === "project-name") {
    target = projectNameInput;
  } else if (focusState.type === "node-field") {
    target = document.querySelector(`.node-card[data-uid="${focusState.uid}"] [data-field="${focusState.field}"]`);
  } else if (focusState.type === "table-field") {
    target = document.querySelector(`#table-body [data-uid="${focusState.uid}"][data-field="${focusState.field}"]`);
  }

  if (!target) {
    return;
  }

  target.focus({ preventScroll: true });
  if (typeof target.setSelectionRange === "function" && focusState.selectionStart !== null && focusState.selectionEnd !== null) {
    target.setSelectionRange(focusState.selectionStart, focusState.selectionEnd);
  }
}

function normalizeNodes(rawNodes) {
  state.nextSequence = 1;
  return rawNodes.map((node, index) => {
    const normalized = createEmptyNode(node.x ?? 80 + index * 40, node.y ?? 80 + index * 40);
    normalized.id = node.id || normalized.id;
    normalized.label = node.label || "";
    normalized.duration = node.duration ?? "";
    normalized.predecessors = node.predecessors || "";
    normalized.faz = node.faz ?? "";
    normalized.fez = node.fez ?? "";
    normalized.saz = node.saz ?? "";
    normalized.sez = node.sez ?? "";
    normalized.gp = node.gp ?? "";
    normalized.fp = node.fp ?? "";
    normalized.x = Number(node.x) || normalized.x;
    normalized.y = Number(node.y) || normalized.y;
    return normalized;
  });
}

function predecessorList(node) {
  return String(node.predecessors || "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);
}

function addConnection(sourceUid, targetUid) {
  if (!sourceUid || !targetUid || sourceUid === targetUid) {
    return false;
  }

  const sourceNode = state.nodes.find((node) => node.uid === sourceUid);
  const targetNode = state.nodes.find((node) => node.uid === targetUid);
  if (!sourceNode || !targetNode || !sourceNode.id || !targetNode.id) {
    return false;
  }

  const predecessors = predecessorList(targetNode);
  if (predecessors.includes(sourceNode.id)) {
    return false;
  }

  predecessors.push(sourceNode.id);
  targetNode.predecessors = predecessors.join(", ");
  return true;
}

function canAddConnection(sourceUid, targetUid) {
  if (!sourceUid || !targetUid || sourceUid === targetUid) {
    return false;
  }

  const sourceNode = state.nodes.find((node) => node.uid === sourceUid);
  const targetNode = state.nodes.find((node) => node.uid === targetUid);
  if (!sourceNode || !targetNode || !sourceNode.id || !targetNode.id) {
    return false;
  }

  return !predecessorList(targetNode).includes(sourceNode.id);
}

function removeConnection(sourceId, targetUid) {
  const targetNode = state.nodes.find((node) => node.uid === targetUid);
  if (!targetNode) {
    return false;
  }

  const currentPredecessors = predecessorList(targetNode);
  const nextPredecessors = currentPredecessors.filter((entry) => entry !== sourceId);
  if (nextPredecessors.length === currentPredecessors.length) {
    return false;
  }

  targetNode.predecessors = nextPredecessors.join(", ");
  return true;
}

function clearPendingConnection() {
  state.pendingConnectionSourceUid = null;
}

function clearSelectedConnection() {
  state.selectedConnection = null;
}

function selectConnection(sourceId, targetUid) {
  if (document.activeElement && typeof document.activeElement.blur === "function") {
    document.activeElement.blur();
  }
  state.selectedConnection = { sourceId, targetUid };
}

function isSelectedConnection(sourceId, targetUid) {
  return (
    state.selectedConnection &&
    state.selectedConnection.sourceId === sourceId &&
    state.selectedConnection.targetUid === targetUid
  );
}

function closeConnectionContextMenu() {
  if (!connectionContextMenu) {
    return;
  }
  delete connectionContextMenu.dataset.sourceId;
  delete connectionContextMenu.dataset.targetUid;
  connectionContextMenu.classList.add("hidden");
}

function openConnectionContextMenu(clientX, clientY) {
  if (!connectionContextMenu) {
    return;
  }
  if (state.selectedConnection) {
    connectionContextMenu.dataset.sourceId = state.selectedConnection.sourceId;
    connectionContextMenu.dataset.targetUid = state.selectedConnection.targetUid;
  }
  connectionContextMenu.style.left = `${clientX}px`;
  connectionContextMenu.style.top = `${clientY}px`;
  connectionContextMenu.classList.remove("hidden");
}

function deleteConnectionByIds(sourceId, targetUid) {
  if (!sourceId || !targetUid) {
    return false;
  }

  pushHistorySnapshot();
  closeConnectionContextMenu();
  clearPendingConnection();
  clearSelectedConnection();
  if (removeConnection(sourceId, targetUid)) {
    markDirty("Pfeil entfernt. Bitte prÃ¼fen.");
    return true;
  }

  render();
  return false;
}

function deleteSelectedConnection() {
  if (!state.selectedConnection) {
    return false;
  }

  const { sourceId, targetUid } = state.selectedConnection;
  return deleteConnectionByIds(sourceId, targetUid);
}

function handleConnectorClick(uid, type) {
  closeConnectionContextMenu();
  clearSelectedConnection();

  if (type === "out") {
    if (state.pendingConnectionSourceUid === uid) {
      clearPendingConnection();
      statusElement.textContent = "Verbindungsauswahl aufgehoben.";
    } else {
      state.pendingConnectionSourceUid = uid;
      statusElement.textContent = "Startpunkt gewÃ¤hlt. Jetzt Eingangs-Punkt einer anderen Kachel anklicken.";
    }
    render();
    return;
  }

  const sourceUid = state.pendingConnectionSourceUid;
  if (!sourceUid) {
    statusElement.textContent = "Bitte zuerst einen Ausgangs-Punkt auswÃ¤hlen.";
    return;
  }

  const canCreateConnection = canAddConnection(sourceUid, uid);
  if (canCreateConnection) {
    pushHistorySnapshot();
  }
  const didAddConnection = addConnection(sourceUid, uid);
  clearPendingConnection();
  if (didAddConnection) {
    markDirty("Pfeil gesetzt. Bitte prÃ¼fen.");
  } else {
    statusElement.textContent = "Pfeil konnte nicht gesetzt werden.";
    render();
  }
}

function getConnectorCenter(node, cardElement, selector) {
  const connector = cardElement.querySelector(selector);
  if (!connector) {
    return {
      x: node.x + (selector.includes("out") ? cardElement.offsetWidth : 0),
      y: node.y + cardElement.offsetHeight / 2,
    };
  }

  return {
    x: node.x + connector.offsetLeft + connector.offsetWidth / 2,
    y: node.y + connector.offsetTop + connector.offsetHeight / 2,
  };
}

function clearCalculatedFields() {
  state.nodes.forEach((node) => {
    node.error = "";
    node.critical = false;
  });
}

function markDirty(message = "Ãƒâ€žnderungen vorhanden. Bitte prÃƒÂ¼fen.") {
  state.isDirty = true;
  state.lastErrors = [];
  state.lastProjectDuration = 0;
  state.expectedValues = new Map();
  clearPendingConnection();
  clearSelectedConnection();
  closeConnectionContextMenu();
  clearCalculatedFields();
  statusElement.textContent = message;
  render();
}

function applySolutionValues() {
  if (!state.expectedValues || state.expectedValues.size === 0) {
    return;
  }

  state.nodes.forEach((node) => {
    const expected = state.expectedValues.get(node.uid);
    if (!expected) {
      return;
    }

    node.faz = String(expected.faz);
    node.fez = String(expected.fez);
    node.saz = String(expected.saz);
    node.sez = String(expected.sez);
    node.gp = String(expected.gp);
    node.fp = String(expected.fp);
  });

  state.lastErrors = [];
  render();
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function getSerializableNodes() {
  return state.nodes.map((node) => ({
    id: node.id,
    label: node.label,
    duration: node.duration,
    predecessors: node.predecessors,
    faz: node.faz,
    fez: node.fez,
    saz: node.saz,
    sez: node.sez,
    gp: node.gp,
    fp: node.fp,
    x: node.x,
    y: node.y,
  }));
}

function getSerializableState() {
  return {
    projectName: state.projectName,
    nodes: getSerializableNodes(),
    zoom: state.zoom,
    offsetX: state.offsetX,
    offsetY: state.offsetY,
    mode: state.mode,
    view: state.view,
    savedAt: new Date().toISOString(),
  };
}

function readSavedProjects() {
  try {
    return JSON.parse(localStorage.getItem(PROJECTS_STORAGE_KEY) || "[]");
  } catch {
    return [];
  }
}

function writeSavedProjects(projects) {
  localStorage.setItem(PROJECTS_STORAGE_KEY, JSON.stringify(projects));
}

function refreshSavedProjectsList() {
  if (!savedProjectsSelect) {
    return;
  }

  const projects = readSavedProjects();
  savedProjectsSelect.innerHTML = "";

  if (projects.length === 0) {
    const option = document.createElement("option");
    option.textContent = "Keine gespeicherten Projekte";
    option.disabled = true;
    savedProjectsSelect.appendChild(option);
    return;
  }

  projects.forEach((project, index) => {
    const option = document.createElement("option");
    option.value = String(index);
    option.textContent = project.projectName || `Projekt ${index + 1}`;
    savedProjectsSelect.appendChild(option);
  });
}

function saveToBrowser() {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(getSerializableState()));
    statusElement.textContent = "Plan im Browser gespeichert.";
  } catch (error) {
    statusElement.textContent = "Speichern im Browser ist fehlgeschlagen.";
  }
}

function loadFromBrowser() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      statusElement.textContent = "Es gibt noch keinen gespeicherten Plan.";
      return;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.nodes)) {
      throw new Error("Kein gÃƒÂ¼ltiger Speicherstand gefunden.");
    }

    state.nodes = normalizeNodes(parsed.nodes);
    state.zoom = typeof parsed.zoom === "number" ? parsed.zoom : 0.8;
    state.offsetX = typeof parsed.offsetX === "number" ? parsed.offsetX : 160;
    state.offsetY = typeof parsed.offsetY === "number" ? parsed.offsetY : 120;
    markDirty("Gespeicherten Plan geladen. Bitte prÃƒÂ¼fen.");
  } catch (error) {
    statusElement.textContent = "Gespeicherten Plan konnte nicht geladen werden.";
  }
}

function getExportBounds() {
  if (state.nodes.length === 0) {
    return { minX: 0, minY: 0, width: 1200, height: 800 };
  }

  const minX = Math.min(...state.nodes.map((node) => node.x)) - EXPORT_PADDING;
  const minY = Math.min(...state.nodes.map((node) => node.y)) - EXPORT_PADDING;
  const maxX = Math.max(...state.nodes.map((node) => node.x + NODE_WIDTH)) + EXPORT_PADDING;
  const maxY = Math.max(...state.nodes.map((node) => node.y + NODE_HEIGHT)) + EXPORT_PADDING;

  return {
    minX,
    minY,
    width: Math.max(600, maxX - minX),
    height: Math.max(400, maxY - minY),
  };
}

function buildConnectionPath(sourceNode, targetNode, bounds) {
  const sourceX = sourceNode.x + NODE_WIDTH - bounds.minX;
  const sourceY = sourceNode.y + NODE_HEIGHT / 2 - bounds.minY;
  const targetX = targetNode.x - bounds.minX;
  const targetY = targetNode.y + NODE_HEIGHT / 2 - bounds.minY;
  const midX = (sourceX + targetX) / 2;
  return `M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`;
}

function buildStandaloneSvg() {
  const bounds = getExportBounds();
  const metadata = JSON.stringify({
    nodes: getSerializableNodes(),
    zoom: state.zoom,
    offsetX: state.offsetX,
    offsetY: state.offsetY,
  });

  const lines = [];
  state.nodes.forEach((node) => {
    predecessorList(node).forEach((predecessorId) => {
      const predecessorNode = state.nodes.find((entry) => entry.id === predecessorId);
      if (!predecessorNode) {
        return;
      }

      lines.push(
        `<path d="${buildConnectionPath(predecessorNode, node, bounds)}" fill="none" stroke="${predecessorNode.critical && node.critical ? "#a71d31" : "#6b5640"}" stroke-width="3"/>`
      );
    });
  });

  const nodeMarkup = state.nodes.map((node) => {
    const x = node.x - bounds.minX;
    const y = node.y - bounds.minY;
    const background = node.critical ? "#fff8f8" : "#ffffff";
    const border = node.error ? "#c47000" : node.critical ? "#c15e6e" : "#8f7757";

    return `
      <g transform="translate(${x},${y})">
        <rect x="0" y="0" width="${NODE_WIDTH}" height="${NODE_HEIGHT}" rx="20" ry="20" fill="${background}" stroke="${border}" stroke-width="1.5"/>
        <text x="20" y="18" font-size="13" font-weight="700" fill="#2f2418">FAZ</text>
        <text x="${NODE_WIDTH - 20}" y="18" font-size="13" font-weight="700" fill="#2f2418" text-anchor="end">FEZ</text>
        <text x="20" y="38" font-size="16" fill="#2f2418">${escapeXml(node.faz || "-")}</text>
        <text x="${NODE_WIDTH - 20}" y="38" font-size="16" fill="#2f2418" text-anchor="end">${escapeXml(node.fez || "-")}</text>
        <rect x="14" y="48" width="${NODE_WIDTH - 28}" height="152" fill="#fffdf8" stroke="#8f7757" stroke-width="1.5"/>
        <line x1="102" y1="48" x2="102" y2="124" stroke="#8f7757"/>
        <line x1="14" y1="124" x2="${NODE_WIDTH - 14}" y2="124" stroke="#8f7757"/>
        <line x1="163" y1="124" x2="163" y2="200" stroke="#8f7757"/>
        <text x="24" y="70" font-size="12" font-weight="700" fill="#2f2418">Nr.</text>
        <text x="114" y="70" font-size="12" font-weight="700" fill="#2f2418">Bezeichnung</text>
        <text x="24" y="146" font-size="12" font-weight="700" fill="#2f2418">Dauer</text>
        <text x="114" y="146" font-size="12" font-weight="700" fill="#2f2418">GP</text>
        <text x="177" y="146" font-size="12" font-weight="700" fill="#2f2418">FP</text>
        <text x="24" y="94" font-size="16" fill="#2f2418">${escapeXml(node.id || "-")}</text>
        <text x="114" y="94" font-size="15" fill="#2f2418">${escapeXml(node.label || "-")}</text>
        <text x="24" y="170" font-size="16" fill="#2f2418">${escapeXml(node.duration || "-")}</text>
        <text x="114" y="170" font-size="16" fill="#2f2418">${escapeXml(node.gp || "-")}</text>
        <text x="177" y="170" font-size="16" fill="#2f2418">${escapeXml(node.fp || "-")}</text>
        <text x="20" y="220" font-size="13" font-weight="700" fill="#2f2418">SAZ</text>
        <text x="${NODE_WIDTH - 20}" y="220" font-size="13" font-weight="700" fill="#2f2418" text-anchor="end">SEZ</text>
        <text x="20" y="238" font-size="16" fill="#2f2418">${escapeXml(node.saz || "-")}</text>
        <text x="${NODE_WIDTH - 20}" y="238" font-size="16" fill="#2f2418" text-anchor="end">${escapeXml(node.sez || "-")}</text>
      </g>
    `;
  }).join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${bounds.width}" height="${bounds.height}" viewBox="0 0 ${bounds.width} ${bounds.height}">
  <metadata id="netzplan-data"><![CDATA[${metadata}]]></metadata>
  <rect width="100%" height="100%" fill="#f7f1e6"/>
  ${lines.join("")}
  ${nodeMarkup}
</svg>`;
}

function downloadBlob(filename, blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function validateAndCalculate() {
  const errors = [];
  const byId = new Map();
  const expectedValues = new Map();

  clearCalculatedFields();

  state.nodes.forEach((node) => {
    const normalizedId = String(node.id || "").trim();
    const durationValue = String(node.duration ?? "").trim();

    if (!normalizedId) {
      node.error = "Fehlende ID";
      errors.push("Mindestens ein Vorgang hat keine ID.");
      return;
    }

    if (byId.has(normalizedId)) {
      node.error = "Doppelte ID";
      errors.push(`Die ID "${normalizedId}" wurde mehrfach verwendet.`);
      return;
    }

    if (durationValue === "") {
      node.error = "Fehlende Dauer";
      errors.push(`Beim Vorgang "${normalizedId}" fehlt die Dauer.`);
      return;
    }

    if (!/^\d+([.,]\d+)?$/.test(durationValue)) {
      node.error = "UngÃƒÂ¼ltige Dauer";
      errors.push(`Die Dauer von "${normalizedId}" ist keine gÃƒÂ¼ltige Zahl.`);
      return;
    }

    node.id = normalizedId;
    node.duration = Number(durationValue.replace(",", "."));

    if (node.duration < 0) {
      node.error = "Negative Dauer";
      errors.push(`Die Dauer von "${normalizedId}" darf nicht negativ sein.`);
      return;
    }

    byId.set(normalizedId, node);
  });

  const successors = new Map();
  const indegree = new Map();

  state.nodes.forEach((node) => {
    if (!node.id) {
      return;
    }
    successors.set(node.id, []);
    indegree.set(node.id, 0);
  });

  state.nodes.forEach((node) => {
    if (!node.id || node.error) {
      return;
    }

    predecessorList(node).forEach((predecessorId) => {
      const predecessorNode = byId.get(predecessorId);
      if (!predecessorNode) {
        node.error = `Unbekannter VorgÃƒÂ¤nger: ${predecessorId}`;
        errors.push(`Beim Vorgang "${node.id}" ist der VorgÃƒÂ¤nger "${predecessorId}" unbekannt.`);
        return;
      }

      successors.get(predecessorId).push(node.id);
      indegree.set(node.id, indegree.get(node.id) + 1);
    });
  });

  const queue = [];
  indegree.forEach((value, key) => {
    if (value === 0) {
      queue.push(key);
    }
  });

  const order = [];
  while (queue.length > 0) {
    const currentId = queue.shift();
    order.push(currentId);

    for (const successorId of successors.get(currentId) || []) {
      indegree.set(successorId, indegree.get(successorId) - 1);
      if (indegree.get(successorId) === 0) {
        queue.push(successorId);
      }
    }
  }

  if (order.length !== byId.size) {
    errors.push("Es gibt einen Zyklus in den AbhÃƒÂ¤ngigkeiten. Ein Netzplan darf keine KreisbezÃƒÂ¼ge haben.");
  }

  for (const nodeId of order) {
    const node = byId.get(nodeId);
    const predecessors = predecessorList(node);
    const faz = predecessors.length === 0
      ? 0
      : Math.max(...predecessors.map((predecessorId) => byId.get(predecessorId).fez));

    const current = expectedValues.get(node.uid) || {};
    current.faz = faz;
    current.fez = faz + node.duration;
    expectedValues.set(node.uid, current);
    node.faz = node.faz ?? "";
    node.fez = node.fez ?? "";
  }

  const projectDuration = Math.max(0, ...Array.from(expectedValues.values()).map((node) => Number(node.fez) || 0));

  for (let index = order.length - 1; index >= 0; index -= 1) {
    const nodeId = order[index];
    const node = byId.get(nodeId);
    const nodeSuccessors = successors.get(nodeId) || [];
    const sez = nodeSuccessors.length === 0
      ? projectDuration
      : Math.min(...nodeSuccessors.map((successorId) => expectedValues.get(byId.get(successorId).uid).saz));
    const saz = sez - node.duration;
    const expected = expectedValues.get(node.uid);

    expected.sez = sez;
    expected.saz = saz;
    expected.gp = saz - expected.faz;
    node.fp = nodeSuccessors.length === 0
      ? expected.gp
      : Math.min(...nodeSuccessors.map((successorId) => expectedValues.get(byId.get(successorId).uid).faz)) - expected.fez;
    expected.fp = node.fp;
    node.critical = expected.gp === 0;
  }

  if (errors.length === 0) {
    state.nodes.forEach((node) => {
      const expected = expectedValues.get(node.uid);
      ["faz", "fez", "saz", "sez", "gp", "fp"].forEach((field) => {
        const userValue = String(node[field] ?? "").trim();
        const expectedValue = String(expected[field]);
        if (userValue === "") {
          errors.push(`Beim Vorgang "${node.id}" fehlt der Wert ${field.toUpperCase()}.`);
          node.error = "Fehlende Ergebnisse";
        } else if (userValue !== expectedValue) {
          errors.push(`Beim Vorgang "${node.id}" ist ${field.toUpperCase()} falsch. Richtig wÃƒÂ¤re ${expectedValue}.`);
          node.error = "Falsche Ergebnisse";
        }
      });
    });
  }

  state.lastErrors = errors;
  state.lastProjectDuration = projectDuration;
  state.isDirty = false;
  state.expectedValues = expectedValues;
  render();
}

function render() {
  applyViewport();
  nodesLayer.innerHTML = "";
  connectionsLayer.innerHTML = "";

  state.nodes.forEach((node) => {
    const fragment = nodeTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".node-card");
    card.dataset.uid = node.uid;
    card.style.left = `${node.x}px`;
    card.style.top = `${node.y}px`;
    card.classList.toggle("is-critical", node.critical);
    card.classList.toggle("has-error", Boolean(node.error));

    fragment.querySelectorAll("[data-field]").forEach((element) => {
      const field = element.dataset.field;
      element.value = node[field] ?? "";
      element.addEventListener("input", (event) => {
        node[field] = event.target.value;
        markDirty();
      });
      element.addEventListener("pointerdown", (event) => event.stopPropagation());

      const expected = state.expectedValues?.get(node.uid);
      if (expected && !state.isDirty && ["faz", "fez", "saz", "sez", "gp", "fp"].includes(field)) {
        const isCorrect = String(node[field] ?? "").trim() === String(expected[field]);
        element.classList.toggle("field-correct", isCorrect);
        element.classList.toggle("field-wrong", !isCorrect);
      }
    });

    fragment.querySelector("[data-action='delete']").addEventListener("click", () => {
      state.nodes = state.nodes.filter((entry) => entry.uid !== node.uid);
      markDirty("Vorgang gelÃƒÂ¶scht. Bitte prÃƒÂ¼fen.");
    });

    fragment.querySelector("[data-action='duplicate']").addEventListener("click", () => {
      const duplicate = createEmptyNode(node.x + 32, node.y + 32);
      duplicate.id = `${node.id}_Kopie`;
      duplicate.label = node.label;
      duplicate.duration = node.duration;
      duplicate.predecessors = node.predecessors;
      state.nodes.push(duplicate);
      markDirty("Vorgang kopiert. Bitte prÃƒÂ¼fen.");
    });

    card.addEventListener("pointerdown", (event) => startDrag(event, node.uid));
    nodesLayer.appendChild(fragment);
  });

  drawConnections();
  renderSummary();
}

function applyViewport() {
  scene.style.transform = `translate(${state.offsetX}px, ${state.offsetY}px) scale(${state.zoom})`;
  zoomLevelElement.textContent = `${Math.round(state.zoom * 100)} %`;
}

function renderSummary() {
  const criticalPath = state.nodes
    .filter((node) => node.critical)
    .sort((left, right) => Number(left.faz) - Number(right.faz))
    .map((node) => node.id);

  summaryElement.innerHTML = [
    `<p><strong>VorgÃƒÂ¤nge:</strong> ${state.nodes.length}</p>`,
    `<p><strong>Projektdauer:</strong> ${state.lastProjectDuration}</p>`,
    `<p><strong>Kritischer Pfad:</strong> ${criticalPath.length ? criticalPath.join(" -> ") : "noch nicht berechnet"}</p>`,
  ].join("");

  if (state.nodes.length === 0) {
    validationResultsElement.innerHTML = "<p>Noch keine VorgÃƒÂ¤nge vorhanden.</p>";
    statusElement.textContent = "Bereit.";
    showSolutionButton.hidden = true;
    return;
  }

  if (state.isDirty) {
    validationResultsElement.innerHTML = "<p>Noch nicht geprÃƒÂ¼ft. DrÃƒÂ¼cke auf \"PrÃƒÂ¼fen & berechnen\".</p>";
    showSolutionButton.hidden = true;
    return;
  }

  if (state.lastErrors.length > 0) {
    validationResultsElement.innerHTML = `<p><strong>Fehler gefunden:</strong></p><ul>${state.lastErrors.map((error) => `<li>${error}</li>`).join("")}</ul>`;
    statusElement.textContent = "Bitte Eingaben prÃƒÂ¼fen.";
    showSolutionButton.hidden = false;
    return;
  }

  validationResultsElement.innerHTML = "<p><strong>PrÃƒÂ¼fung:</strong> Alles sieht korrekt aus.</p>";
  statusElement.textContent = "Berechnung erfolgreich.";
  showSolutionButton.hidden = true;
}

function drawConnections() {
  const nodeElements = Array.from(nodesLayer.querySelectorAll(".node-card"));
  const elementById = new Map();

  nodeElements.forEach((element) => {
    const node = state.nodes.find((entry) => entry.uid === element.dataset.uid);
    if (node) {
      elementById.set(node.id, element);
    }
  });

  const marker = document.createElementNS("http://www.w3.org/2000/svg", "marker");
  marker.setAttribute("id", "arrowhead");
  marker.setAttribute("markerWidth", "10");
  marker.setAttribute("markerHeight", "8");
  marker.setAttribute("refX", "9");
  marker.setAttribute("refY", "4");
  marker.setAttribute("orient", "auto");

  const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
  path.setAttribute("d", "M0,0 L10,4 L0,8 z");
  path.setAttribute("fill", "rgba(72, 54, 32, 0.65)");
  marker.appendChild(path);

  const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
  defs.appendChild(marker);
  connectionsLayer.appendChild(defs);

  state.nodes.forEach((node) => {
    const targetElement = elementById.get(node.id);
    if (!targetElement) {
      return;
    }

    predecessorList(node).forEach((predecessorId) => {
      const predecessorNode = state.nodes.find((entry) => entry.id === predecessorId);
      const sourceElement = elementById.get(predecessorId);
      if (!predecessorNode || !sourceElement) {
        return;
      }

      const { x: sourceX, y: sourceY } = getConnectorCenter(predecessorNode, sourceElement, ".connection-point-out");
      const { x: targetX, y: targetY } = getConnectorCenter(node, targetElement, ".connection-point-in");
      const midX = (sourceX + targetX) / 2;
      const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
      line.setAttribute("d", `M ${sourceX} ${sourceY} C ${midX} ${sourceY}, ${midX} ${targetY}, ${targetX} ${targetY}`);
      line.setAttribute("class", "connection-line");
      line.setAttribute("marker-end", "url(#arrowhead)");
      line.dataset.sourceId = predecessorNode.id;
      line.dataset.targetUid = node.uid;

      if (predecessorNode.critical && node.critical) {
        line.classList.add("critical");
      }
      line.classList.toggle("is-selected", isSelectedConnection(predecessorNode.id, node.uid));
      line.addEventListener("pointerdown", (event) => {
        event.stopPropagation();
      });
      line.addEventListener("click", (event) => {
        event.stopPropagation();
        closeConnectionContextMenu();
        selectConnection(predecessorNode.id, node.uid);
        clearPendingConnection();
        statusElement.textContent = "Pfeil ausgewÃ¤hlt. Mit Entf lÃ¶schen oder Rechtsklick fÃ¼r MenÃ¼.";
        render();
      });
      line.addEventListener("dblclick", (event) => {
        event.preventDefault();
        event.stopPropagation();
        deleteConnectionByIds(predecessorNode.id, node.uid);
      });
      line.addEventListener("contextmenu", (event) => {
        event.preventDefault();
        event.stopPropagation();
        selectConnection(predecessorNode.id, node.uid);
        clearPendingConnection();
        statusElement.textContent = "Pfeil ausgewÃ¤hlt. KontextmenÃ¼ geÃ¶ffnet.";
        render();
        openConnectionContextMenu(event.clientX, event.clientY);
      });

      connectionsLayer.appendChild(line);
    });
  });
}

function startDrag(event, uid) {
  if (event.target.tagName === "INPUT" || event.target.tagName === "BUTTON") {
    return;
  }

  const node = state.nodes.find((entry) => entry.uid === uid);
  if (!node) {
    return;
  }

  pushHistorySnapshot();

  state.drag = {
    uid,
    offsetX: event.clientX - state.offsetX - node.x * state.zoom,
    offsetY: event.clientY - state.offsetY - node.y * state.zoom,
  };
}

function onPointerMove(event) {
  if (state.drag) {
    const node = state.nodes.find((entry) => entry.uid === state.drag.uid);
    if (!node) {
      return;
    }

    node.x = Math.max(12, (event.clientX - state.offsetX - state.drag.offsetX) / state.zoom);
    node.y = Math.max(12, (event.clientY - state.offsetY - state.drag.offsetY) / state.zoom);
    render();
    return;
  }

  if (state.pan) {
    state.offsetX = state.pan.startOffsetX + (event.clientX - state.pan.startX);
    state.offsetY = state.pan.startOffsetY + (event.clientY - state.pan.startY);
    applyViewport();
  }
}

function onPointerUp() {
  state.drag = null;
  state.pan = null;
}

function startPan(event) {
  if (event.target.closest(".node-card")) {
    return;
  }

  state.pan = {
    startX: event.clientX,
    startY: event.clientY,
    startOffsetX: state.offsetX,
    startOffsetY: state.offsetY,
  };
}

function setZoom(nextZoom, anchorX = canvas.clientWidth / 2, anchorY = canvas.clientHeight / 2) {
  const clampedZoom = Math.min(1.6, Math.max(0.35, nextZoom));
  const worldX = (anchorX - state.offsetX) / state.zoom;
  const worldY = (anchorY - state.offsetY) / state.zoom;
  state.zoom = clampedZoom;
  state.offsetX = anchorX - worldX * state.zoom;
  state.offsetY = anchorY - worldY * state.zoom;
  applyViewport();
}

function onCanvasWheel(event) {
  if (!event.ctrlKey) {
    return;
  }
  event.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const anchorX = event.clientX - rect.left;
  const anchorY = event.clientY - rect.top;
  setZoom(state.zoom + (event.deltaY < 0 ? 0.1 : -0.1), anchorX, anchorY);
}

function exportJson() {
  const blob = new Blob([JSON.stringify(getSerializableState(), null, 2)], { type: "application/json" });
  downloadBlob("netzplan.json", blob);
}

function exportSvg() {
  const blob = new Blob([buildStandaloneSvg()], { type: "image/svg+xml;charset=utf-8" });
  downloadBlob("netzplan.svg", blob);
}

function svgToImageElement(svgMarkup) {
  return new Promise((resolve, reject) => {
    const blob = new Blob([svgMarkup], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Die Grafik konnte nicht erzeugt werden."));
    };
    image.src = url;
  });
}

async function exportPng() {
  const svgMarkup = buildStandaloneSvg();
  const image = await svgToImageElement(svgMarkup);
  const bounds = getExportBounds();
  const renderCanvas = document.createElement("canvas");
  const scale = 2;
  renderCanvas.width = Math.ceil(bounds.width * scale);
  renderCanvas.height = Math.ceil(bounds.height * scale);
  const context = renderCanvas.getContext("2d");
  context.scale(scale, scale);
  context.drawImage(image, 0, 0, bounds.width, bounds.height);

  const blob = await new Promise((resolve) => renderCanvas.toBlob(resolve, "image/png"));
  downloadBlob("netzplan.png", blob);
}

async function exportPdf() {
  if (!window.jspdf?.jsPDF) {
    throw new Error("PDF-Bibliothek konnte nicht geladen werden.");
  }

  const svgMarkup = buildStandaloneSvg();
  const image = await svgToImageElement(svgMarkup);
  const bounds = getExportBounds();
  const renderCanvas = document.createElement("canvas");
  renderCanvas.width = bounds.width * 2;
  renderCanvas.height = bounds.height * 2;
  const context = renderCanvas.getContext("2d");
  context.scale(2, 2);
  context.drawImage(image, 0, 0, bounds.width, bounds.height);
  const imageData = renderCanvas.toDataURL("image/png");

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation: bounds.width >= bounds.height ? "landscape" : "portrait",
    unit: "pt",
    format: [bounds.width, bounds.height],
  });
  pdf.addImage(imageData, "PNG", 0, 0, bounds.width, bounds.height);
  pdf.save("netzplan.pdf");
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!Array.isArray(parsed)) {
        throw new Error("Die JSON-Datei muss eine Liste von VorgÃƒÂ¤ngen enthalten.");
      }

      state.nodes = normalizeNodes(parsed);
      markDirty("Import geladen. Bitte prÃƒÂ¼fen.");
    } catch (error) {
      statusElement.textContent = error.message;
    }
  };
  reader.readAsText(file);
}

function importSvg(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const svgText = String(reader.result);
      const match = svgText.match(/<metadata id="netzplan-data"><!\[CDATA\[([\s\S]*?)\]\]><\/metadata>/);
      if (!match) {
        throw new Error("In der SVG wurde kein Netzplan gefunden.");
      }

      const parsed = JSON.parse(match[1]);
      if (!Array.isArray(parsed.nodes)) {
        throw new Error("Die SVG enthÃƒÂ¤lt keine gÃƒÂ¼ltigen Netzplan-Daten.");
      }

      state.nodes = normalizeNodes(parsed.nodes);
      state.zoom = typeof parsed.zoom === "number" ? parsed.zoom : state.zoom;
      state.offsetX = typeof parsed.offsetX === "number" ? parsed.offsetX : state.offsetX;
      state.offsetY = typeof parsed.offsetY === "number" ? parsed.offsetY : state.offsetY;
      markDirty("SVG importiert. Bitte prÃƒÂ¼fen.");
    } catch (error) {
      statusElement.textContent = error.message;
    }
  };
  reader.readAsText(file);
}

document.getElementById("add-node-btn").addEventListener("click", () => {
  pushHistorySnapshot();
  state.nodes.push(createEmptyNode(80 + state.nodes.length * 24, 80 + state.nodes.length * 24));
  markDirty("Vorgang hinzugefÃƒÂ¼gt. Bitte prÃƒÂ¼fen.");
});

document.getElementById("recalculate-btn").addEventListener("click", validateAndCalculate);
document.getElementById("load-demo-btn").addEventListener("click", () => {
  state.nodes = normalizeNodes(demoNodes);
  validateAndCalculate();
});
saveBrowserButton.addEventListener("click", saveToBrowser);
loadBrowserButton.addEventListener("click", loadFromBrowser);
document.getElementById("zoom-in-btn").addEventListener("click", () => setZoom(state.zoom + 0.1));
document.getElementById("zoom-out-btn").addEventListener("click", () => setZoom(state.zoom - 0.1));
showSolutionButton.addEventListener("click", applySolutionValues);
document.getElementById("export-btn").addEventListener("click", exportJson);
exportSvgButton.addEventListener("click", () => {
  exportSvg();
  statusElement.textContent = "SVG exportiert.";
});
exportPngButton.addEventListener("click", () => {
  statusElement.textContent = "PNG wird erstellt...";
  exportPng()
    .then(() => {
      statusElement.textContent = "PNG exportiert.";
    })
    .catch((error) => {
      statusElement.textContent = error.message;
    });
});
exportPdfButton.addEventListener("click", () => {
  statusElement.textContent = "PDF wird erstellt...";
  exportPdf()
    .then(() => {
      statusElement.textContent = "PDF exportiert.";
    })
    .catch((error) => {
      statusElement.textContent = error.message;
    });
});
document.getElementById("import-input").addEventListener("change", (event) => {
  const [file] = event.target.files || [];
  if (file && file.name.toLowerCase().endsWith(".json")) {
    importJson(file);
  } else if (file && file.name.toLowerCase().endsWith(".svg")) {
    importSvg(file);
  } else if (file) {
    statusElement.textContent = "Bitte eine JSON- oder SVG-Datei wÃƒÂ¤hlen.";
  }
  event.target.value = "";
});

canvas.addEventListener("pointerdown", startPan);
canvas.addEventListener("wheel", onCanvasWheel, { passive: false });
window.addEventListener("pointermove", onPointerMove);
window.addEventListener("pointerup", onPointerUp);
window.addEventListener("resize", render);
window.addEventListener("keydown", (event) => {
  if (event.ctrlKey && !event.shiftKey && event.key.toLowerCase() === "z") {
    if (undoLastChange()) {
      event.preventDefault();
    }
    return;
  }

  if (event.ctrlKey && event.key.toLowerCase() === "y") {
    if (redoLastChange()) {
      event.preventDefault();
    }
    return;
  }

  if (event.key === "Delete") {
    const activeElement = document.activeElement;
    const isEditableFocused =
      activeElement &&
      (activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        activeElement.tagName === "SELECT" ||
        activeElement.isContentEditable);
    if (isEditableFocused && !state.selectedConnection) {
      return;
    }
    if (deleteSelectedConnection()) {
      event.preventDefault();
    }
  } else if (event.key === "Escape") {
    closeConnectionContextMenu();
    clearPendingConnection();
    clearSelectedConnection();
    render();
  }
});
window.addEventListener("click", (event) => {
  if (event.target.closest(".connection-line")) {
    return;
  }
  if (event.target.closest(".context-menu")) {
    return;
  }
  closeConnectionContextMenu();
  if (state.selectedConnection || state.pendingConnectionSourceUid) {
    clearSelectedConnection();
    clearPendingConnection();
    render();
  }
});

connectionsLayer.addEventListener("contextmenu", (event) => {
  if (!event.target.closest(".connection-line")) {
    closeConnectionContextMenu();
    clearSelectedConnection();
    render();
  }
});

deleteConnectionButton.addEventListener("click", () => {
  const sourceId = connectionContextMenu?.dataset.sourceId || state.selectedConnection?.sourceId;
  const targetUid = connectionContextMenu?.dataset.targetUid || state.selectedConnection?.targetUid;
  deleteConnectionByIds(sourceId, targetUid);
});

try {
  const savedState = localStorage.getItem(LOCAL_STORAGE_KEY);
  if (savedState) {
    loadFromBrowser();
  } else {
    state.nodes = normalizeNodes(demoNodes);
    validateAndCalculate();
  }
} catch (error) {
  state.nodes = normalizeNodes(demoNodes);
  validateAndCalculate();
}



function getDisplayValue(node, field) {
  if (state.mode === "solution" && ["faz", "fez", "saz", "sez", "gp", "fp"].includes(field)) {
    const expected = state.expectedValues.get(node.uid);
    if (expected) {
      return String(expected[field] ?? "");
    }
  }
  return String(node[field] ?? "");
}

function applyFieldState(element, node, field) {
  element.classList.remove("field-correct", "field-wrong", "field-pending");
  if (!["faz", "fez", "saz", "sez", "gp", "fp"].includes(field)) {
    return;
  }
  const expected = state.expectedValues.get(node.uid);
  if (state.isDirty || !expected) {
    element.classList.add("field-pending");
    return;
  }
  const isCorrect = String(node[field] ?? "").trim() === String(expected[field]);
  element.classList.add(isCorrect ? "field-correct" : "field-wrong");
}

function renderTable() {
  if (!tableBody) {
    return;
  }
  tableBody.innerHTML = "";
  const fields = ["id", "label", "duration", "predecessors", "faz", "fez", "saz", "sez", "gp", "fp"];
  state.nodes.forEach((node) => {
    const row = document.createElement("tr");
    fields.forEach((field) => {
      const cell = document.createElement("td");
      const input = document.createElement("input");
      input.className = "table-input";
      input.dataset.uid = node.uid;
      input.dataset.field = field;
      input.value = getDisplayValue(node, field);
      input.disabled = state.mode === "solution" && ["faz", "fez", "saz", "sez", "gp", "fp"].includes(field);
      applyFieldState(input, node, field);
      attachHistoryToEditableInput(input);
      input.addEventListener("input", (event) => {
        node[field] = event.target.value;
        markDirty();
      });
      cell.appendChild(input);
      row.appendChild(cell);
    });
    tableBody.appendChild(row);
  });
}

function setMode(mode) {
  state.mode = mode;
  render();
}

function setView(view) {
  state.view = view;
  if (graphicPanel) {
    graphicPanel.classList.toggle("hidden", view !== "graphic");
  }
  if (tablePanel) {
    tablePanel.classList.toggle("hidden", view !== "table");
  }
  graphicViewButton.classList.toggle("active-toggle", view === "graphic");
  tableViewButton.classList.toggle("active-toggle", view === "table");
}

function saveNamedProject() {
  state.projectName = projectNameInput.value.trim() || "Mein Netzplan";
  projectNameInput.value = state.projectName;
  const projects = readSavedProjects();
  const payload = getSerializableState();
  const existingIndex = projects.findIndex((entry) => entry.projectName === payload.projectName);
  if (existingIndex >= 0) {
    projects[existingIndex] = payload;
  } else {
    projects.push(payload);
  }
  writeSavedProjects(projects);
  refreshSavedProjectsList();
  statusElement.textContent = "Projekt gespeichert.";
}

function openSelectedProject() {
  const projects = readSavedProjects();
  const index = Number(savedProjectsSelect.value);
  if (!Number.isInteger(index) || !projects[index]) {
    statusElement.textContent = "Bitte ein Projekt auswÃ¤hlen.";
    return;
  }
  const project = projects[index];
  state.projectName = project.projectName || "Mein Netzplan";
  state.nodes = normalizeNodes(project.nodes);
  state.zoom = typeof project.zoom === "number" ? project.zoom : 0.8;
  state.offsetX = typeof project.offsetX === "number" ? project.offsetX : 160;
  state.offsetY = typeof project.offsetY === "number" ? project.offsetY : 120;
  state.mode = project.mode === "solution" ? "solution" : "task";
  state.view = project.view === "table" ? "table" : "graphic";
  markDirty("Projekt geladen. Bitte prÃ¼fen.");
}

function deleteSelectedProject() {
  const projects = readSavedProjects();
  const index = Number(savedProjectsSelect.value);
  if (!Number.isInteger(index) || !projects[index]) {
    statusElement.textContent = "Bitte ein Projekt auswÃ¤hlen.";
    return;
  }
  projects.splice(index, 1);
  writeSavedProjects(projects);
  refreshSavedProjectsList();
  statusElement.textContent = "Projekt gelÃ¶scht.";
}

function renderSummary() {
  const criticalPath = state.nodes
    .filter((node) => node.critical)
    .sort((left, right) => Number(left.faz) - Number(right.faz))
    .map((node) => node.id);

  summaryElement.innerHTML = [
    `<p><strong>Projekt:</strong> ${state.projectName || "Mein Netzplan"}</p>`,
    `<p><strong>VorgÃ¤nge:</strong> ${state.nodes.length}</p>`,
    `<p><strong>Projektdauer:</strong> ${state.lastProjectDuration}</p>`,
    `<p><strong>Kritischer Pfad:</strong> ${criticalPath.length ? criticalPath.join(" -> ") : "noch nicht berechnet"}</p>`,
  ].join("");

  if (state.nodes.length === 0) {
    validationResultsElement.innerHTML = "<p>Noch keine VorgÃ¤nge vorhanden.</p>";
    statusElement.textContent = "Bereit.";
    showSolutionButton.hidden = true;
    return;
  }
  if (state.isDirty) {
    validationResultsElement.innerHTML = '<p>Noch nicht geprÃ¼ft. DrÃ¼cke auf "PrÃ¼fen & berechnen".</p>';
    statusElement.textContent = "Ã„nderungen vorhanden.";
    showSolutionButton.hidden = true;
    return;
  }
  if (state.lastErrors.length > 0) {
    validationResultsElement.innerHTML = `<p><strong>Fehler gefunden:</strong></p><ul>${state.lastErrors.map((error) => `<li>${error}</li>`).join("")}</ul>`;
    statusElement.textContent = "Bitte Eingaben prÃ¼fen.";
    showSolutionButton.hidden = false;
    return;
  }
  validationResultsElement.innerHTML = "<p><strong>PrÃ¼fung:</strong> Alles sieht korrekt aus.</p>";
  statusElement.textContent = "Berechnung erfolgreich.";
  showSolutionButton.hidden = true;
}

function render() {
  const focusState = captureFocusState();
  applyViewport();
  syncHistoryButtons();
  projectNameInput.value = state.projectName;
  taskModeButton.classList.toggle("active-toggle", state.mode === "task");
  solutionModeButton.classList.toggle("active-toggle", state.mode === "solution");
  setView(state.view);
  nodesLayer.innerHTML = "";
  connectionsLayer.innerHTML = "";

  state.nodes.forEach((node) => {
    const fragment = nodeTemplate.content.cloneNode(true);
    const card = fragment.querySelector(".node-card");
    card.dataset.uid = node.uid;
    card.style.left = `${node.x}px`;
    card.style.top = `${node.y}px`;
    card.classList.toggle("is-critical", node.critical);
    card.classList.toggle("has-error", Boolean(node.error));
    card.classList.toggle("is-link-source", state.pendingConnectionSourceUid === node.uid);
    fragment.querySelectorAll("[data-connector]").forEach((element) => {
      const type = element.dataset.connector;
      element.classList.toggle("is-pending", type === "out" && state.pendingConnectionSourceUid === node.uid);
      element.addEventListener("click", (event) => {
        event.stopPropagation();
        handleConnectorClick(node.uid, type);
      });
      element.addEventListener("pointerdown", (event) => event.stopPropagation());
    });
    fragment.querySelectorAll("[data-field]").forEach((element) => {
      const field = element.dataset.field;
      element.value = getDisplayValue(node, field);
      const isResultField = ["faz", "fez", "saz", "sez", "gp", "fp"].includes(field);
      element.disabled = state.mode === "solution" && isResultField;
      applyFieldState(element, node, field);
      attachHistoryToEditableInput(element);
      element.addEventListener("input", (event) => {
        node[field] = event.target.value;
        markDirty();
      });
      element.addEventListener("pointerdown", (event) => event.stopPropagation());
    });
    fragment.querySelector("[data-action='delete']").addEventListener("click", () => {
      pushHistorySnapshot();
      state.nodes = state.nodes.filter((entry) => entry.uid !== node.uid);
      markDirty("Vorgang gelÃ¶scht. Bitte prÃ¼fen.");
    });
    fragment.querySelector("[data-action='duplicate']").addEventListener("click", () => {
      pushHistorySnapshot();
      const duplicate = createEmptyNode(node.x + 32, node.y + 32);
      duplicate.id = `${node.id}_Kopie`;
      duplicate.label = node.label;
      duplicate.duration = node.duration;
      duplicate.predecessors = node.predecessors;
      duplicate.faz = node.faz;
      duplicate.fez = node.fez;
      duplicate.saz = node.saz;
      duplicate.sez = node.sez;
      duplicate.gp = node.gp;
      duplicate.fp = node.fp;
      state.nodes.push(duplicate);
      markDirty("Vorgang kopiert. Bitte prÃ¼fen.");
    });
    card.addEventListener("pointerdown", (event) => startDrag(event, node.uid));
    nodesLayer.appendChild(fragment);
  });

  drawConnections();
  renderTable();
  renderSummary();
  refreshSavedProjectsList();
  restoreFocusState(focusState);
}

saveProjectButton.addEventListener("click", saveNamedProject);
undoButton.addEventListener("click", undoLastChange);
redoButton.addEventListener("click", redoLastChange);
openProjectButton.addEventListener("click", openSelectedProject);
deleteProjectButton.addEventListener("click", deleteSelectedProject);
taskModeButton.addEventListener("click", () => setMode("task"));
solutionModeButton.addEventListener("click", () => setMode("solution"));
graphicViewButton.addEventListener("click", () => setView("graphic"));
tableViewButton.addEventListener("click", () => setView("table"));
printButton.addEventListener("click", () => window.print());
projectNameInput.addEventListener("input", () => {
  state.projectName = projectNameInput.value.trim() || "Mein Netzplan";
  markDirty("Projektname geÃ¤ndert. Bitte prÃ¼fen.");
  saveToBrowser();
});
attachHistoryToEditableInput(projectNameInput);
refreshSavedProjectsList();
setView(state.view);
render();



function loadFromBrowser() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) {
      statusElement.textContent = "Es gibt noch keinen gespeicherten Plan.";
      return;
    }
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.nodes)) {
      throw new Error("Kein gÃ¼ltiger Speicherstand gefunden.");
    }
    state.projectName = parsed.projectName || "Mein Netzplan";
    state.nodes = normalizeNodes(parsed.nodes);
    state.zoom = typeof parsed.zoom === "number" ? parsed.zoom : 0.8;
    state.offsetX = typeof parsed.offsetX === "number" ? parsed.offsetX : 160;
    state.offsetY = typeof parsed.offsetY === "number" ? parsed.offsetY : 120;
    state.mode = parsed.mode === "solution" ? "solution" : "task";
    state.view = parsed.view === "table" ? "table" : "graphic";
    markDirty("Gespeicherten Plan geladen. Bitte prÃ¼fen.");
  } catch (error) {
    statusElement.textContent = "Gespeicherten Plan konnte nicht geladen werden.";
  }
}

function importJson(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result));
      if (!parsed || !Array.isArray(parsed.nodes)) {
        throw new Error("Die JSON-Datei muss einen gespeicherten Netzplan enthalten.");
      }
      state.projectName = parsed.projectName || "Mein Netzplan";
      state.nodes = normalizeNodes(parsed.nodes);
      state.zoom = typeof parsed.zoom === "number" ? parsed.zoom : state.zoom;
      state.offsetX = typeof parsed.offsetX === "number" ? parsed.offsetX : state.offsetX;
      state.offsetY = typeof parsed.offsetY === "number" ? parsed.offsetY : state.offsetY;
      state.mode = parsed.mode === "solution" ? "solution" : "task";
      state.view = parsed.view === "table" ? "table" : "graphic";
      markDirty("Import geladen. Bitte prÃ¼fen.");
    } catch (error) {
      statusElement.textContent = error.message;
    }
  };
  reader.readAsText(file);
}


