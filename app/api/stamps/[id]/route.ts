import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  FOREVER_STAMP_FACE_VALUE,
  STAMP_COLOR_TAXONOMY,
  THEME_TAXONOMY
} from "@/lib/constants";

export const runtime = "nodejs";

function parseStampId(raw: string) {
  const value = Number(raw);
  return Number.isInteger(value) ? value : null;
}

function parseYear(value: unknown): number | null {
  if (value === null) return null;
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < 1800 || value > 2100) return null;
  return value;
}

function parseScottNumber(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toUpperCase();
  if (!trimmed.length) return null;
  if (!/^[A-Z0-9-]{1,20}$/.test(trimmed)) return null;
  return trimmed;
}

function parseFaceValue(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.length) return null;
  if (trimmed.toLowerCase().includes("forever")) return FOREVER_STAMP_FACE_VALUE;
  return trimmed;
}

function parseName(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length ? trimmed : null;
}

function parseTheme(value: unknown) {
  if (value === null) return null;
  if (typeof value !== "string") return null;
  return THEME_TAXONOMY.includes(value as (typeof THEME_TAXONOMY)[number])
    ? (value as (typeof THEME_TAXONOMY)[number])
    : null;
}

function parseThemeTags(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") return null;

  const tags = value
    .split(",")
    .map((item) => item.trim().toUpperCase().replace(/\s+/g, "_"))
    .filter(Boolean);

  if (!tags.length) return null;
  return [...new Set(tags)].slice(0, 12).join(",");
}

function parseDominantColors(value: unknown): string | null {
  if (value === null) return null;
  if (typeof value !== "string") return null;

  const normalized = value
    .split(",")
    .map((item) => item.trim().toUpperCase())
    .filter(Boolean);

  if (normalized.length === 0) return null;

  const unique = Array.from(new Set(normalized));
  if (unique.length > 5) return null;
  if (!unique.every((color) => STAMP_COLOR_TAXONOMY.includes(color as (typeof STAMP_COLOR_TAXONOMY)[number]))) {
    return null;
  }

  return unique.join(",");
}

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const stampId = parseStampId(params.id);
  if (stampId == null) {
    return NextResponse.json({ error: "Invalid stamp id" }, { status: 400 });
  }

  const existing = await prisma.stamp.findUnique({ where: { id: stampId } });
  if (!existing) {
    return NextResponse.json({ error: "Stamp not found" }, { status: 404 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = parseName((body as Record<string, unknown>).name);
  const year = parseYear((body as Record<string, unknown>).year);
  const scottNumber = parseScottNumber((body as Record<string, unknown>).scottNumber);
  const faceValue = parseFaceValue((body as Record<string, unknown>).faceValue);
  const theme = parseTheme((body as Record<string, unknown>).theme);
  const themeTags = parseThemeTags((body as Record<string, unknown>).themeTags);
  const dominantColors = parseDominantColors((body as Record<string, unknown>).dominantColors);

  if ((body as Record<string, unknown>).name !== undefined && name == null) {
    return NextResponse.json({ error: "Invalid name" }, { status: 400 });
  }

  if ((body as Record<string, unknown>).year !== undefined && year == null && (body as Record<string, unknown>).year !== null) {
    return NextResponse.json({ error: "Invalid year" }, { status: 400 });
  }

  if (
    (body as Record<string, unknown>).scottNumber !== undefined &&
    scottNumber == null &&
    (body as Record<string, unknown>).scottNumber !== null
  ) {
    return NextResponse.json({ error: "Invalid Scott number" }, { status: 400 });
  }

  if ((body as Record<string, unknown>).faceValue !== undefined && faceValue == null && (body as Record<string, unknown>).faceValue !== null) {
    return NextResponse.json({ error: "Invalid face value" }, { status: 400 });
  }

  if ((body as Record<string, unknown>).theme !== undefined && theme == null && (body as Record<string, unknown>).theme !== null) {
    return NextResponse.json({ error: "Invalid theme" }, { status: 400 });
  }

  if (
    (body as Record<string, unknown>).themeTags !== undefined &&
    themeTags == null &&
    (body as Record<string, unknown>).themeTags !== null
  ) {
    return NextResponse.json({ error: "Invalid theme tags" }, { status: 400 });
  }

  if (
    (body as Record<string, unknown>).dominantColors !== undefined &&
    dominantColors == null &&
    (body as Record<string, unknown>).dominantColors !== null
  ) {
    return NextResponse.json(
      { error: `Invalid colors. Use comma-separated colors from: ${STAMP_COLOR_TAXONOMY.join(", ")}` },
      { status: 400 }
    );
  }

  const updateData: Record<string, unknown> = {};
  if ((body as Record<string, unknown>).name !== undefined) updateData.name = name;
  if ((body as Record<string, unknown>).year !== undefined) updateData.year = year;
  if ((body as Record<string, unknown>).scottNumber !== undefined) {
    updateData.scottNumber = scottNumber;
    updateData.confidenceScottNumber = scottNumber ? 1 : null;
  }
  if ((body as Record<string, unknown>).faceValue !== undefined) updateData.faceValue = faceValue;
  if ((body as Record<string, unknown>).theme !== undefined) updateData.theme = theme;
  if ((body as Record<string, unknown>).themeTags !== undefined) {
    updateData.themeTags = themeTags;
    if (themeTags) {
      const firstKnown = themeTags
        .split(",")
        .find((tag) => THEME_TAXONOMY.includes(tag as (typeof THEME_TAXONOMY)[number]));
      updateData.theme = firstKnown
        ? (firstKnown as (typeof THEME_TAXONOMY)[number])
        : null;
    } else {
      updateData.theme = null;
    }
    updateData.confidenceTheme = themeTags ? 1 : null;
  }
  if ((body as Record<string, unknown>).dominantColors !== undefined) {
    updateData.dominantColors = dominantColors;
    updateData.confidenceColors = dominantColors ? 1 : null;
  }
  updateData.needsReview = false;

  const stamp = await prisma.stamp.update({
    where: { id: stampId },
    data: updateData
  });

  return NextResponse.json({ ok: true, stamp });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const stampId = parseStampId(params.id);
  if (stampId == null) {
    return NextResponse.json({ error: "Invalid stamp id" }, { status: 400 });
  }

  const stamp = await prisma.stamp.findUnique({ where: { id: stampId } });
  if (!stamp) {
    return NextResponse.json({ error: "Stamp not found" }, { status: 404 });
  }

  await prisma.stamp.delete({ where: { id: stampId } });

  const absolutePath = path.join(process.cwd(), "public", stamp.imagePath.replace(/^\//, ""));
  await fs.unlink(absolutePath).catch(() => {});

  return NextResponse.json({ ok: true });
}
