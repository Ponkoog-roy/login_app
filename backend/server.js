const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 5000;
const JWT_SECRET = 'super-secret-key-change-in-production';

// --- Hardcoded users for demo ---
const USERS = [
  { id: 1, username: 'admin', password: 'password123', role: 'Administrator' },
  { id: 2, username: 'user',  password: 'user123',     role: 'Standard User' }
];

// --- Middleware ---
app.use(cors());
app.use(express.json());

// Request logger
app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// --- Auth middleware ---
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid token' });
  }

  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Token expired or invalid' });
  }
}

// ==================== ROUTES ====================

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// POST /api/login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const user = USERS.find(
    (u) => u.username === username && u.password === password
  );

  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '1h' }
  );

  console.log(`✅ User "${user.username}" logged in`);

  res.json({
    message: 'Login successful',
    token,
    user: { id: user.id, username: user.username, role: user.role }
  });
});

// GET /api/me  (protected)
app.get('/api/me', authenticate, (req, res) => {
  res.json({
    id: req.user.id,
    username: req.user.username,
    role: req.user.role
  });
});

// POST /api/logout  (stateless — just acknowledge)
app.post('/api/logout', authenticate, (req, res) => {
  console.log(`🚪 User "${req.user.username}" logged out`);
  res.json({ message: 'Logged out successfully' });
});

// ==================== START ====================
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Backend API running on http://0.0.0.0:${PORT}`);
});
