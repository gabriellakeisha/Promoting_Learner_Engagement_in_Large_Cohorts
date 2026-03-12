// tests for auth routes - registration and login validation
// mocks the database so we dont need a real mongodb connection

const express = require('express');
const request = require('supertest');

// mock the User model before requiring routes
jest.mock('../server/models/User');
const User = require('../server/models/User');

// set up a minimal express app with the auth routes
function createTestApp() {
  const app = express();
  app.use(express.json());

  // fake session middleware for testing
  app.use((req, res, next) => {
    req.session = {};
    req.session.destroy = (cb) => cb(null);
    next();
  });

  const authRoutes = require('../server/routes/auth');
  app.use('/api/auth', authRoutes);
  return app;
}

describe('POST /api/auth/register', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
  });

  test('should return 400 if email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ password: 'test123', displayName: 'Test' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('should return 400 if password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@test.com', displayName: 'Test' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('should return 400 if displayName is missing', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'test@test.com', password: 'test123' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('should return 400 if email already exists', async () => {
    User.findOne.mockResolvedValue({ email: 'existing@test.com' });

    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'existing@test.com', password: 'test123', displayName: 'Test' });

    expect(res.status).toBe(400);
    expect(res.body.message).toContain('already exists');
  });

  test('should return 403 if lecturer code is wrong', async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'lecturer@test.com',
        password: 'test123',
        displayName: 'Dr Test',
        role: 'lecturer',
        lecturerCode: 'WRONGCODE'
      });

    expect(res.status).toBe(403);
    expect(res.body.message).toContain('Invalid lecturer access code');
  });

  test('should register student successfully', async () => {
    User.findOne.mockResolvedValue(null);

    const mockUser = {
      _id: 'user123',
      email: 'student@test.com',
      displayName: 'Student Test',
      role: 'student',
      save: jest.fn().mockResolvedValue(true)
    };

    // mock the User constructor
    User.mockImplementation(() => mockUser);

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'student@test.com',
        password: 'test123',
        displayName: 'Student Test'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe('student@test.com');
  });

  test('should register lecturer with correct access code', async () => {
    User.findOne.mockResolvedValue(null);

    const mockUser = {
      _id: 'lect123',
      email: 'lecturer@test.com',
      displayName: 'Dr Test',
      role: 'lecturer',
      save: jest.fn().mockResolvedValue(true)
    };

    User.mockImplementation(() => mockUser);

    const res = await request(app)
      .post('/api/auth/register')
      .send({
        email: 'lecturer@test.com',
        password: 'test123',
        displayName: 'Dr Test',
        role: 'lecturer',
        lecturerCode: 'ECHOCLASS-LECTURER-2026'
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });
});

describe('POST /api/auth/login', () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createTestApp();
  });

  test('should return 400 if email is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ password: 'test123' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('should return 400 if password is missing', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com' });

    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('should return 401 if user not found', async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'nobody@test.com', password: 'test123' });

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('Invalid');
  });

  test('should return 401 if password is wrong', async () => {
    User.findOne.mockResolvedValue({
      _id: 'user123',
      email: 'test@test.com',
      comparePassword: jest.fn().mockResolvedValue(false)
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'wrongpassword' });

    expect(res.status).toBe(401);
    expect(res.body.message).toContain('Invalid');
  });

  test('should login successfully with correct credentials', async () => {
    User.findOne.mockResolvedValue({
      _id: 'user123',
      email: 'test@test.com',
      displayName: 'Test User',
      role: 'student',
      comparePassword: jest.fn().mockResolvedValue(true),
      updateLoginTracking: jest.fn().mockResolvedValue(true)
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'test@test.com', password: 'correct123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.user.email).toBe('test@test.com');
  });
});

describe('GET /api/auth/me', () => {
  test('should return 401 if not logged in', async () => {
    const app = createTestApp();

    const res = await request(app).get('/api/auth/me');

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });
});

describe('POST /api/auth/logout', () => {
  test('should logout successfully', async () => {
    const app = createTestApp();

    const res = await request(app).post('/api/auth/logout');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
