import React from 'react';
import { Sparkles, FileText, LayoutGrid, Settings, RefreshCw, Layers } from 'lucide-react';

export default function Header({ activeTab, setActiveTab, botInfo, isConnected, onRefresh, onOpenSettings }) {
  return (
    <header className="app-header">
      <div className="brand-section">
        <div className="brand-icon">N</div>
        <div>
          <div className="brand-title">
            Notion AI Studio
            {botInfo && (
              <span className="workspace-badge">
                <span className="workspace-status"></span>
                {botInfo.workspace_name || 'Notion Workspace'}
              </span>
            )}
          </div>
          <div className="brand-subtitle">AI 문서 작성 & 기존 글 자동 정리 · v1.0.0</div>
        </div>
      </div>

      <nav className="header-nav">
        <button
          className={`nav-tab ${activeTab === 'writer' ? 'active' : ''}`}
          onClick={() => setActiveTab('writer')}
        >
          <FileText size={15} />
          AI Notion 글 쓰기
        </button>

        <button
          className={`nav-tab ${activeTab === 'organizer' ? 'active' : ''}`}
          onClick={() => setActiveTab('organizer')}
        >
          <Sparkles size={15} />
          기존 글 AI 정리
        </button>

        <button
          className={`nav-tab ${activeTab === 'explorer' ? 'active' : ''}`}
          onClick={() => setActiveTab('explorer')}
        >
          <LayoutGrid size={15} />
          페이지 탐색기
        </button>
      </nav>

      <div className="header-actions">
        <button className="btn btn-secondary" onClick={onRefresh} title="Notion 연결 다시 확인">
          <RefreshCw size={14} />
          새로고침
        </button>

        <button className="btn btn-icon" onClick={onOpenSettings} title="API Key 설정">
          <Settings size={17} />
        </button>
      </div>
    </header>
  );
}
