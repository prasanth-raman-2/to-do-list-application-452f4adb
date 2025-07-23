import React, { useState, useEffect, useRef } from "react";
import "./App.css";

// API base for production: update to API host if app is served together; in dev use proxy or change here if needed.
const API_BASE = "http://localhost:5000/api";

// Util: Accessible notification for screen readers
function LiveRegion({ msg }) {
  return (
    <div
      aria-live="polite"
      aria-atomic="true"
      style={{
        position: "absolute",
        left: "-9999px",
        height: "1px",
        width: "1px",
        overflow: "hidden",
      }}
    >
      {msg}
    </div>
  );
}

// Task priorities for demo
const PRIORITIES = [
  { value: "low", label: "Low" },
  { value: "normal", label: "Normal" },
  { value: "high", label: "High" },
];

// --- COMPONENT: TaskForm ---
function TaskForm({ onSubmit, editing, initial, onCancel }) {
  const [title, setTitle] = useState(initial?.title || "");
  const [description, setDescription] = useState(initial?.description || "");
  const [dueDate, setDueDate] = useState(initial?.due_date ? initial.due_date.slice(0, 16) : "");
  const [priority, setPriority] = useState(initial?.priority || "normal");

  const inputRef = useRef(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
    }
  }, [editing]);

  function handleSubmit(e) {
    e.preventDefault();
    if (!title.trim()) return;
    onSubmit({
      title: title.trim(),
      description,
      due_date: dueDate ? new Date(dueDate).toISOString() : null,
      priority,
    });
    setTitle("");
    setDescription("");
    setDueDate("");
    setPriority("normal");
  }

  return (
    <form className="task-form" onSubmit={handleSubmit}>
      <label htmlFor={!editing ? "new-task-input" : "edit-task-input"} className="visually-hidden">
        {editing ? "Edit task title" : "New task title"}
      </label>
      <input
        ref={inputRef}
        id={!editing ? "new-task-input" : "edit-task-input"}
        data-testid={editing ? "edit-task-input" : "new-task-input"}
        type="text"
        value={title}
        placeholder={editing ? "Edit task..." : "Add new task..."}
        onChange={e => setTitle(e.target.value)}
        required
        autoComplete="off"
      />
      <input
        type="text"
        value={description}
        placeholder="Description (optional)"
        onChange={e => setDescription(e.target.value)}
        aria-label="Description"
      />
      <input
        type="datetime-local"
        value={dueDate}
        onChange={e => setDueDate(e.target.value)}
        aria-label="Due Date"
      />
      <select value={priority} onChange={e => setPriority(e.target.value)} aria-label="Task priority">
        {PRIORITIES.map(p => (
          <option value={p.value} key={p.value}>
            {p.label}
          </option>
        ))}
      </select>
      <button
        type="submit"
        className="btn btn-add"
        data-testid={editing ? "save-task-btn" : "add-task-btn"}
        aria-label={editing ? "Save task" : "Add new task"}
      >
        {editing ? "Save" : "Add"}
      </button>
      {editing && (
        <button
          type="button"
          className="btn btn-secondary"
          onClick={onCancel}
        >
          Cancel
        </button>
      )}
    </form>
  );
}

// --- COMPONENT: BulkOpsBar ---
function BulkOpsBar({ selected, onBulkDelete, onBulkComplete, onBulkIncomplete, clearSelection }) {
  if (selected.length === 0) return null;
  return (
    <div className="bulk-ops-bar">
      <span>{selected.length} selected</span>
      <button className="btn" data-testid="bulk-complete-btn" onClick={onBulkComplete}>Complete</button>
      <button className="btn" onClick={onBulkIncomplete}>Mark Incomplete</button>
      <button className="btn btn-danger" data-testid="bulk-delete-btn" onClick={onBulkDelete}>Delete</button>
      <button className="btn btn-secondary" onClick={clearSelection}>Clear</button>
    </div>
  );
}

// --- COMPONENT: TaskList ---
function TaskList({
  tasks,
  onToggle,
  onEdit,
  onDelete,
  selected,
  onSelect,
  editingId,
  onSaveEdit,
  onCancelEdit,
}) {
  if (tasks.length === 0) {
    return <p style={{ margin: "2rem" }}>No tasks found.</p>;
  }
  return (
    <ul className="task-list" role="list">
      {tasks.map((task) => (
        <li
          key={task.id}
          className={`task-item${task.completed ? " completed" : ""}`}
          aria-label={task.title}
        >
          <input
            type="checkbox"
            data-testid="select-task"
            checked={selected.includes(task.id)}
            onChange={() => onSelect(task.id)}
            aria-label={`Select task: ${task.title}`}
          />
          <button
            data-testid="toggle-task"
            aria-pressed={task.completed}
            onClick={() => onToggle(task.id)}
            className="toggle-btn"
            title={task.completed ? "Mark incomplete" : "Mark complete"}
          >
            {task.completed ? "☑️" : "⬜"}
          </button>
          {editingId === task.id ? (
            <TaskForm
              onSubmit={(vals) => onSaveEdit(task.id, vals)}
              editing
              initial={task}
              onCancel={onCancelEdit}
            />
          ) : (
            <div className="task-content">
              <span
                className="task-title"
                style={{
                  textDecoration: task.completed ? "line-through" : "none",
                }}
                data-testid={task.completed ? "task-completed" : ""}
              >
                {task.title}
              </span>
              <span className="task-priority">{task.priority}</span>
              {task.due_date ? (
                <span className="task-due">Due: {new Date(task.due_date).toLocaleString()}</span>
              ) : null}
              <span className="task-desc">{task.description}</span>
            </div>
          )}
          {editingId !== task.id && (
            <span className="task-actions">
              <button
                data-testid="edit-task"
                className="btn btn-secondary"
                onClick={() => onEdit(task.id)}
                aria-label="Edit"
              >
                Edit
              </button>
              <button
                data-testid="delete-task"
                className="btn btn-danger"
                onClick={() => onDelete(task.id)}
                aria-label="Delete"
              >
                Delete
              </button>
            </span>
          )}
        </li>
      ))}
    </ul>
  );
}

// --- MAIN APP COMPONENT ---
function App() {
  // Theme support
  const [theme, setTheme] = useState("light");
  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // State core
  const [tasks, setTasks] = useState([]);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all"); // all/completed/active
  const [sortBy, setSortBy] = useState("created_at");
  const [sortOrder, setSortOrder] = useState("desc");
  const [selected, setSelected] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [liveMsg, setLiveMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [bulkLoading, setBulkLoading] = useState(false);
  const [error, setError] = useState("");

  // API: Load tasks, filter/sort
  function loadTasks() {
    setLoading(true);
    let params = [];
    if (filter === "completed") params.push("completed=true");
    else if (filter === "active") params.push("completed=false");
    if (search.trim()) params.push("q=" + encodeURIComponent(search));
    if (sortBy) params.push("sort_by=" + sortBy);
    if (sortOrder) params.push("sort_order=" + sortOrder);
    fetch(`${API_BASE}/tasks?${params.join("&")}`)
      .then((r) => {
        if (!r.ok) throw new Error("Failed to fetch tasks");
        return r.json();
      })
      .then((data) => setTasks(data))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadTasks();
    // eslint-disable-next-line
  }, [filter, search, sortBy, sortOrder]);

  // Task operations
  function addTask(task) {
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/tasks`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(task),
    })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to add task");
        return r.json();
      })
      .then((task) => {
        setLiveMsg("Task added.");
        setSearch(""); // reset search
        loadTasks();
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  function deleteTask(id) {
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/tasks/${id}`, { method: "DELETE" })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to delete task");
        return r.json();
      })
      .then(() => {
        setLiveMsg("Task deleted.");
        loadTasks();
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  function toggleTask(id) {
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/tasks/${id}/toggle`, { method: "POST" })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to toggle completion");
        return r.json();
      })
      .then(() => {
        setLiveMsg("Task completion toggled.");
        loadTasks();
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  function startEdit(id) {
    setEditingId(id);
  }

  function saveEdit(id, vals) {
    setLoading(true);
    setError("");
    fetch(`${API_BASE}/tasks/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(vals),
    })
      .then((r) => {
        if (!r.ok) throw new Error("Failed to update task");
        return r.json();
      })
      .then(() => {
        setLiveMsg("Task updated.");
        setEditingId(null);
        loadTasks();
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  function cancelEdit() {
    setEditingId(null);
  }

  // Bulk
  function onSelect(id) {
    setSelected((sel) =>
      sel.includes(id) ? sel.filter((x) => x !== id) : [...sel, id]
    );
  }
  function clearSelection() {
    setSelected([]);
  }
  function bulkOp(action) {
    if (selected.length === 0) return;
    setBulkLoading(true);
    setError("");
    fetch(`${API_BASE}/tasks/bulk`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: selected, action }),
    })
      .then((r) => {
        if (!r.ok) throw new Error("Bulk operation failed");
        return r.json();
      })
      .then(() => {
        setLiveMsg(`Bulk '${action}' complete.`);
        setSelected([]);
        loadTasks();
      })
      .catch((e) => setError(e.message))
      .finally(() => setBulkLoading(false));
  }

  // Filtering etc
  function handleSearchChange(e) {
    setSearch(e.target.value);
  }

  // Theme Toggle UI
  function toggleTheme() {
    setTheme((t) => (t === "light" ? "dark" : "light"));
  }

  // Accessibility: announce page events
  const timerRef = useRef(null);
  useEffect(() => {
    if (!liveMsg) return;
    timerRef.current && clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setLiveMsg(""), 1200);
  }, [liveMsg]);

  // Error dismiss
  function dismissError() {
    setError("");
  }

  return (
    <main className="App" role="main">
      <header className="App-header" style={{ minHeight: 0 }}>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
        >
          {theme === "light" ? "🌙 Dark" : "☀️ Light"}
        </button>
        <h1 className="title">📝 To-Do List</h1>
        <div className="filter-sort-bar">
          <button
            data-testid="filter-all"
            className={`btn${filter === "all" ? " btn-selected" : ""}`}
            onClick={() => setFilter("all")}
          >
            All
          </button>
          <button
            data-testid="filter-active"
            className={`btn${filter === "active" ? " btn-selected" : ""}`}
            onClick={() => setFilter("active")}
          >
            Active
          </button>
          <button
            data-testid="filter-completed"
            className={`btn${filter === "completed" ? " btn-selected" : ""}`}
            onClick={() => setFilter("completed")}
          >
            Completed
          </button>
          <input
            data-testid="search-input"
            type="search"
            value={search}
            onChange={handleSearchChange}
            placeholder="Search"
            aria-label="Search tasks"
            style={{ marginLeft: "1rem" }}
          />
          <span>Sort by:</span>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            aria-label="Sort by"
          >
            <option value="created_at">Created</option>
            <option value="due_date">Due date</option>
            <option value="priority">Priority</option>
          </select>
          <button className="btn btn-secondary"
            onClick={() => setSortOrder((o) => (o === "asc" ? "desc" : "asc"))}>
            {sortOrder === "asc" ? "▲" : "▼"}
          </button>
        </div>
      </header>
      <section>
        <TaskForm onSubmit={addTask} />
      </section>
      <BulkOpsBar
        selected={selected}
        onBulkDelete={() => bulkOp("delete")}
        onBulkComplete={() => bulkOp("complete")}
        onBulkIncomplete={() => bulkOp("incomplete")}
        clearSelection={clearSelection}
      />
      {error && (
        <div className="error-banner" role="alert">
          <span>{error}</span>
          <button aria-label="Dismiss error" className="btn" onClick={dismissError}>x</button>
        </div>
      )}
      {loading ? (
        <div className="loading-indicator" aria-busy="true">Loading...</div>
      ) : (
        <TaskList
          tasks={tasks}
          onToggle={toggleTask}
          onEdit={startEdit}
          onDelete={deleteTask}
          selected={selected}
          onSelect={onSelect}
          editingId={editingId}
          onSaveEdit={saveEdit}
          onCancelEdit={cancelEdit}
        />
      )}
      <LiveRegion msg={liveMsg} />
      <footer className="footer">
        <span>
          To-Do List &copy; {new Date().getFullYear()}
        </span>
      </footer>
    </main>
  );
}

export default App;
