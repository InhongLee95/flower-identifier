import type { HistoryEntry } from "./types";

const STORAGE_KEY = "flower-history";
const MAX_ENTRIES = 20;

// PLAN 13: 새로고침 시 기록 복원
export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // description 필드가 없던 예전 기록(호환)도 안전하게 표시되도록 기본값 채움
    return parsed.map((entry) => ({ description: "", ...entry }));
  } catch {
    return [];
  }
}

// PLAN 10: 최근 20개 유지, 초과 시 오래된 것부터 삭제 (Storage 파일은 그대로 둠)
export function addHistoryEntry(
  entry: Omit<HistoryEntry, "id" | "createdAt">
): HistoryEntry[] {
  const newEntry: HistoryEntry = {
    ...entry,
    id: crypto.randomUUID(),
    createdAt: Date.now(),
  };
  const next = [newEntry, ...loadHistory()].slice(0, MAX_ENTRIES);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

// PLAN 14: localStorage 목록만 비움 (Storage의 사진 파일은 삭제하지 않음)
export function clearHistory(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}
