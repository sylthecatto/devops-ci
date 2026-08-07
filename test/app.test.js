const request = require('supertest');

jest.mock('../src/db', () => {
  const users = [];
  let nextId = 1;

  return {
    query: jest.fn((text, params = []) => {
      if (text.startsWith('SELECT id FROM users WHERE username')) {
        const [username] = params;
        return { rows: users.filter((u) => u.username === username).map((u) => ({ id: u.id })) };
      }
      if (text.startsWith('INSERT INTO users')) {
        const [username, password_hash] = params;
        const user = { id: nextId++, username, password_hash, created_at: new Date().toISOString() };
        users.push(user);
        return { rows: [{ id: user.id, username: user.username, created_at: user.created_at }] };
      }
      if (text.startsWith('SELECT id, username, password_hash FROM users')) {
        const [username] = params;
        return { rows: users.filter((u) => u.username === username) };
      }
      throw new Error(`Unmocked query: ${text}`);
    }),
  };
});

const app = require('../src/app');

describe('GET /health', () => {
  it('returns 200 ok', async () => {
    const res = await request(app).get('/health');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: 'ok' });
  });
});

describe('GET /api/meta', () => {
  it('returns build/environment/hostname with sane defaults', async () => {
    const res = await request(app).get('/api/meta');
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('buildVersion');
    expect(res.body).toHaveProperty('environment');
    expect(res.body).toHaveProperty('hostname');
  });
});

describe('POST /api/register', () => {
  it('rejects missing fields', async () => {
    const res = await request(app).post('/api/register').send({ username: 'alice' });
    expect(res.status).toBe(400);
  });

  it('rejects short passwords', async () => {
    const res = await request(app).post('/api/register').send({ username: 'alice', password: 'short' });
    expect(res.status).toBe(400);
  });

  it('creates a new user', async () => {
    const res = await request(app).post('/api/register').send({ username: 'alice', password: 'password123' });
    expect(res.status).toBe(201);
    expect(res.body.user.username).toBe('alice');
  });

  it('rejects a duplicate username', async () => {
    await request(app).post('/api/register').send({ username: 'bob', password: 'password123' });
    const res = await request(app).post('/api/register').send({ username: 'bob', password: 'password123' });
    expect(res.status).toBe(409);
  });
});

describe('POST /api/login', () => {
  it('rejects unknown username', async () => {
    const res = await request(app).post('/api/login').send({ username: 'nope', password: 'password123' });
    expect(res.status).toBe(401);
  });

  it('logs in with correct credentials', async () => {
    await request(app).post('/api/register').send({ username: 'carol', password: 'password123' });
    const res = await request(app).post('/api/login').send({ username: 'carol', password: 'password123' });
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('carol');
  });

  it('rejects wrong password', async () => {
    await request(app).post('/api/register').send({ username: 'dave', password: 'password123' });
    const res = await request(app).post('/api/login').send({ username: 'dave', password: 'wrongpass' });
    expect(res.status).toBe(401);
  });
});

describe('GET /api/me', () => {
  it('rejects when not authenticated', async () => {
    const res = await request(app).get('/api/me');
    expect(res.status).toBe(401);
  });

  it('returns the user after login via a shared session cookie', async () => {
    const agent = request.agent(app);
    await agent.post('/api/register').send({ username: 'erin', password: 'password123' });
    await agent.post('/api/login').send({ username: 'erin', password: 'password123' });
    const res = await agent.get('/api/me');
    expect(res.status).toBe(200);
    expect(res.body.user.username).toBe('erin');
  });
});
