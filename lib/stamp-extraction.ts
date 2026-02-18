import fs from "fs/promises";
import path from "path";
import { createWorker } from "tesseract.js";
import {
  FOREVER_STAMP_FACE_VALUE,
  STAMP_COLOR_TAXONOMY,
  StampColor,
  THEME_KEYWORDS,
  THEME_TAXONOMY,
  ThemeTaxonomy
} from "@/lib/constants";

type ParsedStamp = {
  name: string | null;
  scottNumber: string | null;
  confidenceScottNumber: number;
  faceValue: string | null;
  confidenceFaceValue: number;
  theme: ThemeTaxonomy | null;
  confidenceTheme: number;
  dominantColors: string | null;
  confidenceColors: number;
  needsReview: boolean;
};

type OcrParsed = {
  scottNumber: string | null;
  scottNumberConfidence: number;
  faceValue: string | null;
  faceValueConfidence: number;
  theme: ThemeTaxonomy | null;
  themeConfidence: number;
};

type VisionParsed = {
  name: string | null;
  scottNumber: string | null;
  confidenceScottNumber: number;
  faceValue: string | null;
  confidenceFaceValue: number;
  theme: ThemeTaxonomy | null;
  confidenceTheme: number;
  colors: StampColor[];
  confidenceColors: number;
};

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const OPENAI_MODEL = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
const TESSERACT_WORKER_PATH = path.join(
  process.cwd(),
  "node_modules",
  "tesseract.js",
  "src",
  "worker-script",
  "node",
  "index.js"
);

function normalizeText(text: string) {
  return text.toLowerCase().replace(/\s+/g, " ").trim();
}

function parseScottNumber(text: string): { value: string | null; confidence: number } {
  const explicit = text.match(/\bscott\s*#?\s*([a-z]{0,3}\d{1,4}[a-z]{0,3})\b/i);
  if (explicit) return { value: explicit[1].toUpperCase(), confidence: 0.84 };

  const generic = text.match(/\b([a-z]{0,2}\d{1,4}[a-z]{0,2})\b/i);
  if (!generic) return { value: null, confidence: 0 };
  const token = generic[1].toUpperCase();
  if (/^\d{4}$/.test(token) || /^\d{1,2}$/.test(token)) return { value: null, confidence: 0 };
  return { value: token, confidence: 0.72 };
}

function parseYear(text: string): { value: number | null; confidence: number } {
  const match = text.match(/\b(18\d{2}|19\d{2}|20\d{2})\b/);
  if (!match) return { value: null, confidence: 0 };
  return { value: Number(match[1]), confidence: 0.86 };
}

function parseFaceValue(text: string): { value: string | null; confidence: number } {
  if (/\bforever\b/i.test(text)) {
    return { value: FOREVER_STAMP_FACE_VALUE, confidence: 0.9 };
  }

  const match = text.match(/\b(\$\s?\d+(?:\.\d{1,2})?|\d+\s?(?:c|¢|cents?|dollars?))\b/i);
  if (!match) return { value: null, confidence: 0 };
  return { value: match[1].replace(/\s+/g, " ").trim(), confidence: 0.82 };
}

function parseTheme(text: string): { value: ThemeTaxonomy | null; confidence: number } {
  const normalized = normalizeText(text);
  for (const theme of THEME_TAXONOMY) {
    const keywords = THEME_KEYWORDS[theme];
    for (const keyword of keywords) {
      if (normalized.includes(keyword)) {
        return { value: theme, confidence: 0.8 };
      }
    }
  }
  return { value: null, confidence: 0 };
}

function parseOcrText(rawText: string): OcrParsed {
  const scottNumber = parseScottNumber(rawText);
  const faceValue = parseFaceValue(rawText);
  const theme = parseTheme(rawText);

  return {
    scottNumber: scottNumber.value,
    scottNumberConfidence: scottNumber.confidence,
    faceValue: faceValue.value,
    faceValueConfidence: faceValue.confidence,
    theme: theme.value,
    themeConfidence: theme.confidence
  };
}

function imageMimeType(imagePath: string) {
  const ext = path.extname(imagePath).toLowerCase();
  if (ext === ".png") return "image/png";
  if (ext === ".webp") return "image/webp";
  if (ext === ".gif") return "image/gif";
  return "image/jpeg";
}

function extractTextFromResponse(response: any): string {
  if (typeof response?.output_text === "string") return response.output_text;
  const output = response?.output;
  if (!Array.isArray(output)) return "";

  const parts: string[] = [];
  for (const item of output) {
    const content = item?.content;
    if (!Array.isArray(content)) continue;
    for (const block of content) {
      if (typeof block?.text === "string") {
        parts.push(block.text);
      }
    }
  }
  return parts.join("\n");
}

function extractJsonObject(text: string): string | null {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  return text.slice(start, end + 1);
}

function parseConfidence(value: unknown): number {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(1, value));
}

function parseYearValue(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isInteger(value)) return null;
  if (value < 1800 || value > 2100) return null;
  return value;
}

function parseScottNumberValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim().toUpperCase();
  if (!trimmed) return null;
  if (!/^[A-Z0-9-]{1,20}$/.test(trimmed)) return null;
  return trimmed;
}

function parseFaceValueValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed.length) return null;
  if (trimmed.toLowerCase().includes("forever")) return FOREVER_STAMP_FACE_VALUE;
  return trimmed;
}

function parseThemeValue(value: unknown): ThemeTaxonomy | null {
  if (typeof value !== "string") return null;
  if (THEME_TAXONOMY.includes(value as ThemeTaxonomy)) return value as ThemeTaxonomy;
  return null;
}

function parseNameValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.slice(0, 120);
}

function parseColorValues(value: unknown): StampColor[] {
  if (!Array.isArray(value)) return [];
  const unique = new Set<StampColor>();
  for (const item of value) {
    if (typeof item !== "string") continue;
    const normalized = item.trim().toUpperCase();
    if (STAMP_COLOR_TAXONOMY.includes(normalized as StampColor)) {
      unique.add(normalized as StampColor);
    }
  }
  return [...unique].slice(0, 5);
}

async function classifyWithVision(absoluteImagePath: string, rawOcrText: string): Promise<VisionParsed | null> {
  if (!OPENAI_API_KEY) return null;

  const imageBytes = await fs.readFile(absoluteImagePath);
  const imageDataUrl = `data:${imageMimeType(absoluteImagePath)};base64,${imageBytes.toString("base64")}`;

  const prompt = [
    "Classify this postage stamp image into one theme from this taxonomy only:",
    THEME_TAXONOMY.join(", "),
    "Also label dominant colors from this fixed list only:",
    STAMP_COLOR_TAXONOMY.join(", "),
    "Return 1 to 5 colors, ordered by prominence.",
    "If no confident fit, use null for theme.",
    "Use OCR text as supporting context:",
    rawOcrText || "(empty)",
    'Return JSON only with keys: {"name": string|null, "theme": ThemeTaxonomy|null, "confidenceTheme": number, "colors": StampColor[], "confidenceColors": number, "scottNumber": string|null, "confidenceScottNumber": number, "faceValue": string|null, "confidenceFaceValue": number}.',
    "name should be a concise stamp title (not a filename).",
    "All confidence fields must be 0 to 1."
  ].join("\n");

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${OPENAI_API_KEY}`
    },
    body: JSON.stringify({
      model: OPENAI_MODEL,
      temperature: 0,
      max_output_tokens: 220,
      input: [
        {
          role: "user",
          content: [
            { type: "input_text", text: prompt },
            { type: "input_image", image_url: imageDataUrl }
          ]
        }
      ]
    })
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(`Vision API error ${response.status}: ${message.slice(0, 300)}`);
  }

  const data = await response.json();
  const text = extractTextFromResponse(data);
  const jsonText = extractJsonObject(text);
  if (!jsonText) return null;

  const parsed = JSON.parse(jsonText) as Record<string, unknown>;
  return {
    name: parseNameValue(parsed.name),
    scottNumber: parseScottNumberValue(parsed.scottNumber),
    confidenceScottNumber: parseConfidence(parsed.confidenceScottNumber),
    faceValue: parseFaceValueValue(parsed.faceValue),
    confidenceFaceValue: parseConfidence(parsed.confidenceFaceValue),
    theme: parseThemeValue(parsed.theme),
    confidenceTheme: parseConfidence(parsed.confidenceTheme),
    colors: parseColorValues(parsed.colors),
    confidenceColors: parseConfidence(parsed.confidenceColors)
  };
}

function mergeParsed(ocr: OcrParsed, vision: VisionParsed | null): OcrParsed {
  if (!vision) return ocr;

  const scottNumber = ocr.scottNumber ?? vision.scottNumber;
  const scottNumberConfidence = ocr.scottNumber ? ocr.scottNumberConfidence : vision.confidenceScottNumber;
  const faceValue = ocr.faceValue ?? vision.faceValue;
  const faceValueConfidence = ocr.faceValue ? ocr.faceValueConfidence : vision.confidenceFaceValue;

  let theme = ocr.theme;
  let themeConfidence = ocr.themeConfidence;
  if (vision.theme && vision.confidenceTheme >= themeConfidence) {
    theme = vision.theme;
    themeConfidence = vision.confidenceTheme;
  } else if (!theme && vision.theme) {
    theme = vision.theme;
    themeConfidence = vision.confidenceTheme;
  }

  return {
    scottNumber,
    scottNumberConfidence: scottNumber ? scottNumberConfidence : 0,
    faceValue,
    faceValueConfidence: faceValue ? faceValueConfidence : 0,
    theme,
    themeConfidence
  };
}

function needsHumanReview(parsed: OcrParsed) {
  return (
    parsed.scottNumberConfidence < 0.75 ||
    parsed.faceValueConfidence < 0.75 ||
    parsed.themeConfidence < 0.75 ||
    parsed.scottNumber === null ||
    parsed.faceValue === null ||
    parsed.theme === null
  );
}

export async function extractStampFromImage(
  absoluteImagePath: string,
  options?: { skipOcr?: boolean }
): Promise<ParsedStamp> {
  let parsedFromOcr: OcrParsed = {
    scottNumber: null,
    scottNumberConfidence: 0,
    faceValue: null,
    faceValueConfidence: 0,
    theme: null,
    themeConfidence: 0
  };
  let rawText = "";

  if (!options?.skipOcr) {
    const worker = await createWorker("eng", 1, {
      workerPath: TESSERACT_WORKER_PATH
    });

    try {
      const result = await worker.recognize(absoluteImagePath);
      rawText = result.data.text ?? "";
      parsedFromOcr = parseOcrText(rawText);
    } finally {
      await worker.terminate();
    }
  }

  const parsedFromVision = await classifyWithVision(absoluteImagePath, rawText);
  const parsed = mergeParsed(parsedFromOcr, parsedFromVision);

  return {
    name: parsedFromVision?.name ?? null,
    scottNumber: parsed.scottNumber,
    confidenceScottNumber: parsed.scottNumberConfidence,
    faceValue: parsed.faceValue,
    confidenceFaceValue: parsed.faceValueConfidence,
    theme: parsed.theme,
    confidenceTheme: parsed.themeConfidence,
    dominantColors: parsedFromVision?.colors?.length ? parsedFromVision.colors.join(",") : null,
    confidenceColors: parsedFromVision?.confidenceColors ?? 0,
    needsReview: needsHumanReview(parsed)
  };
}
