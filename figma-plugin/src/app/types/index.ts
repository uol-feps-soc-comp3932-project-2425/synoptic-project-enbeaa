export interface FrameBasicInfo {
  id: string;
  name: string;
  width: number;
  height: number;
  thumbnail?: string;
}

export interface DesignToken {
  type: string; // color, spacing, typography, etc.
  name: string; // name of the token
  value: any; // the actual value (color code, spacing value, etc.)
  path: string[]; // hierarchical path for organization
  nodeId: string; // Figma node ID for reference
  selector?: string; // potential CSS selector
}

export type MessageType =
  | { type: "init-frames"; frames: FrameBasicInfo[] }
  | { type: "frame-thumbnail"; frameId: string; thumbnail: string }
  | {
      type: "frame-selected";
      frameId: string;
      frameName: string;
      tokens: DesignToken[];
    }
  | {
      type: "tokens-data";
      frameId: string;
      frameName: string;
      tokens: DesignToken[];
    };

export interface PluginMessage {
  pluginMessage: MessageType;
}
