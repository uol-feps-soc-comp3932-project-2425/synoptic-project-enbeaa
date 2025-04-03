import React from 'react';
import { DesignToken } from '../types/index';

type TokenListProps = {
  tokens: DesignToken[];
};

const TokenList: React.FC<TokenListProps> = ({ tokens }) => {
  if (tokens.length === 0) {
    return <div className="token-item">No tokens found for this frame</div>;
  }

  const tokensByType = tokens.reduce((groups, token) => {
    if (!groups[token.type]) {
      groups[token.type] = [];
    }
    groups[token.type].push(token);
    return groups;
  }, {} as Record<string, DesignToken[]>);

  return (
    <div className="token-list">
      {Object.entries(tokensByType).map(([type, typeTokens]) => (
        <React.Fragment key={type}>
          <div className="token-item">
            <strong>{type.toUpperCase()}</strong>
          </div>
          {typeTokens.map((token) => (
            <TokenItem key={`${token.nodeId}-${token.name}`} token={token} />
          ))}
        </React.Fragment>
      ))}
    </div>
  );
};

const TokenItem: React.FC<{ token: DesignToken }> = ({ token }) => {
  return (
    <div className="token-item">
      <div>
        <span className="token-name">{token.name}</span>
      </div>
      <div className="token-value">{formatTokenValue(token)}</div>
      <div className="token-path">{token.path ? token.path.join(' / ') : ''}</div>
      <div className="token-selector">{token.selector || ''}</div>
    </div>
  );
};

const formatTokenValue = (token: DesignToken) => {
  switch (token.type) {
    case 'color':
      const colorValue = formatColor(token.value);
      const cssColor = getCssColor(token.value);
      return (
        <>
          <div className="color-preview" style={{ background: cssColor }}></div> {colorValue}
        </>
      );

    case 'typography':
      if (token.value.family) {
        return `${token.value.family} ${token.value.style || ''}`;
      } else {
        return `${token.value}px`;
      }

    case 'content':
      return `"${token.value}"`;

    case 'spacing':
    case 'sizing':
      return `${token.value}px`;

    default:
      return JSON.stringify(token.value);
  }
};

const formatColor = (color: any) => {
  if (!color) return 'N/A';

  const r = color.r;
  const g = color.g;
  const b = color.b;
  const a = color.a !== undefined ? color.a : 1;

  return `rgba(${r}, ${g}, ${b}, ${a.toFixed(2)})`;
};

const getCssColor = (color: any) => {
  if (!color) return '#ccc';

  const r = color.r;
  const g = color.g;
  const b = color.b;
  const a = color.a !== undefined ? color.a : 1;

  return `rgba(${r}, ${g}, ${b}, ${a})`;
};

export default TokenList;
