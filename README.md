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
   - GS ITM 워크스페이스 내 연결된 모든 페이지/DB 목록 검색 및 조회.
   - Notion 웹페이지 직통 링크 및 실시간 블록 구조 미리보기.

4. **API 연결 및 보안 가이드 (Security & Setup)**
   - API 토큰: `.env` 환경변수에 기본 적용 (`NOTION_API_KEY`)
   - 워크스페이스 정보: **GS ITM** (Bot 이름: `외부 API`)
   - Notion API 보안 정책에 따라, 노션 페이지 우측 상단 `•••` -> `Add connections (연결 추가)` -> `외부 API`를 클릭하여 페이지 권한을 연결할 수 있습니다.

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

## 📁 프로젝트 구조
- `server/index.js`: Notion SDK 연동 Express 백엔드 API & AI 텍스트-노션 블록 변환 엔진
- `src/App.jsx`: 메인 대시보드 UI
- `src/components/Header.jsx`: 워크스페이스 연결 상태 표시 및 탭 전환
- `src/components/NotionSetupGuide.jsx`: Notion 페이지 공유 가이드 카드
- `src/components/AiWriterStudio.jsx`: AI 초안 생성 및 Notion 저장 스튜디오
- `src/components/AiPageOrganizer.jsx`: 기존 글 읽기 및 AI 정리/추가 스튜디오
- `src/components/PageExplorer.jsx`: 노션 페이지 목록 및 블록 탐색기
