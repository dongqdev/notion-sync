import React, { useState } from 'react';
import { Sparkles, Send, Save, CheckCircle, FilePlus, Copy, Code, Eye, ArrowUpRight, Smile } from 'lucide-react';

export default function AiWriterStudio({ pages = [], onSaveToNotion, isSaving }) {
  const [prompt, setPrompt] = useState('');
  const [title, setTitle] = useState('');
  const [selectedParentId, setSelectedParentId] = useState('');
  const [iconEmoji, setIconEmoji] = useState('🚀');
  const [tone, setTone] = useState('Professional');
  const [generatedMarkdown, setGeneratedMarkdown] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [viewMode, setViewMode] = useState('canvas'); // 'canvas' or 'source'
  const [saveSuccess, setSaveSuccess] = useState(null);
  const [copied, setCopied] = useState(false);

  const emojis = ['🚀', '📝', '💡', '⚡', '📊', '🎯', '🛠️', '📘', '✨'];

  const presets = [
    { label: '📝 기술 명세서', prompt: 'Notion API와 백엔드 서비스 간 연동을 위한 기술 명세서 작성' },
    { label: '🤝 기획서 (PRD)', prompt: 'AI 기반 노션 생산성 스마트 스튜디오 서비스 기획서' },
    { label: '📅 회의록', prompt: '주간 서비스 개발 방향 회의록 및 액션 아이템 정리' },
    { label: '✍️ 기술 블로그', prompt: 'Notion API와 AI 모델 연동으로 노션 작업 자동화하기' },
    { label: '✅ 주간 보고서', prompt: '금주 개발 성과 및 차주 계획 보고서' },
  ];

  const handleApplyPreset = (p) => {
    setPrompt(p.prompt);
    if (!title) {
      setTitle(p.label.replace(/[^a-zA-Z0-9가-힣\s]/g, '').trim());
    }
  };

  const handleGenerate = async () => {
    if (!prompt.trim()) return;
    setIsGenerating(true);
    setSaveSuccess(null);

    try {
      const res = await fetch('/api/ai/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'write_new',
          prompt,
          tone,
          language: 'Korean'
        })
      });
      const data = await res.json();
      if (data.success) {
        setGeneratedMarkdown(data.markdown);
        if (!title) {
          setTitle(prompt.slice(0, 30));
        }
      }
    } catch (err) {
      alert('AI 생성 실패: ' + err.message);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSave = async () => {
    if (!title.trim() || !generatedMarkdown.trim()) {
      alert('제목과 문서 내용이 필요합니다.');
      return;
    }

    const parentPage = pages.find(p => p.id === selectedParentId);
    const parentType = parentPage && parentPage.object === 'database' ? 'database_id' : 'page_id';

    const result = await onSaveToNotion({
      parentId: selectedParentId || undefined,
      parentType,
      title,
      contentMarkdown: generatedMarkdown,
      iconEmoji
    });

    if (result && result.success) {
      setSaveSuccess(result.page);
    }
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard.writeText(generatedMarkdown);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  // Helper renderer to render Markdown as Notion Blocks in Canvas view
  const renderNotionCanvasBlocks = (md) => {
    if (!md) return null;
    const lines = md.split('\n');

    return lines.map((line, idx) => {
      const trimmed = line.trim();
      if (!trimmed) return null;

      if (trimmed.startsWith('# ')) {
        return <h1 key={idx} className="notion-block-h1">{trimmed.slice(2)}</h1>;
      }
      if (trimmed.startsWith('## ')) {
        return <h2 key={idx} className="notion-block-h2">{trimmed.slice(3)}</h2>;
      }
      if (trimmed.startsWith('### ')) {
        return <h3 key={idx} className="notion-block-h3">{trimmed.slice(4)}</h3>;
      }
      if (trimmed.match(/^[-*]\s*\[([ xX])\]\s+(.*)/)) {
        const match = trimmed.match(/^[-*]\s*\[([ xX])\]\s+(.*)/);
        return (
          <div key={idx} className="notion-block-todo">
            <input type="checkbox" defaultChecked={match[1].toLowerCase() === 'x'} />
            <span>{match[2]}</span>
          </div>
        );
      }
      if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
        return (
          <div key={idx} className="notion-block-bullet">
            <span style={{ color: 'var(--text-muted)' }}>•</span>
            <span>{trimmed.slice(2)}</span>
          </div>
        );
      }
      if (trimmed.startsWith('> ')) {
        return (
          <div key={idx} className="notion-block-callout">
            <span style={{ fontSize: '1.1rem' }}>💡</span>
            <div>{trimmed.slice(2)}</div>
          </div>
        );
      }
      if (trimmed.startsWith('```')) {
        return null; // hide wrapper ticks
      }
      return <p key={idx} style={{ color: '#e5e7eb', fontSize: '0.925rem', lineHeight: '1.6' }}>{trimmed}</p>;
    });
  };

  return (
    <div className="studio-layout">
      {/* Left AI Controls Panel */}
      <div className="sidebar-panel">
        <div className="panel-header">
          <div className="panel-title">
            <Sparkles size={16} className="text-amber" />
            AI 글쓰기 프롬프트
          </div>
        </div>

        <div className="editor-body" style={{ padding: '1.1rem' }}>
          {/* Preset Chips */}
          <div className="field-group">
            <span className="field-label">템플릿 프리셋</span>
            <div className="preset-pills">
              {presets.map((p, idx) => (
                <button key={idx} className="pill-btn" onClick={() => handleApplyPreset(p)}>
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {/* Prompt Area */}
          <div className="field-group">
            <span className="field-label">문서 주제 및 작성 지시문</span>
            <textarea
              rows={4}
              placeholder="예: 백엔드 API 연동 문서 및 회의록 작성해줘"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
            />
          </div>

          {/* Emoji & Tone */}
          <div className="field-group">
            <span className="field-label">아이콘 배지</span>
            <div className="preset-pills">
              {emojis.map((em) => (
                <button
                  key={em}
                  className={`pill-btn ${iconEmoji === em ? 'active' : ''}`}
                  onClick={() => setIconEmoji(em)}
                  style={{ fontSize: '1rem', padding: '0.2rem 0.5rem' }}
                >
                  {em}
                </button>
              ))}
            </div>
          </div>

          <div className="field-group">
            <span className="field-label">톤 앤 매너</span>
            <div className="preset-pills">
              {['Professional', 'Technical', 'Concise', 'Casual'].map((t) => (
                <button
                  key={t}
                  className={`pill-btn ${tone === t ? 'active' : ''}`}
                  onClick={() => setTone(t)}
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {/* Notion Parent selector */}
          <div className="field-group">
            <span className="field-label">저장할 Notion 상위 페이지/DB</span>
            <select
              value={selectedParentId}
              onChange={(e) => setSelectedParentId(e.target.value)}
            >
              <option value="">-- 워크스페이스 내 첫번째 공유 페이지 --</option>
              {pages.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.icon?.emoji || '📄'} {p.title}
                </option>
              ))}
            </select>
          </div>

          <button
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '0.25rem' }}
            onClick={handleGenerate}
            disabled={isGenerating || !prompt.trim()}
          >
            {isGenerating ? (
              <>
                <Sparkles size={15} className="spin" />
                AI가 노션 글로 작성 중...
              </>
            ) : (
              <>
                <Send size={15} />
                AI 초안 생성 시작
              </>
            )}
          </button>
        </div>
      </div>

      {/* Right Canvas / Source Panel */}
      <div className="workspace-panel">
        <div className="editor-toolbar">
          <div className="toolbar-group">
            <div className="view-mode-switch">
              <button
                className={`mode-btn ${viewMode === 'canvas' ? 'active' : ''}`}
                onClick={() => setViewMode('canvas')}
              >
                🎨 Notion Canvas 뷰
              </button>
              <button
                className={`mode-btn ${viewMode === 'source' ? 'active' : ''}`}
                onClick={() => setViewMode('source')}
              >
                💻 마크다운 소스
              </button>
            </div>
          </div>

          <div className="toolbar-group">
            {generatedMarkdown && (
              <button className="btn btn-secondary" onClick={handleCopyMarkdown}>
                <Copy size={14} />
                {copied ? '복사됨!' : '마크다운 복사'}
              </button>
            )}

            <button
              className="btn btn-primary"
              onClick={handleSave}
              disabled={isSaving || !generatedMarkdown.trim()}
            >
              {isSaving ? <Sparkles size={15} className="spin" /> : <Save size={15} />}
              Notion에 저장
            </button>
          </div>
        </div>

        <div className="editor-body">
          {saveSuccess && (
            <div className="notion-block-callout" style={{ borderColor: 'var(--notion-emerald)' }}>
              <CheckCircle size={18} className="text-emerald" />
              <div>
                <strong>Notion 페이지 생성 완료!</strong>
                <div>'{saveSuccess.title}' 페이지가 Notion에 생성되었습니다.</div>
                {saveSuccess.url && (
                  <a
                    href={saveSuccess.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: '#38bdf8', fontSize: '0.8rem', display: 'inline-flex', alignItems: 'center', gap: '0.2rem', marginTop: '0.2rem' }}
                  >
                    Notion에서 열기 <ArrowUpRight size={12} />
                  </a>
                )}
              </div>
            </div>
          )}

          {viewMode === 'canvas' ? (
            <div className="notion-canvas-wrapper">
              <div className="notion-cover-header">
                <div className="notion-cover-accent">{iconEmoji}</div>
              </div>

              <div className="notion-page-canvas">
                <input
                  type="text"
                  className="notion-page-title"
                  placeholder="제목을 입력하세요"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />

                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
                  {generatedMarkdown ? (
                    renderNotionCanvasBlocks(generatedMarkdown)
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', padding: '2rem 0' }}>
                      좌측에서 문서 주제를 입력하고 'AI 초안 생성 시작'을 누르면 이곳에 노션 페이지 캔버스가 렌더링됩니다.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="field-group" style={{ flex: 1 }}>
              <input
                type="text"
                className="notion-page-title"
                style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}
                placeholder="문서 제목"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
              <textarea
                className="editor-textarea"
                placeholder="마크다운 내용..."
                value={generatedMarkdown}
                onChange={(e) => setGeneratedMarkdown(e.target.value)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
