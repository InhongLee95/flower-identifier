# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project status

This repository currently contains only planning documents (`PRD.md`, `prd_lite.md`, `PLAN.md`, `DESIGN.md`) and environment/config scaffolding (`.env`, `.gitignore`). No Next.js project has been scaffolded yet — there is no `package.json`, `app/` directory, or `node_modules`. Once scaffolded, use the standard Next.js commands (`npm run dev`, `npm run build`, `npm run lint`).

There is also a stray `test.html` at the repo root (a plain "안녕하세요" placeholder page, unrelated to the flower app) — leave it alone unless the user asks about it.

## Related documents

- `PRD.md` — full requirements (배경, 목표, 기능 규칙, 범위/비범위, 보안)
- `prd_lite.md` — plain-language 1-page summary of the same requirements
- `PLAN.md` — this cycle's build order and success criteria (15 steps, upload → identify → history → deploy)
- `DESIGN.md` — screen layout and data flow (single-page layout, upload → Supabase Storage → OpenAI → result → localStorage)

When implementing, follow `PLAN.md`'s step order and `DESIGN.md`'s data flow; treat `PRD.md` as the source of truth if the lighter docs conflict.

## What this app does

An image-upload flower identification app: the user uploads a photo of a flower and OpenAI (gpt-4o-mini's vision capability) returns the flower's name. Single-user, personal-use tool — no auth, no multi-user support. Full requirements live in `PRD.md`; the plain-language draft is `prd_lite.md`.

## Tech stack (fixed — do not introduce alternatives)

- Next.js (App Router) — UI and API routes in one project
- OpenAI gpt-4o-mini — image-based flower identification
- Tailwind CSS — styling
- Supabase Storage — stores uploaded flower photos (via `SUPABASE_ACCESS_TOKEN` in `.env`)
- Deployment target: Vercel (default subdomain, no custom domain)

These choices are locked in for continuity with earlier course parts and an upcoming Vercel deployment step — don't swap in a different framework, model, storage, or styling approach.

## Architecture (planned)

- Single page (`app/page.tsx`): title → upload area (file picker + preview) → result area (loading / success card / error + retry) → history list (thumbnail + name + date, newest first, scrollable, with "전체 삭제" button).
- `/api/identify` (server route): receives an uploaded image, uploads it to Supabase Storage (private bucket) and sends the image itself (base64, not a URL) to OpenAI gpt-4o-mini for identification in parallel, returns the flower name + image URL.
- Client-side: each identification result (image URL, flower name, timestamp) is stored in `localStorage`, capped at the 20 most recent entries (oldest evicted first). Record metadata lives client-side only; image binaries live in Supabase Storage. Deleting history entries (individually or via "전체 삭제") only clears `localStorage` — it does not delete the underlying files in Supabase Storage (explicit non-goal).
- No server-side database/table — `localStorage` is the only persistence layer for record metadata.
- Timeout: if the identify request exceeds 10s, treat it as a failure and show the retry UI (same copy as other errors); this is separate from the 5s target for the happy path.

## Product rules to preserve when implementing

- Identification result must appear within 5s of upload.
- Accepted image formats: JPG/PNG only, 4.3MB max (lowered from the original 5MB to stay safely under Vercel's ~4.5MB request body limit — see PRD.md §5, DESIGN.md).
- Non-flower or unrecognizable images must show "꽃을 인식하지 못했습니다" rather than a generic error.
- Empty history state needs its own message, not a blank list.
- History needs a "전체 삭제" (clear all) action.
- Non-goals (do not build): login/accounts, multi-flower comparison or a plant encyclopedia, location-based features, i18n, native mobile app. See `PRD.md` section 6 for the full list.

## Secrets

`.env` holds `GITHUB_TOKEN`, `SUPABASE_ACCESS_TOKEN`, `VERCEL_TOKEN`, `OPENAI_API_KEY`. It is already listed in `.gitignore`.

## Rules

- 모든 설명과 주석은 한국어로 작성한다.
- 새 파일은 `my-app` 폴더 안에만 만든다.
- 기술 스택은 PRD에 정한 대로 Next.js로 고정한다. 다른 프레임워크로 바꾸거나 마이그레이션을 제안하지 않는다. 배포는 Vercel을 사용한다.
- 코드를 바꾸면 반드시 무엇을 왜 바꿨는지 한 줄로 알려준다.
- `.env` 등 비밀 정보 파일과 `node_modules` 폴더는 `.gitignore`에 등록해 두고, 절대 커밋하지 않는다.
- 외부 서비스 인증이 필요하면 토큰 값을 나에게 묻거나 채팅에 출력하지 말고, `.env`에 있는 값을 읽어서 사용한다. 예: Supabase를 쓸 상황이 생기면 Supabase CLI를 설치해 `.env`의 `SUPABASE_ACCESS_TOKEN`으로 작업한다. 예: Vercel 작업(배포 등)이 필요하면 Vercel CLI를 설치해 `.env`의 `VERCEL_TOKEN`으로 인증해 작업한다.
- 파일을 지워야 할 때는 바로 삭제하지 말고, `trash-can` 폴더를 만들어 그 안으로 옮겨만 둔다. 작업이 끝난 뒤 내가 직접 확인하고 삭제하겠다.
- 이미 설치된 서브에이전트는 필요할 때마다 적극 활용한다.
- 파일을 받는 서버 코드는 클라이언트가 보낸 MIME 타입(`file.type`)만 믿지 않고, 매직 넘버 등으로 실제 파일 내용을 재검증한다.
- 로그인 없이 외부에 노출되는 서버 API 라우트를 새로 만들 때는 요청 제한(rate limit)과 Origin 검사를 기본으로 같이 넣는다.
- Vercel에 배포할 때 `.env`의 키를 통째로 등록하지 않고, 그 앱이 실제로 쓰는 키만 골라 등록한다.

## 작업 절차 (검증 루프)

코드를 변경할 때는 아래 루프를 통과할 때까지 반복한다.

1) 변경한다
2) 결과를 직접 확인한다 (브라우저로 열기/실행)
3) 스스로 코드 리뷰한다
4) 문제가 있으면 고치고 다시 1)로 돌아간다
5) 통과하면 무엇을 왜 바꿨는지 한 줄로 요약한다
