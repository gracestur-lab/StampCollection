import path from "path";
import { prisma } from "../lib/prisma";
import { extractStampFromImage } from "../lib/stamp-extraction";

const POLL_MS = Number(process.env.OCR_POLL_MS ?? 5000);

async function processOneJob() {
  const job = await prisma.ocrJob.findFirst({
    where: { status: "PENDING" },
    include: { stamp: true },
    orderBy: { createdAt: "asc" }
  });

  if (!job) return false;

  await prisma.ocrJob.update({
    where: { id: job.id },
    data: { status: "PROCESSING", error: null }
  });

  try {
    const absoluteImagePath = path.join(process.cwd(), "public", job.stamp.imagePath.replace(/^\//, ""));
    const parsed = await extractStampFromImage(absoluteImagePath);
    const parsedThemeTags = parsed.theme ? parsed.theme : null;

    await prisma.stamp.update({
      where: { id: job.stampId },
      data: {
        scottNumber: parsed.scottNumber,
        faceValue: parsed.faceValue,
        theme: parsed.theme,
        themeTags: parsedThemeTags,
        dominantColors: parsed.dominantColors,
        confidenceScottNumber: parsed.confidenceScottNumber,
        confidenceFaceValue: parsed.confidenceFaceValue,
        confidenceTheme: parsed.confidenceTheme,
        confidenceColors: parsed.confidenceColors,
        needsReview: parsed.needsReview
      }
    });

    await prisma.ocrJob.update({
      where: { id: job.id },
      data: {
        status: "COMPLETED",
        completedAt: new Date()
      }
    });

    console.log(`Processed OCR job ${job.id} for stamp ${job.stampId}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown OCR failure";

    await prisma.ocrJob.update({
      where: { id: job.id },
      data: {
        status: "FAILED",
        error: message
      }
    });

    console.error(`OCR job ${job.id} failed: ${message}`);
  }

  return true;
}

async function run() {
  console.log(`OCR worker started. Poll every ${POLL_MS}ms.`);

  while (true) {
    const found = await processOneJob();
    if (!found) {
      await new Promise((resolve) => setTimeout(resolve, POLL_MS));
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
