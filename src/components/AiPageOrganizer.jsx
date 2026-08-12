import React, { useState, useEffect } from 'react';
import { Sparkles, FileText, CheckCircle, RefreshCw, PlusCircle, ExternalLink, ArrowRight } from 'lucide-react';

export default function AiPageOrganizer({ pages = [], onAppendToNotion }) {
  const [selectedPageId, setSelectedPageId] = useState('');
  const [pageMarkdown, setPageMarkdown] = useState('');
  const [isLoadingBlocks, setIsLoadingBlocks] = useState(false);
  const [aiMode, setAiMode] = useState('summarize');
  const [aiResultMarkdown, setAiResultMarkdown] = useState('');
  const [isProcessingAi, setIsProcessingAi] = useState(false);
  const [isAppending, setIsAppending] = useState(false);
  const [appendSuccess, setAppendSuccess] = useState(false);

  useEffect(() => {
    if (!selectedPageId) {
      setPageMarkdown('');
      return;
    }
    fetchPageBlocks(selectedPageId);
  }, [selectedPageId]);

  const fetchPageBlocks = async (pageId) => {
    setIsLoadingBlocks(true);
    setAppendSuccess(false);
    try {
      const res = await fetch(`/api/pages/${pageId}/blocks`);
      const data = await res.json();
      if (data.success) {
        setPageMarkdown(data.markdown || '(본문 내용이 비어있거나 읽을 수 있는 블록이 없습니다.)');
      } else {
        setPageMarkdown('⚠️ 블록을 불러오지 못했습니다: ' + data.error);
      }
    } catch (err) {
      setPageMarkdown('⚠️ 네트워크 오류: ' + err.message);
    } finally {
      setIsLoadingBlocks(false);
    }
  };

  const handleRunAiOrganize = async () => {
    if (!selectedPageId) {
      alert('정리할 Notion 페이지를 먼저 선택해주세요.');
      return;
    }

    setIsProcessingAi(true);
    setAppendSuccess(false);

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: aiMode,
          contextText: pageMarkdown,
          language: 'Korean'
        })
      });
      const data = await res.json();
      if (data.success) {
        setAiResultMarkdown(data.markdown);
      }
    } catch (err) {
      alert('AI 정리 실패: ' + err.message);
    } finally {
      setIsProcessingAi(false);
    }
  };

  const handleAppendToPage = async () => {
    if (!selectedPageId || !aiResultMarkdown.trim()) {
      alert('페이지 선택 및 AI 정리 결과가 필요합니다.');
      return;
    }

    setIsAppending(true);
    try {
      const res = await fetch(`/api/pages/${selectedPageId}/append`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contentMarkdown: aiResultMarkdown
        })
      });
      const data = await res.json();
      if (data.success) {
        setAppendSuccess(true);
        fetchPageBlocks(selectedPageId);
      } else {
        alert('추가 실패: ' + data.error);
      }
    } catch (err) {
      alert('오류 발생: ' + err.message);
    } finally {
      setIsAppending(false);
    }
  };

  const activePageObj = pages.find(p => p.id === selectedPageId);

  return (
    <div className="studio-layout">
      {/* Left Sidebar */}
      <div className="sidebar-panel">
        <div className="panel-header">
          <div className="panel-title">
            <FileText size={16} className="text-amber" />
            Notion 기존 글 선택
          </div>
          {selectedPageId && (
            <button className="btn btn-icon" onClick={() => fetchPageBlocks(selectedPageId)} title="새로고침">
              <RefreshCw size={13} className={isLoadingBlocks ? 'spin' : ''} />
            </button>
          )}
        </div>

        <div className="editor-body" style={{ padding: '1.1rem' }}>
          <div className="field-group">
            <span className="field-label">정리할 대상 페이지</span>
            <select
              value={selectedPageId}
              onChange={(e) => setSelectedPageId(e.target.value)}
            >
              <option value="">-- 노션 페이지 선택 --</option>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.icon?.emoji || '📄'} {p.title}
                </option>
              ))}
            </select>
          </div>

          <div className="field-group" style={{ flex: 1 }}>
            <div className="flex-between">
              <span className="field-label">원문 읽기 본문</span>
              {activePageObj?.url && (
                <a
                  href={activePageObj.url}
                  target="_blank"
                  rel="noreferrer"
                  style={{ fontSize: '0.725rem', color: '#38bdf8', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '0.2rem' }}
                >
                  Notion 열기 <ExternalLink size={11} />
                </a>
              )}
            </div>
            <textarea
              className="editor-textarea"
              readOnly
              style={{ height: '100%', minHeight: '300px', opacity: isLoadingBlocks ? 0.6 : 1 }}
              value={isLoadingBlocks ? '페이지 블록 데이터를 불러오는 중...' : pageMarkdown}
              placeholder="Notion 페이지를 선택하면 원문 내용이 자동으로 로드됩니다."
            />
          </div>
        </div>
      </div>

      {/* Right Canvas */}
      <div className="workspace-panel">
        <div className="editor-toolbar">
          <div className="toolbar-group">
            <Sparkles size={16} className="text-indigo" />
            <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>AI 글 정리 & 구조화 스튜디오</span>
          </div>

          <div className="toolbar-group">
            <button
              className="btn btn-secondary"
              onClick={handleRunAiOrganize}
              disabled={isProcessingAi || !selectedPageId}
            >
              {isProcessingAi ? (
                <>
                  <Sparkles size={14} className="spin" />
                  AI 분석 중...
                </>
              ) : (
                <>
                  <Sparkles size={14} />
                  AI 분석 & 정리 실행
                </>
              )}
            </button>

            <button
              className="btn btn-primary"
              onClick={handleAppendToPage}
              disabled={isAppending || !aiResultMarkdown.trim()}
            >
              {isAppending ? <Sparkles size={14} className="spin" /> : <PlusCircle size={14} />}
              Notion 페이지 하단에 추가
            </button>
          </div>
        </div>

        <div className="editor-body">
          <div className="ai-controls-card">
            <span className="field-label">AI 정리 모드</span>
            <div className="preset-pills">
              <button
                className={`pill-btn ${aiMode === 'summarize' ? 'active' : ''}`}
                onClick={() => setAiMode('summarize')}
              >
                📝 1-Click 핵심 요약
              </button>
              <button
                className={`pill-btn ${aiMode === 'reorganize' ? 'active' : ''}`}
                onClick={() => setAiMode('reorganize')}
              >
                🗂️ 문단 구조화 & 가독성 정리
              </button>
              <button
                className={`pill-btn ${aiMode === 'action_items' ? 'active' : ''}`}
                onClick={() => setAiMode('action_items')}
              >
                ✅ Action Items (To-Do) 추출
              </button>
            </div>
          </div>

          {appendSuccess && (
            <div className="notion-block-callout" style={{ borderColor: 'var(--notion-emerald)' }}>
              <CheckCircle size={18} className="text-emerald" />
              <div>
                <strong>Notion 페이지 업데이트 완료!</strong>
                <div>AI 정리 블록이 선택된 Notion 페이지 하단에 성공적으로 추가되었습니다.</div>
              </div>
            </div>
          )}

          <div className="field-group" style={{ flex: 1 }}>
            <span className="field-label">AI 정리 결과 (Notion 블록 변환 준비)</span>
            <textarea
              className="editor-textarea"
              style={{ height: '100%', minHeight: '320px' }}
              value={aiResultMarkdown}
              onChange={(e) => setAiResultMarkdown(e.target.value)}
              placeholder="위의 'AI 분석 & 정리 실행' 버튼을 누르면 정리된 노션 블록 서식이 출력됩니다."
            />
          </div>
        </div>
      </div>
    </div>
  );
}
