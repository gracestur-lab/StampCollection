import { randomUUID } from "crypto";
import fs from "fs/promises";
import path from "path";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { FOREVER_STAMP_FACE_VALUE, THEME_TAXONOMY } from "@/lib/constants";
import { extractStampFromImage } from "@/lib/stamp-extraction";

export const runtime = "nodejs";

function sanitizeFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function hasUsableOpenAiKey() {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return false;
  const lowered = key.toLowerCase();
  if (lowered.includes("your_real_key_here") || lowered.includes("replace")) return false;
  return true;
}

function normalizeFaceValue(value: string | null): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.toLowerCase().includes("forever")) return FOREVER_STAMP_FACE_VALUE;
  return trimmed;
}

type UploadOutcome = {
  stamp: Awaited<ReturnType<typeof prisma.stamp.create>>;
  extracted: boolean;
  extractionStatus:
    | "vision_success"
    | "vision_no_fields"
    | "vision_error"
    | "missing_openai_key";
};

function normalizeThemeTag(value: string): string {
  return value.trim().toUpperCase().replace(/\s+/g, "_");
}

function parseThemeTags(selectedThemes: string[], customThemesRaw: string): string[] {
  const customThemes = customThemesRaw
    .split(",")
    .map((item) => normalizeThemeTag(item))
    .filter(Boolean);

  const tags = [...selectedThemes.map((item) => normalizeThemeTag(item)), ...customThemes];
  return [...new Set(tags)].slice(0, 12);
}

function primaryThemeFromTags(themeTags: string[]): (typeof THEME_TAXONOMY)[number] | null {
  const firstKnown = themeTags.find((tag) =>
    THEME_TAXONOMY.includes(tag as (typeof THEME_TAXONOMY)[number])
  );
  return firstKnown ? (firstKnown as (typeof THEME_TAXONOMY)[number]) : null;
}

async function processUploadFile(
  file: File,
  suppliedName: string,
  scottNumber: string | null,
  faceValue: string | null,
  themeTags: string[]
): Promise<UploadOutcome> {
  const ext = path.extname(file.name) || ".jpg";
  const baseName = sanitizeFileName(path.basename(file.name, ext));
  const filename = `${Date.now()}-${randomUUID()}-${baseName}${ext}`;

  const uploadsDir = path.join(process.cwd(), "public", "uploads");
  await fs.mkdir(uploadsDir, { recursive: true });

  const bytes = Buffer.from(await file.arrayBuffer());
  const absolutePath = path.join(uploadsDir, filename);
  await fs.writeFile(absolutePath, bytes);

  const theme = primaryThemeFromTags(themeTags);
  const themeTagsCsv = themeTags.length ? themeTags.join(",") : null;

  const stamp = await prisma.stamp.create({
    data: {
      name: suppliedName || baseName || "Untitled Stamp",
      scottNumber,
      faceValue,
      imagePath: `/uploads/${filename}`,
      theme,
      themeTags: themeTagsCsv,
      needsReview: true
    }
  });

  if (!hasUsableOpenAiKey()) {
    await prisma.ocrJob.create({
      data: {
        stampId: stamp.id,
        status: "PENDING"
      }
    });

    return {
      stamp,
      extracted: false,
      extractionStatus: "missing_openai_key"
    };
  }

  try {
    const extracted = await extractStampFromImage(absolutePath, { skipOcr: true });
    const autoFilledAny =
      extracted.name !== null ||
      extracted.scottNumber !== null ||
      extracted.faceValue !== null ||
      extracted.theme !== null ||
      themeTags.length > 0;

    const finalName = suppliedName || extracted.name || stamp.name;
    const finalScottNumber = scottNumber ?? extracted.scottNumber;
    const finalFaceValue = faceValue ?? extracted.faceValue;
    const extractedThemeTags = extracted.theme ? [extracted.theme] : [];
    const finalThemeTags = themeTags.length ? themeTags : extractedThemeTags;
    const finalTheme = primaryThemeFromTags(finalThemeTags);
    const finalThemeTagsCsv = finalThemeTags.length ? finalThemeTags.join(",") : null;

    const confidenceScottNumber =
      finalScottNumber === null ? null : scottNumber !== null ? 1 : extracted.confidenceScottNumber;
    const confidenceFaceValue = finalFaceValue === null ? null : faceValue !== null ? 1 : extracted.confidenceFaceValue;
    const confidenceTheme = finalThemeTags.length === 0 ? null : themeTags.length > 0 ? 1 : extracted.confidenceTheme;
    const dominantColors = extracted.dominantColors;
    const confidenceColors = dominantColors ? extracted.confidenceColors : null;

    const needsReview =
      finalScottNumber === null ||
      finalFaceValue === null ||
      finalThemeTags.length === 0 ||
      (confidenceScottNumber ?? 0) < 0.75 ||
      (confidenceFaceValue ?? 0) < 0.75 ||
      (confidenceTheme ?? 0) < 0.75;

    const updated = await prisma.stamp.update({
      where: { id: stamp.id },
      data: {
        name: finalName,
        scottNumber: finalScottNumber,
        faceValue: finalFaceValue,
        theme: finalTheme,
        themeTags: finalThemeTagsCsv,
        dominantColors,
        confidenceScottNumber,
        confidenceFaceValue,
        confidenceTheme,
        confidenceColors,
        needsReview
      }
    });

    if (!autoFilledAny) {
      await prisma.ocrJob.create({
        data: {
          stampId: stamp.id,
          status: "PENDING"
        }
      });
    }

    return {
      stamp: updated,
      extracted: autoFilledAny,
      extractionStatus: autoFilledAny ? "vision_success" : "vision_no_fields"
    };
  } catch {
    await prisma.ocrJob.create({
      data: {
        stampId: stamp.id,
        status: "PENDING"
      }
    });

    return {
      stamp,
      extracted: false,
      extractionStatus: "vision_error"
    };
  }
}

export async function POST(request: Request) {
  const formData = await request.formData();
  const imageList = formData
    .getAll("images")
    .filter((value): value is File => value instanceof File && value.size > 0);
  const singleImage = formData.get("image");
  if (imageList.length === 0 && singleImage instanceof File) {
    imageList.push(singleImage);
  }
  const suppliedName = String(formData.get("name") ?? "").trim();
  const scottNumberRaw = String(formData.get("scottNumber") ?? "").trim();
  const faceValueRaw = String(formData.get("faceValue") ?? "").trim();
  const selectedThemes = formData
    .getAll("themes")
    .map((value) => String(value))
    .filter(Boolean);
  const customThemesRaw = String(formData.get("customThemes") ?? "").trim();

  if (imageList.length === 0) {
    return NextResponse.json({ error: "At least one image file is required" }, { status: 400 });
  }

  const themeTags = parseThemeTags(selectedThemes, customThemesRaw);
  const scottNumber = scottNumberRaw ? scottNumberRaw.toUpperCase() : null;
  const faceValue = normalizeFaceValue(faceValueRaw || null);

  const outcomes: UploadOutcome[] = [];

  for (let i = 0; i < imageList.length; i += 1) {
    const file = imageList[i];
    const nameForThisFile =
      suppliedName && imageList.length > 1 ? `${suppliedName} ${i + 1}` : suppliedName;
    const outcome = await processUploadFile(file, nameForThisFile, scottNumber, faceValue, themeTags);
    outcomes.push(outcome);
  }

  if (outcomes.length === 1) {
    return NextResponse.json({
      ok: true,
      stamp: outcomes[0].stamp,
      extracted: outcomes[0].extracted,
      extractionStatus: outcomes[0].extractionStatus
    });
  }

  const extractedCount = outcomes.filter((outcome) => outcome.extracted).length;
  const queuedCount = outcomes.length - extractedCount;

  return NextResponse.json({
    ok: true,
    batch: true,
    total: outcomes.length,
    extractedCount,
    queuedCount,
    stamps: outcomes.map((outcome) => outcome.stamp)
  });
}
