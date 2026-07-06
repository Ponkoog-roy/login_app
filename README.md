# 🚀 SecureAuth — Dockerized Login & Signout App

A simple **login & signout** web application with a separate **frontend** (Nginx) and **backend** (Node.js/Express) running as independent Docker containers.

![Docker](https://img.shields.io/badge/docker-ready-blue)
![License](https://img.shields.io/badge/license-MIT-blue)
![Node.js](https://img.shields.io/badge/node-20--alpine-green)
![Nginx](https://img.shields.io/badge/nginx-alpine-brightgreen)

---

## 📦 Stack / Tech Used

| Technology     | Version      | Purpose                          |
|----------------|-------------|----------------------------------|
| Node.js        | `20-alpine` | Backend runtime                  |
| Express.js     | `4.21`      | REST API framework               |
| JSON Web Token | `9.0`       | Authentication (JWT)             |
| Nginx          | `alpine`    | Frontend static file server      |
| Docker         | `latest`    | Containerization                 |
| Docker Compose | `v2+`       | Multi-container orchestration    |
| HTML/CSS/JS    | `-`         | Frontend SPA (Single Page App)   |

---

## 📁 Project Structure

```
.
├── docker-compose.yml           # Orchestrates both containers
├── backend/
│   ├── Dockerfile               # Node.js 20 Alpine image
│   ├── package.json             # Express, CORS, JWT dependencies
│   └── server.js                # REST API server (login/logout/me)
├── frontend/
│   ├── Dockerfile               # Nginx Alpine image
│   ├── nginx.conf               # Static serving + API reverse proxy
│   ├── index.html               # Single-page app (login + dashboard)
│   ├── style.css                # Premium dark glassmorphism theme
│   └── app.js                   # JWT auth logic & view switching
└── README.md                    # This file
```

---

## ✅ Prerequisites

Before you begin, make sure you have the following installed:

- [Docker](https://docs.docker.com/get-docker/) `v20+`
- [Docker Compose](https://docs.docker.com/compose/install/) `v2+`
- [Git](https://git-scm.com/)

---

## 🚀 Quick Start

### 1. Clone the Repository

```bash
git clone https://github.com/Ponkoog-roy/devops-assessment.git
cd YOUR_REPO
```

### 2. Build & Run with Docker Compose

```bash
docker compose up --build
```

### 3. Open in Browser

Visit `http://localhost:3000` in your browser.

### 4. Login with Demo Credentials

| Username | Password       | Role          |
|----------|---------------|---------------|
| `admin`  | `password123` | Administrator |
| `user`   | `user123`     | Standard User |

---

## 🔧 Configuration

| Variable      | Default                              | Description                     |
|---------------|--------------------------------------|---------------------------------|
| `PORT`        | `5000`                               | Backend API port                |
| `JWT_SECRET`  | `super-secret-key-change-in-production` | Secret key for JWT signing   |
| Frontend Port | `3000`                               | Nginx serves frontend on `:3000` |

---

## 📋 API Endpoints

| Method | Endpoint      | Auth Required | Description                     |
|--------|---------------|---------------|---------------------------------|
| `POST` | `/api/login`  | ❌ No         | Validate credentials, return JWT |
| `GET`  | `/api/me`     | ✅ Bearer     | Get logged-in user info          |
| `POST` | `/api/logout` | ✅ Bearer     | Acknowledge logout               |
| `GET`  | `/api/health` | ❌ No         | Health check                     |

### Example: Login Request

```bash
curl -X POST http://localhost:5000/api/login \
  -H "Content-Type: application/json" \
  -d '{"username": "admin", "password": "password123"}'
```

### Example: Access Protected Route

```bash
curl http://localhost:5000/api/me \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

---

## 🐳 Docker Commands

| Command                           | Description                           |
|-----------------------------------|---------------------------------------|
| `docker compose up --build`       | Build and start all services          |
| `docker compose up -d`            | Start all services in background      |
| `docker compose down`             | Stop all services                     |
| `docker compose logs -f`          | Follow live logs                      |
| `docker compose ps`               | Check container status                |
| `docker compose logs -f backend`  | Follow backend logs only              |
| `docker compose logs -f frontend` | Follow frontend logs only             |
| `docker compose build --no-cache` | Rebuild without cache                 |

---

## 🏗️ Architecture

```
┌─────────────────┐        ┌──────────────────────┐
│                 │  :3000  │    Frontend Container │
│    Browser      │◄──────►│    (Nginx Alpine)     │
│                 │        │                      │
└─────────────────┘        │  - index.html        │
                           │  - style.css         │
                           │  - app.js            │
                           │                      │
                           │  /api/* ──────►──┐   │
                           └──────────────────┼───┘
                                              │
                                    Docker Network
                                              │
                           ┌──────────────────┼───┐
                           │  Backend Container│   │
                           │  (Node.js Alpine) │   │
                           │                  ◄┘   │
                           │  - Express.js  :5000  │
                           │  - JWT Auth           │
                           │  - CORS               │
                           └──────────────────────┘
```

> **Note:** The frontend Nginx reverse-proxies all `/api/*` requests to the backend container over the shared Docker network. This eliminates CORS issues in production.

---

## 🌐 Deployment

### Option 1: Local Docker

```bash
docker compose up -d --build
```

### Option 2: Remote Server

```bash
# SSH into your server
ssh user@your-server

# Clone and run
git clone https://github.com/webrezaul/-SecureAuth-Dockerized-Login-Signout-App
cd YOUR_REPO
docker compose up -d --build
```

---

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m "Add amazing feature"`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📝 Changelog

| Version | Date       | Changes                                                  |
|---------|------------|----------------------------------------------------------|
| `1.0.0` | 2026-07-02 | Initial release — login/signout with Docker containers   |

---

## 📄 License

MIT

---

## 👤 Author

**Rezaul Karim**
- GitHub: [@webrezaul](https://github.com/webrezaul)
