"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  FOREVER_STAMP_DOLLARS,
  STAMP_COLOR_TAXONOMY,
  THEME_TAXONOMY,
  ThemeTaxonomy
} from "@/lib/constants";

export type SortKey = "name" | "scottNumber" | "faceValue" | "theme";
export type SortDir = "asc" | "desc";

type StampRow = {
  id: number;
  name: string;
  scottNumber: string | null;
  faceValue: string | null;
  theme: ThemeTaxonomy | null;
  themeTags: string | null;
  dominantColors: string | null;
  imagePath: string;
  needsReview: boolean;
  confidenceScottNumber: number | null;
  confidenceFaceValue: number | null;
  confidenceTheme: number | null;
  confidenceColors: number | null;
};

type Props = {
  stamps: StampRow[];
  sortBy: SortKey;
  dir: SortDir;
  queryParams?: Record<string, string>;
};

function nextDir(currentSort: SortKey, column: SortKey, dir: SortDir): SortDir {
  if (currentSort !== column) return "asc";
  return dir === "asc" ? "desc" : "asc";
}

function headerLink(
  label: string,
  column: SortKey,
  sortBy: SortKey,
  dir: SortDir,
  queryParams?: Record<string, string>
) {
  const targetDir = nextDir(sortBy, column, dir);
  const arrow = sortBy === column ? (dir === "asc" ? "↑" : "↓") : "";
  const params = new URLSearchParams(queryParams ?? {});
  params.set("sort", column);
  params.set("dir", targetDir);

  return (
    <Link
      href={`/dashboard?${params.toString()}`}
      className="inline-flex items-center gap-1 text-stampblue hover:underline"
    >
      {label}
      <span>{arrow}</span>
    </Link>
  );
}

function confidenceBadge(label: string, value: number | null) {
  if (value == null) return <span className="text-xs text-stone-500">{label}: -</span>;
  const color = value >= 0.85 ? "text-emerald-700" : value >= 0.7 ? "text-amber-700" : "text-red-700";
  return <span className={`text-xs ${color}`}>{label}: {(value * 100).toFixed(0)}%</span>;
}

function colorBadgeClass(color: string) {
  const map: Record<string, string> = {
    BLACK: "bg-black text-white border-black",
    WHITE: "bg-white text-stone-800 border-stone-300",
    GRAY: "bg-gray-400 text-white border-gray-500",
    BROWN: "bg-amber-800 text-white border-amber-900",
    RED: "bg-red-600 text-white border-red-700",
    ORANGE: "bg-orange-500 text-white border-orange-600",
    YELLOW: "bg-yellow-300 text-stone-900 border-yellow-400",
    GREEN: "bg-green-600 text-white border-green-700",
    BLUE: "bg-blue-600 text-white border-blue-700",
    PURPLE: "bg-purple-600 text-white border-purple-700",
    PINK: "bg-pink-400 text-stone-900 border-pink-500",
    GOLD: "bg-yellow-500 text-stone-900 border-yellow-600",
    SILVER: "bg-slate-300 text-stone-900 border-slate-400"
  };
  return map[color] ?? "bg-stone-200 text-stone-800 border-stone-300";
}

function renderColorLabels(dominantColors: string | null) {
  if (!dominantColors) return <span className="text-stone-500">Unknown</span>;

  const colors = dominantColors
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  if (!colors.length) return <span className="text-stone-500">Unknown</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {colors.map((color) => (
        <span
          key={color}
          className={`inline-flex rounded-full border px-2 py-0.5 text-xs font-medium ${colorBadgeClass(color)}`}
        >
          {color}
        </span>
      ))}
    </div>
  );
}

function renderThemeTags(themeTags: string | null, fallbackTheme: ThemeTaxonomy | null) {
  const tags = themeTags
    ? themeTags
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean)
    : fallbackTheme
      ? [fallbackTheme]
      : [];

  if (!tags.length) return <span className="text-stone-500">Unknown</span>;

  return (
    <div className="flex flex-wrap gap-1">
      {tags.map((tag) => (
        <span
          key={tag}
          className="inline-flex rounded-full border border-stampblue/40 bg-stampblue/10 px-2 py-0.5 text-xs font-medium text-stampblue"
        >
          {tag}
        </span>
      ))}
    </div>
  );
}

function parseFaceValueToDollars(value: string | null): number | null {
  if (!value) return null;
  const normalized = value.toLowerCase().replace(/,/g, "").trim();
  if (!normalized) return null;
  if (normalized.includes("forever")) return FOREVER_STAMP_DOLLARS;

  const centsMatch = normalized.match(/(\d+(?:\.\d+)?)\s*(c|¢|cents?)/);
  if (centsMatch) return Number(centsMatch[1]) / 100;

  const dollarSymbolMatch = normalized.match(/\$\s*(\d+(?:\.\d{1,2})?)/);
  if (dollarSymbolMatch) return Number(dollarSymbolMatch[1]);

  const dollarWordMatch = normalized.match(/(\d+(?:\.\d{1,2})?)\s*(dollars?)/);
  if (dollarWordMatch) return Number(dollarWordMatch[1]);

  const numeric = Number(normalized.replace(/[^0-9.]/g, ""));
  return Number.isFinite(numeric) ? numeric : null;
}

export default function SortableStampsTable({ stamps, sortBy, dir, queryParams }: Props) {
  const [rows, setRows] = useState(stamps);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [expandedImage, setExpandedImage] = useState<{ src: string; alt: string } | null>(null);
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [groupName, setGroupName] = useState("My Stamp Group");
  const themeOptions = useMemo(() => [...THEME_TAXONOMY], []);
  const selectedRows = useMemo(
    () => rows.filter((row) => selectedIds.includes(row.id)),
    [rows, selectedIds]
  );
  const selectedTotal = useMemo(
    () =>
      selectedRows.reduce((sum, stamp) => {
        const value = parseFaceValueToDollars(stamp.faceValue);
        return sum + (value ?? 0);
      }, 0),
    [selectedRows]
  );
  const allSelected = rows.length > 0 && selectedIds.length === rows.length;

  function toggleSelected(id: number) {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((stampId) => stampId !== id) : [...prev, id]
    );
  }

  function toggleSelectAll() {
    setSelectedIds((prev) => (prev.length === rows.length ? [] : rows.map((row) => row.id)));
  }

  function openGroupPage() {
    if (!selectedIds.length) return;
    const params = new URLSearchParams({
      ids: selectedIds.join(","),
      name: groupName || "Selected Group"
    });
    window.location.href = `/group?${params.toString()}`;
  }

  async function onDelete(stampId: number) {
    const ok = window.confirm("Delete this stamp?");
    if (!ok) return;

    setBusyId(stampId);
    const response = await fetch(`/api/stamps/${stampId}`, { method: "DELETE" });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      window.alert(data.error ?? "Delete failed");
      setBusyId(null);
      return;
    }

    setRows((prev) => prev.filter((stamp) => stamp.id !== stampId));
    setSelectedIds((prev) => prev.filter((id) => id !== stampId));
    setBusyId(null);
  }

  async function onEdit(stamp: StampRow) {
    const nameInput = window.prompt("Name", stamp.name) ?? stamp.name;
    const scottNumberInput =
      window.prompt("Scott Number (blank clears)", stamp.scottNumber ?? "") ?? "";
    const faceValueInput = window.prompt("Face value (blank clears)", stamp.faceValue ?? "") ?? "";
    const themeTagsInput = window.prompt(
      `Themes (comma-separated; can include custom values). Suggested: ${themeOptions.join(", ")}`,
      stamp.themeTags ?? stamp.theme ?? ""
    );
    const colorsInput = window.prompt(
      `Colors (${STAMP_COLOR_TAXONOMY.join(", ")}) comma-separated, blank clears`,
      stamp.dominantColors ?? ""
    );

    if (themeTagsInput == null || colorsInput == null) return;

    const scottNumber = scottNumberInput.trim().toUpperCase();
    if (scottNumber && !/^[A-Z0-9-]{1,20}$/.test(scottNumber)) {
      window.alert("Scott Number must use letters, numbers, or dashes.");
      return;
    }

    const parsedThemeTags = themeTagsInput
      .split(",")
      .map((item) => item.trim().toUpperCase().replace(/\s+/g, "_"))
      .filter(Boolean);
    const uniqueThemeTags = [...new Set(parsedThemeTags)].slice(0, 12);
    const firstKnownTheme =
      uniqueThemeTags.find((tag) => THEME_TAXONOMY.includes(tag as ThemeTaxonomy)) ?? null;

    const parsedColors = colorsInput
      .split(",")
      .map((item) => item.trim().toUpperCase())
      .filter(Boolean);
    const uniqueColors = [...new Set(parsedColors)];
    if (
      uniqueColors.length > 5 ||
      !uniqueColors.every((color) => STAMP_COLOR_TAXONOMY.includes(color as (typeof STAMP_COLOR_TAXONOMY)[number]))
    ) {
      window.alert(`Colors must be 1-5 comma-separated values from: ${STAMP_COLOR_TAXONOMY.join(", ")}`);
      return;
    }

    setBusyId(stamp.id);
    const response = await fetch(`/api/stamps/${stamp.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: nameInput.trim() || stamp.name,
        scottNumber: scottNumber || null,
        faceValue: faceValueInput.trim() || null,
        theme: firstKnownTheme,
        themeTags: uniqueThemeTags.length ? uniqueThemeTags.join(",") : null,
        dominantColors: uniqueColors.length ? uniqueColors.join(",") : null
      })
    });
    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      window.alert(data.error ?? "Update failed");
      setBusyId(null);
      return;
    }

    setRows((prev) => prev.map((row) => (row.id === stamp.id ? data.stamp : row)));
    setBusyId(null);
  }

  return (
    <div className="overflow-x-auto rounded-2xl border border-[#cfbea6] bg-white/70 shadow-[0_14px_32px_rgba(29,22,15,0.1)]">
      <div className="border-b border-[#d7c8b2] bg-[#f8f2e8] p-3">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-2">
            <label className="text-sm text-stone-700">Group Name</label>
            <input
              value={groupName}
              onChange={(event) => setGroupName(event.target.value)}
              className="rounded border border-stone-300 px-2 py-1 text-sm"
            />
          </div>
          <div className="flex items-center gap-3">
            <div className="text-sm text-stone-800">
              <span className="font-semibold">{groupName || "Selected Group"}:</span>{" "}
              {selectedRows.length} stamp(s), total ${selectedTotal.toFixed(2)}
            </div>
            <button
              type="button"
              onClick={openGroupPage}
              disabled={selectedRows.length === 0}
              className="btn-primary px-3 py-1.5 text-xs disabled:opacity-50"
            >
              View Group Page
            </button>
          </div>
        </div>
      </div>

      <table className="min-w-full text-sm">
        <thead className="border-b border-[#d7c8b2] bg-[#f2e9da] text-left">
          <tr>
            <th className="w-20">
              <span className="mr-2 text-xs font-semibold text-stone-700">Select</span>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                aria-label="Select all stamps"
                className="h-4 w-4 cursor-pointer accent-stampblue"
              />
            </th>
            <th>Image</th>
            <th>{headerLink("Name", "name", sortBy, dir, queryParams)}</th>
            <th>{headerLink("Scott #", "scottNumber", sortBy, dir, queryParams)}</th>
            <th>{headerLink("Face Value", "faceValue", sortBy, dir, queryParams)}</th>
            <th>{headerLink("Theme", "theme", sortBy, dir, queryParams)}</th>
            <th>Colors</th>
            <th>OCR Quality</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((stamp) => (
            <tr key={stamp.id} className="border-b border-[#eadfce] last:border-b-0">
              <td>
                <input
                  type="checkbox"
                  checked={selectedIds.includes(stamp.id)}
                  onChange={() => toggleSelected(stamp.id)}
                  aria-label={`Select ${stamp.name}`}
                  className="h-4 w-4 cursor-pointer accent-stampblue"
                />
              </td>
              <td>
                <button
                  type="button"
                  onClick={() => setExpandedImage({ src: stamp.imagePath, alt: stamp.name })}
                  className="block"
                >
                  <img src={stamp.imagePath} alt={stamp.name} className="h-14 w-20 rounded object-cover" />
                </button>
              </td>
              <td className="font-medium">{stamp.name}</td>
              <td>{stamp.scottNumber ?? "-"}</td>
              <td>{stamp.faceValue ?? "-"}</td>
              <td>{renderThemeTags(stamp.themeTags, stamp.theme)}</td>
              <td>{renderColorLabels(stamp.dominantColors)}</td>
              <td>
                <div className="flex flex-col gap-1">
                  {confidenceBadge("Scott #", stamp.confidenceScottNumber)}
                  {confidenceBadge("Denom", stamp.confidenceFaceValue)}
                  {confidenceBadge("Theme", stamp.confidenceTheme)}
                  {confidenceBadge("Colors", stamp.confidenceColors)}
                  {stamp.needsReview ? (
                    <span className="pill-warn inline-flex rounded-full border px-2 py-0.5 text-xs">
                      needs_review
                    </span>
                  ) : (
                    <span className="pill-ok inline-flex rounded-full border px-2 py-0.5 text-xs">
                      trusted
                    </span>
                  )}
                </div>
              </td>
              <td>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onEdit(stamp)}
                    disabled={busyId === stamp.id}
                    className="btn-secondary px-2 py-1 text-xs disabled:opacity-60"
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => onDelete(stamp.id)}
                    disabled={busyId === stamp.id}
                    className="btn-danger px-2 py-1 text-xs disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              </td>
            </tr>
          ))}
          {rows.length === 0 ? (
            <tr>
              <td colSpan={9} className="py-6 text-center text-stone-500">
                No stamps yet. Upload an image to create one.
              </td>
            </tr>
          ) : null}
        </tbody>
      </table>

      {expandedImage ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4"
          onClick={() => setExpandedImage(null)}
        >
          <div
            className="relative max-h-[90vh] max-w-[90vw]"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setExpandedImage(null)}
              className="btn-secondary absolute right-2 top-2 px-2 py-1 text-xs"
            >
              Close
            </button>
            <img
              src={expandedImage.src}
              alt={expandedImage.alt}
              className="max-h-[90vh] max-w-[90vw] rounded object-contain"
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
