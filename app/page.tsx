"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { addHistoryEntry, clearHistory, loadHistory } from "@/lib/history";
import type { HistoryEntry } from "@/lib/types";

const ALLOWED_TYPES = ["image/jpeg", "image/png"];
const MAX_SIZE = 4_300_000; // 4.3MB — Vercel 요청 본문 한도(약 4.5MB) 안에서 안전하게 잡을 수 있는 최대치, DESIGN.md 참고
const CLIENT_TIMEOUT_MS = 10_000;

type ResultState =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "success"; flowerName: string; description: string }
  | { status: "error"; code: string; message: string; retryable: boolean };

export default function Home() {
  const [validationError, setValidationError] = useState<string | null>(null);
  const [result, setResult] = useState<ResultState>({ status: "idle" });
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const lastFileRef = useRef<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // PLAN 13: 새로고침 시 기록 복원 (localStorage는 클라이언트에만 있어 마운트 후에 읽어야 함)
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- 최초 마운트 시 1회만 client-only 스토리지를 읽어오는 안전한 패턴
    setHistory(loadHistory());
  }, []);

  // PLAN 11·12: 기록 경로들의 서명 URL을 한 번에 요청
  useEffect(() => {
    if (history.length === 0) return;
    const paths = history.map((h) => h.imagePath);
    fetch(`/api/image-url?paths=${encodeURIComponent(paths.join(","))}`)
      .then((res) => res.json())
      .then((json) => {
        if (json?.data?.urls) setThumbnails(json.data.urls);
      })
      .catch(() => {});
  }, [history]);

  const identify = useCallback(async (file: File) => {
    setResult({ status: "loading" });

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS);

    try {
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch("/api/identify", {
        method: "POST",
        body: formData,
        signal: controller.signal,
      });
      const json = await res.json();

      if (json.error) {
        const code = json.error.code as string;
        setResult({
          status: "error",
          code,
          message: json.error.message,
          retryable: code === "TIMEOUT" || code === "UPLOAD_FAILED" || code === "AI_ERROR",
        });
        return;
      }

      setResult({
        status: "success",
        flowerName: json.data.flowerName,
        description: json.data.description,
      });
      setHistory(
        addHistoryEntry({
          imagePath: json.data.imagePath,
          flowerName: json.data.flowerName,
          description: json.data.description,
        })
      );
    } catch {
      // 네트워크 오류 또는 클라이언트 10초 타임아웃 (DESIGN.md 3단계)
      setResult({ status: "error", code: "TIMEOUT", message: "다시 시도해주세요.", retryable: true });
    } finally {
      clearTimeout(timer);
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일을 다시 선택해도 onChange가 발생하도록 초기화
    if (!file) return;

    if (!ALLOWED_TYPES.includes(file.type)) {
      setValidationError("JPG 또는 PNG 파일만 업로드할 수 있어요.");
      return;
    }
    if (file.size > MAX_SIZE) {
      setValidationError("4.3MB 이하의 사진만 업로드할 수 있어요.");
      return;
    }

    setValidationError(null);
    lastFileRef.current = file;

    // 선택 즉시 미리보기를 보여줘서, 분석 중(최대 10초) 동안에도 무엇을 올렸는지 바로 보이게 함
    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return URL.createObjectURL(file);
    });

    identify(file);
  };

  const handleRetry = () => {
    if (lastFileRef.current) identify(lastFileRef.current);
  };

  const handleClearHistory = () => {
    clearHistory();
    setHistory([]);
    setThumbnails({});
  };

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col gap-8 px-4 py-10">
      <h1 className="text-center text-2xl font-bold text-brand-dark">꽃 이름 찾기</h1>

      {/* 업로드 영역 */}
      <section className="flex flex-col items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="rounded-full bg-brand px-6 py-3 font-medium text-white transition hover:bg-brand-dark"
        >
          사진 선택하기
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png"
          className="hidden"
          onChange={handleFileChange}
        />
        {validationError && <p className="text-sm text-red-600">{validationError}</p>}
      </section>

      {/* 결과 표시 영역 */}
      <section className="flex min-h-40 flex-col items-center justify-center gap-3 rounded-2xl border border-brand/20 bg-white p-6">
        {result.status === "idle" && (
          <p className="text-sm text-gray-400">꽃 사진을 선택하면 여기에 결과가 보여요.</p>
        )}

        {previewUrl && result.status !== "idle" && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt="업로드한 사진"
            className="h-48 w-48 rounded-xl object-cover"
          />
        )}

        {result.status === "loading" && <p className="text-sm text-gray-500">분석 중...</p>}
        {result.status === "success" && (
          <div className="flex w-full max-w-sm flex-col items-center gap-2">
            <p className="text-lg font-semibold text-brand-dark">{result.flowerName}</p>
            {result.description && (
              <p className="w-full whitespace-pre-line rounded-lg bg-brand/5 p-3 text-sm leading-relaxed text-gray-700">
                {result.description}
              </p>
            )}
          </div>
        )}
        {result.status === "error" && result.code === "NOT_A_FLOWER" && (
          <p className="text-sm text-gray-600">{result.message}</p>
        )}
        {result.status === "error" && result.code !== "NOT_A_FLOWER" && (
          <div className="flex flex-col items-center gap-3">
            <p className="text-sm text-gray-600">{result.message}</p>
            {result.retryable && (
              <button
                type="button"
                onClick={handleRetry}
                className="rounded-full border border-brand px-4 py-2 text-sm font-medium text-brand-dark hover:bg-brand/10"
              >
                다시 시도
              </button>
            )}
          </div>
        )}
      </section>

      {/* 식별 기록 영역 */}
      <section className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <h2 className="font-semibold text-gray-700">식별 기록</h2>
          {history.length > 0 && (
            <button
              type="button"
              onClick={handleClearHistory}
              className="text-sm text-gray-400 underline hover:text-red-500"
            >
              전체 삭제
            </button>
          )}
        </div>

        {history.length === 0 ? (
          <p className="text-sm text-gray-400">아직 식별한 꽃이 없어요</p>
        ) : (
          <ul className="flex max-h-96 flex-col gap-2 overflow-y-auto">
            {history.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-3 rounded-lg border border-gray-100 p-2"
              >
                {thumbnails[entry.imagePath] ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbnails[entry.imagePath]}
                    alt={entry.flowerName}
                    className="h-14 w-14 rounded-md object-cover"
                  />
                ) : (
                  <div className="h-14 w-14 rounded-md bg-gray-100" />
                )}
                <div className="flex min-w-0 flex-col">
                  <span className="font-medium text-gray-800">{entry.flowerName}</span>
                  {entry.description && (
                    <span className="line-clamp-1 text-xs text-gray-500">
                      {entry.description}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">
                    {new Date(entry.createdAt).toLocaleString("ko-KR")}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
