"use client";

import { useEffect, useState } from "react";

// One case row in our app.
// Comments below are only for fields we send to / read from SuiteCRM.
type Case = {
  id: string; // SuiteCRM id — used for edit/delete, not shown on screen
  title: string; // SuiteCRM field: name
  status: string; // SuiteCRM field: status (we show "Open", CRM stores "Open_New", etc.)
  description: string; // SuiteCRM field: description
  createdAt: string; // read-only — SuiteCRM date_entered (list only)
  updatedAt: string; // read-only — SuiteCRM date_modified (list only)
};

export default function CasesPage() {
  const [cases, setCases] = useState<Case[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Form fields match the Case type above (without id).
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState(""); // saved to SuiteCRM description
  const [status, setStatus] = useState("Open"); // saved to SuiteCRM status

  // Load all cases from our API (API talks to SuiteCRM).
  async function loadCases(showLoading = true) {
    if (showLoading) setLoading(true);
    setError("");
    const res = await fetch("/api/cases");
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Could not load cases");
      if (showLoading) setLoading(false);
      return;
    }
    setCases(data);
    if (showLoading) setLoading(false);
  }

  useEffect(() => {
    loadCases();
  }, []);

  function clearForm() {
    setTitle("");
    setDescription("");
    setStatus("Open");
    setEditingId(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    setSaving(true);
    setError("");

    const body = {
      title,
      description, // goes to SuiteCRM Cases.description
      status, // goes to SuiteCRM Cases.status
    };

    const url = editingId ? `/api/cases/${editingId}` : "/api/cases";
    const method = editingId ? "PATCH" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Save failed");
      setSaving(false);
      return;
    }

    await loadCases(false);
    clearForm();
    setSaving(false);
  }

  function handleEdit(c: Case) {
    setEditingId(c.id);
    setTitle(c.title);
    setDescription(c.description);
    setStatus(c.status);
  }

  async function handleDelete(id: string) {
    setError("");
    const res = await fetch(`/api/cases/${id}`, { method: "DELETE" });
    const data = await res.json();
    if (!res.ok) {
      setError(data.error || "Delete failed");
      return;
    }
    setCases(cases.filter((c) => c.id !== id));
    if (editingId === id) clearForm();
  }

  function getStatusClass(status: string) {
    if (status === "Open") return "bg-green-100 text-green-800";
    if (status === "In Progress") return "bg-yellow-100 text-yellow-800";
    if (status === "Closed") return "bg-gray-100 text-gray-600";
    return "bg-gray-100 text-gray-600";
  }

  return (
    <main className="mx-auto max-w-3xl p-6">
      <h1 className="mb-2 text-2xl font-semibold">Cases</h1>
      <p className="mb-6 text-sm text-gray-500">Data comes from SuiteCRM</p>

      {error && (
        <p className="mb-4 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mb-8 space-y-3 rounded-lg border p-4">
        <h2 className="font-medium">{editingId ? "Update case" : "Add case"}</h2>

        <input
          className="w-full rounded border px-3 py-2"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />

        {/* description → SuiteCRM Cases.description */}
        <textarea
          className="w-full rounded border px-3 py-2"
          placeholder="Description"
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />

        {/* status → SuiteCRM Cases.status */}
        <select
          className="w-full rounded border px-3 py-2"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option>Open</option>
          <option>In Progress</option>
          <option>Closed</option>
        </select>

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded bg-black px-4 py-2 text-sm text-white disabled:opacity-50"
          >
            {saving ? "Saving..." : editingId ? "Save" : "Add"}
          </button>
          {editingId && (
            <button type="button" onClick={clearForm} className="rounded border px-4 py-2 text-sm">
              Cancel
            </button>
          )}
        </div>
      </form>

      {loading && <p className="text-sm text-gray-500">Loading...</p>}

      {!loading && cases.length === 0 && (
        <p className="text-sm text-gray-500">No cases yet.</p>
      )}

      {!loading && cases.length > 0 && (
        <ul className="space-y-3">
          {cases.map((c) => (
            <li key={c.id} className="rounded-lg border p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="mb-2 flex items-center gap-2">
                    <p className="font-semibold">{c.title}</p>
                    <span className={`rounded-full px-2 py-0.5 text-xs ${getStatusClass(c.status)}`}>
                      {c.status}
                    </span>
                  </div>

                  {c.description ? (
                    <p className="mb-2 text-sm text-gray-600">{c.description}</p>
                  ) : (
                    <p className="mb-2 text-sm italic text-gray-400">No description</p>
                  )}

                  <p className="text-xs text-gray-500">
                    Created {c.createdAt || "—"} · Updated {c.updatedAt || "—"}
                  </p>
                </div>

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleEdit(c)}
                    className="rounded border px-3 py-1 text-sm"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDelete(c.id)}
                    className="rounded border border-red-300 px-3 py-1 text-sm text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
