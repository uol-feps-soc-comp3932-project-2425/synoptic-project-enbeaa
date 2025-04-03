import React from 'react';
import { FrameBasicInfo } from '../types';

type FrameGridProps = {
  frames: FrameBasicInfo[];
  selectedFrameId: string | null;
  onSelectFrame: (frameId: string) => void;
};

const FrameGrid: React.FC<FrameGridProps> = ({ frames, selectedFrameId, onSelectFrame }) => {
  if (frames.length === 0) {
    return <div className="message">No frames found in the current page</div>;
  }

  return (
    <div className="frame-grid">
      {frames.map((frame) => (
        <div
          key={frame.id}
          className={`frame-item ${selectedFrameId === frame.id ? 'selected' : ''}`}
          onClick={() => onSelectFrame(frame.id)}
        >
          <div
            className="frame-thumbnail"
            style={
              frame.thumbnail
                ? {
                    backgroundImage: `url(data:image/png;base64,${frame.thumbnail})`,
                  }
                : undefined
            }
          >
            {!frame.thumbnail && (
              <span>
                <i className="fa-solid fa-hourglass-half"></i>
              </span>
            )}
          </div>
          <div className="frame-info">
            <div className="frame-name">{frame.name}</div>
            <div className="frame-dimensions">
              {frame.width}x{frame.height}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
};

export default FrameGrid;
