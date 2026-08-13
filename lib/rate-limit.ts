// 서버리스 인스턴스가 살아있는 동안만 유지되는 메모리 카운터.
// 완벽한 방어는 아니지만(인스턴스 재시작 시 초기화), 개인용 앱에서
// 무제한 자동 호출로 인한 API 비용 폭탄을 막는 최소한의 방어선 역할을 한다.
const WINDOW_MS = 60_000;
const MAX_REQUESTS_PER_WINDOW = 10;

const hits = new Map<string, number[]>();

export function isRateLimited(key: string): boolean {
  const now = Date.now();
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    // 이미 차단 상태면 기록을 더 늘리지 않는다 (폭주 시 메모리 무한 증가 방지)
    hits.set(key, recent);
    return true;
  }

  recent.push(now);
  hits.set(key, recent);
  return false;
}

export function getClientKey(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() ?? "unknown";
}

// 다른 사이트가 방문자의 브라우저를 통해 우리 API를 대신 호출하는 것을 막는다.
// Origin 헤더는 브라우저가 스크립트로 위조할 수 없으므로, 있는데 우리 origin과
// 다르면 거절한다. 없으면(서버 간 호출 등) 통과시킨다 — 그런 요청은 IP 기준
// 요청 제한으로 별도 방어된다.
export function isCrossOriginBrowserRequest(request: Request, expectedOrigin: string): boolean {
  const origin = request.headers.get("origin");
  return origin !== null && origin !== expectedOrigin;
}
