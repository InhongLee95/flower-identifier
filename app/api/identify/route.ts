import { randomUUID } from "node:crypto";
import { NextRequest, NextResponse } from "next/server";
import OpenAI from "openai";
import { getClientKey, isCrossOriginBrowserRequest, isRateLimited } from "@/lib/rate-limit";
import { FLOWER_BUCKET, supabaseAdmin } from "@/lib/supabase-server";
import type { IdentifyErrorCode } from "@/lib/types";

export const runtime = "nodejs";

const ALLOWED_TYPES = ["image/jpeg", "image/png"];
const MAX_SIZE = 4 * 1024 * 1024; // 4MB — Vercel 요청 본문 한도(약 4.5MB) 대응, DESIGN.md 참고
const TIMEOUT_MS = 10_000;

// 파일 앞부분의 매직 넘버로 실제 이미지 형식을 확인 (file.type은 요청자가 임의로 적을 수 있어 신뢰 불가)
function hasValidMagicNumber(buffer: Buffer, mimeType: string): boolean {
  if (mimeType === "image/jpeg") {
    return buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  }
  if (mimeType === "image/png") {
    return (
      buffer.length >= 4 &&
      buffer[0] === 0x89 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x4e &&
      buffer[3] === 0x47
    );
  }
  return false;
}

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

function errorResponse(code: IdentifyErrorCode, message: string, status: number) {
  return NextResponse.json({ error: { code, message } }, { status });
}

export async function POST(request: NextRequest) {
  if (isCrossOriginBrowserRequest(request, request.nextUrl.origin)) {
    return errorResponse("FORBIDDEN", "잘못된 요청입니다.", 403);
  }
  if (isRateLimited(getClientKey(request))) {
    return errorResponse("RATE_LIMITED", "요청이 너무 많습니다. 잠시 후 다시 시도해주세요.", 429);
  }

  const formData = await request.formData();
  const file = formData.get("image");

  if (!(file instanceof File)) {
    return errorResponse("INVALID_FILE", "이미지 파일이 필요합니다.", 400);
  }

  // 서버 재검증 (브라우저 검증 우회 대비, DESIGN.md 4단계)
  if (!ALLOWED_TYPES.includes(file.type)) {
    return errorResponse("INVALID_FILE", "JPG 또는 PNG 파일만 업로드할 수 있어요.", 400);
  }
  if (file.size > MAX_SIZE) {
    return errorResponse("INVALID_FILE", "4MB 이하의 사진만 업로드할 수 있어요.", 400);
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);

  if (!hasValidMagicNumber(buffer, file.type)) {
    return errorResponse("INVALID_FILE", "JPG 또는 PNG 파일만 업로드할 수 있어요.", 400);
  }

  const base64 = buffer.toString("base64");
  const ext = file.type === "image/png" ? "png" : "jpg";
  const storagePath = `${randomUUID()}.${ext}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    // Storage 업로드와 AI 식별을 동시에 실행 (DESIGN.md 5단계) — 둘 중 하나라도 실패하면 전체 실패
    const [identifyResult, uploadResult] = await Promise.all([
      openai.chat.completions.create(
        {
          model: "gpt-4o-mini",
          response_format: { type: "json_object" },
          messages: [
            {
              role: "system",
              content:
                '너는 식물 전문가야. 사진을 보고 꽃인지 판단해줘. 반드시 JSON으로만 답해: {"isFlower": boolean, "flowerName": string | null}. flowerName은 한국어 이름으로 적어줘. 꽃이 아니거나 확신할 수 없으면 isFlower를 false로, flowerName은 null로 해.',
            },
            {
              role: "user",
              content: [
                { type: "text", text: "이 사진 속 꽃 이름이 뭐야?" },
                {
                  type: "image_url",
                  image_url: { url: `data:${file.type};base64,${base64}` },
                },
              ],
            },
          ],
        },
        { signal: controller.signal }
      ),
      supabaseAdmin.storage
        .from(FLOWER_BUCKET)
        .upload(storagePath, buffer, { contentType: file.type }),
    ]);

    if (uploadResult.error) {
      console.error("[identify] Supabase Storage 업로드 실패:", uploadResult.error);
      return errorResponse("UPLOAD_FAILED", "다시 시도해주세요.", 500);
    }

    let parsed: { isFlower?: boolean; flowerName?: string | null };
    try {
      parsed = JSON.parse(identifyResult.choices[0]?.message?.content ?? "{}");
    } catch (err) {
      console.error("[identify] OpenAI 응답 JSON 파싱 실패:", err);
      return errorResponse("AI_ERROR", "다시 시도해주세요.", 502);
    }

    if (!parsed.isFlower || !parsed.flowerName) {
      return errorResponse("NOT_A_FLOWER", "꽃을 인식하지 못했습니다.", 200);
    }

    return NextResponse.json({
      data: { flowerName: parsed.flowerName, imagePath: storagePath },
    });
  } catch (err) {
    if (controller.signal.aborted) {
      console.error("[identify] 10초 타임아웃으로 요청 중단");
      return errorResponse("TIMEOUT", "다시 시도해주세요.", 504);
    }
    console.error("[identify] OpenAI/Storage 호출 실패:", err);
    return errorResponse("AI_ERROR", "다시 시도해주세요.", 502);
  } finally {
    clearTimeout(timer);
  }
}
