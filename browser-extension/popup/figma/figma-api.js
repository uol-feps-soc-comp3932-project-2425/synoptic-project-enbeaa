const FIGMA_AUTH_URL = 'https://www.figma.com/oauth';
const FIGMA_API_BASE = 'https://api.figma.com/v1';
const FIGMA_CLIENT_ID = 'HKKJCixfvBgiJb5HcYMCil';
const REDIRECT_URI = `https://${chrome.runtime.id}.chromiumapp.org/figma-auth`;
const CLIENT_SECRET = '7SI7bGbObPeKsOTDLzD9eazvOdMPCx';

function generateRandomString(length = 32) {
  const array = new Uint8Array(length);
  crypto.getRandomValues(array);
  return Array.from(array, (byte) => byte.toString(16).padStart(2, '0')).join('');
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

class FigmaAPI {
  constructor() {
    this.token = null;
    this.initializeToken();
  }

  async initializeToken() {
    const data = await this.getStorageItem('figmaAuthToken');
    if (data) {
      this.token = data;
    }
  }

  isAuthenticated() {
    return !!this.token;
  }

  async authenticate() {
    try {
      const codeVerifier = generateRandomString(64);
      const codeChallenge = await generateCodeChallenge(codeVerifier);

      await this.setStorageItem('figma_code_verifier', codeVerifier);

      const authURL = new URL(FIGMA_AUTH_URL);
      authURL.searchParams.append('client_id', FIGMA_CLIENT_ID);
      authURL.searchParams.append('redirect_uri', REDIRECT_URI);
      authURL.searchParams.append('response_type', 'code');
      authURL.searchParams.append('scope', 'files:read,file_comments:write');
      authURL.searchParams.append('code_challenge', codeChallenge);
      authURL.searchParams.append('code_challenge_method', 'S256');
      authURL.searchParams.append('state', generateRandomString(16));

      const responseUrl = await new Promise((resolve, reject) => {
        chrome.identity.launchWebAuthFlow(
          {
            url: authURL.toString(),
            interactive: true,
          },
          (redirectUrl) => {
            if (chrome.runtime.lastError) {
              console.error('Chrome identity error:', chrome.runtime.lastError);
              reject(chrome.runtime.lastError.message);
            } else {
              resolve(redirectUrl);
            }
          }
        );
      });

      if (!responseUrl) {
        throw new Error('Authentication failed - no response URL');
      }

      const url = new URL(responseUrl);
      const code = url.searchParams.get('code');

      if (!code) {
        throw new Error('No authorization code received');
      }

      const tokenResponse = await this.exchangeCodeForToken(code, codeVerifier);

      this.token = tokenResponse.access_token;
      await this.setStorageItem('figmaAuthToken', this.token);
      await this.setStorageItem('figma_token_expiry', Date.now() + tokenResponse.expires_in * 1000);

      return true;
    } catch (error) {
      return false;
    }
  }

  async exchangeCodeForToken(code, codeVerifier) {
    const tokenUrl = 'https://api.figma.com/v1/oauth/token';

    const params = new URLSearchParams();
    params.append('client_id', FIGMA_CLIENT_ID);
    params.append('redirect_uri', REDIRECT_URI);
    params.append('code_verifier', codeVerifier);
    params.append('code', code);
    params.append('grant_type', 'authorization_code');

    const auth_id = btoa(FIGMA_CLIENT_ID.concat(':', CLIENT_SECRET));
    const auth_param = `Basic ${auth_id}`;

    // prettier-ignore
    const headers = {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': auth_param,
    };

    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: headers,
      body: params.toString(),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Token exchange failed: ${error.message || response.status}`);
    }

    return response.json();
  }

  async logout() {
    this.token = null;
    await this.removeStorageItem('figmaAuthToken');
    return true;
  }

  async request(endpoint, options = {}) {
    if (!this.isAuthenticated()) {
      throw new Error('Not authenticated with Figma');
    }
    const url = `${FIGMA_API_BASE}${endpoint}`;

    const fetchOptions = {
      ...options,
      headers: {
        ...options.headers,
        Authorization: `Bearer ${this.token}`,
        'Content-Type': 'application/json',
      },
    };
    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      if (response.status === 401) {
        await this.logout();
        throw new Error('Authentication expired. Please log in again.');
      }

      const error = await response.json().catch(() => ({ message: 'Unknown error' }));
      throw new Error(`Figma API error: ${error.message}`);
    }

    return response.json();
  }

  async addFigmaFile(fileUrl, tokensId) {
    const fileKey = this.extractFileKeyFromUrl(fileUrl);
    if (!fileKey) {
      throw new Error('Invalid Figma file URL');
    }

    try {
      await this.request(`/files/${fileKey}`);
    } catch (error) {
      throw new Error(`Cannot access Figma file: ${error.message}`);
    }

    const fileMap = (await this.getStorageItem('figmaFileMap')) || {};

    fileMap[tokensId] = {
      fileKey,
      fileUrl,
      addedAt: Date.now(),
    };

    await this.setStorageItem('figmaFileMap', fileMap);
    return fileKey;
  }

  async getFileKeyForTokens(tokensId) {
    const fileMap = (await this.getStorageItem('figmaFileMap')) || {};

    if (fileMap[tokensId]) {
      return fileMap[tokensId].fileKey;
    }

    return null;
  }

  extractFileKeyFromUrl(url) {
    try {
      const figmaUrl = new URL(url);
      if (!figmaUrl.hostname.includes('figma.com')) {
        return null;
      }
      console.log(figmaUrl.pathname);
      const matches = figmaUrl.pathname.split('/');
      if (matches && matches[2]) {
        return matches[2];
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  async postComment(fileKey, comment, nodeId) {
    if (!fileKey || !comment) {
      throw new Error('File key and comment are required');
    }

    const payload = {
      message: comment,
      client_meta: {
        node_id: nodeId,
        node_offset: {
          x: 0,
          y: 0,
        },
      },
    };

    return this.request(`/files/${fileKey}/comments`, {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  async getStorageItem(key) {
    return new Promise((resolve) => {
      chrome.storage.local.get(key, (result) => {
        resolve(result[key]);
      });
    });
  }

  async setStorageItem(key, value) {
    return new Promise((resolve) => {
      chrome.storage.local.set({ [key]: value }, resolve);
    });
  }

  async removeStorageItem(key) {
    return new Promise((resolve) => {
      chrome.storage.local.remove(key, resolve);
    });
  }
}

const figmaApi = new FigmaAPI();
export default figmaApi;
