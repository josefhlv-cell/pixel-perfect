import { t } from "./i18n";

const czk = new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: 0 });

export function formatCZK(v: number | null | undefined): string {
  if (v == null || !Number.isFinite(v)) return t("common.unknown");
  return `${czk.format(v)} Kč`;
}

export function formatNumber(v: number | null | undefined, digits = 0): string {
  if (v == null || !Number.isFinite(v)) return t("common.unknown");
  return new Intl.NumberFormat("cs-CZ", { maximumFractionDigits: digits }).format(v);
}

export function formatBps(v: number | null | undefined, digits = 2): string {
  if (v == null || !Number.isFinite(v)) return t("common.unknown");
  return `${new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(v / 100)} %`;
}

export function formatRelative(iso: string | null | undefined): string {
  if (!iso) return t("common.unknown");
  const diff = Date.now() - new Date(iso).getTime();
  const h = Math.round(diff / 3600_000);
  if (h < 1) return "před chvílí";
  if (h < 24) return `před ${h} h`;
  const d = Math.round(h / 24);
  return `před ${d} d`;
}
