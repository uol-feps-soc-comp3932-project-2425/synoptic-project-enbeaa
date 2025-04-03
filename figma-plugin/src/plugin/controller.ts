// Import token extractor utility
import { extractTokensRecursively } from './utils/tokenExtractor';

figma.showUI(__html__, { width: 450, height: 600 });

let cachedFrameData = null;
let framesLoaded = false;

function getAllFrames() {
  const frames: FrameNode[] = [];

  figma.currentPage.children.forEach((node) => {
    if (node.type === 'FRAME') {
      frames.push(node as FrameNode);
    }
  });
  return frames;
}

async function generateFrameThumbnail(frame: FrameNode) {
  try {
    const bytes = await frame.exportAsync({
      format: 'PNG',
      constraint: { type: 'SCALE', value: 2 },
    });

    return {
      frameId: frame.id,
      thumbnail: figma.base64Encode(bytes),
      success: true,
    };
  } catch (error) {
    console.error(`Error generating thumbnail for ${frame.name}:`, error);
    return {
      frameId: frame.id,
      error: `Failed to generate thumbnail: ${error.message}`,
      success: false,
    };
  }
}

async function initializePlugin() {
  const frames = getAllFrames();

  const basicFrameData = frames.map((frame) => ({
    id: frame.id,
    name: frame.name,
    width: Math.round(frame.width),
    height: Math.round(frame.height),
  }));

  const batchSize = 3;
  const thumbnails = [];

  for (let i = 0; i < frames.length; i += batchSize) {
    const batch = frames.slice(i, i + batchSize);

    // Process current batch
    const batchResults = await Promise.all(batch.map((frame) => generateFrameThumbnail(frame)));
    thumbnails.push(...batchResults);
  }

  cachedFrameData = {
    frames: basicFrameData,
    thumbnails: thumbnails,
  };
  framesLoaded = true;

  if (uiIsReady) {
    sendFrameDataToUI();
  }
}

let uiIsReady = false;

// Send frame data to the UI
function sendFrameDataToUI() {
  if (framesLoaded && cachedFrameData) {
    figma.ui.postMessage({
      type: 'init-frames',
      frames: cachedFrameData.frames,
      thumbnails: cachedFrameData.thumbnails,
    });
  }
}

initializePlugin().catch((error) => {
  console.error('Error initializing plugin:', error);
  figma.ui.postMessage({
    type: 'initialization-error',
    error: error.message,
  });
});

figma.ui.onmessage = (msg) => {
  if (msg.type === 'ui-ready') {
    uiIsReady = true;

    if (framesLoaded) {
      sendFrameDataToUI();
    } else {
      figma.ui.postMessage({
        type: 'loading-frames',
        message: 'Preparing frame data...',
      });
    }
  }

  if (msg.type === 'select-frame') {
    const frame = figma.getNodeById(msg.frameId) as FrameNode;

    if (frame) {
      figma.currentPage.selection = [frame];
      figma.viewport.scrollAndZoomIntoView([frame]);
      const tokens = extractTokensRecursively(frame);

      figma.ui.postMessage({
        type: 'frame-selected',
        frameId: frame.id,
        frameName: frame.name,
        tokens: tokens,
      });
    }
  }

  if (msg.type === 'export-tokens') {
    if (msg.frameId) {
      const frame = figma.getNodeById(msg.frameId) as FrameNode;

      if (frame) {
        const tokens = extractTokensRecursively(frame);
        figma.ui.postMessage({
          type: 'tokens-data',
          frameId: frame.id,
          frameName: frame.name,
          tokens: tokens,
        });
      }
    }
  }

  if (msg.type === 'refresh-frames') {
    cachedFrameData = null;
    framesLoaded = false;

    figma.ui.postMessage({
      type: 'loading-frames',
      message: 'Refreshing frames...',
    });

    initializePlugin().catch((error) => {
      console.error('Error refreshing frames:', error);

      figma.ui.postMessage({
        type: 'refresh-error',
        error: error.message,
      });
    });
  }
};
