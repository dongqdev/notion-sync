# 🚀 Notion AI Sync & Writing Studio

Notion API Key를 환경 변수로 설정하여, Notion 문서를 AI로 자동 작성하고 기존 글을 1-Click 요약 / 구조화 / 할 일(Action Items) 추출로 정리할 수 있는 웹 애플리케이션 및 백엔드 서비스입니다.

---

## 🌟 주요 기능

1. **AI Notion 신규 글 작성 (AI Notion Writer)**
   - 주제/프롬프트를 입력하면 AI가 Notion 마크다운 형식(제목, 개요, 실행 계획, 체크리스트, 코드 블록, 콜아웃 등)으로 자동 구성합니다.
   - 템플릿 프리셋 제공: 기술 명세서(Tech Spec), PRD, 회의록, 기술 블로그, 주간 보고서 등.
   - 대상 Notion 상위 페이지/DB를 선택하여 **원클릭으로 Notion에 새 페이지 생성**.

2. **기존 Notion 글 AI 정리 (AI Page Organizer)**
   - 연결된 Notion 페이지 선택 시 원문 블록 텍스트 자동 탐색.
   - **1-Click 핵심 요약**: 길고 복잡한 글을 3줄 요약 + 핵심 키워드로 축약.
   - **문단 구조화 & 가독성 정리**: 헤더(#, ##), 불렛 포인트, 콜아웃으로 문서 재구성.
   - **Action Items 추출**: 본문에서 작업 항목을 찾아 Notion 체크리스트(`to_do` 블록)로 자동 추출.
   - 정리 결과를 선택된 Notion 페이지 하단에 **직접 블록 추가(Append)**.

3. **Notion 워크스페이스 탐색기 (Page Explorer)**
   - 연결된 워크스페이스 내 모든 페이지/DB 목록 검색 및 조회.
   - Notion 웹페이지 직통 링크 및 실시간 블록 구조 미리보기.

4. **API 연결 및 보안 가이드 (Security & Setup)**
   - API 토큰: `.env` 환경변수에 기본 적용 (`NOTION_API_KEY`)
   - Bot 이름: `외부 API`
   - Notion API 보안 정책에 따라, 노션 페이지 우측 상단 `•••` -> `Add connections (연결 추가)` -> `외부 API`를 클릭하여 페이지 권한을 연결할 수 있습니다.

---

## 🔑 Notion API 키 발급 및 설정 가이드

Notion과 연동하여 동기화 기능을 수행하기 위해서는 Notion API 통합 토큰(API Key)이 필요합니다. 아래 순서에 따라 연결을 생성하고 키를 설정하세요.

### 1단계: 신규 연결 생성
1. [Notion Developers Connections](https://app.notion.com/developers/connections) 페이지에 접속합니다.
2. 우측 상단의 **`+ 신규 연결`** 버튼을 클릭합니다.
3. **연결 이름**(예: `이동규님의 연결` 등)을 입력하고, 인증 방법에서 **`액세스 토큰`**을 선택한 뒤 **`연결 생성하기`**를 클릭합니다.

![신규 연결 설정](images/notion_connection_setup1.png)

### 2단계: API 통합 토큰 확인 및 권한 설정
1. 생성된 연결 설정 페이지에서 **`액세스 토큰(API 통합 토큰)`** 값을 복사하여 로컬 프로젝트 루트의 `.env` 파일 내 `NOTION_API_KEY` 값으로 추가합니다.
   ```properties
   NOTION_API_KEY=ntn_xxxx...
   ```
2. **기능(Capabilities)** 섹션에서 아래 권한들이 활성화되어 있는지 확인합니다:
   - **콘텐츠 읽기** (필수)
   - **콘텐츠 업데이트** (필수)
   - **콘텐츠 삽입** (필수)
   - **이메일 주소를 포함한 사용자 정보 읽기** (선택)

![API 토큰 및 기능 설정](images/notion_connection_setup2.png)

### 3단계: 페이지에 통합 연결하기 (콘텐츠 사용 권한)

통합(Integration)을 만들었다고 워크스페이스의 모든 페이지에 자동으로 접근되는 게 아닙니다. AI가 읽거나 쓸 페이지마다 이 통합을 개별로 연결해줘야 합니다.

1. 연결하려는 Notion 페이지를 열고 우측 상단 `•••` → `연결 추가(Add connections)` → 아까 만든 통합(예: `외부 API`)을 선택합니다.
2. 이미 연결된 페이지들은 [Notion Developers Connections](https://app.notion.com/developers/connections) → 해당 통합 → **콘텐츠 사용 권한** 탭에서 한눈에 확인하고 관리할 수 있습니다.

![콘텐츠 사용 권한 화면](images/notion_content_permission.png)

여기 없는 페이지는 API로 찾을 수 없습니다 (`object_not_found` 에러의 가장 흔한 원인입니다).

### 4단계: 휴지통(Trash Archive) 페이지 ID 설정

"안전한 글수정"과 "삭제" 기능은 원문을 실수로 잃어버리지 않도록, 지우거나 덮어쓰기 전에 원본을 Notion 내의 별도 페이지에 백업해둡니다. 이 백업 위치로 쓸 페이지를 직접 만들고, 그 페이지의 ID를 알려줘야 합니다.

1. Notion에서 새 페이지를 하나 만들고(예: `휴지통 (Trash Archive)`), 아까 연결한 통합(Integration)에 이 페이지도 연결(`•••` → `연결 추가`)해줍니다.
2. 그 페이지를 열면 브라우저 주소창에 아래처럼 뜨는데, 맨 끝에 붙은 32자리 문자열이 페이지 ID입니다.
   ```
   https://app.notion.com/p/Trash-Archive-3b9813eb76778101a4c1d67d707c9506
                                           ^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^^
                                           이 부분이 페이지 ID
   ```
3. 이 값을 `.env`의 `NOTION_TRASH_PAGE_ID`에 넣습니다 (대시 `-` 유무는 상관없습니다).
   ```properties
   NOTION_TRASH_PAGE_ID=3b9813eb-7677-8101-a4c1-d67d707c9506
   ```

설정하지 않으면 코드에 저장된 기본 페이지로 백업되니, 본인 워크스페이스의 휴지통 페이지를 꼭 별도로 지정하는 걸 권장합니다.

**중요: "삭제"는 진짜 삭제가 아닙니다.** `notion-cli delete`는 Notion 페이지를 완전히 지우지 않습니다. Notion 공개 API에는 영구 삭제 기능 자체가 없어서, 내부적으로 `pages.update({ archived: true })`만 호출해 페이지를 보관(archive) 처리하고, 위에서 설정한 휴지통 페이지 밑에 원본을 가리키는 기록을 남깁니다. 즉 항상 복구 가능한 소프트 삭제이며, `notion-cli restore`로 되돌릴 수 있습니다.

---

## 🤔 왜 백엔드 서버가 필요한가요?

이 프로젝트는 단순히 API 키로 REST API를 호출하는 것뿐이지만, 브라우저(프론트엔드)에서 Notion API를 직접 호출할 수는 없어서 서버(`server/index.js`)가 중간에 필요합니다.

- **API 키 노출 방지**: 브라우저 JS에서 직접 호출하면 API 키가 번들에 그대로 포함되어 개발자 도구로 누구나 탈취할 수 있습니다. 키는 서버의 `.env`에만 두고, 브라우저는 우리 서버에만 요청을 보냅니다.
- **CORS 제한**: Notion API는 브라우저에서의 직접 호출(CORS)을 허용하지 않아, 프론트엔드 `fetch`로는 애초에 호출이 불가능합니다.

즉 요청 흐름은 `브라우저 → 우리 서버(포트 3001) → Notion API` 이며, 마크다운→Notion 블록 변환 같은 로직도 서버에서 처리됩니다.

---

## 🛠️ 실행 방법

### 서버 및 웹 앱 실행 (포트 3001)
```bash
# 디렉토리 이동
cd C:\Users\dongq\Documents\work_space\notion-sync

# 백엔드 및 통합 앱 실행
npm start
```
브라우저에서 `http://localhost:3001` 접속!

---

## 💬 사용 예시

진짜 사용법은 웹 화면 클릭이 아니라, Claude Code 같은 에이전트에게 말로 시키는 겁니다. 에이전트가 `notion-cli`를 대신 실행합니다.

```
"회의록" 페이지 밑에 오늘 회의 내용 요약해서 새 페이지로 만들어줘

"주간 보고서" 페이지 정리해줘. 핵심 요약이랑 액션 아이템만 뽑아서 추가해줘

노션 휴지통에 뭐 들어있어?

SAP Knowledge Graph 사전 학습 자료 생성해줘.
```

아래는 마지막 프롬프트로 실제 생성된 결과 페이지입니다.

![SAP Knowledge Graph 사전 학습 자료 생성 결과](images/sap_knowledge_graph_result.png)

---

## 📁 프로젝트 구조
- `server/index.js`: Notion SDK 연동 Express 백엔드 API & AI 텍스트-노션 블록 변환 엔진
- `src/App.jsx`: 메인 대시보드 UI
- `src/components/Header.jsx`: 워크스페이스 연결 상태 표시 및 탭 전환
- `src/components/NotionSetupGuide.jsx`: Notion 페이지 공유 가이드 카드
- `src/components/AiWriterStudio.jsx`: AI 초안 생성 및 Notion 저장 스튜디오
- `src/components/AiPageOrganizer.jsx`: 기존 글 읽기 및 AI 정리/추가 스튜디오
- `src/components/PageExplorer.jsx`: 노션 페이지 목록 및 블록 탐색기
