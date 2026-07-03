/* ================================================
   SecureAuth — Frontend Logic
   ================================================ */

(() => {
  'use strict';

  const API = '/api';

  // Views
  const loginView = document.getElementById('login-view');
  const dashboardView = document.getElementById('dashboard-view');

  // Login
  const loginForm = document.getElementById('login-form');
  const loginBtn = document.getElementById('login-btn');
  const loginError = document.getElementById('login-error');

  const usernameInput = document.getElementById('username');
  const passwordInput = document.getElementById('password');

  // Dashboard
  const logoutBtn = document.getElementById('logout-btn');
  const welcomeName = document.getElementById('welcome-name');
  const userRole = document.getElementById('user-role');
  const avatarLetter = document.getElementById('avatar-letter');
  const sessionTime = document.getElementById('session-time');

  // ==================================================
  // Helpers
  // ==================================================

  function setView(view) {
    loginView.classList.remove('active');
    dashboardView.classList.remove('active');
    view.classList.add('active');
  }

  function showError(message) {
    loginError.textContent = message;
    loginError.classList.add('visible');
  }

  function clearError() {
    loginError.textContent = '';
    loginError.classList.remove('visible');
  }

  function setLoading(isLoading) {
    loginBtn.disabled = isLoading;

    if (isLoading) {
      loginBtn.classList.add('loading');
    } else {
      loginBtn.classList.remove('loading');
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
    return (
      date.toLocaleTimeString([], {
        hour: '2-digit',
        minute: '2-digit'
      }) +
      ', ' +
      date.toLocaleDateString([], {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      })
    );
  }

  // ==================================================
  // API
  // ==================================================

  async function apiLogin(username, password) {
    const response = await fetch(`${API}/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        username,
        password
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Login failed');
    }

    return data;
  }

  async function apiGetMe(token) {
    const response = await fetch(`${API}/me`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Unauthorized');
    }

    return data;
  }

  async function apiLogout(token) {
    const response = await fetch(`${API}/logout`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || 'Logout failed');
    }

    return data;
  }

  // ==================================================
  // Dashboard
  // ==================================================

  function showDashboard(user) {
    welcomeName.textContent = `Welcome, ${user.username}`;
    userRole.textContent = user.role;
    avatarLetter.textContent = user.username.charAt(0).toUpperCase();
    sessionTime.textContent = formatTime(new Date());

    setView(dashboardView);
  }

  // ==================================================
  // Login
  // ==================================================

  loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    clearError();

    const username = usernameInput.value.trim();
    const password = passwordInput.value;

    if (!username || !password) {
      showError('Please enter username and password');
      return;
    }

    try {
      setLoading(true);

      const data = await apiLogin(username, password);

      setToken(data.token);

      showDashboard(data.user);

      loginForm.reset();
    } catch (err) {
      showError(err.message);
    } finally {
      setLoading(false);
    }
  });

  // ==================================================
  // Logout
  // ==================================================

  logoutBtn.addEventListener('click', async () => {
    const token = getToken();

    try {
      if (token) {
        await apiLogout(token);
      }
    } catch (err) {
      console.error(err);
    }

    removeToken();

    setView(loginView);
  });

  // ==================================================
  // Initial Load
  // ==================================================

  async function initializeApp() {
    const token = getToken();

    if (!token) {
      setView(loginView);
      return;
    }

    try {
      const user = await apiGetMe(token);

      showDashboard(user);
    } catch (err) {
      removeToken();
      setView(loginView);
    }
  }

  initializeApp();

  // ==================================================
  // Shake animation
  // ==================================================

  const style = document.createElement('style');

  style.textContent = `
    @keyframes shake {
      0%,100% { transform: translateX(0); }
      20% { transform: translateX(-8px); }
      40% { transform: translateX(8px); }
      60% { transform: translateX(-4px); }
      80% { transform: translateX(4px); }
    }
  `;

  document.head.appendChild(style);
})();