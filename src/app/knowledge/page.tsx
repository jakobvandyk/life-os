"use client";

import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";

interface Tag {
  id: number;
  name: string;
  color: string;
}

interface NoteTag {
  tag_id: number;
  kb_tags: Tag;
}

interface Note {
  id: number;
  title: string;
  content: string;
  type: string;
  source_url: string | null;
  pinned: boolean;
  goal_id: number | null;
  task_id: number | null;
  created_at: string;
  updated_at: string;
  kb_note_tags: NoteTag[];
}

const TYPE_STYLES: Record<string, string> = {
  note: "bg-desert-celestial/20 text-desert-celestial border border-desert-celestial/30",
  ai_response: "bg-desert-mystic/20 text-desert-mystic border border-desert-mystic/30",
  research: "bg-desert-success-dim text-desert-success border border-desert-success/30",
};

export default function KnowledgePage() {
  const [userId, setUserId] = useState<string | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<string | null>(null);
  const [tagFilter, setTagFilter] = useState<number | null>(null);
  const [editing, setEditing] = useState<Note | null>(null);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState({
    title: "",
    content: "",
    type: "note",
    source_url: "",
    pinned: false,
  });
  const [selectedTags, setSelectedTags] = useState<number[]>([]);
  const [newTagName, setNewTagName] = useState("");

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setUserId(user.id);
    });
  }, []);

  const fetchData = async () => {
    if (!userId) return;

    const [{ data: notesData }, { data: tagsData }] = await Promise.all([
      supabase
        .from("kb_notes")
        .select("*, kb_note_tags(tag_id, kb_tags(id, name, color))")
        .eq("user_id", userId)
        .order("pinned", { ascending: false })
        .order("updated_at", { ascending: false }),
      supabase.from("kb_tags").select("*").eq("user_id", userId).order("name"),
    ]);

    setNotes(notesData || []);
    setTags(tagsData || []);
  };

  useEffect(() => {
    if (userId) fetchData();
  }, [userId]);

  const filteredNotes = useMemo(() => {
    return notes.filter((note) => {
      if (typeFilter && note.type !== typeFilter) return false;
      if (tagFilter && !note.kb_note_tags.some((nt) => nt.tag_id === tagFilter))
        return false;
      if (search) {
        const q = search.toLowerCase();
        const matchTitle = note.title.toLowerCase().includes(q);
        const matchContent = note.content.slice(0, 200).toLowerCase().includes(q);
        if (!matchTitle && !matchContent) return false;
      }
      return true;
    });
  }, [notes, search, typeFilter, tagFilter]);

  const openEditor = (note?: Note) => {
    if (note) {
      setEditing(note);
      setIsNew(false);
      setForm({
        title: note.title,
        content: note.content,
        type: note.type,
        source_url: note.source_url || "",
        pinned: note.pinned,
      });
      setSelectedTags(note.kb_note_tags.map((nt) => nt.tag_id));
    } else {
      setEditing(null);
      setIsNew(true);
      setForm({ title: "", content: "", type: "note", source_url: "", pinned: false });
      setSelectedTags([]);
    }
  };

  const closeEditor = () => {
    setEditing(null);
    setIsNew(false);
  };

  const saveNote = async () => {
    if (!form.title.trim() || !userId) return;

    let noteId: number;

    if (isNew) {
      const { data, error } = await supabase
        .from("kb_notes")
        .insert({
          user_id: userId,
          title: form.title,
          content: form.content,
          type: form.type,
          source_url: form.source_url || null,
          pinned: form.pinned,
        })
        .select("id")
        .single();

      if (error || !data) {
        console.error("Error creating note:", error);
        return;
      }
      noteId = data.id;
    } else if (editing) {
      const { error } = await supabase
        .from("kb_notes")
        .update({
          title: form.title,
          content: form.content,
          type: form.type,
          source_url: form.source_url || null,
          pinned: form.pinned,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editing.id);

      if (error) {
        console.error("Error updating note:", error);
        return;
      }
      noteId = editing.id;
    } else {
      return;
    }

    // Sync tags: delete existing, insert selected
    await supabase.from("kb_note_tags").delete().eq("note_id", noteId);
    if (selectedTags.length > 0) {
      await supabase
        .from("kb_note_tags")
        .insert(selectedTags.map((tagId) => ({ note_id: noteId, tag_id: tagId })));
    }

    closeEditor();
    fetchData();
  };

  const deleteNote = async () => {
    if (!editing || !userId) return;
    const { error } = await supabase
      .from("kb_notes")
      .delete()
      .eq("id", editing.id)
      .eq("user_id", userId);
    if (error) {
      console.error("Error deleting note:", error);
      return;
    }
    closeEditor();
    fetchData();
  };

  const addTag = async () => {
    if (!newTagName.trim() || !userId) return;
    const { error } = await supabase
      .from("kb_tags")
      .insert({ user_id: userId, name: newTagName.trim() });
    if (error) {
      console.error("Error adding tag:", error);
      return;
    }
    setNewTagName("");
    fetchData();
  };

  const toggleTag = (tagId: number) => {
    setSelectedTags((prev) =>
      prev.includes(tagId) ? prev.filter((t) => t !== tagId) : [...prev, tagId]
    );
  };

  const showEditor = isNew || editing;

  return (
    <div className="bg-desert-bg min-h-screen p-6 relative z-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-pixel text-lg text-desert-text">📚 Knowledge Base</h1>
          <p className="text-desert-text-3 mt-1">
            {notes.length} note{notes.length !== 1 ? "s" : ""}
          </p>
        </div>
        <button
          onClick={() => openEditor()}
          className="px-4 py-2 bg-desert-accent text-desert-bg font-mono font-semibold uppercase tracking-wider text-sm rounded-sm hover:bg-desert-accent-glow transition-colors duration-150"
        >
          + New Note
        </button>
      </div>

      {/* Search + Filters */}
      <div className="mb-6 space-y-3">
        <input
          type="text"
          placeholder="Search notes..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-4 py-2 text-desert-text placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors"
        />
        <div className="flex gap-2 flex-wrap">
          {/* Type filters */}
          {["note", "ai_response", "research"].map((type) => (
            <button
              key={type}
              onClick={() => setTypeFilter(typeFilter === type ? null : type)}
              className={`px-3 py-1 rounded-lg font-mono text-xs uppercase tracking-wider transition-colors ${
                typeFilter === type
                  ? TYPE_STYLES[type]
                  : "bg-desert-surface border border-desert-border text-desert-text-3 hover:text-desert-text-2"
              }`}
            >
              {type.replace("_", " ")}
            </button>
          ))}
          {/* Tag filters */}
          {tags.map((tag) => (
            <button
              key={tag.id}
              onClick={() => setTagFilter(tagFilter === tag.id ? null : tag.id)}
              className={`px-3 py-1 rounded-lg font-mono text-xs tracking-wider transition-colors ${
                tagFilter === tag.id
                  ? "bg-desert-accent-dim text-desert-accent border border-desert-accent/30"
                  : "bg-desert-surface border border-desert-border text-desert-text-3 hover:text-desert-text-2"
              }`}
            >
              {tag.name}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-6">
        {/* Note List */}
        <div className={`space-y-2 ${showEditor ? "w-1/3 shrink-0" : "w-full"}`}>
          {filteredNotes.length === 0 ? (
            <div className="bg-desert-surface rounded-sm p-12 text-center">
              <p className="text-desert-text-3">
                {search || typeFilter || tagFilter ? "No matching notes" : "No notes yet"}
              </p>
            </div>
          ) : (
            filteredNotes.map((note) => (
              <div
                key={note.id}
                onClick={() => openEditor(note)}
                className={`bg-desert-surface border rounded-sm p-4 cursor-pointer hover:bg-desert-surface-hover hover:border-desert-border-strong transition-colors ${
                  editing?.id === note.id
                    ? "border-desert-accent"
                    : "border-desert-border"
                }`}
              >
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex items-center gap-2 min-w-0">
                    {note.pinned && (
                      <span className="text-desert-accent text-xs shrink-0">📌</span>
                    )}
                    <p className="text-desert-text text-sm font-medium truncate">
                      {note.title}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 px-2 py-0.5 rounded-sm font-mono text-[10px] uppercase tracking-wider ${TYPE_STYLES[note.type]}`}
                  >
                    {note.type.replace("_", " ")}
                  </span>
                </div>
                {note.content && (
                  <p className="text-desert-text-3 text-xs line-clamp-2 mt-1">
                    {note.content.slice(0, 150)}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-2">
                  {note.kb_note_tags.map((nt) => (
                    <span
                      key={nt.tag_id}
                      className="px-1.5 py-0.5 bg-desert-surface-hover rounded-sm text-[10px] font-mono text-desert-text-3"
                    >
                      {nt.kb_tags.name}
                    </span>
                  ))}
                  {(note.goal_id || note.task_id) && (
                    <span className="text-[10px] font-mono text-desert-mystic">
                      {note.goal_id ? "🎯 linked" : "📋 linked"}
                    </span>
                  )}
                  <span className="text-[10px] font-mono text-desert-text-3 ml-auto">
                    {new Date(note.updated_at).toLocaleDateString("en-NZ", {
                      day: "numeric",
                      month: "short",
                    })}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Editor Panel */}
        {showEditor && (
          <div className="flex-1 bg-desert-surface border border-desert-border rounded-sm p-5 sticky top-6 self-start">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-mono font-bold text-sm tracking-[0.06em] uppercase text-desert-text">
                {isNew ? "New Note" : "Edit Note"}
              </h2>
              <button
                onClick={closeEditor}
                className="text-desert-text-3 hover:text-desert-text text-sm transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <input
                type="text"
                placeholder="Title..."
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                autoFocus
                className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-4 py-2 text-desert-text placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors"
              />

              <textarea
                placeholder="Write your note..."
                value={form.content}
                onChange={(e) => setForm({ ...form, content: e.target.value })}
                rows={12}
                className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-4 py-3 text-desert-text font-mono text-sm placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors resize-y"
              />

              <div className="flex gap-3 flex-wrap items-end">
                <div>
                  <p className="text-xs text-desert-text-3 mb-1">Type</p>
                  <select
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value })}
                    className="bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-desert-text text-sm focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors"
                  >
                    <option value="note">Note</option>
                    <option value="ai_response">AI Response</option>
                    <option value="research">Research</option>
                  </select>
                </div>

                {form.type === "research" && (
                  <div className="flex-1">
                    <p className="text-xs text-desert-text-3 mb-1">Source URL</p>
                    <input
                      type="url"
                      placeholder="https://..."
                      value={form.source_url}
                      onChange={(e) => setForm({ ...form, source_url: e.target.value })}
                      className="w-full bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-2 text-desert-text text-sm placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent focus:ring-1 focus:ring-desert-accent transition-colors"
                    />
                  </div>
                )}

                <label className="flex items-center gap-2 cursor-pointer pb-2">
                  <input
                    type="checkbox"
                    checked={form.pinned}
                    onChange={(e) => setForm({ ...form, pinned: e.target.checked })}
                    className="accent-desert-accent"
                  />
                  <span className="text-sm text-desert-text-2">Pin</span>
                </label>
              </div>

              {/* Tags */}
              <div>
                <p className="text-xs text-desert-text-3 mb-2">Tags</p>
                <div className="flex gap-1.5 flex-wrap mb-2">
                  {tags.map((tag) => (
                    <button
                      key={tag.id}
                      onClick={() => toggleTag(tag.id)}
                      className={`px-2 py-1 rounded-sm font-mono text-xs transition-colors ${
                        selectedTags.includes(tag.id)
                          ? "bg-desert-accent text-desert-bg"
                          : "bg-desert-bg border border-desert-border text-desert-text-3 hover:text-desert-text-2"
                      }`}
                    >
                      {tag.name}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="New tag..."
                    value={newTagName}
                    onChange={(e) => setNewTagName(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && addTag()}
                    className="bg-desert-bg border border-desert-border-strong rounded-sm px-3 py-1.5 text-desert-text text-xs placeholder:text-desert-text-3 focus:outline-none focus:border-desert-accent transition-colors"
                  />
                  <button
                    onClick={addTag}
                    className="px-3 py-1.5 text-desert-text-3 hover:text-desert-text font-mono text-xs transition-colors"
                  >
                    + Add
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center justify-between pt-2 border-t border-desert-border">
                {!isNew && (
                  <button
                    onClick={deleteNote}
                    className="px-3 py-1.5 text-desert-danger hover:bg-desert-danger-dim font-mono text-xs uppercase tracking-wider rounded-sm transition-colors"
                  >
                    Delete
                  </button>
                )}
                <div className={`flex gap-2 ${isNew ? "ml-auto" : ""}`}>
                  <button
                    onClick={closeEditor}
                    className="px-4 py-2 text-desert-text-3 hover:text-desert-text text-sm transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={saveNote}
                    className="px-4 py-2 bg-desert-accent text-desert-bg font-mono font-semibold uppercase tracking-wider text-sm rounded-sm hover:bg-desert-accent-glow transition-colors duration-150"
                  >
                    Save
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
