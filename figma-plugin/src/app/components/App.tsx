import React, { useState, useEffect } from 'react';
import Header from './Header';
import Button from './Button';
import IconButton from './IconButton';
import FrameGrid from './FrameGrid';
import TokenList from './TokenList';
import { FrameBasicInfo, DesignToken } from '../types';
import '../styles/index.css';

const App: React.FC = () => {
  const [selectedFrameId, setSelectedFrameId] = useState<string | null>(null);
  const [frames, setFrames] = useState<FrameBasicInfo[]>([]);
  const [tokens, setTokens] = useState<DesignToken[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [messages, setMessages] = useState<{ text: string; type: 'info' | 'error' | 'success' }[]>([]);

  useEffect(() => {
    parent.postMessage(
      {
        pluginMessage: { type: 'ui-ready' },
      },
      '*'
    );
    return () => {
      window.onmessage = null;
    };
  }, []);

  useEffect(() => {
    const handleMessage = (event) => {
      const msg = event.data.pluginMessage;
      if (!msg || !msg.type) return;

      switch (msg.type) {
        case 'loading-frames':
          showMessage(msg.message || 'Loading frames...', 'info');
          setIsLoading(true);
          break;

        case 'init-frames':
          if (msg.thumbnails && Array.isArray(msg.thumbnails)) {
            const thumbnailMap = msg.thumbnails.reduce((acc, item) => {
              if (item.success) {
                acc[item.frameId] = item.thumbnail;
              }
              return acc;
            }, {});

            const framesWithThumbnails = msg.frames.map((frame) => ({
              ...frame,
              thumbnail: thumbnailMap[frame.id] || null,
            }));

            setFrames(framesWithThumbnails);
          } else {
            setFrames(msg.frames);
          }

          setIsLoading(false);
          showMessage('Frames loaded successfully', 'success');
          break;

        case 'initialization-error':
          setIsLoading(false);
          showMessage(`Error loading frames: ${msg.error}`, 'error');
          break;

        case 'frame-selected':
          setTokens(msg.tokens);
          break;

        case 'tokens-data':
          exportTokensAsJson(msg.tokens, msg.frameName);
          break;

        case 'refresh-error':
          setIsLoading(false);
          showMessage(`Error refreshing frames: ${msg.error}`, 'error');
          break;
      }
    };

    window.onmessage = handleMessage;
    return () => {
      window.onmessage = null;
    };
  }, []);

  const handleSelectFrame = (frameId: string) => {
    setSelectedFrameId(frameId);
    parent.postMessage(
      {
        pluginMessage: { type: 'select-frame', frameId },
      },
      '*'
    );
  };

  const handleExportTokens = () => {
    if (selectedFrameId) {
      parent.postMessage(
        {
          pluginMessage: { type: 'export-tokens', frameId: selectedFrameId },
        },
        '*'
      );
    }
  };

  const handleRefreshFrames = () => {
    setIsLoading(true);
    showMessage('Refreshing frames...', 'info');

    parent.postMessage(
      {
        pluginMessage: { type: 'refresh-frames' },
      },
      '*'
    );
  };

  // future update buttons
  const handleSettingsClick = () => {
    showMessage('Settings functionality will be available in a future update');
  };
  const handleExportToBrowser = () => {
    showMessage('Export to Browser functionality will be available in a future update');
  };

  const showMessage = (text: string, type: 'info' | 'error' | 'success' = 'info') => {
    const newMessage = { text, type };
    setMessages((prev) => [...prev, newMessage]);
    setTimeout(() => {
      setMessages((prev) => prev.filter((m) => m !== newMessage));
    }, 5000);
  };

  const exportTokensAsJson = (tokens: DesignToken[], frameName: string) => {
    const exportData = {
      frameName: frameName,
      exportDate: new Date().toISOString(),
      tokens: tokens,
    };

    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(exportData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute('href', dataStr);
    downloadAnchorNode.setAttribute('download', `${frameName.replace(/\s+/g, '-').toLowerCase()}-tokens.json`);
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();

    showMessage(`Tokens for "${frameName}" exported successfully!`, 'success');
  };

  return (
    <div className="container">
      <Header />

      <div className="export-section">
        <h3>Design Token Export</h3>
        <Button primary disabled={!selectedFrameId} onClick={handleExportTokens}>
          Export Tokens
        </Button>
      </div>

      <div className="frames-section">
        <div className="frames-header">
          <div className="select-text">
            <span className="frame-icon">
              <i className="fa-solid fa-border-all"></i>
            </span>
            <span>Select a frame</span>
          </div>
          <div className="buttons">
            <IconButton icon="fa-solid fa-refresh" onClick={handleRefreshFrames} />
            <IconButton icon="fa-solid fa-cog" onClick={handleSettingsClick} />
            <Button onClick={handleExportToBrowser}>Export to Browser</Button>
          </div>
        </div>

        {isLoading ? (
          <div className="loading-container">
            <div className="loading-spinner"></div>
            <p>Loading frames...</p>
          </div>
        ) : (
          <FrameGrid frames={frames} selectedFrameId={selectedFrameId} onSelectFrame={handleSelectFrame} />
        )}
      </div>

      {selectedFrameId && (
        <div className="token-section">
          <div className="tokens-header">Design Tokens</div>
          <TokenList tokens={tokens} />
        </div>
      )}

      <div id="message-container">
        {messages.map((msg, index) => (
          <div key={index} className={`message ${msg.type}`}>
            {msg.text}
          </div>
        ))}
      </div>
    </div>
  );
};

export default App;
