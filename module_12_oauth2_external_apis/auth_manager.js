// NeuralTab — auth_manager.js (Module 12)
// OAuth2 token management via chrome.identity.launchWebAuthFlow
'use strict';

const AuthManager = (() => {
  const TOKEN_KEY = 'oauthToken';
  const CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID.apps.googleusercontent.com';
  const REDIRECT = `https://${chrome.runtime.id}.chromiumapp.org/`;
  const SCOPES = ['openid', 'email', 'profile'];

  function buildAuthUrl() {
    const params = new URLSearchParams({
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT,
      response_type: 'token',
      scope: SCOPES.join(' '),
      include_granted_scopes: 'true',
    });
    return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
  }

  async function getToken() {
    const { oauthToken } = await chrome.storage.local.get(TOKEN_KEY);
    return oauthToken || null;
  }

  async function saveToken(token) {
    await chrome.storage.local.set({ [TOKEN_KEY]: token });
  }

  async function clearToken() {
    await chrome.storage.local.remove(TOKEN_KEY);
  }

  async function login() {
    const url = await chrome.identity.launchWebAuthFlow({
      url: buildAuthUrl(),
      interactive: true,
    });
    const match = url.match(/[#&]access_token=([^&]+)/);
    if (!match) throw new Error('No access_token in redirect');
    const token = match[1];
    await saveToken(token);
    return token;
  }

  async function callAPI(endpoint) {
    let token = await getToken();
    if (!token) token = await login();
    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${token}` }
    });
    if (res.status === 401) {
      await clearToken();
      throw new Error('Token expired — please log in again');
    }
    return res.json();
  }

  async function getUserInfo() {
    return callAPI('https://www.googleapis.com/oauth2/v2/userinfo');
  }

  return { login, logout: clearToken, getToken, getUserInfo, callAPI };
})();
