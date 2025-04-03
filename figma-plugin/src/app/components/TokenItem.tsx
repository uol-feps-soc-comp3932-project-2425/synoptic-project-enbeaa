import React from 'react';
import { DesignToken } from '../types';

const formatColor = (color: any): string => {
  if (!color) return 'N/A';

  const r = color.r;
  const g = color.g;
  const b = color.b;
  const a = color.a !== undefined ? color.a : 1;

  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
};

const getCssColor = (color: any): string => {
  if (!color) return '#ccc';

  const r = color.r;
  const g = color.g;
  const b = color.b;
  const a = color.a !== undefined ? color.a : 1;

  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

interface TokenItemProps {
  token: DesignToken;
}

const TokenItem: React.FC<TokenItemProps> = ({ token }) => {
  const renderTokenValue = () => {
    switch (token.type) {
      case 'color':
        return (
          <>
            <div className="color-preview" style={{ background: getCssColor(token.value) }}></div>
            {formatColor(token.value)}
          </>
        );

      case 'typography':
        if (token.value.family) {
          return `${token.value.family} ${token.value.style || ''}`;
        } else {
          return `${token.value}px`;
        }

      case 'spacing':
        if (typeof token.value === 'object' && token.value.color) {
          return (
            <>
              <div className="color-preview" style={{ background: getCssColor(token.value.color) }}></div>
              {token.value.weight}px {formatColor(token.value.color)}
            </>
          );
        }
        return `${token.value}px`;

      default:
        return JSON.stringify(token.value);
    }
  };

  return (
    <div className="token-item">
      <div>
        <span className="token-name">{token.name}</span>
      </div>
      <div className="token-value">{renderTokenValue()}</div>
      <div className="token-path">{token.path.join(' / ')}</div>
      {token.selector && <div className="token-selector">{token.selector}</div>}
    </div>
  );
};

export default TokenItem;
