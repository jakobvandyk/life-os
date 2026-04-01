"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Task {
  id: number;
  title: string;
  description: string;
  priority: string;
  status: string;
  due_date: string | null;
  created_at: string;
}

const priorityColors: Record<string, string> = {
  urgent: "bg-desert-danger-dim text-desert-danger border border-desert-danger/30",
  high: "bg-desert-danger-dim text-desert-danger border border-desert-danger/30",
  medium: "bg-desert-warning-dim text-desert-warning border border-desert-warning/30",
  low: "bg-desert-success-dim text-desert-success border border-desert-success/30",
};

const statusLabels: Record<string, string> = {
  todo: "To Do",
  in_progress: "In Progress",
  done: "Done",
};

export default function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [filter, setFilter] = useState("all");
  const [showForm, setShowForm] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium",
    due_date: "",
  });

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const fetchTasks = async () => {
    let query = supabase.from("tasks").select("*").order("status").order("priority");

    if (filter !== "all") {
      query = query.eq("status", filter);
    }

    const { data } = await query;
    setTasks(data || []);
  };

  useEffect(() => {
    fetchTasks();
  }, [filter]);

  const addTask = async () => {
    if (!newTask.title.trim() || !userId) return;
    await supabase.from("tasks").insert({
      title: newTask.title,
      description: newTask.description || "",
      priority: newTask.priority,
      due_date: newTask.due_date || null,
      user_id: userId,
    });
    setNewTask({ title: "", description: "", priority: "medium", due_date: "" });
    setShowForm(false);
    fetchTasks();
  };

  const updateStatus = async (id: number, status: string) => {
    const updates: Record<string, unknown> = { status };
    if (status === "done") {
      updates.completed_at = new Date().toISOString();
    } else {
      updates.completed_at = null;
    }
    await supabase.from("tasks").update(updates).eq("id", id);
    fetchTasks();
  };

  const deleteTask = async (id: number) => {
    await supabase.from("tasks").delete().eq("id", id);
    fetchTasks();
  };

  const activeTasks = tasks.filter((t) => t.status !== "done");
  const doneTasks = tasks.filter((t) => t.status === "done");

  return (
    <div className="bg-desert-bg min-h-screen p-6 relative z-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-pixel text-lg text-desert-text">📋 Tasks</h1>
          <p className="text-desert-text-3 mt-1">
            {activeTasks.length} active · {doneTasks.length} completed
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-desert-accent text-desert-bg font-mono font-semibold uppercase tracking-wider text-sm rounded-sm hover:bg-desert-accent-glow transition-colors duration-150"
        >
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
                onChange={(e) => setNewTask({...newTask, title: e.target.value })}
                onKeyDown={(e) => e.key === "Enter" && addTask()}
                autoFocus
                className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-4 py-2 text-desert-text placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors"
              />
              <textarea
                placeholder="Description (optional)"
                value={newTask.description}
                onChange={(e) => setNewTask({...newTask, description: e.target.value })}
                rows={2}
                className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-4 py-2 text-desert-text placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors"
              />
            <div className="flex gap-3">
                <select
                  value={newTask.priority}
                  onChange={(e) => setNewTask({...newTask, priority: e.target.value })}
                  className="bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-desert-text text-sm focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors"
                >
                <option value="urgent">🔴 Urgent</option>
                <option value="high">🟠 High</option>
                <option value="medium">🔵 Medium</option>
                <option value="low">⚪ Low</option>
              </select>
              <input
                type="date"
                value={newTask.due_date}
                onChange={(e) => setNewTask({...newTask, due_date: e.target.value })}
                className="bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-desert-text text-sm focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors"
              />
                <button
                  onClick={addTask}
                  className="px-4 py-2 bg-desert-accent text-desert-bg font-mono font-semibold uppercase tracking-wider text-sm rounded-sm hover:bg-desert-accent-glow transition-colors duration-150"
                >
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

      <div className="flex gap-2 mb-6">
        {["all", "todo", "in_progress", "done"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
          className={`px-3 py-1.5 rounded-sm text-sm transition-colors duration-150 ${
            filter === f
              ? "bg-desert-accent text-desert-bg"
              : "bg-desert-surface-hover text-desert-text-2 hover:text-desert-text"
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
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`bg-desert-surface rounded-sm p-4 flex items-center gap-4 group hover:border-desert-border-strong transition-colors ${
                task.status === "done" ? "opacity-50" : ""
              }`}
            >
              <button
                onClick={() =>
                  updateStatus(task.id, task.status === "done" ? "todo" : "done")
                }
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  task.status === "done"
                    ? "bg-desert-success border-desert-success"
                    : "border-desert-border-strong hover:border-desert-accent"
                }`}
              >
                {task.status === "done" && (
                  <span className="text-desert-bg text-xs">✓</span>
                )}
              </button>

              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    task.status === "done" ? "text-desert-text-3 line-through" : "text-desert-text"
                  }`}
                >
                  {task.title}
                </p>
                {task.description && (
                  <p className="text-xs text-desert-text-3 mt-0.5 truncate">{task.description}</p>
                )}
              </div>

              <span
                className={`px-2 py-0.5 rounded-md text-xs font-medium border ${priorityColors[task.priority]}`}
              >
                {task.priority}
              </span>

              {task.due_date && (
                <span
                  className={`text-xs font-mono ${
                    new Date(task.due_date) < new Date() && task.status !== "done"
                      ? "text-desert-danger"
                      : "text-desert-text-3"
                  }`}
                >
                  {(() => {
                    const dueDate = new Date(task.due_date!);
                    const today = new Date();
                    const tomorrow = new Date(today);
                    tomorrow.setDate(tomorrow.getDate() + 1);
                    
                    // Normalize dates to midnight for accurate day comparison
                    const todayMidnight = new Date(today.getFullYear(), today.getMonth(), today.getDate());
                    const dueDateMidnight = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
                    const diffTime = dueDateMidnight.getTime() - todayMidnight.getTime();
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    
                    if (diffDays < 0 && task.status !== "done") {
                      return `${Math.abs(diffDays)}d overdue`;
                    } else if (diffDays === 0) {
                      return <span className="text-desert-accent">today</span>;
                    } else if (diffDays === 1) {
                      return <span className="text-desert-success">tomorrow</span>;
                    } else if (diffDays > 0 && diffDays <= 7) {
                      return dueDate.toLocaleDateString("en-NZ", { weekday: "short" });
                    } else {
                      return dueDate.toLocaleDateString("en-NZ", {
                        month: "short",
                        day: "numeric",
                      });
                    }
                  })()}
                </span>
              )}

              {task.status !== "done" && (
                <select
                  value={task.status}
                  onChange={(e) => updateStatus(task.id, e.target.value)}
                  className="bg-desert-bg border border-desert-border-strong rounded-md px-2 py-1 text-xs text-desert-text-3 focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              )}

              <button
                onClick={() => deleteTask(task.id)}
                className="text-desert-text-3 hover:text-desert-danger text-sm opacity-0 group-hover:opacity-100 transition-opacity"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}