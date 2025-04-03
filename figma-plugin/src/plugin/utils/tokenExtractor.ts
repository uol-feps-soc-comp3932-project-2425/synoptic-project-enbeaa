export interface DesignToken {
  type: string; // color, spacing, typography
  name: string;
  value: any;
  path: string[]; // hierarchical path for organization
  nodeId: string; // Figma node ID for reference
  selector?: string; // potential CSS selector
}

function generatePotentialSelector(path: string[]): string {
  return path
    .map((segment) =>
      segment
        .replace(/([a-z])([A-Z])/g, '$1-$2')
        .toLowerCase()
        // remove invalid css special characters
        .replace(/[^a-z0-9-_]/g, '')
    )
    .map((segment) => `.${segment}`)
    .join(' ');
}

export function extractDesignTokens(node: SceneNode, path: string[] = []): DesignToken[] {
  const tokens: DesignToken[] = [];
  // add path for hierachical matching in browser extension
  const currentPath = [...path, node.name];

  if (!node) return tokens;

  // colours
  if ('fills' in node && node.fills && node.fills !== figma.mixed) {
    for (const fill of node.fills) {
      if (fill.type === 'SOLID') {
        const { r, g, b } = fill.color;
        tokens.push({
          type: 'color',
          name: `${node.name}-fill`,
          value: {
            r: Math.round(r * 255),
            g: Math.round(g * 255),
            b: Math.round(b * 255),
            a: fill.opacity || 1,
          },
          path: currentPath,
          nodeId: node.id,
          selector: generatePotentialSelector(currentPath),
        });
      }
    }
  }

  // typography
  if ('fontName' in node && node.fontName !== figma.mixed) {
    tokens.push({
      type: 'typography',
      name: `${node.name}-font`,
      value: {
        family: node.fontName.family,
        style: node.fontName.style,
      },
      path: currentPath,
      nodeId: node.id,
      selector: generatePotentialSelector(currentPath),
    });
  }

  if ('fontSize' in node && node.fontSize !== figma.mixed && node.fontSize !== undefined) {
    tokens.push({
      type: 'typography',
      name: `${node.name}-fontSize`,
      value: node.fontSize,
      path: currentPath,
      nodeId: node.id,
      selector: generatePotentialSelector(currentPath),
    });
  }

  // spacing
  if ('layoutMode' in node) {
    if (node.layoutMode !== 'NONE' && node.itemSpacing !== undefined) {
      tokens.push({
        type: 'spacing',
        name: `${node.name}-gap`,
        value: node.itemSpacing,
        path: currentPath,
        nodeId: node.id,
        selector: generatePotentialSelector(currentPath),
      });
    }
  }

  if ('paddingLeft' in node && node.paddingLeft !== undefined) {
    tokens.push({
      type: 'spacing',
      name: `${node.name}-paddingLeft`,
      value: node.paddingLeft,
      path: currentPath,
      nodeId: node.id,
      selector: generatePotentialSelector(currentPath),
    });
  }

  if ('paddingRight' in node && node.paddingRight !== undefined) {
    tokens.push({
      type: 'spacing',
      name: `${node.name}-paddingRight`,
      value: node.paddingRight,
      path: currentPath,
      nodeId: node.id,
      selector: generatePotentialSelector(currentPath),
    });
  }

  if ('paddingTop' in node && node.paddingTop !== undefined) {
    tokens.push({
      type: 'spacing',
      name: `${node.name}-paddingTop`,
      value: node.paddingTop,
      path: currentPath,
      nodeId: node.id,
      selector: generatePotentialSelector(currentPath),
    });
  }

  if ('paddingBottom' in node && node.paddingBottom !== undefined) {
    tokens.push({
      type: 'spacing',
      name: `${node.name}-paddingBottom`,
      value: node.paddingBottom,
      path: currentPath,
      nodeId: node.id,
      selector: generatePotentialSelector(currentPath),
    });
  }

  return tokens;
}

export function extractTokensRecursively(node: SceneNode, path: string[] = []): DesignToken[] {
  try {
    const nodeTokens = extractDesignTokens(node, path);

    if ('children' in node && node.children) {
      for (const child of node.children) {
        try {
          const childTokens = extractTokensRecursively(child, [...path, node.name]);
          nodeTokens.push(...childTokens);
        } catch (error) {
          console.error(`Error processing child node: ${child.name}`, error);
        }
      }
    }
    return nodeTokens;
  } catch (error) {
    console.error(`Error processing node: ${node.name}`, error);
    return [];
  }
}

export function isValidNode(node: any): boolean {
  return node && typeof node === 'object' && 'id' in node && 'name' in node;
}
