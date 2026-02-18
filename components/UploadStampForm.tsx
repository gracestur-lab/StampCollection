"use client";

import { useState } from "react";
import { THEME_TAXONOMY } from "@/lib/constants";

export default function UploadStampForm() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setMessage(null);
    setLoading(true);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const response = await fetch("/api/stamps/upload", {
      method: "POST",
      body: formData
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      setMessage(data.error ?? "Upload failed");
      setLoading(false);
      return;
    }

    if (data.batch) {
      setMessage(
        `Uploaded ${data.total} stamps. Auto-extracted ${data.extractedCount}, queued OCR for ${data.queuedCount}.`
      );
    } else if (data.extractionStatus === "vision_success") {
      setMessage(`Uploaded and auto-extracted details for stamp #${data.stamp?.id}.`);
    } else if (data.extractionStatus === "missing_openai_key") {
      setMessage(
        `Uploaded stamp #${data.stamp?.id}. Auto-fill skipped because OPENAI_API_KEY is missing/placeholder; OCR job queued.`
      );
    } else if (data.extractionStatus === "vision_no_fields") {
      setMessage(
        `Uploaded stamp #${data.stamp?.id}. Vision couldn't confidently read fields, so OCR job was queued.`
      );
    } else if (data.extractionStatus === "vision_error") {
      setMessage(
        `Uploaded stamp #${data.stamp?.id}. Vision failed at runtime, so OCR job was queued.`
      );
    } else {
      setMessage(
        data.extracted
          ? `Uploaded and auto-extracted details for stamp #${data.stamp?.id}.`
          : `Uploaded. OCR job queued for stamp #${data.stamp?.id}.`
      );
    }
    setLoading(false);
    form.reset();
    window.location.reload();
  }

  return (
    <form onSubmit={onSubmit} className="grid gap-3 rounded-2xl border border-[#cfbea6] bg-white/70 p-5 shadow-[0_14px_32px_rgba(29,22,15,0.1)] md:grid-cols-6 md:items-end">
      <label className="flex flex-col gap-1 text-sm md:col-span-2">
        Stamp Name
        <input name="name" type="text" placeholder="Optional" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Scott Number
        <input name="scottNumber" type="text" placeholder="Optional (e.g. 3000, C10)" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Face Value
        <input name="faceValue" type="text" placeholder="Optional (e.g. 25c, $1.00)" />
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Themes (multi-select)
        <select name="themes" multiple className="min-h-24">
          {THEME_TAXONOMY.map((theme) => (
            <option key={theme} value={theme}>
              {theme}
            </option>
          ))}
        </select>
        <span className="text-xs text-stone-500">Use Cmd/Ctrl + click to select multiple.</span>
      </label>

      <label className="flex flex-col gap-1 text-sm">
        Custom Themes
        <input name="customThemes" type="text" placeholder="Optional (comma-separated)" />
      </label>

      <label className="flex flex-col gap-1 text-sm md:col-span-2">
        Image(s)
        <input
          name="images"
          type="file"
          accept="image/*"
          multiple
          required
          className="file:mr-3 file:rounded file:border file:border-stone-400 file:px-2 file:py-1 file:text-sm"
        />
      </label>

      <button type="submit" disabled={loading} className="btn-primary md:col-span-6">
        {loading ? "Uploading..." : "Upload Stamp"}
      </button>

      {message ? <p className="text-sm text-stone-700 md:col-span-6">{message}</p> : null}
    </form>
  );
}
