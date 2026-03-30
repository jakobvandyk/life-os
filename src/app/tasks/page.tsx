"use client";

import { useEffect, useState } from "react";

interface Task {
  id: number;
  title: string;
  description: string;
  priority: string;
  status: string;
  due_date: string | null;
  project_name: string | null;
  project_color: string | null;
  created_at: string;
}

const priorityColors: Record<string, string> = {
  urgent: "bg-red-500/20 text-red-400 border-red-500/30",
  high: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  medium: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  low: "bg-gray-500/20 text-gray-400 border-gray-500/30",
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
  const [newTask, setNewTask] = useState({
    title: "",
    description: "",
    priority: "medium",
    due_date: "",
  });

  const fetchTasks = () => {
    const url =
      filter === "all" ? "/api/tasks" : `/api/tasks?status=${filter}`;
    fetch(url).then((r) => r.json()).then(setTasks);
  };

  useEffect(() => {
    fetchTasks();
  }, [filter]);

  const addTask = async () => {
    if (!newTask.title.trim()) return;
    await fetch("/api/tasks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newTask),
    });
    setNewTask({ title: "", description: "", priority: "medium", due_date: "" });
    setShowForm(false);
    fetchTasks();
  };

  const updateStatus = async (id: number, status: string) => {
    await fetch(`/api/tasks/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status }),
    });
    fetchTasks();
  };

  const deleteTask = async (id: number) => {
    await fetch(`/api/tasks/${id}`, { method: "DELETE" });
    fetchTasks();
  };

  const activeTasks = tasks.filter((t) => t.status !== "done");
  const doneTasks = tasks.filter((t) => t.status === "done");

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-white">📋 Tasks</h1>
          <p className="text-gray-500 mt-1">
            {activeTasks.length} active · {doneTasks.length} completed
          </p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
        >
          + New Task
        </button>
      </div>

      {/* Add Task Form */}
      {showForm && (
        <div className="bg-gray-900 rounded-xl p-5 border border-gray-800 mb-6">
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Task title..."
              value={newTask.title}
              onChange={(e) =>
                setNewTask({...newTask, title: e.target.value })
              }
              onKeyDown={(e) => e.key === "Enter" && addTask()}
              autoFocus
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
            <textarea
              placeholder="Description (optional)"
              value={newTask.description}
              onChange={(e) =>
                setNewTask({...newTask, description: e.target.value })
              }
              rows={2}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
            <div className="flex gap-3">
              <select
                value={newTask.priority}
                onChange={(e) =>
                  setNewTask({...newTask, priority: e.target.value })
                }
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
              >
                <option value="urgent">🔴 Urgent</option>
                <option value="high">🟠 High</option>
                <option value="medium">🔵 Medium</option>
                <option value="low">⚪ Low</option>
              </select>
              <input
                type="date"
                value={newTask.due_date}
                onChange={(e) =>
                  setNewTask({...newTask, due_date: e.target.value })
                }
                className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-white text-sm focus:outline-none focus:border-indigo-500"
              />
              <button
                onClick={addTask}
                className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Add Task
              </button>
              <button
                onClick={() => setShowForm(false)}
                className="px-4 py-2 text-gray-400 hover:text-white text-sm transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-2 mb-6">
        {["all", "todo", "in_progress", "done"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
              filter === f
                ? "bg-indigo-600 text-white"
                : "bg-gray-800 text-gray-400 hover:text-white"
            }`}
          >
            {f === "all" ? "All" : statusLabels[f]}
          </button>
        ))}
      </div>

      {/* Task List */}
      {tasks.length === 0 ? (
        <div className="bg-gray-900 rounded-xl p-12 border border-gray-800 text-center">
          <p className="text-gray-500">No tasks yet. Create your first one!</p>
        </div>
      ) : (
        <div className="space-y-2">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`bg-gray-900 rounded-xl p-4 border border-gray-800 flex items-center gap-4 group hover:border-gray-700 transition-colors ${
                task.status === "done" ? "opacity-50" : ""
              }`}
            >
              {/* Checkbox */}
              <button
                onClick={() =>
                  updateStatus(
                    task.id,
                    task.status === "done" ? "todo" : "done"
                  )
                }
                className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${
                  task.status === "done"
                    ? "bg-green-500 border-green-500"
                    : "border-gray-600 hover:border-indigo-500"
                }`}
              >
                {task.status === "done" && (
                  <span className="text-white text-xs">✓</span>
                )}
              </button>

              {/* Content */}
              <div className="flex-1 min-w-0">
                <p
                  className={`text-sm font-medium ${
                    task.status === "done"
                      ? "text-gray-500 line-through"
                      : "text-white"
                  }`}
                >
                  {task.title}
                </p>
                {task.description && (
                  <p className="text-xs text-gray-500 mt-0.5 truncate">
                    {task.description}
                  </p>
                )}
              </div>

              {/* Priority Badge */}
              <span
                className={`px-2 py-0.5 rounded-md text-xs font-medium border ${priorityColors[task.priority]}`}
              >
                {task.priority}
              </span>

              {/* Due Date */}
              {task.due_date && (
                <span
                  className={`text-xs ${
                    new Date(task.due_date) < new Date() &&
                    task.status !== "done"
                      ? "text-red-400"
                      : "text-gray-500"
                  }`}
                >
                  {new Date(task.due_date).toLocaleDateString("en-NZ", {
                    month: "short",
                    day: "numeric",
                  })}
                </span>
              )}

              {/* Status Toggle */}
              {task.status !== "done" && (
                <select
                  value={task.status}
                  onChange={(e) => updateStatus(task.id, e.target.value)}
                  className="bg-gray-800 border border-gray-700 rounded-md px-2 py-1 text-xs text-gray-400 focus:outline-none opacity-0 group-hover:opacity-100 transition-opacity"
                >
                  <option value="todo">To Do</option>
                  <option value="in_progress">In Progress</option>
                  <option value="done">Done</option>
                </select>
              )}

              {/* Delete */}
              <button
                onClick={() => deleteTask(task.id)}
                className="text-gray-600 hover:text-red-400 text-sm opacity-0 group-hover:opacity-100 transition-opacity"
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