"use client";

import { useCallback, useEffect, useState } from "react";
import { Clock, Pencil, Plus, Trash2, X } from "lucide-react";

const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL ?? "https://your-backend.onrender.com";

// Limits mirror the backend's validation (backend/timers.go).
const maxMessageLength = 500;
const maxMessages = 10;
const minInterval = 5;
const maxInterval = 1440;
const maxWindow = 120;

type SelectionMode = "rotate" | "random";

export type ChatTimer = {
  id: number;
  name: string;
  messages: string[];
  selection_mode: SelectionMode;
  interval_minutes: number;
  min_chat_lines: number;
  activity_window_minutes: number;
  online_only: boolean;
  enabled: boolean;
  status?: {
    last_sent_at: string | null;
    next_due_at: string | null;
    last_skip_reason: string;
  };
};

// Numbers are kept as strings while editing so fields can be cleared and retyped.
type Draft = {
  id: number;
  name: string;
  messages: string[];
  selection_mode: SelectionMode;
  interval_minutes: string;
  min_chat_lines: string;
  activity_window_minutes: string;
  online_only: boolean;
  enabled: boolean;
};

const newDraft = (): Draft => ({
  id: 0,
  name: "",
  messages: [""],
  selection_mode: "rotate",
  interval_minutes: "15",
  min_chat_lines: "5",
  activity_window_minutes: "10",
  online_only: true,
  enabled: true,
});

const toDraft = (t: ChatTimer): Draft => ({
  id: t.id,
  name: t.name,
  messages: t.messages.length > 0 ? [...t.messages] : [""],
  selection_mode: t.selection_mode,
  interval_minutes: String(t.interval_minutes),
  min_chat_lines: String(t.min_chat_lines),
  activity_window_minutes: String(t.activity_window_minutes),
  online_only: t.online_only,
  enabled: t.enabled,
});

function wholeNumber(value: string, min: number, max: number) {
  if (!/^\d+$/.test(value.trim())) return null;
  const n = Number(value);
  return n >= min && n <= max ? n : null;
}

// Returns the timer to save, or a message explaining what to fix.
function validate(d: Draft): { timer?: Omit<ChatTimer, "status">; error?: string } {
  const name = d.name.trim();
  if (!name) return { error: "Give the timer a name." };
  const messages = d.messages.map((m) => m.trim()).filter(Boolean);
  if (messages.length === 0) return { error: "Add at least one message." };
  if (messages.some((m) => m.length > maxMessageLength)) {
    return { error: `Messages can be at most ${maxMessageLength} characters (Twitch's limit).` };
  }
  const interval = wholeNumber(d.interval_minutes, minInterval, maxInterval);
  if (interval === null) return { error: `Interval must be between ${minInterval} and ${maxInterval} minutes.` };
  const lines = wholeNumber(d.min_chat_lines, 0, 1000);
  if (lines === null) return { error: "Minimum chat messages must be between 0 and 1000." };
  const windowMinutes = wholeNumber(d.activity_window_minutes, 1, maxWindow);
  if (windowMinutes === null) return { error: `Activity window must be between 1 and ${maxWindow} minutes.` };
  return {
    timer: {
      id: d.id,
      name,
      messages,
      selection_mode: d.selection_mode,
      interval_minutes: interval,
      min_chat_lines: lines,
      activity_window_minutes: windowMinutes,
      online_only: d.online_only,
      enabled: d.enabled,
    },
  };
}

function relativeTime(iso: string) {
  const diff = Math.round((new Date(iso).getTime() - Date.now()) / 60000);
  if (diff === 0) return "now";
  const abs = Math.abs(diff);
  const text = abs >= 60 ? `${Math.floor(abs / 60)}h ${abs % 60}m` : `${abs} min`;
  return diff > 0 ? `in ${text}` : `${text} ago`;
}

function statusText(t: ChatTimer) {
  if (!t.enabled) return "Off";
  const s = t.status;
  const parts: string[] = [];
  if (s?.next_due_at) parts.push(`Next check ${relativeTime(s.next_due_at)}`);
  else parts.push(`First message in about ${t.interval_minutes} min`);
  if (s?.last_skip_reason) parts.push(`last skipped: ${s.last_skip_reason}`);
  else if (s?.last_sent_at) parts.push(`last sent ${relativeTime(s.last_sent_at)}`);
  return parts.join(" · ");
}

function summary(t: ChatTimer) {
  const parts = [`Every ${t.interval_minutes} min`];
  parts.push(
    t.min_chat_lines > 0
      ? `${t.min_chat_lines}+ messages in ${t.activity_window_minutes} min`
      : "no activity needed",
  );
  if (t.messages.length > 1) parts.push(t.selection_mode === "random" ? "random order" : "in order");
  if (t.online_only) parts.push("live only");
  return parts.join(" · ");
}

function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (next: boolean) => void; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus ${
        checked ? "bg-emerald-500" : "bg-ax-border"
      } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
    >
      <span className={`inline-block h-4 w-4 transform rounded-full bg-ax-section shadow transition-transform ${checked ? "translate-x-4" : "translate-x-1"}`} />
    </button>
  );
}

const inputClass =
  "w-full rounded-md border border-ax-border bg-ax-section px-2.5 py-1.5 text-sm text-ax-body placeholder:text-ax-muted focus:outline-none focus:ring-2 focus:ring-accent/60";
const labelClass = "text-xs font-medium text-ax-secondary";
const ghostButton =
  "inline-flex items-center gap-1.5 rounded-md border border-ax-border px-3 py-1.5 text-xs font-medium text-ax-body hover:bg-ax-raised disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus";
const primaryButton =
  "inline-flex items-center gap-1.5 rounded-md bg-ax-accent px-3 py-1.5 text-xs font-semibold text-ax-btn-text hover:bg-ax-btn-hover active:bg-ax-btn-pressed disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus";

function TimerEditor({
  draft,
  setDraft,
  onSave,
  onCancel,
  saving,
  error,
}: {
  draft: Draft;
  setDraft: (update: (d: Draft) => Draft) => void;
  onSave: () => void;
  onCancel: () => void;
  saving: boolean;
  error: string | null;
}) {
  const fieldId = (name: string) => `timer-${draft.id}-${name}`;
  const setMessage = (index: number, value: string) =>
    setDraft((d) => ({ ...d, messages: d.messages.map((m, i) => (i === index ? value : m)) }));

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSave();
      }}
      className="space-y-4 border-t border-ax-subtle px-4 py-4"
      aria-label={draft.id ? `Edit timer ${draft.name}` : "New timer"}
    >
      <div className="flex flex-col gap-1.5">
        <label htmlFor={fieldId("name")} className={labelClass}>Name</label>
        <input
          id={fieldId("name")}
          value={draft.name}
          maxLength={50}
          onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
          className={`${inputClass} sm:max-w-xs`}
          placeholder="e.g. Socials"
        />
      </div>

      <fieldset className="space-y-2">
        <legend className={labelClass}>Messages</legend>
        {draft.messages.map((message, i) => {
          const over = message.trim().length > maxMessageLength;
          return (
            <div key={i} className="flex items-start gap-2">
              <div className="flex-1">
                <textarea
                  aria-label={`Message ${i + 1}`}
                  value={message}
                  rows={2}
                  onChange={(e) => setMessage(i, e.target.value)}
                  className={`${inputClass} resize-y`}
                  placeholder="Follow $(channel) so you don't miss the next stream!"
                />
                <p className={`mt-0.5 text-right font-mono text-[11px] ${over ? "text-rose-300" : "text-ax-secondary"}`}>
                  {message.trim().length}/{maxMessageLength}
                </p>
              </div>
              {draft.messages.length > 1 && (
                <button
                  type="button"
                  onClick={() => setDraft((d) => ({ ...d, messages: d.messages.filter((_, j) => j !== i) }))}
                  aria-label={`Remove message ${i + 1}`}
                  className="mt-1.5 rounded-md p-1 text-ax-secondary hover:bg-ax-raised hover:text-ax-heading focus-visible:outline focus-visible:outline-2 focus-visible:outline-ax-focus"
                >
                  <X size={16} aria-hidden="true" />
                </button>
              )}
            </div>
          );
        })}
        {draft.messages.length < maxMessages && (
          <button type="button" onClick={() => setDraft((d) => ({ ...d, messages: [...d.messages, ""] }))} className={ghostButton}>
            <Plus size={14} aria-hidden="true" /> Add another message
          </button>
        )}
        <p className="text-[11px] text-ax-secondary">
          Variables:{" "}
          {["$(channel)", "$(game)", "$(title)", "$(random.chatter)"].map((v, i) => (
            <span key={v}>
              {i > 0 && ", "}
              <code className="rounded bg-ax-raised px-1 py-0.5 font-mono text-[11px] text-ax-body">{v}</code>
            </span>
          ))}
          .
        </p>
      </fieldset>

      {draft.messages.length > 1 && (
        <fieldset>
          <legend className={labelClass}>Message order</legend>
          <div className="mt-1.5 inline-flex rounded-md border border-ax-border p-0.5" role="radiogroup">
            {(["rotate", "random"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                role="radio"
                aria-checked={draft.selection_mode === mode}
                onClick={() => setDraft((d) => ({ ...d, selection_mode: mode }))}
                className={`rounded px-3 py-1 text-xs font-medium focus-visible:outline focus-visible:outline-2 focus-visible:outline-ax-focus ${
                  draft.selection_mode === mode ? "bg-ax-raised text-ax-heading" : "text-ax-secondary hover:text-ax-heading"
                }`}
              >
                {mode === "rotate" ? "In order" : "Random"}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      <div className="grid gap-4 sm:grid-cols-3">
        <div className="flex flex-col gap-1.5">
          <label htmlFor={fieldId("interval")} className={labelClass}>Interval (minutes)</label>
          <input
            id={fieldId("interval")}
            inputMode="numeric"
            value={draft.interval_minutes}
            onChange={(e) => setDraft((d) => ({ ...d, interval_minutes: e.target.value }))}
            className={inputClass}
          />
          <p className="text-[11px] text-ax-secondary">{minInterval}–{maxInterval} minutes.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={fieldId("lines")} className={labelClass}>Minimum chat messages</label>
          <input
            id={fieldId("lines")}
            inputMode="numeric"
            value={draft.min_chat_lines}
            onChange={(e) => setDraft((d) => ({ ...d, min_chat_lines: e.target.value }))}
            className={inputClass}
          />
          <p className="text-[11px] text-ax-secondary">0 sends even when chat is quiet.</p>
        </div>
        <div className="flex flex-col gap-1.5">
          <label htmlFor={fieldId("window")} className={labelClass}>Counted over the last (minutes)</label>
          <input
            id={fieldId("window")}
            inputMode="numeric"
            value={draft.activity_window_minutes}
            onChange={(e) => setDraft((d) => ({ ...d, activity_window_minutes: e.target.value }))}
            className={inputClass}
          />
          <p className="text-[11px] text-ax-secondary">Viewer messages only; the bot&apos;s don&apos;t count.</p>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:gap-8">
        <label className="flex items-center gap-2 text-sm text-ax-body">
          <input
            type="checkbox"
            checked={draft.online_only}
            onChange={(e) => setDraft((d) => ({ ...d, online_only: e.target.checked }))}
            className="h-4 w-4"
          />
          Only while live
        </label>
        <label className="flex items-center gap-2 text-sm text-ax-body">
          <input
            type="checkbox"
            checked={draft.enabled}
            onChange={(e) => setDraft((d) => ({ ...d, enabled: e.target.checked }))}
            className="h-4 w-4"
          />
          Enabled
        </label>
      </div>

      <p className="text-[11px] leading-relaxed text-ax-secondary">
        When the timer comes due and chat had fewer messages than the minimum, it&apos;s skipped and waits another full
        interval. It never sends several catch-up messages after a quiet stretch.
      </p>

      {error && <p className="text-xs text-rose-300" role="alert">{error}</p>}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className={ghostButton} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className={primaryButton} disabled={saving}>
          {saving ? "Saving…" : draft.id ? "Save timer" : "Create timer"}
        </button>
      </div>
    </form>
  );
}

export default function TimersSection({ login }: { login: string }) {
  const [timers, setTimers] = useState<ChatTimer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [draft, setDraftState] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [rowError, setRowError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<number | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const setDraft = (update: (d: Draft) => Draft) => setDraftState((d) => (d ? update(d) : d));

  const load = useCallback(async () => {
    try {
      const res = await fetch(`${backendUrl}/timers?login=${encodeURIComponent(login)}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTimers(Array.isArray(data.timers) ? data.timers : []);
      setLoadError(null);
    } catch {
      setLoadError("Couldn't load timers. Refresh to try again.");
    } finally {
      setLoading(false);
    }
  }, [login]);

  useEffect(() => {
    load();
    // Refresh the "next check" times while the page is open.
    const id = setInterval(load, 60_000);
    return () => clearInterval(id);
  }, [load]);

  const post = async (path: string, body: object) => {
    const res = await fetch(`${backendUrl}${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login, ...body }),
    });
    if (!res.ok) {
      const text = (await res.text()).trim();
      throw new Error(res.status < 500 && text ? text.charAt(0).toUpperCase() + text.slice(1) : "Something went wrong. Please try again.");
    }
    return res;
  };

  const save = async () => {
    if (!draft) return;
    const { timer, error } = validate(draft);
    if (!timer) {
      setFormError(error ?? "Check the timer settings.");
      return;
    }
    setSaving(true);
    setFormError(null);
    try {
      const res = await post("/timers", timer);
      const data = await res.json();
      const saved: ChatTimer = data.timer;
      setTimers((prev) => {
        const next = prev.some((t) => t.id === saved.id) ? prev.map((t) => (t.id === saved.id ? saved : t)) : [...prev, saved];
        return next.sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: "base" }));
      });
      setDraftState(null);
    } catch (e) {
      setFormError(e instanceof Error ? e.message : "Something went wrong. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const setEnabled = async (t: ChatTimer, enabled: boolean) => {
    setBusyId(t.id);
    setRowError(null);
    try {
      const res = await post("/timers", { ...t, enabled });
      const data = await res.json();
      setTimers((prev) => prev.map((x) => (x.id === t.id ? data.timer : x)));
    } catch (e) {
      setRowError(e instanceof Error ? e.message : "Couldn't update the timer.");
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (t: ChatTimer) => {
    setBusyId(t.id);
    setRowError(null);
    try {
      await post("/timers/delete", { id: t.id, name: t.name });
      setTimers((prev) => prev.filter((x) => x.id !== t.id));
      setConfirmDelete(null);
    } catch (e) {
      setRowError(e instanceof Error ? e.message : "Couldn't delete the timer.");
    } finally {
      setBusyId(null);
    }
  };

  const startEdit = (next: Draft) => {
    setFormError(null);
    setConfirmDelete(null);
    setDraftState(next);
  };

  const creating = draft !== null && draft.id === 0;

  return (
    <section aria-labelledby="timers-title" className="rounded-md border border-ax-subtle bg-ax-section p-6">
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="timers-title" className="flex items-center gap-2 text-xl font-semibold text-ax-heading">
            <Clock size={20} aria-hidden="true" className="text-ax-accent" />
            Timers
          </h2>
          <p className="mt-1 text-sm text-ax-secondary">
            Messages AxyraBot posts in chat on a schedule, only when chat is active enough.
          </p>
        </div>
        {!creating && (
          <button type="button" onClick={() => startEdit(newDraft())} className={primaryButton}>
            <Plus size={14} aria-hidden="true" /> New timer
          </button>
        )}
      </div>

      {loading && <p className="text-sm text-ax-secondary">Loading timers…</p>}
      {loadError && <p className="text-sm text-rose-300">{loadError}</p>}
      {rowError && <p className="mb-3 text-sm text-rose-300" role="alert">{rowError}</p>}

      <div className="space-y-3">
        {creating && draft && (
          <div className="rounded-md border border-ax-accent/60 bg-ax-section">
            <p className="px-4 pt-3 text-sm font-medium text-ax-heading">New timer</p>
            <TimerEditor draft={draft} setDraft={setDraft} onSave={save} onCancel={() => setDraftState(null)} saving={saving} error={formError} />
          </div>
        )}

        {timers.map((t) => {
          const editing = draft?.id === t.id;
          return (
            <div key={t.id} className="rounded-md border border-ax-subtle bg-ax-section">
              <div className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-ax-body">{t.name}</p>
                  <p className="text-xs text-ax-secondary">{summary(t)}</p>
                  <p className="mt-0.5 font-mono text-[11px] text-ax-muted">{statusText(t)}</p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {confirmDelete === t.id ? (
                    <>
                      <span className="text-xs text-ax-body">Delete this timer?</span>
                      <button type="button" onClick={() => setConfirmDelete(null)} className={ghostButton} disabled={busyId === t.id}>
                        Keep
                      </button>
                      <button
                        type="button"
                        onClick={() => remove(t)}
                        disabled={busyId === t.id}
                        className="inline-flex items-center gap-1.5 rounded-md bg-rose-500 px-3 py-1.5 text-xs font-semibold text-white hover:bg-rose-400 disabled:opacity-60 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ax-focus"
                      >
                        Delete
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => (editing ? setDraftState(null) : startEdit(toDraft(t)))}
                        aria-label={`Edit ${t.name}`}
                        aria-expanded={editing}
                        className={ghostButton}
                      >
                        <Pencil size={14} aria-hidden="true" /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmDelete(t.id)}
                        aria-label={`Delete ${t.name}`}
                        className="rounded-md p-1.5 text-ax-secondary hover:bg-ax-raised hover:text-rose-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-ax-focus"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                      <Toggle checked={t.enabled} onChange={(next) => setEnabled(t, next)} label={`${t.name} enabled`} disabled={busyId === t.id} />
                    </>
                  )}
                </div>
              </div>
              {editing && draft && (
                <TimerEditor draft={draft} setDraft={setDraft} onSave={save} onCancel={() => setDraftState(null)} saving={saving} error={formError} />
              )}
            </div>
          );
        })}

        {!loading && !loadError && timers.length === 0 && !creating && (
          <p className="rounded-md border border-dashed border-ax-border px-4 py-6 text-center text-sm text-ax-secondary">
            No timers yet. Create one to share your socials, schedule or Discord on a regular basis.
          </p>
        )}
      </div>
    </section>
  );
}
