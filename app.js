import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getDatabase, ref, onValue, push, update, remove, set,
  serverTimestamp, onDisconnect
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { firebaseConfig } from "./firebase-config.js";

const $ = (id) => document.getElementById(id);
const els = {
  sidebar: $("sidebar"), list: $("noteList"), search: $("search"),
  newNote: $("newNote"), del: $("deleteNote"), toggle: $("toggleSidebar"),
  title: $("title"), content: $("content"), saved: $("saved"),
  conn: $("conn"), connText: $("connText"), online: $("online"),
};

if (!firebaseConfig.databaseURL) {
  $("configError").hidden = false;
  throw new Error("Firebase no configurado");
}

const db = getDatabase(initializeApp(firebaseConfig));
const notesRef = ref(db, "notes");

let notes = {};
let currentId = null;
let pending = null;      // temporizador de guardado pendiente
let lastSent = null;     // último estado enviado, para ignorar nuestro propio eco

// ---------- Conexión y presencia ----------
const clientId = Math.random().toString(36).slice(2);
const meRef = ref(db, `presence/${clientId}`);

onValue(ref(db, ".info/connected"), (snap) => {
  const on = snap.val() === true;
  els.conn.classList.toggle("on", on);
  els.connText.textContent = on ? "Conectado" : "Sin conexión";
  if (on) {
    onDisconnect(meRef).remove();
    set(meRef, true);
  }
});

onValue(ref(db, "presence"), (snap) => {
  const n = snap.size;
  els.online.textContent = n > 0 ? `👥 ${n} en línea` : "";
});

// ---------- Lista de notas ----------
onValue(notesRef, (snap) => {
  notes = snap.val() || {};
  renderList();

  if (currentId && !notes[currentId]) {
    selectNote(null);
  } else if (currentId) {
    applyRemote(notes[currentId]);
  } else {
    const fromHash = location.hash.slice(1);
    if (fromHash && notes[fromHash]) selectNote(fromHash);
  }
});

function sortedNotes() {
  return Object.entries(notes).sort((a, b) => (b[1].updatedAt || 0) - (a[1].updatedAt || 0));
}

function renderList() {
  const q = els.search.value.trim().toLowerCase();
  const items = sortedNotes().filter(([, n]) =>
    !q || (n.title || "").toLowerCase().includes(q) || (n.content || "").toLowerCase().includes(q));

  els.list.replaceChildren();
  if (!items.length) {
    const li = document.createElement("li");
    li.className = "empty";
    li.textContent = q ? "Sin resultados" : "No hay notas todavía";
    els.list.append(li);
    return;
  }
  for (const [id, n] of items) {
    const li = document.createElement("li");
    li.classList.toggle("active", id === currentId);
    const t = document.createElement("div");
    t.className = "n-title";
    t.textContent = n.title || "Sin título";
    const m = document.createElement("div");
    m.className = "n-meta";
    m.textContent = `${timeAgo(n.updatedAt)} · ${(n.content || "").split("\n")[0].slice(0, 60)}`;
    li.append(t, m);
    li.onclick = () => { selectNote(id); els.sidebar.classList.remove("open"); };
    els.list.append(li);
  }
}

function timeAgo(ts) {
  if (!ts) return "ahora";
  const s = Math.max(0, (Date.now() - ts) / 1000);
  if (s < 60) return "ahora";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  return new Date(ts).toLocaleDateString("es-ES");
}

// ---------- Editor ----------
function selectNote(id) {
  flush();
  currentId = id;
  const n = id ? notes[id] : null;
  history.replaceState(null, "", id ? `#${id}` : location.pathname);
  els.title.disabled = els.content.disabled = els.del.disabled = !n;
  els.title.value = n?.title || "";
  els.content.value = n?.content || "";
  els.saved.textContent = "";
  lastSent = null;
  renderList();
  if (n && !n.content) els.content.focus();
}

// Aplica cambios de otros usuarios conservando la posición del cursor.
function applyRemote(n) {
  if (!n || pending) return; // si estamos escribiendo, nuestros cambios mandan
  if (lastSent && n.title === lastSent.title && n.content === lastSent.content) return;
  if (els.title.value !== (n.title || "")) replaceKeepingCursor(els.title, n.title || "");
  if (els.content.value !== (n.content || "")) replaceKeepingCursor(els.content, n.content || "");
  els.saved.textContent = `Actualizado ${timeAgo(n.updatedAt)}`;
}

function replaceKeepingCursor(el, next) {
  const prev = el.value;
  const focused = document.activeElement === el;
  const { selectionStart: s, selectionEnd: e } = el;
  let p = 0;
  while (p < prev.length && p < next.length && prev[p] === next[p]) p++;
  const delta = next.length - prev.length;
  el.value = next;
  if (focused) {
    const fix = (x) => (x > p ? Math.max(p, x + delta) : x);
    el.setSelectionRange(fix(s), fix(e));
  }
}

function scheduleSave() {
  if (!currentId) return;
  els.saved.textContent = "Escribiendo…";
  clearTimeout(pending);
  pending = setTimeout(flush, 250);
}

function flush() {
  if (!pending || !currentId) { pending = null; return; }
  clearTimeout(pending);
  pending = null;
  lastSent = { title: els.title.value, content: els.content.value };
  update(ref(db, `notes/${currentId}`), { ...lastSent, updatedAt: serverTimestamp() })
    .then(() => { els.saved.textContent = "Guardado"; })
    .catch((err) => { els.saved.textContent = `Error al guardar: ${err.message}`; });
}

els.title.addEventListener("input", scheduleSave);
els.content.addEventListener("input", scheduleSave);
els.search.addEventListener("input", renderList);
window.addEventListener("beforeunload", flush);

// Tab inserta tabulación en lugar de cambiar el foco
els.content.addEventListener("keydown", (e) => {
  if (e.key === "Tab" && !e.shiftKey) {
    e.preventDefault();
    els.content.setRangeText("\t", els.content.selectionStart, els.content.selectionEnd, "end");
    scheduleSave();
  }
});

els.newNote.onclick = async () => {
  const r = push(notesRef);
  await set(r, { title: "", content: "", updatedAt: serverTimestamp() });
  selectNote(r.key);
  els.title.focus();
  els.sidebar.classList.remove("open");
};

els.del.onclick = async () => {
  if (!currentId) return;
  const name = notes[currentId]?.title || "Sin título";
  if (!confirm(`¿Borrar «${name}»? Se borrará para todos.`)) return;
  const id = currentId;
  clearTimeout(pending);
  pending = null;
  selectNote(null);
  await remove(ref(db, `notes/${id}`));
};

els.toggle.onclick = () => els.sidebar.classList.toggle("open");

setInterval(renderList, 60_000); // refresca los "hace X min"
