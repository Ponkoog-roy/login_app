const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 8080;
const JWT_SECRET = 'super-secret-key-change-in-production';

// Demo users
const USERS = [
  {
    id: 1,
    username: 'admin',
    password: 'password123',
    role: 'Administrator'
  },
  {
    id: 2,
    username: 'user',
    password: 'user123',
    role: 'Standard User'
  }
];

// Middleware
app.use(cors());
app.use(express.json());

app.use((req, _res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.path}`);
  next();
});

// Auth middleware
function authenticate(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      error: 'Missing or invalid token'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({
      error: 'Token expired or invalid'
    });
  }
}

// ==================================================
// Assessment Required Endpoints
// ==================================================

app.get('/', (_req, res) => {
  res.send('Application is running');
});

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok'
  });
});

// ==================================================
// Application Endpoints
// ==================================================

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString()
  });
});

// Login
app.post('/api/login', (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({
      error: 'Username and password are required'
    });
  }

  const user = USERS.find(
    (u) => u.username === username && u.password === password
  );

  if (!user) {
    return res.status(401).json({
      error: 'Invalid username or password'
    });
  }

  const token = jwt.sign(
    {
      id: user.id,
      username: user.username,
      role: user.role
    },
    JWT_SECRET,
    {
      expiresIn: '1h'
    }
  );

  res.json({
    message: 'Login successful',
    token,
    user: {
      id: user.id,
      username: user.username,
      role: user.role
    }
  });
});

// Current user
app.get('/api/me', authenticate, (req, res) => {
  res.json(req.user);
});

// Logout
app.post('/api/logout', authenticate, (_req, res) => {
  res.json({
    message: 'Logged out successfully'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});