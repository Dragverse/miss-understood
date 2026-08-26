"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import {
  FiArrowUp,
  FiArrowDown,
  FiColumns,
  FiEye,
  FiEyeOff,
  FiTrash2,
  FiPlus,
  FiChevronDown,
  FiCheck,
  FiX,
} from "react-icons/fi";
import { BLOCK_REGISTRY, addableBlockTypes, blockLabel } from "@/lib/blocks/registry";
import { editorFieldsFor, isFieldRelevant, type EditorField } from "@/lib/blocks/editor-fields";
import { BLOCK_VISIBILITIES, type BlockType, type ColumnIndex, type ViewerBlock } from "@/lib/blocks/types";
import { ImagesField, VideoPickerField, type BlockImage } from "./block-media-fields";

/**
 * The creator's control panel for their board: what's on it, what order, and
 * every block's settings. Lives in the dashboard so editing happens in one
 * place rather than being scattered across the public profile.
 */
export function BoardEditor({ handle, creatorDid }: { handle: string | null; creatorDid: string | null }) {
  const { getAccessToken, authenticated } = usePrivy();
  const [blocks, setBlocks] = useState<ViewerBlock[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [picking, setPicking] = useState(false);

  const authedFetch = useCallback(
    async (url: string, init: RequestInit = {}) => {
      const token = await getAccessToken();
      if (!token) throw new Error("Not signed in");
      const response = await fetch(url, {
        ...init,
        headers: { ...init.headers, "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Request failed");
      return data;
    },
    [getAccessToken]
  );

  const load = useCallback(async () => {
    if (!handle || !authenticated) {
      setIsLoading(false);
      return;
    }
    try {
      const token = await getAccessToken();
      const response = await fetch(`/api/board/${encodeURIComponent(handle)}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to load board");
      setBlocks(
        [...(data.board.blocks as ViewerBlock[])].sort((a, b) => a.position - b.position)
      );
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load board");
    } finally {
      setIsLoading(false);
    }
  }, [handle, authenticated, getAccessToken]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Persist the whole ordering, so a dropped request can't half-apply. */
  const persistOrder = useCallback(
    async (next: ViewerBlock[]) => {
      setBusy(true);
      try {
        await authedFetch("/api/board/reorder", {
          method: "POST",
          body: JSON.stringify({
            blocks: next.map((b, index) => ({
              id: b.id,
              columnIndex: b.columnIndex,
              position: index,
            })),
          }),
        });
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to reorder");
      } finally {
        setBusy(false);
      }
    },
    [authedFetch, load]
  );

  const move = (id: string, direction: -1 | 1) => {
    const index = blocks.findIndex((b) => b.id === id);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= blocks.length) return;
    const next = [...blocks];
    [next[index], next[target]] = [next[target], next[index]];
    setBlocks(next); // optimistic; persistOrder reloads from the server
    void persistOrder(next);
  };

  const swapColumn = (id: string) => {
    const next = blocks.map((b) =>
      b.id === id ? { ...b, columnIndex: (b.columnIndex === 0 ? 1 : 0) as ColumnIndex } : b
    );
    setBlocks(next);
    void persistOrder(next);
  };

  const patch = async (id: string, body: Record<string, unknown>) => {
    setBusy(true);
    try {
      await authedFetch(`/api/board/blocks/${id}`, { method: "PATCH", body: JSON.stringify(body) });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    setBusy(true);
    try {
      await authedFetch(`/api/board/blocks/${id}`, { method: "DELETE" });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    } finally {
      setBusy(false);
    }
  };

  const add = async (type: BlockType) => {
    setBusy(true);
    setPicking(false);
    try {
      await authedFetch("/api/board/blocks", {
        method: "POST",
        body: JSON.stringify({ type, columnIndex: 0 }),
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add block");
    } finally {
      setBusy(false);
    }
  };

  if (!authenticated) return null;
  if (isLoading) {
    return <p className="text-sm text-gray-400">Loading your board…</p>;
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <ul className="space-y-2">
        {blocks.map((block, index) => (
          <li key={block.id}>
            <BlockRow
              block={block}
              creatorDid={creatorDid}
              index={index}
              total={blocks.length}
              busy={busy}
              expanded={expanded === block.id}
              onToggleExpand={() => setExpanded(expanded === block.id ? null : block.id)}
              onMoveUp={() => move(block.id, -1)}
              onMoveDown={() => move(block.id, 1)}
              onSwapColumn={() => swapColumn(block.id)}
              onPatch={(body) => patch(block.id, body)}
              onRemove={() => remove(block.id)}
            />
          </li>
        ))}
      </ul>

      {picking ? (
        <div className="rounded-xl border border-[#2f2942] bg-[#1a0b2e] p-2">
          <div className="flex items-center justify-between px-2 py-1">
            <span className="text-xs uppercase tracking-wide text-gray-400">Add a block</span>
            <button onClick={() => setPicking(false)} className="text-xs text-gray-400 hover:text-white">
              Cancel
            </button>
          </div>
          <ul className="mt-1">
            {addableBlockTypes().map((type) => {
              const definition = BLOCK_REGISTRY[type];
              const Icon = definition.icon;
              return (
                <li key={type}>
                  <button
                    disabled={busy}
                    onClick={() => void add(type)}
                    className="flex items-start gap-3 w-full text-left px-2 py-2 rounded-lg hover:bg-white/5 transition-colors disabled:opacity-50"
                  >
                    <Icon aria-hidden="true" size={16} className="mt-0.5 opacity-70" />
                    <span>
                      <span className="block text-sm font-medium text-white">{definition.label}</span>
                      <span className="block text-xs text-gray-400">{definition.description}</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : (
        <button
          onClick={() => setPicking(true)}
          disabled={busy}
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl border border-dashed border-[#2f2942] text-sm text-gray-400 hover:text-white hover:border-[#EB83EA] transition-colors disabled:opacity-50"
        >
          <FiPlus aria-hidden="true" size={16} />
          Add a block
        </button>
      )}
    </div>
  );
}

function BlockRow({
  block,
  creatorDid,
  index,
  total,
  busy,
  expanded,
  onToggleExpand,
  onMoveUp,
  onMoveDown,
  onSwapColumn,
  onPatch,
  onRemove,
}: {
  block: ViewerBlock;
  creatorDid: string | null;
  index: number;
  total: number;
  busy: boolean;
  expanded: boolean;
  onToggleExpand: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onSwapColumn: () => void;
  onPatch: (body: Record<string, unknown>) => void;
  onRemove: () => void;
}) {
  const definition = BLOCK_REGISTRY[block.type];
  const Icon = definition?.icon;
  const hidden = "hidden" in block ? block.hidden : false;
  const fields = editorFieldsFor(block.type);

  return (
    <div className={`rounded-xl border border-[#2f2942] bg-[#1a0b2e] ${hidden ? "opacity-60" : ""}`}>
      <div className="flex items-center gap-2 px-3 py-2.5">
        {Icon && <Icon aria-hidden="true" size={16} className="opacity-70 flex-shrink-0" />}

        <button onClick={onToggleExpand} className="flex-1 text-left min-w-0">
          <span className="block text-sm font-medium text-white truncate">
            {blockLabel(block.type, block.title)}
          </span>
          <span className="block text-[11px] text-gray-500">
            {block.columnIndex === 0 ? "Left" : "Right"} column
            {hidden && " · hidden"}
            {block.visibility !== "public" && ` · ${block.visibility}`}
          </span>
        </button>

        <div className="flex items-center gap-0.5 flex-shrink-0">
          <RowButton label="Move up" onClick={onMoveUp} disabled={busy || index === 0}>
            <FiArrowUp size={14} />
          </RowButton>
          <RowButton label="Move down" onClick={onMoveDown} disabled={busy || index === total - 1}>
            <FiArrowDown size={14} />
          </RowButton>
          <RowButton label="Switch column" onClick={onSwapColumn} disabled={busy}>
            <FiColumns size={14} />
          </RowButton>
          <RowButton
            label={hidden ? "Show on profile" : "Hide from profile"}
            onClick={() => onPatch({ hidden: !hidden })}
            disabled={busy}
          >
            {hidden ? <FiEyeOff size={14} /> : <FiEye size={14} />}
          </RowButton>
          <RowButton label="Settings" onClick={onToggleExpand} disabled={busy}>
            <FiChevronDown
              size={14}
              className={`transition-transform ${expanded ? "rotate-180" : ""}`}
            />
          </RowButton>
        </div>
      </div>

      {expanded && (
        <BlockSettings
          block={block}
          creatorDid={creatorDid}
          fields={fields}
          busy={busy}
          onPatch={onPatch}
          onRemove={onRemove}
        />
      )}
    </div>
  );
}

function RowButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="p-1.5 rounded text-gray-400 hover:text-white hover:bg-white/10 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
    >
      {children}
    </button>
  );
}

function BlockSettings({
  block,
  creatorDid,
  fields,
  busy,
  onPatch,
  onRemove,
}: {
  block: ViewerBlock;
  creatorDid: string | null;
  fields: EditorField[];
  busy: boolean;
  onPatch: (body: Record<string, unknown>) => void;
  onRemove: () => void;
}) {
  const initialConfig = useMemo(
    () => ("config" in block ? { ...(block.config as Record<string, unknown>) } : {}),
    [block]
  );
  const [draft, setDraft] = useState<Record<string, unknown>>(initialConfig);
  const [title, setTitle] = useState(block.title ?? "");
  const [confirmDelete, setConfirmDelete] = useState(false);

  const dirty =
    JSON.stringify(draft) !== JSON.stringify(initialConfig) || (block.title ?? "") !== title;

  const set = (key: string, value: unknown) => setDraft((d) => ({ ...d, [key]: value }));

  return (
    <div className="border-t border-[#2f2942] px-3 py-3 space-y-3">
      <Field label="Heading">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={BLOCK_REGISTRY[block.type]?.label}
          className="w-full bg-[#0f071a] border border-[#2f2942] rounded-lg px-2.5 py-1.5 text-sm text-white placeholder:text-gray-600"
        />
      </Field>

      <Field label="Who can see this">
        <select
          value={block.visibility}
          onChange={(e) => onPatch({ visibility: e.target.value })}
          disabled={busy}
          className="w-full bg-[#0f071a] border border-[#2f2942] rounded-lg px-2.5 py-1.5 text-sm text-white"
        >
          {BLOCK_VISIBILITIES.map((value) => (
            <option key={value} value={value}>
              {VISIBILITY_LABELS[value]}
            </option>
          ))}
        </select>
      </Field>

      {fields
        .filter((field) => isFieldRelevant(block.type, field, draft))
        .map((field) => (
          <ConfigField
            key={field.key}
            field={field}
            value={draft[field.key]}
            creatorDid={creatorDid}
            onChange={set}
          />
        ))}

      {fields.length === 0 && (
        <p className="text-xs text-gray-500">
          This block pulls straight from your content — nothing to configure.
        </p>
      )}

      <div className="flex items-center justify-between pt-1">
        {confirmDelete ? (
          <span className="flex items-center gap-2 text-xs">
            <span className="text-gray-400">Remove this block?</span>
            <button
              onClick={onRemove}
              disabled={busy}
              className="px-2 py-1 rounded bg-red-500/20 text-red-400 hover:bg-red-500/30 disabled:opacity-50"
            >
              Remove
            </button>
            <button onClick={() => setConfirmDelete(false)} className="px-2 py-1 rounded hover:bg-white/10 text-gray-400">
              Keep
            </button>
          </span>
        ) : (
          <button
            onClick={() => setConfirmDelete(true)}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            <FiTrash2 size={12} />
            Remove block
          </button>
        )}

        <button
          onClick={() => onPatch({ config: draft, title: title.trim() || null })}
          disabled={busy || !dirty}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-[#EB83EA] text-black disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 transition-opacity"
        >
          <FiCheck size={12} />
          {dirty ? "Save changes" : "Saved"}
        </button>
      </div>
    </div>
  );
}

const VISIBILITY_LABELS: Record<string, string> = {
  public: "Everyone",
  "followers-only": "Followers",
  subscribers: "Subscribers",
  private: "Only me",
};

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">{label}</span>
      {children}
    </label>
  );
}

const inputClass =
  "w-full bg-[#0f071a] border border-[#2f2942] rounded-lg px-2.5 py-1.5 text-sm text-white placeholder:text-gray-600";

function ConfigField({
  field,
  value,
  creatorDid,
  onChange,
}: {
  field: EditorField;
  value: unknown;
  creatorDid: string | null;
  onChange: (key: string, value: unknown) => void;
}) {
  switch (field.kind) {
    case "images":
      return (
        <ImagesField
          label={field.label}
          help={field.help}
          value={Array.isArray(value) ? (value as BlockImage[]) : []}
          onChange={(images) => onChange(field.key, images)}
        />
      );

    case "videoPicker":
      return (
        <VideoPickerField
          label={field.label}
          help={field.help}
          creatorDid={creatorDid}
          value={typeof value === "string" ? value : undefined}
          onChange={(id) => onChange(field.key, id)}
        />
      );

    case "toggle":
      return (
        <label className="flex items-start gap-2.5 cursor-pointer">
          <input
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(field.key, e.target.checked)}
            className="mt-0.5 accent-[#EB83EA]"
          />
          <span>
            <span className="block text-sm text-white">{field.label}</span>
            {field.help && <span className="block text-xs text-gray-500">{field.help}</span>}
          </span>
        </label>
      );

    case "number":
      return (
        <Field label={field.label}>
          <input
            type="number"
            min={field.min}
            max={field.max}
            value={typeof value === "number" ? value : ""}
            onChange={(e) => onChange(field.key, e.target.value === "" ? undefined : Number(e.target.value))}
            className={inputClass}
          />
          {field.help && <span className="block text-xs text-gray-500 mt-1">{field.help}</span>}
        </Field>
      );

    case "select":
      return (
        <Field label={field.label}>
          <select
            value={String(value ?? "")}
            onChange={(e) => {
              const raw = e.target.value;
              const match = field.options.find((o) => String(o.value) === raw);
              onChange(field.key, match ? match.value : raw);
            }}
            className={inputClass}
          >
            {field.options.map((option) => (
              <option key={String(option.value)} value={String(option.value)}>
                {option.label}
              </option>
            ))}
          </select>
        </Field>
      );

    case "textarea":
      return (
        <Field label={field.label}>
          <textarea
            rows={field.rows ?? 3}
            value={typeof value === "string" ? value : ""}
            placeholder={field.placeholder}
            onChange={(e) => onChange(field.key, e.target.value)}
            className={`${inputClass} resize-y`}
          />
        </Field>
      );

    case "links":
      return <LinksField value={Array.isArray(value) ? value : []} onChange={(v) => onChange(field.key, v)} />;

    case "text":
    default:
      return (
        <Field label={field.label}>
          <input
            value={typeof value === "string" ? value : ""}
            placeholder={field.placeholder}
            onChange={(e) => onChange(field.key, e.target.value || undefined)}
            className={inputClass}
          />
          {"help" in field && field.help && (
            <span className="block text-xs text-gray-500 mt-1">{field.help}</span>
          )}
        </Field>
      );
  }
}

interface LinkEntry {
  label: string;
  url: string;
}

function LinksField({
  value,
  onChange,
}: {
  value: unknown[];
  onChange: (value: LinkEntry[]) => void;
}) {
  const links = value as LinkEntry[];

  const update = (index: number, patch: Partial<LinkEntry>) =>
    onChange(links.map((link, i) => (i === index ? { ...link, ...patch } : link)));

  return (
    <div>
      <span className="block text-[11px] uppercase tracking-wide text-gray-500 mb-1">Links</span>
      <div className="space-y-2">
        {links.map((link, index) => (
          <div key={index} className="flex gap-1.5">
            <input
              value={link.label ?? ""}
              placeholder="Label"
              onChange={(e) => update(index, { label: e.target.value })}
              className={`${inputClass} w-1/3`}
            />
            <input
              value={link.url ?? ""}
              placeholder="https://…"
              onChange={(e) => update(index, { url: e.target.value })}
              className={inputClass}
            />
            <button
              type="button"
              aria-label={`Remove link ${index + 1}`}
              onClick={() => onChange(links.filter((_, i) => i !== index))}
              className="p-1.5 rounded text-gray-500 hover:text-red-400 hover:bg-white/10 flex-shrink-0"
            >
              <FiX size={14} />
            </button>
          </div>
        ))}
      </div>

      <button
        type="button"
        onClick={() => onChange([...links, { label: "", url: "" }])}
        className="mt-2 inline-flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
      >
        <FiPlus size={12} />
        Add link
      </button>
    </div>
  );
}
