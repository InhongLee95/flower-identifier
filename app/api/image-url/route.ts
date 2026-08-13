import { NextRequest, NextResponse } from "next/server";
import { getClientKey, isCrossOriginBrowserRequest, isRateLimited } from "@/lib/rate-limit";
import { FLOWER_BUCKET, supabaseAdmin } from "@/lib/supabase-server";

export const runtime = "nodejs";

const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1시간, DESIGN.md 참고
const MAX_PATHS = 20;

// identify 라우트가 만드는 경로 형식(UUID.jpg|png)만 통과시켜, 임의 경로로
// 비공개 버킷의 서명 URL을 발급받아가는 것을 막는다.
const VALID_PATH_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(jpg|png)$/i;

export async function GET(request: NextRequest) {
  if (isCrossOriginBrowserRequest(request, request.nextUrl.origin)) {
    return NextResponse.json(
      { error: { code: "FORBIDDEN", message: "잘못된 요청입니다." } },
      { status: 403 }
    );
  }
  if (isRateLimited(getClientKey(request))) {
    return NextResponse.json(
      { error: { code: "RATE_LIMITED", message: "요청이 너무 많습니다. 잠시 후 다시 시도해주세요." } },
      { status: 429 }
    );
  }

  const pathsParam = request.nextUrl.searchParams.get("paths");
  if (!pathsParam) {
    return NextResponse.json({ data: { urls: {} } });
  }

  const paths = pathsParam
    .split(",")
    .filter(Boolean)
    // 정규식의 `$`는 맨 끝 개행 문자 하나를 허용하므로, 개행이 섞인 값은 별도로 한 번 더 거른다.
    .filter((path) => !/[\r\n]/.test(path) && VALID_PATH_PATTERN.test(path))
    .slice(0, MAX_PATHS);

  const results = await Promise.all(
    paths.map(async (path) => {
      const { data, error } = await supabaseAdmin.storage
        .from(FLOWER_BUCKET)
        .createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
      if (error) {
        console.error("[image-url] 서명 URL 발급 실패:", path, error);
      }
      return [path, error ? null : (data?.signedUrl ?? null)] as const;
    })
  );

  const allFailed = results.length > 0 && results.every(([, url]) => url === null);
  if (allFailed) {
    return NextResponse.json(
      { error: { code: "SIGN_FAILED", message: "이미지 주소 발급에 실패했습니다." } },
      { status: 500 }
    );
  }

  const urls = Object.fromEntries(results.filter(([, url]) => url !== null));
  return NextResponse.json({ data: { urls } });
}
