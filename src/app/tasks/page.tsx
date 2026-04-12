"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { queueWrite } from "@/lib/sync";
import PixelIcon from "@/components/PixelIcon";

interface Task {
  id: number;
  title: string;
  description: string;
  priority: string;
  status: string;
  due_date: string | null;
  parent_id: number | null;
  created_at: string;
}

interface TaskWithChildren extends Task {
  subtasks: Task[];
}

const priorityColors: Record<string, string> = {
  urgent: "bg-desert-danger-dim text-desert-danger border border-desert-danger/30",
  high: "bg-desert-danger-dim text-desert-danger border border-desert-danger/30",
  medium: "bg-desert-warning-dim text-desert-warning border border-desert-warning/30",
  low: "bg-desert-success-dim text-desert-success border border-desert-success/30",
};

const statusColors: Record<string, string> = {
  todo: "border-desert-text-3 text-desert-text-3",
  in_progress: "border-desert-accent text-desert-accent bg-desert-accent/10",
  done: "border-desert-success text-desert-success bg-desert-success/10",
};

const statusLabels: Record<string, string> = {
  todo: "TO DO",
  in_progress: "IN PROGRESS",
  done: "DONE",
};

const statusCycle: Record<string, string> = {
  todo: "in_progress",
  in_progress: "done",
  done: "todo",
};

const inputClass =
  "w-full bg-desert-bg border border-desert-border-strong rounded-sm px-4 py-2 text-desert-text placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors";
const selectClass =
  "bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-desert-text text-sm focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors";
const btnPrimary =
  "px-4 py-2 bg-desert-accent text-desert-bg font-mono font-semibold uppercase tracking-wider text-sm rounded-sm hover:bg-desert-accent-glow transition-colors duration-150";

function formatDueDate(task: Task) {
  if (!task.due_date) return null;
  const dueDate = new Date(task.due_date);
  const today = new Date();
  const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const dueDateMidnight = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
  const diffDays = Math.ceil((dueDateMidnight.getTime() - todayMidnight.getTime()) / (1000 * 60 * 60 * 24));

  if (diffDays < 0 && task.status !== "done") {
    return { text: `${Math.abs(diffDays)}d overdue`, className: "text-desert-danger" };
  } else if (diffDays === 0) {
    return { text: "today", className: "text-desert-accent" };
  } else if (diffDays === 1) {
    return { text: "tomorrow", className: "text-desert-success" };
  } else if (diffDays > 0 && diffDays <= 7) {
    return { text: dueDate.toLocaleDateString("en-NZ", { weekday: "short" }), className: "text-desert-text-3" };
  } else {
    return { text: dueDate.toLocaleDateString("en-NZ", { month: "short", day: "numeric" }), className: "text-desert-text-3" };
  }
}

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({ title: "", description: "", priority: "medium", due_date: "", parent_id: "" });
  const [newTask, setNewTask] = useState({ title: "", description: "", priority: "medium", due_date: "", parent_id: "" });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const fetchTasks = async () => {
    let query = supabase.from("tasks").select("*").order("created_at", { ascending: false });
    if (filter !== "all") {
      query = query.eq("status", filter);
    }
    const { data } = await query;
    setTasks(data || []);
  };

  useEffect(() => {
    fetchTasks();
  }, [filter]);

  // Group tasks into parents with subtasks
  const groupedTasks = useMemo(() => {
    const parentTasks: TaskWithChildren[] = [];
    const childMap = new Map<number, Task[]>();

    // Separate parents and children
    for (const task of tasks) {
      if (task.parent_id) {
        const existing = childMap.get(task.parent_id) || [];
        existing.push(task);
        childMap.set(task.parent_id, existing);
      }
    }

    for (const task of tasks) {
      if (!task.parent_id) {
        parentTasks.push({ ...task, subtasks: childMap.get(task.id) || [] });
      }
    }

    // Include orphaned subtasks (parent filtered out)
    const parentIds = new Set(parentTasks.map((t) => t.id));
    for (const task of tasks) {
      if (task.parent_id && !parentIds.has(task.parent_id)) {
        parentTasks.push({ ...task, subtasks: [] });
      }
    }

    return parentTasks;
  }, [tasks]);

  // Top-level tasks for the parent dropdown
  const topLevelTasks = useMemo(() => tasks.filter((t) => !t.parent_id && t.status !== "done"), [tasks]);

  const activeTasks = tasks.filter((t) => t.status !== "done");
  const doneTasks = tasks.filter((t) => t.status === "done");

  const addTask = async () => {
    if (!newTask.title.trim() || !userId) return;
    const payload = {
      title: newTask.title,
      description: newTask.description || "",
      priority: newTask.priority,
      due_date: newTask.due_date || null,
      parent_id: newTask.parent_id ? parseInt(newTask.parent_id) : null,
      user_id: userId,
    };
    const { error } = await supabase.from("tasks").insert(payload);
    if (error) await queueWrite("tasks", "insert", payload);
    setNewTask({ title: "", description: "", priority: "medium", due_date: "", parent_id: "" });
    setShowForm(false);
    fetchTasks();
  };

  const updateStatus = async (id: number, status: string) => {
    const updates: Record<string, unknown> = { status };
    updates.completed_at = status === "done" ? new Date().toISOString() : null;
    const { error } = await supabase.from("tasks").update(updates).eq("id", id);
    if (error) await queueWrite("tasks", "update", { id, ...updates });
    fetchTasks();
  };

  const saveEdit = async () => {
    if (!editingId || !editForm.title.trim()) return;
    const updates = {
      title: editForm.title,
      description: editForm.description || "",
      priority: editForm.priority,
      due_date: editForm.due_date || null,
      parent_id: editForm.parent_id ? parseInt(editForm.parent_id) : null,
    };
    const { error } = await supabase.from("tasks").update(updates).eq("id", editingId);
    if (error) await queueWrite("tasks", "update", { id: editingId, ...updates });
    setEditingId(null);
    fetchTasks();
  };

  const startEditing = (task: Task) => {
    setEditingId(task.id);
    setEditForm({
      title: task.title,
      description: task.description || "",
      priority: task.priority,
      due_date: task.due_date || "",
      parent_id: task.parent_id ? String(task.parent_id) : "",
    });
  };

  const deleteTask = async (id: number) => {
    const { error } = await supabase.from("tasks").delete().eq("id", id);
    if (error) await queueWrite("tasks", "delete", { id });
    fetchTasks();
  };

  const renderTaskRow = (task: Task, isSubtask: boolean, subtaskInfo?: { done: number; total: number }) => {
    const isEditing = editingId === task.id;
    const due = formatDueDate(task);

    if (isEditing) {
      return (
        <div
          key={task.id}
          className={`bg-desert-surface rounded-sm p-4 ${isSubtask ? "ml-6 md:ml-10 border-l-2 border-desert-accent/30" : ""}`}
        >
          <div className="space-y-3">
            <input
              type="text"
              value={editForm.title}
              onChange={(e) => setEditForm({ ...editForm, title: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && saveEdit()}
              autoFocus
              className={inputClass}
              placeholder="Task title..."
            />
            <textarea
              value={editForm.description}
              onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
              rows={2}
              className={inputClass}
              placeholder="Description (optional)"
            />
            <div className="flex flex-wrap gap-3">
              <select
                value={editForm.priority}
                onChange={(e) => setEditForm({ ...editForm, priority: e.target.value })}
                className={selectClass}
              >
                <option value="urgent">◆ Urgent</option>
                <option value="high">▲ High</option>
                <option value="medium">● Medium</option>
                <option value="low">○ Low</option>
              </select>
              <input
                type="date"
                value={editForm.due_date}
                onChange={(e) => setEditForm({ ...editForm, due_date: e.target.value })}
                className={selectClass}
              />
              <select
                value={editForm.parent_id}
                onChange={(e) => setEditForm({ ...editForm, parent_id: e.target.value })}
                className={selectClass}
              >
                <option value="">No parent (top-level)</option>
                {topLevelTasks
                  .filter((t) => t.id !== task.id)
                  .map((t) => (
                    <option key={t.id} value={t.id}>
                      ↳ {t.title}
                    </option>
                  ))}
              </select>
              <button onClick={saveEdit} className={btnPrimary}>
                Save
              </button>
              <button
                onClick={() => setEditingId(null)}
                className="px-4 py-2 text-desert-text-3 hover:text-desert-text text-sm transition-colors duration-150"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div
        key={task.id}
        className={`bg-desert-surface rounded-sm p-3 md:p-4 group hover:border-desert-border-strong transition-colors ${
          task.status === "done" ? "opacity-50" : ""
        } ${isSubtask ? "ml-6 md:ml-10 border-l-2 border-desert-accent/30" : ""}`}
      >
        {/* Desktop layout */}
        <div className="hidden md:flex items-center gap-4">
          <button
            onClick={() => updateStatus(task.id, task.status === "done" ? "todo" : "done")}
            className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
              task.status === "done"
                ? "bg-desert-success border-desert-success"
                : "border-desert-border-strong hover:border-desert-accent"
            }`}
          >
            {task.status === "done" && <span className="text-desert-bg text-xs">✓</span>}
          </button>

          <div className="flex-1 min-w-0">
            <p className={`text-sm font-medium ${task.status === "done" ? "text-desert-text-3 line-through" : "text-desert-text"}`}>
              {task.title}
            </p>
            {task.description && <p className="text-xs text-desert-text-3 mt-0.5 truncate">{task.description}</p>}
            {subtaskInfo && subtaskInfo.total > 0 && (
              <p className="text-xs text-desert-text-3 mt-0.5 font-mono">
                {subtaskInfo.done}/{subtaskInfo.total} subtasks
              </p>
            )}
          </div>

          <span className={`px-2 py-0.5 rounded-md text-xs font-medium border shrink-0 ${priorityColors[task.priority]}`}>
            {task.priority}
          </span>

          <span className="text-xs font-mono shrink-0 min-w-[5rem] text-right">
            {due ? <span className={due.className}>{due.text}</span> : <span className="text-desert-text-3/0">—</span>}
          </span>

          <button
            onClick={() => updateStatus(task.id, statusCycle[task.status])}
            className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider border shrink-0 min-w-[6.5rem] text-center transition-colors ${statusColors[task.status]}`}
          >
            {statusLabels[task.status]}
          </button>

          <button
            onClick={() => startEditing(task)}
            className="text-desert-text-3 hover:text-desert-accent text-sm opacity-0 group-hover:opacity-100 transition-opacity"
            title="Edit"
          >
            ✎
          </button>
          <button
            onClick={() => deleteTask(task.id)}
            className="text-desert-text-3 hover:text-desert-danger text-sm opacity-0 group-hover:opacity-100 transition-opacity"
            title="Delete"
          >
            ✕
          </button>
        </div>

        {/* Mobile layout */}
        <div className="flex md:hidden flex-col gap-2">
          <div className="flex items-start gap-3">
            <button
              onClick={() => updateStatus(task.id, task.status === "done" ? "todo" : "done")}
              className={`w-5 h-5 mt-0.5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                task.status === "done"
                  ? "bg-desert-success border-desert-success"
                  : "border-desert-border-strong hover:border-desert-accent"
              }`}
            >
              {task.status === "done" && <span className="text-desert-bg text-xs">✓</span>}
            </button>
            <div className="flex-1 min-w-0">
              <p className={`text-sm font-medium ${task.status === "done" ? "text-desert-text-3 line-through" : "text-desert-text"}`}>
                {task.title}
              </p>
              {task.description && <p className="text-xs text-desert-text-3 mt-0.5">{task.description}</p>}
              {subtaskInfo && subtaskInfo.total > 0 && (
                <p className="text-xs text-desert-text-3 mt-0.5 font-mono">
                  {subtaskInfo.done}/{subtaskInfo.total} subtasks
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 ml-8 flex-wrap">
            <span className={`px-2 py-0.5 rounded-md text-xs font-medium border ${priorityColors[task.priority]}`}>
              {task.priority}
            </span>
            {due && <span className={`text-xs font-mono ${due.className}`}>{due.text}</span>}
            <button
              onClick={() => updateStatus(task.id, statusCycle[task.status])}
              className={`px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold uppercase tracking-wider border transition-colors ${statusColors[task.status]}`}
            >
              {statusLabels[task.status]}
            </button>
            <div className="ml-auto flex gap-2">
              <button
                onClick={() => startEditing(task)}
                className="text-desert-text-3 hover:text-desert-accent text-sm"
                title="Edit"
              >
                ✎
              </button>
              <button
                onClick={() => deleteTask(task.id)}
                className="text-desert-text-3 hover:text-desert-danger text-sm"
                title="Delete"
              >
                ✕
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen p-3 md:p-6 relative z-10">
      <div className="flex items-center justify-between mb-8 pb-6 border-b border-desert-border">
        <div>
          <h1 className="font-pixel text-lg text-desert-text flex items-center gap-3">
            <PixelIcon name="tasks" size={22} className="text-desert-accent" /> Tasks
          </h1>
          <p className="text-desert-text-3 mt-1">
            {activeTasks.length} active · {doneTasks.length} completed
          </p>
        </div>
        <button onClick={() => setShowForm(!showForm)} className={btnPrimary}>
          + New Task
        </button>
      </div>

      {showForm && (
        <div className="bg-desert-surface rounded-sm p-5 mb-6">
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Task title..."
              value={newTask.title}
              onChange={(e) => setNewTask({ ...newTask, title: e.target.value })}
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              autoFocus
              className={inputClass}
            />
            <textarea
              placeholder="Description (optional)"
              value={newTask.description}
              onChange={(e) => setNewTask({ ...newTask, description: e.target.value })}
              rows={2}
              className={inputClass}
            />
            <div className="flex flex-wrap gap-3">
              <select
                value={newTask.priority}
                onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })}
                className={selectClass}
              >
                <option value="urgent">◆ Urgent</option>
                <option value="high">▲ High</option>
                <option value="medium">● Medium</option>
                <option value="low">○ Low</option>
              </select>
              <input
                type="date"
                value={newTask.due_date}
                onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })}
                className={selectClass}
              />
              <select
                value={newTask.parent_id}
                onChange={(e) => setNewTask({ ...newTask, parent_id: e.target.value })}
                className={selectClass}
              >
                <option value="">No parent (top-level)</option>
                {topLevelTasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    ↳ {t.title}
                  </option>
                ))}
              </select>
              <button onClick={addTask} className={btnPrimary}>
                Add Task
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-desert-text-3 hover:text-desert-text text-sm transition-colors duration-150"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-2 mb-6 flex-wrap">
        {["all", "todo", "in_progress", "done"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-sm text-sm transition-colors duration-150 ${
              filter === f ? "bg-desert-accent text-desert-bg" : "bg-desert-surface-hover text-desert-text-2 hover:text-desert-text"
            }`}
          >
            {f === "all" ? "All" : statusLabels[f]}
          </button>
        ))}
      </div>

      {tasks.length === 0 ? (
        <div className="bg-desert-surface rounded-sm p-12 text-center">
          <p className="text-desert-text-3">No tasks yet. Create your first one!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {groupedTasks.map((task) => {
            const subtaskInfo = {
              done: task.subtasks.filter((s) => s.status === "done").length,
              total: task.subtasks.length,
            };
            return (
              <div key={task.id}>
                {renderTaskRow(task, false, subtaskInfo)}
                {task.subtasks.map((sub) => renderTaskRow(sub, true))}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
