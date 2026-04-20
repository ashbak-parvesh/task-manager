/* ============================================================
   CONFIG
   ============================================================ */
const API = "http://127.0.0.1:8000";          // Same origin – FastAPI serves the frontend
const PAGE_SIZE = 10;

/* ============================================================
   STATE
   ============================================================ */
let state = {
  token: localStorage.getItem("token") || null,
  username: localStorage.getItem("username") || null,
  currentPage: 1,
  filters: { completed: "", priority: "", search: "" },
};

/* ============================================================
   BOOTSTRAP
   ============================================================ */
document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");

  // FORCE CLEAN STATE FIRST
  state.token = token && token !== "undefined" ? token : null;
  state.username = localStorage.getItem("username");

  if (state.token) {
    showApp();
    loadTasks();
  } else {
    showAuth();
  }
});

/* ============================================================
   VIEW HELPERS
   ============================================================ */
function showAuth() {
  document.getElementById("auth-section").classList.remove("hidden");
  document.getElementById("app-section").classList.add("hidden");
}

function showApp() {
  document.getElementById("auth-section").classList.add("hidden");
  document.getElementById("app-section").classList.remove("hidden");
  document.getElementById("nav-username").textContent = state.username ?? "";
}

function switchTab(tab) {
  const isLogin = tab === "login";

  document.getElementById("panel-login").classList.toggle("hidden", !isLogin);
  document.getElementById("panel-register").classList.toggle("hidden", isLogin);

  document.getElementById("tab-login").classList.toggle("active", isLogin);
  document.getElementById("tab-register").classList.toggle("active", !isLogin);
}

/* ============================================================
   TOAST
   ============================================================ */
let _toastTimer = null;

function showToast(message, type = "info") {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.className = `toast ${type} show`;

  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => {
    el.classList.remove("show");
  }, 3500);
}

/* ============================================================
   API HELPER
   ============================================================ */
async function apiFetch(path, options = {}) {
  const headers = { "Content-Type": "application/json", ...options.headers };
  if (state.token) headers["Authorization"] = `Bearer ${state.token}`;

  const res = await fetch(`${API}${path}`, { ...options, headers });

  // 401 → force logout
  if (res.status === 401) {
    logout(false);
    showToast("Session expired. Please log in again.", "error");
    throw new Error("Unauthorized");
  }

  return res;
}

/* ============================================================
   AUTH — REGISTER
   ============================================================ */
async function register() {
  const username = document.getElementById("reg-username").value.trim();
  const email    = document.getElementById("reg-email").value.trim();
  const password = document.getElementById("reg-password").value;

  if (!username || !email || !password) {
    showToast("Please fill in all fields.", "error");
    return;
  }

  try {
    const res = await apiFetch("/auth/register", {
      method: "POST",
      body: JSON.stringify({ username, email, password }),
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.detail ?? "Registration failed.", "error");
      return;
    }

    showToast("Account created! Please log in.", "success");
    switchTab("login");

    // Pre-fill login username
    document.getElementById("login-username").value = username;
    document.getElementById("reg-username").value = "";
    document.getElementById("reg-email").value = "";
    document.getElementById("reg-password").value = "";
  } catch (err) {
    if (err.message !== "Unauthorized")
      showToast("Network error. Is the server running?", "error");
  }
}

/* ============================================================
   AUTH — LOGIN
   ============================================================ */
async function login() {
  const username = document.getElementById("login-username").value.trim();
  const password = document.getElementById("login-password").value;

  if (!username || !password) {
    showToast("Please enter username and password.", "error");
    return;
  }

  try {
    // ✅ FIX: proper form-data format
    const body = new URLSearchParams();
    body.append("username", username);
    body.append("password", password);

    const res = await fetch(`${API}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: body.toString()
    });

    const data = await res.json();

    if (!res.ok) {
      showToast(data.detail ?? "Login failed.", "error");
      return;
    }

    // save token
    state.token = data.access_token;
    state.username = username;

    localStorage.setItem("token", state.token);
    localStorage.setItem("username", state.username);

    showToast("Login successful!", "success");
    showApp();
    loadTasks();

  } catch (err) {
    showToast("Server not reachable. Check backend.", "error");
  }
}

/* ============================================================
   AUTH — LOGOUT
   ============================================================ */
function logout(notify = true) {
  state.token    = null;
  state.username = null;
  state.currentPage = 1;
  localStorage.removeItem("token");
  localStorage.removeItem("username");

  // Clear form inputs
  document.getElementById("login-username").value = "";
  document.getElementById("login-password").value = "";

  showAuth();
  if (notify) showToast("Logged out successfully.", "info");
}

/* ============================================================
   TASKS — LOAD (with filters + pagination)
   ============================================================ */
async function loadTasks(page = state.currentPage) {
  state.currentPage = page;

  const params = new URLSearchParams();
  params.set("page", page);
  params.set("page_size", PAGE_SIZE);

  const { completed, priority, search } = state.filters;
  if (completed !== "") params.set("completed", completed);
  if (priority  !== "") params.set("priority",  priority);
  if (search    !== "") params.set("search",     search);

  try {
    const res  = await apiFetch(`/tasks?${params}`);
    const data = await res.json();

    if (!res.ok) {
      showToast(data.detail ?? "Failed to load tasks.", "error");
      return;
    }

    renderTasks(data);
    renderPagination(data);
    renderStats(data);
  } catch (err) {
    if (err.message !== "Unauthorized")
      showToast("Could not fetch tasks.", "error");
  }
}

/* ============================================================
   TASKS — RENDER LIST
   ============================================================ */
function renderTasks({ items }) {
  const container = document.getElementById("task-list");

  if (!items.length) {
    container.innerHTML = `
      <div class="empty-state">
        <i class='bx bx-inbox'></i>
        <p>No tasks found. Try adjusting filters or create one!</p>
      </div>`;
    return;
  }

  container.innerHTML = items.map(taskCard).join("");
}

function taskCard(task) {
  const priorityLabel = { low: "🟢 Low", medium: "🟡 Medium", high: "🔴 High" };
  const dueHTML  = formatDue(task.due_date);
  const checked  = task.completed ? "checked" : "";
  const doneHTML = task.completed
    ? `<span class="badge badge-done">✓ Done</span>`
    : "";

  return `
    <div class="task-card ${task.completed ? "completed" : ""}" id="task-${task.id}">
      <input
        class="task-check"
        type="checkbox"
        ${checked}
        title="Toggle completion"
        onchange="toggleComplete(${task.id}, this.checked)"
      />
      <div class="task-body">
        <div class="task-title" title="${escHtml(task.title)}">${escHtml(task.title)}</div>
        ${task.description
          ? `<div class="task-desc">${escHtml(task.description)}</div>`
          : ""}
        <div class="task-meta">
          <span class="badge badge-${task.priority}">
            ${priorityLabel[task.priority]}
          </span>
          ${doneHTML}
          ${dueHTML}
        </div>
      </div>
      <div class="task-actions">
        <button
          class="btn-icon"
          title="Edit task"
          onclick="openEditModal(${task.id})"
        ><i class='bx bx-edit-alt'></i></button>
        <button
          class="btn-icon"
          title="Delete task"
          style="color:var(--clr-danger)"
          onclick="deleteTask(${task.id})"
        ><i class='bx bx-trash'></i></button>
      </div>
    </div>`;
}

function formatDue(iso) {
  if (!iso) return "";
  const due  = new Date(iso);
  const now  = new Date();
  const over = due < now;
  const str  = due.toLocaleString(undefined, {
    month: "short", day: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
  return `<span class="task-due ${over ? "overdue" : ""}">
            <i class='bx bx-calendar'></i> ${str}${over ? " ⚠️" : ""}
          </span>`;
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/* ============================================================
   TASKS — STATS BAR
   ============================================================ */
function renderStats({ total, items }) {
  const done    = items.filter((t) => t.completed).length;
  const pending = items.filter((t) => !t.completed).length;

  document.getElementById("stat-total").textContent   = `${total} total`;
  document.getElementById("stat-pending").textContent = `${pending} pending`;
  document.getElementById("stat-done").textContent    = `${done} done`;
}

/* ============================================================
   TASKS — PAGINATION
   ============================================================ */
function renderPagination({ page, total_pages }) {
  const container = document.getElementById("pagination");
  if (total_pages <= 1) { container.innerHTML = ""; return; }

  let html = "";

  // Prev
  html += `<button class="page-btn" onclick="loadTasks(${page - 1})"
             ${page === 1 ? "disabled" : ""}>
             <i class='bx bx-chevron-left'></i>
           </button>`;

  // Page numbers (show ±2 around current)
  for (let p = 1; p <= total_pages; p++) {
    if (
      p === 1 || p === total_pages ||
      (p >= page - 2 && p <= page + 2)
    ) {
      html += `<button class="page-btn ${p === page ? "active" : ""}"
                 onclick="loadTasks(${p})">${p}</button>`;
    } else if (p === page - 3 || p === page + 3) {
      html += `<span style="color:var(--clr-text-muted);align-self:center">…</span>`;
    }
  }

  // Next
  html += `<button class="page-btn" onclick="loadTasks(${page + 1})"
             ${page === total_pages ? "disabled" : ""}>
             <i class='bx bx-chevron-right'></i>
           </button>`;

  container.innerHTML = html;
}

/* ============================================================
   TASKS — FILTERS
   ============================================================ */
let _filterTimer = null;

function applyFilters() {
  state.filters.completed = document.getElementById("filter-completed").value;
  state.filters.priority  = document.getElementById("filter-priority").value;
  state.filters.search    = document.getElementById("filter-search").value.trim();
  state.currentPage = 1;

  clearTimeout(_filterTimer);
  _filterTimer = setTimeout(() => loadTasks(1), 300); // debounce search
}

/* ============================================================
   TASKS — CREATE
   ============================================================ */
async function createTask() {
  const title       = document.getElementById("task-title").value.trim();
  const description = document.getElementById("task-desc").value.trim();
  const priority    = document.getElementById("task-priority").value;
  const due_date    = document.getElementById("task-due").value;

  if (!title) {
    showToast("Task title is required.", "error");
    document.getElementById("task-title").focus();
    return;
  }

  const payload = {
    title,
    description: description || null,
    priority,
    due_date: due_date ? new Date(due_date).toISOString() : null,
  };

  try {
    const res  = await apiFetch("/tasks", {
      method: "POST",
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.detail ?? "Failed to create task.", "error");
      return;
    }

    showToast("Task created!", "success");

    // Clear form
    document.getElementById("task-title").value    = "";
    document.getElementById("task-desc").value     = "";
    document.getElementById("task-priority").value = "medium";
    document.getElementById("task-due").value      = "";

    // Reload first page
    state.currentPage = 1;
    loadTasks(1);
  } catch (err) {
    if (err.message !== "Unauthorized")
      showToast("Could not create task.", "error");
  }
}

/* ============================================================
   TASKS — TOGGLE COMPLETE
   ============================================================ */
async function toggleComplete(taskId, completed) {
  try {
    const res  = await apiFetch(`/tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify({ completed }),
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.detail ?? "Update failed.", "error");
      loadTasks(); // revert UI
      return;
    }

    showToast(completed ? "Task marked complete ✓" : "Task reopened.", "success");
    loadTasks();
  } catch (err) {
    if (err.message !== "Unauthorized") {
      showToast("Could not update task.", "error");
      loadTasks();
    }
  }
}

/* ============================================================
   TASKS — DELETE
   ============================================================ */
async function deleteTask(taskId) {
  if (!confirm("Delete this task? This cannot be undone.")) return;

  try {
    const res  = await apiFetch(`/tasks/${taskId}`, { method: "DELETE" });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.detail ?? "Delete failed.", "error");
      return;
    }

    showToast("Task deleted.", "info");

    // If last item on page > 1, go to previous page
    const list = document.querySelectorAll(".task-card");
    if (list.length === 1 && state.currentPage > 1) {
      loadTasks(state.currentPage - 1);
    } else {
      loadTasks();
    }
  } catch (err) {
    if (err.message !== "Unauthorized")
      showToast("Could not delete task.", "error");
  }
}

/* ============================================================
   TASKS — EDIT MODAL
   ============================================================ */
async function openEditModal(taskId) {
  try {
    const res  = await apiFetch(`/tasks/${taskId}`);
    const task = await res.json();

    if (!res.ok) {
      showToast(task.detail ?? "Could not load task.", "error");
      return;
    }

    document.getElementById("edit-task-id").value    = task.id;
    document.getElementById("edit-title").value      = task.title;
    document.getElementById("edit-desc").value       = task.description ?? "";
    document.getElementById("edit-priority").value   = task.priority;
    document.getElementById("edit-completed").checked = task.completed;
    document.getElementById("edit-due").value        = task.due_date
      ? toLocalDatetimeInput(task.due_date)
      : "";

    document.getElementById("edit-modal").classList.remove("hidden");
    document.getElementById("edit-title").focus();
  } catch (err) {
    if (err.message !== "Unauthorized")
      showToast("Could not open editor.", "error");
  }
}

function closeModal() {
  document.getElementById("edit-modal").classList.add("hidden");
}

// Close modal on backdrop click
document.getElementById("edit-modal").addEventListener("click", (e) => {
  if (e.target === e.currentTarget) closeModal();
});

// Close modal on Escape key
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape") closeModal();
});

async function saveEdit() {
  const taskId    = document.getElementById("edit-task-id").value;
  const title     = document.getElementById("edit-title").value.trim();
  const desc      = document.getElementById("edit-desc").value.trim();
  const priority  = document.getElementById("edit-priority").value;
  const completed = document.getElementById("edit-completed").checked;
  const due       = document.getElementById("edit-due").value;

  if (!title) {
    showToast("Title cannot be empty.", "error");
    document.getElementById("edit-title").focus();
    return;
  }

  const payload = {
    title,
    description: desc || null,
    priority,
    completed,
    due_date: due ? new Date(due).toISOString() : null,
  };

  try {
    const res  = await apiFetch(`/tasks/${taskId}`, {
      method: "PUT",
      body: JSON.stringify(payload),
    });
    const data = await res.json();

    if (!res.ok) {
      showToast(data.detail ?? "Update failed.", "error");
      return;
    }

    showToast("Task updated!", "success");
    closeModal();
    loadTasks();
  } catch (err) {
    if (err.message !== "Unauthorized")
      showToast("Could not save changes.", "error");
  }
}

/* ============================================================
   UTILITY — datetime-local input needs local ISO string
   ============================================================ */
function toLocalDatetimeInput(isoString) {
  const d = new Date(isoString);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    `T${pad(d.getHours())}:${pad(d.getMinutes())}`
  );
}