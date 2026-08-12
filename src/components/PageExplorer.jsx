import React, { useState } from 'react';
import { Search, ExternalLink, RefreshCw, FileText, Database, Calendar, Lock, ChevronRight } from 'lucide-react';

export default function PageExplorer({ pages = [], onRefresh, isLoading }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedPage, setSelectedPage] = useState(null);
  const [pageBlocks, setPageBlocks] = useState(null);
  const [isLoadingBlocks, setIsLoadingBlocks] = useState(false);

  const filteredPages = pages.filter(p =>
    p.title.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelectPage = async (page) => {
    setSelectedPage(page);
    setIsLoadingBlocks(true);
    try {
      const res = await fetch(`/api/pages/${page.id}/blocks`);
      const data = await res.json();
      if (data.success) {
        setPageBlocks(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setIsLoadingBlocks(false);
    }
  };

  return (
    <div className="studio-layout">
      {/* Search Sidebar */}
      <div className="sidebar-panel">
        <div className="panel-header">
          <div className="panel-title">
            <FileText size={18} className="text-accent" />
            연결된 페이지 & DB ({pages.length})
          </div>
          <button className="btn btn-icon" onClick={onRefresh} title="새로고침">
            <RefreshCw size={14} className={isLoading ? 'spin' : ''} />
          </button>
        </div>

        <div className="search-box">
          <Search size={15} className="search-icon" />
          <input
            type="text"
            className="search-input"
            placeholder="페이지 제목 검색..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        <div className="page-list">
          {filteredPages.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {searchTerm ? '검색 결과가 없습니다.' : '연결된 Notion 페이지가 없습니다.'}
            </div>
          ) : (
            filteredPages.map((page) => (
              <div
                key={page.id}
                className={`page-item ${selectedPage?.id === page.id ? 'active' : ''}`}
                onClick={() => handleSelectPage(page)}
              >
                <div className="page-item-main">
                  <span className="page-item-icon">
                    {page.icon?.emoji || (page.object === 'database' ? '📊' : '📄')}
                  </span>
                  <div className="page-item-title">{page.title}</div>
                </div>
                <div className="page-item-badge">{page.object}</div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Detail Viewer */}
      <div className="workspace-panel">
        {selectedPage ? (
          <>
            <div className="editor-toolbar">
              <div className="toolbar-group">
                <span style={{ fontSize: '1.2rem' }}>
                  {selectedPage.icon?.emoji || (selectedPage.object === 'database' ? '📊' : '📄')}
                </span>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 700 }}>{selectedPage.title}</h3>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    수정일: {new Date(selectedPage.last_edited_time).toLocaleString()}
                  </div>
                </div>
              </div>

              {selectedPage.url && (
                <a
                  href={selectedPage.url}
                  target="_blank"
                  rel="noreferrer"
                  className="btn btn-secondary"
                  style={{ textDecoration: 'none' }}
                >
                  Notion 웹에서 열기
                  <ExternalLink size={14} />
                </a>
              )}
            </div>

            <div className="editor-body">
              <div className="field-group">
                <span className="field-label">블록 구조 미리보기</span>
                {isLoadingBlocks ? (
                  <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)' }}>
                    <RefreshCw size={20} className="spin" style={{ marginBottom: '0.5rem' }} />
                    <div>블록 데이터를 가져오는 중...</div>
                  </div>
                ) : (
                  <div className="notion-preview-box">
                    {pageBlocks?.blocks && pageBlocks.blocks.length > 0 ? (
                      pageBlocks.blocks.map((b) => {
                        if (b.type === 'heading_1') return <h1 key={b.id} className="notion-h1">{b.text}</h1>;
                        if (b.type === 'heading_2') return <h2 key={b.id} className="notion-h2">{b.text}</h2>;
                        if (b.type === 'heading_3') return <h3 key={b.id} className="notion-h3">{b.text}</h3>;
                        if (b.type === 'bulleted_list_item') return <div key={b.id} className="notion-bullet">• {b.text}</div>;
                        if (b.type === 'to_do') return <div key={b.id} className="notion-todo">☑️ {b.text}</div>;
                        if (b.type === 'callout') return <div key={b.id} className="notion-callout">{b.text}</div>;
                        if (b.type === 'code') return <pre key={b.id} className="notion-code-block">{b.text}</pre>;
                        return <p key={b.id} style={{ color: '#e2e8f0' }}>{b.text}</p>;
                      })
                    ) : (
                      <div style={{ color: 'var(--text-muted)', textAlign: 'center', padding: '1rem' }}>
                        내용 블록이 비어있습니다.
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </>
        ) : (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '0.75rem', color: 'var(--text-muted)' }}>
            <FileText size={48} opacity={0.3} />
            <div>좌측 목록에서 페이지를 선택하면 상세 내역을 확인할 수 있습니다.</div>
          </div>
        )}
      </div>
    </div>
  );
}
