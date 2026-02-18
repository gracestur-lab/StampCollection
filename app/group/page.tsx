import Link from "next/link";
import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { FOREVER_STAMP_DOLLARS } from "@/lib/constants";

function parseIds(raw?: string | string[]) {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (!value) return [];
  return value
    .split(",")
    .map((id) => Number(id.trim()))
    .filter((id) => Number.isInteger(id));
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

export default async function GroupPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  await requireUser();

  const ids = parseIds(searchParams.ids);
  const groupNameRaw = Array.isArray(searchParams.name) ? searchParams.name[0] : searchParams.name;
  const groupName = groupNameRaw?.trim() ? groupNameRaw.trim() : "Selected Group";

  const stamps =
    ids.length > 0
      ? await prisma.stamp.findMany({
          where: { id: { in: ids } },
          orderBy: { name: "asc" }
        })
      : [];

  const total = stamps.reduce((sum, stamp) => {
    const value = parseFaceValueToDollars(stamp.faceValue);
    return sum + (value ?? 0);
  }, 0);

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-6xl flex-col gap-6 px-6 py-8">
      <header className="flex items-end justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-stone-600">Stamp Group</p>
          <h1 className="text-5xl font-semibold text-stampblue">{groupName}</h1>
          <p className="mt-1 text-sm text-stone-700">
            {stamps.length} stamp(s), total ${total.toFixed(2)}
          </p>
        </div>
        <Link href="/dashboard" className="btn-secondary px-4 py-2 text-sm">
          Back to Dashboard
        </Link>
      </header>

      <section className="overflow-x-auto rounded-2xl border border-[#cfbea6] bg-white/70 shadow-[0_14px_32px_rgba(29,22,15,0.1)]">
        <table className="min-w-full text-sm">
          <thead className="border-b border-[#d7c8b2] bg-[#f2e9da] text-left">
            <tr>
              <th>Image</th>
              <th>Name</th>
              <th>Scott #</th>
              <th>Face Value</th>
              <th>Themes</th>
            </tr>
          </thead>
          <tbody>
            {stamps.map((stamp) => (
              <tr key={stamp.id} className="border-b border-[#eadfce] last:border-b-0">
                <td>
                  <img src={stamp.imagePath} alt={stamp.name} className="h-16 w-24 rounded object-cover" />
                </td>
                <td className="font-medium">{stamp.name}</td>
                <td>{stamp.scottNumber ?? "-"}</td>
                <td>{stamp.faceValue ?? "-"}</td>
                <td>{stamp.themeTags ?? stamp.theme ?? "-"}</td>
              </tr>
            ))}
            {stamps.length === 0 ? (
              <tr>
                <td colSpan={5} className="py-8 text-center text-stone-600">
                  No stamps selected. Go back to dashboard, select stamps, then click View Group Page.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </section>
    </main>
  );
}
