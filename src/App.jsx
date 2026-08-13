import React, { useState, useEffect } from 'react';
import Header from './components/Header';
import NotionSetupGuide from './components/NotionSetupGuide';
import AiWriterStudio from './components/AiWriterStudio';
import AiPageOrganizer from './components/AiPageOrganizer';
import PageExplorer from './components/PageExplorer';
import SettingsModal from './components/SettingsModal';

export default function App() {
  const [activeTab, setActiveTab] = useState('writer');
  const [botInfo, setBotInfo] = useState(null);
  const [pages, setPages] = useState([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSettings, setShowSettings] = useState(false);
  const [activeKey, setActiveKey] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    checkConnectionAndLoadPages();
  }, [activeKey]);

  const checkConnectionAndLoadPages = async () => {
    setIsLoading(true);
    try {
      // 1. Verify status
      const statusRes = await fetch('/api/status', {
        headers: { 'x-notion-token': activeKey }
      });
      const statusData = await statusRes.json();

      if (statusData.success && statusData.user) {
        setIsConnected(true);
        setBotInfo(statusData.user.bot?.owner?.workspace ? statusData.user.bot : { workspace_name: 'Notion Workspace' });

        // 2. Fetch pages
        const searchRes = await fetch('/api/search', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-notion-token': activeKey
          },
          body: JSON.stringify({ page_size: 50 })
        });
        const searchData = await searchRes.json();
        if (searchData.success) {
          setPages(searchData.results || []);
        }
      } else {
        setIsConnected(false);
      }
    } catch (err) {
      console.error('Connection error:', err);
      setIsConnected(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreatePageInNotion = async (pageData) => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/pages/create', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-notion-token': activeKey
        },
        body: JSON.stringify(pageData)
      });
      const data = await res.json();
      if (data.success) {
        // Refresh page list
        checkConnectionAndLoadPages();
        return data;
      } else {
        alert('Notion 페이지 생성 실패: ' + data.error);
        return null;
      }
    } catch (err) {
      alert('오류 발생: ' + err.message);
      return null;
    } finally {
      setIsSaving(false);
    }
  };

  const handleUpdateKey = (newKey) => {
    setActiveKey(newKey);
    fetch('/api/config/key', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: newKey })
    });
  };

  return (
    <div className="app-container">
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        botInfo={botInfo}
        isConnected={isConnected}
        onRefresh={checkConnectionAndLoadPages}
        onOpenSettings={() => setShowSettings(true)}
      />

      <main className="app-main">
        {/* If connected but 0 pages found, show Notion Setup Guide Banner */}
        {isConnected && pages.length === 0 && !isLoading && (
          <NotionSetupGuide onRefresh={checkConnectionAndLoadPages} />
        )}

        {/* Tab Views */}
        {activeTab === 'writer' && (
          <AiWriterStudio
            pages={pages}
            onSaveToNotion={handleCreatePageInNotion}
            isSaving={isSaving}
          />
        )}

        {activeTab === 'organizer' && (
          <AiPageOrganizer
            pages={pages}
            onAppendToNotion={checkConnectionAndLoadPages}
          />
        )}

        {activeTab === 'explorer' && (
          <PageExplorer
            pages={pages}
            onRefresh={checkConnectionAndLoadPages}
            isLoading={isLoading}
          />
        )}
      </main>

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          activeKey={activeKey}
          onSaveKey={handleUpdateKey}
        />
      )}
    </div>
  );
}
