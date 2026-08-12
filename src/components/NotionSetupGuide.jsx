import React from 'react';
import { AlertCircle, ExternalLink, CheckCircle2, ArrowRight } from 'lucide-react';

export default function NotionSetupGuide({ onRefresh }) {
  return (
    <div className="setup-alert-card">
      <div className="setup-alert-icon">
        <AlertCircle size={24} />
      </div>
      <div className="setup-alert-content">
        <div className="setup-alert-title">
          Notion 워크스페이스("GS ITM") 페이지 연결 안내
        </div>
        <div className="setup-alert-desc">
          Notion API 보안 정책상, AI가 읽거나 수정하기 위해선 사용자가 작성할 노션 페이지 또는 데이터베이스에 <strong>'외부 API'</strong> 봇 연결 권한을 부여해야 합니다.
        </div>

        <div className="setup-steps-grid">
          <div className="setup-step-box">
            <span className="setup-step-num">1</span>
            Notion 앱/웹에서 원하는 페이지 접속
          </div>
          <div className="setup-step-box">
            <span className="setup-step-num">2</span>
            우측 상단 <strong>우측 점3개 (•••)</strong> 클릭
          </div>
          <div className="setup-step-box">
            <span className="setup-step-num">3</span>
            <strong>연결 추가 (Add connections)</strong> 클릭
          </div>
          <div className="setup-step-box">
            <span className="setup-step-num">4</span>
            목록에서 <strong>외부 API</strong> 검색 및 선택
          </div>
        </div>

        <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <button className="btn btn-primary" onClick={onRefresh}>
            <CheckCircle2 size={16} />
            연결 상태 확인 및 새로고침
          </button>
          <a
            href="https://www.notion.so"
            target="_blank"
            rel="noreferrer"
            className="btn btn-secondary"
            style={{ textDecoration: 'none' }}
          >
            Notion 바로가기
            <ExternalLink size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
