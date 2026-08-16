---
name: notion-ai-tool
description: >-
  Notion API 연동 에이전트 스킬. 사용자의 자연어 요청에 따라 노션 글에 대한
  1) 원문 읽기 2) 요약 3) 글쓰기(신규 페이지) 4) 안전한 글수정 5) 삭제 및 휴지통 관리
  6) 회사정보(개인정보/접속정보/거래처명 등) 마스킹 을 수행합니다.
---

# Notion AI Agent Tool Workflow

이 스킬은 Codex, Copilot, Claude, Antigravity 등 셸 명령을 실행할 수 있는 모든 에이전트가
Notion API CLI를 통해 Notion 페이지를 안전하게 읽고 쓰도록 가이드합니다. 이 저장소 안에서는
`npm run notion <command>`로 쓰고, `npm link`가 되어 있으면 어느 디렉토리에서든 `notion-cli
<command>`로도 동일하게 쓸 수 있습니다.

**핵심 원칙**: 실제 "AI" 역할(요약문 작성, 신규 문서 초안 작성 등 텍스트 생성)은 이 CLI가 아니라
**호출하는 에이전트 자신**이 합니다. CLI는 그 결과를 Notion에 반영하는 단순한 실행기일 뿐입니다.

## 명령어 목록

```
npm run notion search <query>                                    # 페이지/DB 검색 (제목, id, url)
npm run notion get-content <page_query>                          # 페이지 내용을 마크다운으로 읽기
npm run notion create <parent_page_query> <title> <content_md>   # 지정한 페이지 밑에 새 페이지 생성
npm run notion append <page_query> <content_md>                  # 기존 페이지 하단에 내용 추가
npm run notion add-toggle <page_query> <toggle_title> <content_md> # 토글 블록으로 내용 추가
npm run notion propose-edit <page_query> <revised_md>             # 원문 보존한 채 수정본 제안
npm run notion approve-edit <page_query>                          # 제안 승인 → 원문은 백업 후 교체
npm run notion delete <page_query>                                # 페이지 삭제(아카이브 + 휴지통 기록)
npm run notion list-trash                                         # 휴지통 목록 조회
npm run notion restore <trash_entry_query>                        # 휴지통에서 복원
npm run notion scan <page_query>                                  # 본문에서 이메일/전화/IP/키/URL 패턴 감지
npm run notion scan-images <page_query>                           # 페이지 내 이미지에서 OCR로 텍스트 추출
```

> ⚠️ **검색 인덱싱 지연**: `create`/`delete`로 페이지를 만들거나 이름이 바뀐 직후, 곧바로 같은
> 이름으로 `search`/`get-content`/`delete`를 하면 Notion 검색 인덱스가 아직 갱신되지 않아
> 못 찾을 수 있습니다. 방금 만든/바뀐 페이지를 이어서 다뤄야 한다면 명령 결과로 나온
> URL의 페이지 ID를 그대로 쓰거나, 잠시 후 다시 시도하세요.

## 5대 핵심 기능 연동 가이드

### 1. 요약 (Summarization)
- **요청 예시**: "OO 글 3줄 요약해줘", "핵심 내용 서머리 추가해줘"
- **실행 절차**:
  1. `npm run notion get-content <page_query>` 로 원문을 읽는다.
  2. 에이전트 자신이 3줄 핵심 요약 + 주요 키워드 + Action Items를 **직접 작성**한다.
  3. `npm run notion add-toggle <page_query> "📌 AI 요약" <summary_md>` 로 상단/하단에 삽입한다.

### 2. 글쓰기 (Document Writing)
- **요청 예시**: "OO 페이지 밑에 OO 주제로 새 문서 만들어줘"
- **실행 절차**:
  1. 대상 상위 페이지가 불명확하면 `npm run notion search <keyword>` 로 후보를 보여주고 사용자가 고르게 한다.
  2. 에이전트가 템플릿(기술명세서, PRD, 회의록 등)에 맞춰 마크다운 본문을 작성한다.
  3. `npm run notion create <parent_page_query> <title> <content_md>` 로 생성한다.
  - **주의**: 이 연동에 사용되는 Notion 통합은 워크스페이스 전체가 아니라 "Add connections"로
    개별 공유된 페이지에만 접근 가능합니다. 따라서 진짜 "워크스페이스 최상위"에 페이지를 만드는
    것은 불가능하며, 반드시 기존에 공유된 페이지 중 하나를 부모로 지정해야 합니다. 사용자가
    "최상위에 만들어줘"라고 하면, 어느 공유 페이지를 부모로 쓸지 먼저 물어보세요.

### 3. 안전한 글수정 (Safe Document Editing)
- **1단계: 수정본 제안** — 요청: "OO 페이지 내용 다듬어줘"
  - `npm run notion propose-edit <page_query> <revised_md>` — 원문은 그대로 두고 하단에
    `✨ [AI 수정 제안본]` 배너 + 수정본을 추가.
- **2단계: 승인** — 요청: 사용자가 "OK" / "수정 승인"이라고 답할 때
  - `npm run notion approve-edit <page_query>` — 배너 이전 블록(원문)을 **내용까지 그대로**
    휴지통의 새 백업 페이지로 복사하고, 대상 페이지에서는 원문+배너를 지워 수정본만 남긴다.

### 4. 삭제 (Delete)
- **요청 예시**: "OO 페이지 삭제해줘", "OO 글 지워줘"
- **실행 절차**: `npm run notion delete <page_query>`
  - Notion 공개 API는 페이지 영구삭제를 지원하지 않으므로, 내부적으로 (a) 원본 페이지를
    아카이브 처리하고 (b) 휴지통 페이지 밑에 원본 링크가 담긴 기록을 남기는 방식으로 동작합니다.
  - 제목이 모호해서 검색 결과에 실제로 제목이 포함된 페이지가 없으면 명령이 **에러로 중단**됩니다
    (엉뚱한 페이지를 지우지 않기 위한 안전장치). 이 경우 `search`로 먼저 정확한 제목을 확인하세요.

### 5. 휴지통 관리 (Trash)
- **목록 조회**: `npm run notion list-trash` — 휴지통에 있는 항목(삭제 기록, 편집 백업)을
  최신순으로 보여준다.
- **복원**: `npm run notion restore <trash_entry_query>` — `delete`로 만들어진 항목만 복원
  가능(원본 페이지를 다시 아카이브 해제). `approve-edit`이 만든 백업 페이지는 참고용 사본이라
  복원 대상이 아니며, 필요하면 그 내용을 `get-content`로 읽어 다시 `propose-edit` 하세요.

### 6. 회사정보 마스킹 (Redaction)
- **요청 예시**: "이 페이지 회사정보 좀 가려줘", "민감정보 마스킹해줘"
- **가리는 대상**: 담당자 개인정보(이름/이메일/연락처), 시스템·접속정보(서버주소/DB접속문자열/
  API키·토큰/내부 URL), 거래처·프로젝트명. (재무수치는 기본 범위 아님 — 사용자가 별도로 요청하면 포함)
- **원본은 절대 직접 덮어쓰지 않는다** — 기존 안전한 글수정(3번) 흐름을 그대로 재사용한다.
- **실행 절차**:
  1. `npm run notion get-content <page_query>` 로 원문을 읽는다.
  2. `npm run notion scan <page_query>` 로 이메일/전화번호/IP/접속키워드/URL처럼 정규식으로
     잡히는 후보를 미리 확인한다. **이 목록은 시작점일 뿐**이다 — 담당자 이름, 거래처·프로젝트명처럼
     정형화되지 않은 정보는 여기 안 잡히므로 원문을 직접 읽고 에이전트가 판단해서 추가로 찾아야 한다.
  3. 페이지에 이미지가 있으면 `npm run notion scan-images <page_query>` 로 이미지 속 텍스트를
     OCR로 확인한다. **이미지 자체를 자동으로 가리거나 재업로드하지는 않는다** — 회사정보로
     보이는 텍스트가 있는 이미지는 사용자에게 "이 이미지엔 OO가 찍혀 있어 보이는데 어떻게 할지"
     물어보고, 필요하면 해당 이미지 블록을 빼고 재구성하는 방향으로 처리한다.
  4. 2~3단계에서 찾은 항목들을 본문에서 `[가림:이메일]`, `[가림:담당자명]`, `[가림:접속정보]`,
     `[가림:거래처명]` 같은 표시로 치환한 마스킹 버전을 작성한다.
  5. `npm run notion propose-edit <page_query> <masked_md>` 로 제안하고, 사용자가 승인하면
     `npm run notion approve-edit <page_query>` — 원문은 휴지통에 그대로 백업되고, 페이지에는
     마스킹된 버전만 남는다.
