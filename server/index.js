require('dotenv').config();
const express = require('express');
const session = require('express-session');
const { createServer } = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const { getAll, upsert, getOne } = require('./db');

const app = express();
const httpServer = createServer(app);

const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';

const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGIN, credentials: true },
});

const SESSION_SECRET = process.env.SESSION_SECRET || 'travellog-dev-secret';
const IS_PROD = process.env.NODE_ENV === 'production';
const sessionMiddleware = session({
  secret: SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    sameSite: IS_PROD ? 'none' : 'lax',
    secure: IS_PROD,
    maxAge: 30 * 24 * 60 * 60 * 1000,
  },
});

// 2 users configured via env
const USERS = {
  [process.env.USER1_NAME || '나']: {
    password: process.env.USER1_PASS || 'pass1',
    slot: 1,
  },
  [process.env.USER2_NAME || '여친']: {
    password: process.env.USER2_PASS || 'pass2',
    slot: 2,
  },
};

app.use(cors({ origin: CLIENT_ORIGIN, credentials: true }));
app.use(express.json());
app.use(sessionMiddleware);

// Share session with Socket.io
io.engine.use(sessionMiddleware);

// --- REST ---

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = USERS[username];
  if (!user || user.password !== password) {
    return res.status(401).json({ error: '이름 또는 비밀번호가 틀렸습니다.' });
  }
  req.session.username = username;
  req.session.slot = user.slot;
  res.json({ username, slot: user.slot });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy();
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  if (!req.session.username) return res.status(401).json({ error: 'unauthenticated' });
  res.json({ username: req.session.username, slot: req.session.slot });
});

app.get('/api/visits', (req, res) => {
  if (!req.session.username) return res.status(401).json({ error: 'unauthenticated' });
  res.json(getAll.all());
});

// Track connected users: slot → socket id
const onlineSlots = new Map();

// --- Socket.io ---
io.on('connection', (socket) => {
  const sess = socket.request.session;
  if (!sess?.username) {
    socket.disconnect(true);
    return;
  }

  const { username, slot } = sess;
  onlineSlots.set(slot, socket.id);
  io.emit('users-online', [...onlineSlots.keys()]);

  socket.on('toggle-city', ({ code, name, province }) => {
    if (!code || !name) return;

    let row = getOne.get(code);
    if (!row) {
      row = { city_code: code, city_name: name, province: province || '', user1: 0, user2: 0 };
    }

    const field = slot === 1 ? 'user1' : 'user2';
    row[field] = row[field] ? 0 : 1;

    upsert.run({
      code: row.city_code,
      name: row.city_name,
      province: row.province,
      user1: row.user1,
      user2: row.user2,
    });

    io.emit('city-updated', {
      city_code: row.city_code,
      city_name: row.city_name,
      province: row.province,
      user1: row.user1,
      user2: row.user2,
    });
  });

  socket.on('disconnect', () => {
    if (onlineSlots.get(slot) === socket.id) {
      onlineSlots.delete(slot);
    }
    io.emit('users-online', [...onlineSlots.keys()]);
  });
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => console.log(`Server running on port ${PORT}`));
