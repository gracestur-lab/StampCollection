import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const stampId = Number(params.id);

  if (!Number.isInteger(stampId)) {
    return NextResponse.json({ error: "Invalid stamp id" }, { status: 400 });
  }

  const stamp = await prisma.stamp.findUnique({ where: { id: stampId } });
  if (!stamp) {
    return NextResponse.json({ error: "Stamp not found" }, { status: 404 });
  }

  const job = await prisma.ocrJob.create({
    data: {
      stampId,
      status: "PENDING"
    }
  });

  return NextResponse.json({ ok: true, jobId: job.id });
}
