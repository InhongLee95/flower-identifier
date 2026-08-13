# 꽃 이름 찾기

꽃 사진을 올리면 AI가 꽃 이름을 알려주는 개인용 웹앱입니다. 산책이나 여행 중 예쁜 꽃을 보고 이름이 궁금할 때, 포털에서 비슷한 사진을 찾아 비교할 필요 없이 사진 한 장으로 바로 확인할 수 있습니다.

## 주요 기능

- **꽃 사진 업로드 및 식별**: 사진을 올리면 OpenAI(gpt-4o-mini)가 꽃인지 판단하고 이름을 알려줍니다 (5초 이내 목표, 10초 초과 시 타임아웃 안내).
- **식별 기록 확인**: 최근 식별한 꽃 20건을 사진·이름·날짜와 함께 목록으로 다시 볼 수 있습니다. 새로고침해도 유지되며, "전체 삭제"로 한 번에 지울 수 있습니다.

로그인 없이 혼자 쓰는 개인용 도구이며, 회원가입·여러 꽃 비교·위치 기반 기능은 다루지 않습니다. 자세한 요구사항은 [`PRD.md`](./PRD.md)를 참고하세요.

## 기술 스택

- [Next.js](https://nextjs.org) (App Router) — 화면과 서버 API를 한 프로젝트에서 처리
- [OpenAI](https://platform.openai.com) gpt-4o-mini — 이미지 기반 꽃 식별
- [Tailwind CSS](https://tailwindcss.com) — 스타일링
- [Supabase Storage](https://supabase.com) — 업로드된 사진 저장 (비공개 버킷)
- 배포: [Vercel](https://vercel.com)

## 로컬에서 실행하기

```bash
npm install
npm run dev
```

`http://localhost:3000`에서 확인할 수 있습니다. 실행하려면 아래 환경 변수가 `.env`에 필요합니다 (저장소에는 포함되어 있지 않습니다).

| 변수 | 용도 |
|---|---|
| `OPENAI_API_KEY` | 꽃 이름 식별(gpt-4o-mini) |
| `SUPABASE_URL` | Supabase 프로젝트 주소 |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Storage 업로드/서명 URL 발급 |

## 설계 문서

- [`PRD.md`](./PRD.md) — 전체 요구사항
- [`PLAN.md`](./PLAN.md) — 개발 계획과 성공 기준
- [`DESIGN.md`](./DESIGN.md) — 화면 구성, 데이터 흐름, API 스펙
- [`CHECK.md`](./CHECK.md) — 배포 전 점검 결과
