import { createClient } from "@supabase/supabase-js";

// 비공개 버킷 — 업로드된 꽃 사진 저장용 (DESIGN.md 참고)
export const FLOWER_BUCKET = "flower-photos";

// 서버 전용 클라이언트: service role 키를 쓰므로 절대 클라이언트 컴포넌트에서 import하지 않는다.
export const supabaseAdmin = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { persistSession: false } }
);
