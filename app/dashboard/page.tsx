import { requireUser } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import SortableStampsTable, { SortDir, SortKey } from "@/components/SortableStampsTable";
import UploadStampForm from "@/components/UploadStampForm";
import {
  FOREVER_STAMP_DOLLARS,
  THEME_TAXONOMY,
  ThemeTaxonomy
} from "@/lib/constants";

function parseSort(raw?: string | string[]): SortKey {
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (value === "name" || value === "scottNumber" || value === "faceValue" || value === "theme") {
    return value;
  }
  return "name";
}

function parseDir(raw?: string | string[]): SortDir {
  const value = Array.isArray(raw) ? raw[0] : raw;
  return value === "desc" ? "desc" : "asc";
}

function parseThemeFilter(raw?: string | string[]): ThemeTaxonomy | null {
  const value = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  if (!value) return null;
  if (THEME_TAXONOMY.includes(value as ThemeTaxonomy)) {
    return value as ThemeTaxonomy;
  }
  return null;
}

function parseThemeQuery(raw?: string | string[]): string | null {
  const value = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  const trimmed = value.trim().toUpperCase().replace(/\s+/g, "_");
  return trimmed || null;
}

function parseMinFaceValue(raw?: string | string[]): number | null {
  const value = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  if (!value.trim()) return null;
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric < 0) return null;
  return numeric;
}

function parseGroupHighValue(raw?: string | string[]): boolean {
  const value = (Array.isArray(raw) ? raw[0] : raw) ?? "";
  return value === "1";
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

function sortStamps<
  T extends {
    name: string;
    scottNumber: string | null;
    faceValue: string | null;
    theme: ThemeTaxonomy | null;
    themeTags: string | null;
  }
>(items: T[], sortBy: SortKey, dir: SortDir) {
  const multiplier = dir === "asc" ? 1 : -1;

  return [...items].sort((a, b) => {
    if (sortBy === "name") {
      return a.name.localeCompare(b.name) * multiplier;
    }

    if (sortBy === "scottNumber") {
      const av = a.scottNumber ?? "";
      const bv = b.scottNumber ?? "";
      if (av !== bv) return av.localeCompare(bv, undefined, { numeric: true }) * multiplier;
      return a.name.localeCompare(b.name);
    }

    if (sortBy === "faceValue") {
      const av = parseFaceValueToDollars(a.faceValue) ?? -1;
      const bv = parseFaceValueToDollars(b.faceValue) ?? -1;
      if (av !== bv) return (av - bv) * multiplier;
      return a.name.localeCompare(b.name);
    }

    const at = a.themeTags?.split(",")[0] ?? a.theme ?? "UNKNOWN";
    const bt = b.themeTags?.split(",")[0] ?? b.theme ?? "UNKNOWN";
    if (at !== bt) return at.localeCompare(bt) * multiplier;
    return a.name.localeCompare(b.name);
  });
}

function buildHighValueGroups<
  T extends {
    name: string;
    faceValue: string | null;
    theme: ThemeTaxonomy | null;
    themeTags: string | null;
    imagePath: string;
    id: number;
  }
>(items: T[], minimumValue: number) {
  const grouped = new Map<string, T[]>();
  for (const stamp of items) {
    const amount = parseFaceValueToDollars(stamp.faceValue);
    if (amount === null || amount < minimumValue) continue;
    const key = stamp.themeTags?.split(",")[0] ?? stamp.theme ?? "UNKNOWN";
    const list = grouped.get(key) ?? [];
    list.push(stamp);
    grouped.set(key, list);
  }

  return [...grouped.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([theme, stamps]) => ({ theme, stamps }));
}

export default async function DashboardPage({
  searchParams
}: {
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const user = await requireUser();
  const sortBy = parseSort(searchParams.sort);
  const dir = parseDir(searchParams.dir);
  const themeFilter = parseThemeFilter(searchParams.theme);
  const themeQuery = parseThemeQuery(searchParams.themeQuery);
  const minFaceValue = parseMinFaceValue(searchParams.minFaceValue);
  const groupHighValue = parseGroupHighValue(searchParams.groupHighValue);
  const highValueThreshold = 1.85;

  const rawStamps = await prisma.stamp.findMany({
    where: themeFilter ? { theme: themeFilter } : undefined
  });
  const themeMatched =
    themeQuery === null
      ? rawStamps
      : rawStamps.filter((stamp) => {
          const tags = stamp.themeTags
            ?.split(",")
            .map((item) => item.trim())
            .filter(Boolean) ?? [];
          return tags.includes(themeQuery);
        });
  const minFiltered =
    minFaceValue === null
      ? themeMatched
      : themeMatched.filter((stamp) => {
          const value = parseFaceValueToDollars(stamp.faceValue);
          return value !== null && value >= minFaceValue;
        });
  const stamps = sortStamps(minFiltered, sortBy, dir);
  const highValueGroups = groupHighValue ? buildHighValueGroups(stamps, highValueThreshold) : [];

  const queryParams: Record<string, string> = {};
  if (themeFilter) queryParams.theme = themeFilter;
  if (themeQuery) queryParams.themeQuery = themeQuery;
  if (minFaceValue !== null) queryParams.minFaceValue = String(minFaceValue);
  if (groupHighValue) queryParams.groupHighValue = "1";

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-6 py-8">
      <header className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.22em] text-stone-600">Private Catalog</p>
          <h1 className="text-5xl font-semibold leading-none text-stampblue">Stamp Collection</h1>
          <p className="mt-1 text-sm text-stone-700">Signed in as {user.email}</p>
        </div>
        <form action="/api/logout" method="post">
          <button className="btn-secondary px-4 py-2">Logout</button>
        </form>
      </header>

      <section>
        <UploadStampForm />
      </section>

      <section className="rounded-2xl border border-[#cfbea6] bg-white/70 p-4 shadow-[0_14px_32px_rgba(29,22,15,0.1)]">
        <form action="/dashboard" method="get" className="grid gap-3 md:grid-cols-5 md:items-end">
          <input type="hidden" name="sort" value={sortBy} />
          <input type="hidden" name="dir" value={dir} />

          <label className="flex flex-col gap-1 text-sm">
            Theme Filter
            <select name="theme" defaultValue={themeFilter ?? ""}>
              <option value="">All themes</option>
              {THEME_TAXONOMY.map((theme) => (
                <option key={theme} value={theme}>
                  {theme}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Theme Tag Contains
            <input
              name="themeQuery"
              type="text"
              defaultValue={themeQuery ?? ""}
              placeholder="e.g. HISTORICAL or MY_CUSTOM_THEME"
            />
          </label>

          <label className="flex flex-col gap-1 text-sm">
            Min Face Value ($)
            <input
              name="minFaceValue"
              type="number"
              min="0"
              step="0.01"
              defaultValue={minFaceValue ?? ""}
              placeholder="Optional"
            />
          </label>

          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" name="groupHighValue" value="1" defaultChecked={groupHighValue} />
            Group stamps worth $1.85+ by theme
          </label>

          <button type="submit" className="btn-primary px-4 py-2">
            Apply Filters
          </button>

          <a href="/dashboard" className="btn-secondary px-4 py-2 text-center text-sm">
            Clear
          </a>
        </form>
      </section>

      <section>
        <SortableStampsTable stamps={stamps} sortBy={sortBy} dir={dir} queryParams={queryParams} />
      </section>

      {groupHighValue ? (
        <section className="rounded-2xl border border-[#cfbea6] bg-white/70 p-4 shadow-[0_14px_32px_rgba(29,22,15,0.1)]">
          <h2 className="text-xl font-semibold text-stampblue">
            High-Value Stamps by Theme ($
            {highValueThreshold.toFixed(2)}+)
          </h2>
          {highValueGroups.length === 0 ? (
            <p className="mt-2 text-sm text-stone-600">No stamps match this threshold.</p>
          ) : (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {highValueGroups.map((group) => (
                <div key={group.theme} className="rounded-lg border border-stone-300 p-3">
                  <h3 className="text-sm font-semibold">{group.theme}</h3>
                  <ul className="mt-2 space-y-2 text-sm">
                    {group.stamps.map((stamp) => (
                      <li key={stamp.id} className="flex items-center justify-between gap-3 border-b border-stone-200 pb-1 last:border-b-0">
                        <span className="truncate">{stamp.name}</span>
                        <span className="font-medium">{stamp.faceValue ?? "-"}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}
    </main>
  );
}
