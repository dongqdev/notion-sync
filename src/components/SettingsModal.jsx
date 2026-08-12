import React, { useState } from 'react';
import { X, Key, Check, ShieldCheck, RefreshCw } from 'lucide-react';

export default function SettingsModal({ onClose, activeKey, onSaveKey }) {
  const [keyInput, setKeyInput] = useState(activeKey || '');
  const [isSaved, setIsSaved] = useState(false);

  const handleSave = () => {
    if (!keyInput.trim()) return;
    onSaveKey(keyInput.trim());
    setIsSaved(true);
    setTimeout(() => {
      setIsSaved(false);
      onClose();
    }, 1200);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title flex-gap-sm">
            <Key size={18} className="text-accent" />
            Notion API Integration Token 설정
          </div>
          <button className="btn btn-icon" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="field-group">
          <span className="field-label">Notion API Internal Integration Token (Secret Key)</span>
          <input
            type="password"
            value={keyInput}
            onChange={(e) => setKeyInput(e.target.value)}
            placeholder="ntn_..."
          />
          <span className="text-muted" style={{ fontSize: '0.75rem' }}>
            Notion 개발자 파트너스 API 시크릿 키입니다. (현재 입력된 키 사용 중)
          </span>
        </div>

        <div className="notion-callout" style={{ fontSize: '0.8rem', background: 'rgba(15, 23, 42, 0.5)' }}>
          <ShieldCheck size={20} className="text-success" />
          <div>
            <strong>API 보안 정보</strong>
            <div>입력하신 API Key는 로컬 환경 서버에서만 안전하게 사용됩니다.</div>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '0.5rem' }}>
          <button className="btn btn-secondary" onClick={onClose}>
            취소
          </button>

          <button className="btn btn-primary" onClick={handleSave}>
            {isSaved ? (
              <>
                <Check size={16} />
                저장 완료!
              </>
            ) : (
              '저장 및 적용'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
