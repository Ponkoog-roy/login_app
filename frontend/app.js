/* ================================================
   SecureAuth — Frontend Logic
   ================================================ */

(() => {
  'use strict';

  // --- API base (relative — Nginx proxies /api/ to the backend) ---
  const API = '/api';

  // --- DOM refs ---
  const loginView     = document.getElementById('login-view');
  const dashboardView = document.getElementById('dashboard-view');
  const loginForm     = document.getElementById('login-form');
  const loginBtn      = document.getElementById('login-btn');
  const loginError    = document.getElementById('login-error');
  const logoutBtn     = document.getElementById('logout-btn');

  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');

  const welcomeName   = document.getElementById('welcome-name');
  const userRole      = document.getElementById('user-role');
  const avatarLetter  = document.getElementById('avatar-letter');
  const sessionTime   = document.getElementById('session-time');

  // ==================== HELPERS ====================

  function setView(view) {
    loginView.classList.remove('active');
    dashboardView.classList.remove('active');
    view.classList.add('active');
  }

  function showError(msg) {
    loginError.textContent = msg;
    loginError.classList.add('visible');
  }

  function clearError() {
    loginError.textContent = '';
    loginError.classList.remove('visible');
  }

  function setLoading(on) {
    if (on) {
      loginBtn.classList.add('loading');
      loginBtn.disabled = true;
    } else {
      loginBtn.classList.remove('loading');
      loginBtn.disabled = false;
    }
  }

  function getToken() {
    return localStorage.getItem('auth_token');
  }

  function setToken(token) {
    localStorage.setItem('auth_token', token);
  }

  function removeToken() {
    localStorage.removeItem('auth_token');
  }

  function formatTime(date) {
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) +
           ', ' +
           date.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
  }

  // ==================== API CALLS ====================

  async function apiLogin(username, password) {
    const res = await fetch(`${API}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Login failed');
    return data;
  }

  async function apiGetMe(token) {
    const res = await fetch(`${API}/me`, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Unauthorized');
    return data;
  }

  async function apiLogout(token) {
    const res = await fetch(`${API}/logout`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` }
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Logout failed');
    return data;
  }

  // ==================== UI ACTIONS ====================

  function showDashboard(user) {
    welcomeName.textContent  = `Welcome, ${user.username}`;
    userRole.textContent     = user.role;
    avatarLetter.textContent = user.username.charAt(0).toUpperCase();
    sessionTime.textContent  = formatTime(new Date());
    setView(dashboardView);
  }

  // ==================== EVENT HANDLERS ====================

  // Login form submit
  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    clearError();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      showError('Please fill in all fields');
      return;
    }

    setLoading(true);

    try {
      const data = await apiLogin(username, password);
      setToken(data.token);
      showDashboard(data.user);
      loginForm.reset();
    } catch (err) {
      showError(err.message);
      // Shake animation on error
      loginBtn.style.animation = 'none';
      requestAnimationFrame(() => {
        loginBtn.style.animation = 'shake 0.4s ease';
      });
    } finally {
      setLoading(false);
    }
  });

  // Logout button
  logoutBtn.addEventListener('click', async () => {
    const token = getToken();
    try {
      if (token) await apiLogout(token);
    } catch {
      // Ignore — still log out locally
    }
    removeToken();
    setView(loginView);
  });

  // ==================== INIT ====================

  // Check for existing token on page load
  (async () => {
    const token = getToken();
    if (!token) return;

    try {
      const user = await apiGetMe(token);
      showDashboard(user);
    } catch {
      removeToken(); // Token invalid/expired
    }
  })();

  // Add shake keyframe dynamically
  const style = document.createElement('style');
  style.textContent = `
    @keyframes shake {
      0%, 100% { transform: translateX(0); }
      20%      { transform: translateX(-8px); }
      40%      { transform: translateX(8px); }
      60%      { transform: translateX(-4px); }
      80%      { transform: translateX(4px); }
    }
  `;
  document.head.appendChild(style);
})();
