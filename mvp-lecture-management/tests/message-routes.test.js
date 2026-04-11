// integration tests for message routes
// mocks the database so no need a real mongodb connection

const express = require('express');
const request = require('supertest');

jest.mock('../server/models/Message');
jest.mock('../server/models/Session');
jest.mock('../server/models/Membership');
jest.mock('../server/models/User');

const Message = require('../server/models/Message');
const Session = require('../server/models/Session');
const Membership = require('../server/models/Membership');

function createTestApp(sessionData = {}) {
  const app = express();
  app.use(express.json());
  app.use((req, res, next) => {
    req.session = { userId: sessionData.userId || 'student123', userRole: sessionData.userRole || 'student', ...sessionData };
    next();
  });
  app.set('io', { to: () => ({ emit: jest.fn() }) });
  const messageRoutes = require('../server/routes/messages');
  app.use('/api/messages', messageRoutes);
  return app;
}

// GET /api/messages/session/:sessionId
describe('GET /api/messages/session/:sessionId', () => {
  let app;
  beforeEach(() => { jest.clearAllMocks(); app = createTestApp(); });

  test('should return messages for a valid session', async () => {
    Session.findById = jest.fn().mockResolvedValue({ _id: 'sess1', lecturer: 'lect1' });
    Membership.findOne = jest.fn().mockResolvedValue({ userId: 'student123', sessionId: 'sess1' });
    const mockMessages = [{ _id: 'msg1', text: 'Hello', type: 'COMMENT', timestamp: new Date(), createdAt: new Date(), userId: { _id: 'student123', displayName: 'Student', role: 'student', avatar: null }, sessionId: 'sess1', identityMode: 'anonymous', alias: null, isEdited: false, isPinned: false, isAnnouncement: false, isReported: false, isPoll: false, poll: null, reactions: {}, replyTo: null, attachment: null }];
    Message.find = jest.fn().mockReturnValue({ sort: jest.fn().mockReturnValue({ skip: jest.fn().mockReturnValue({ limit: jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ lean: jest.fn().mockResolvedValue(mockMessages) }) }) }) }) }) });
    const res = await request(app).get('/api/messages/session/sess1');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.messages).toHaveLength(1);
  });
});

// POST /api/messages/send — send message (sessionId in body)
describe('POST /api/messages/send', () => {
  let app;
  beforeEach(() => { jest.clearAllMocks(); app = createTestApp(); });

  test('should return 400 if required fields are missing', async () => {
    const res = await request(app).post('/api/messages/send').send({ text: 'Hello' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('should return 404 if session does not exist', async () => {
    Session.findById = jest.fn().mockResolvedValue(null);
    const res = await request(app).post('/api/messages/send').send({ sessionId: 'sess999', text: 'Hello', type: 'COMMENT' });
    expect(res.status).toBe(404);
    expect(res.body.success).toBe(false);
  });

  test('should return 400 for invalid message type', async () => {
    Session.findById = jest.fn().mockResolvedValue({ _id: 'sess1', lecturer: { toString: () => 'lect1' }, status: 'active' });
    Membership.findOne = jest.fn().mockResolvedValue({ userId: 'student123', sessionId: 'sess1', incrementMessageCount: jest.fn() });
    const res = await request(app).post('/api/messages/send').send({ sessionId: 'sess1', text: 'Hello', type: 'INVALID_TYPE' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('should return 400 for message exceeding 2000 characters', async () => {
    Session.findById = jest.fn().mockResolvedValue({ _id: 'sess1', lecturer: { toString: () => 'lect1' }, status: 'active' });
    Membership.findOne = jest.fn().mockResolvedValue({ userId: 'student123', sessionId: 'sess1', incrementMessageCount: jest.fn() });
    const res = await request(app).post('/api/messages/send').send({ sessionId: 'sess1', text: 'a'.repeat(2001), type: 'COMMENT' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('should send message successfully with valid data', async () => {
    Session.findById = jest.fn().mockResolvedValue({ _id: 'sess1', lecturer: { toString: () => 'lect1' }, status: 'active' });
    Membership.findOne = jest.fn().mockResolvedValue({ userId: 'student123', sessionId: 'sess1', incrementMessageCount: jest.fn().mockResolvedValue(true) });
    const mockSavedMsg = { _id: 'msg1', text: 'Test message', type: 'QUESTION', sessionId: 'sess1', userId: { _id: 'student123', displayName: 'Student', role: 'student', avatar: null }, identityMode: 'anonymous', alias: null, createdAt: new Date(), timestamp: new Date(), isEdited: false, isPinned: false, isAnnouncement: false, isReported: false, replyTo: null, attachment: null, save: jest.fn().mockResolvedValue(true) };
    Message.mockImplementation(() => ({ ...mockSavedMsg, save: jest.fn().mockResolvedValue(true) }));
    Message.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(mockSavedMsg) }) });
    const res = await request(app).post('/api/messages/send').send({ sessionId: 'sess1', text: 'Test message', type: 'QUESTION', identityMode: 'anonymous' });
    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
  });

  test('should accept all four valid message types', async () => {
    for (const type of ['NONE', 'QUESTION', 'COMMENT', 'CONFUSION']) {
      jest.clearAllMocks(); app = createTestApp();
      Session.findById = jest.fn().mockResolvedValue({ _id: 'sess1', lecturer: { toString: () => 'lect1' }, status: 'active' });
      Membership.findOne = jest.fn().mockResolvedValue({ userId: 'student123', sessionId: 'sess1', incrementMessageCount: jest.fn().mockResolvedValue(true) });
      const m = { _id: 'msg1', text: 'Test', type, sessionId: 'sess1', userId: { _id: 'student123', displayName: 'Student', role: 'student', avatar: null }, identityMode: 'identified', createdAt: new Date(), timestamp: new Date(), isEdited: false, isPinned: false, isAnnouncement: false, isReported: false, replyTo: null, attachment: null, alias: null, save: jest.fn().mockResolvedValue(true) };
      Message.mockImplementation(() => ({ ...m, save: jest.fn().mockResolvedValue(true) }));
      Message.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(m) }) });
      const res = await request(app).post('/api/messages/send').send({ sessionId: 'sess1', text: 'Test', type, identityMode: 'identified' });
      expect(res.status).toBe(201);
    }
  });

  test('should return 400 if session is not active', async () => {
    Session.findById = jest.fn().mockResolvedValue({ _id: 'sess1', lecturer: { toString: () => 'lect1' }, status: 'ended' });
    const res = await request(app).post('/api/messages/send').send({ sessionId: 'sess1', text: 'Hello', type: 'COMMENT' });
    expect(res.status).toBe(400);
  });
});

// PUT /api/messages/:messageId
describe('PUT /api/messages/:messageId', () => {
  let app;
  beforeEach(() => { jest.clearAllMocks(); app = createTestApp(); });

  test('should return 400 if text is empty', async () => {
    const res = await request(app).put('/api/messages/msg1').send({ text: '' });
    expect(res.status).toBe(400);
  });

  test('should return 404 if message does not exist', async () => {
    Message.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
    const res = await request(app).put('/api/messages/msg999').send({ text: 'Updated' });
    expect(res.status).toBe(404);
  });

  test('should return 403 if user is not the owner or lecturer', async () => {
    Message.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue({ _id: 'msg1', userId: { toString: () => 'otherUser' }, sessionId: { _id: 'sess1', lecturer: { toString: () => 'lect1' } }, text: 'Original', save: jest.fn() }) });
    const res = await request(app).put('/api/messages/msg1').send({ text: 'Hacked' });
    expect(res.status).toBe(403);
  });

  test('should edit message successfully when user is the owner', async () => {
    const mock = { _id: 'msg1', userId: { toString: () => 'student123' }, sessionId: { _id: 'sess1', lecturer: { toString: () => 'lect1' } }, text: 'Original', originalText: null, editHistory: [], isEdited: false, save: jest.fn().mockResolvedValue(true) };
    Message.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(mock) });
    const res = await request(app).put('/api/messages/msg1').send({ text: 'Updated text' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(mock.isEdited).toBe(true);
  });
});

// DELETE /api/messages/:messageId
describe('DELETE /api/messages/:messageId', () => {
  let app;
  beforeEach(() => { jest.clearAllMocks(); app = createTestApp(); });

  test('should return 404 if message does not exist', async () => {
    Message.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
    const res = await request(app).delete('/api/messages/msg999');
    expect(res.status).toBe(404);
  });

  test('should return 403 if user is not owner or lecturer', async () => {
    Message.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue({ _id: 'msg1', userId: { toString: () => 'otherUser' }, sessionId: { _id: 'sess1', lecturer: { toString: () => 'lect1' } }, softDelete: jest.fn() }) });
    const res = await request(app).delete('/api/messages/msg1');
    expect(res.status).toBe(403);
  });

  test('should soft delete message when user is the owner', async () => {
    const mock = { _id: 'msg1', userId: { toString: () => 'student123' }, sessionId: { _id: 'sess1', lecturer: { toString: () => 'lect1' } }, softDelete: jest.fn().mockResolvedValue(true) };
    Message.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(mock) });
    const res = await request(app).delete('/api/messages/msg1');
    expect(res.status).toBe(200);
    expect(mock.softDelete).toHaveBeenCalled();
  });
});

// POST /api/messages/:messageId/pin
describe('POST /api/messages/:messageId/pin', () => {
  let app;
  beforeEach(() => { jest.clearAllMocks(); app = createTestApp({ userId: 'lect1', userRole: 'lecturer' }); });

  test('should return 404 if message does not exist', async () => {
    Message.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(null) });
    const res = await request(app).post('/api/messages/msg999/pin');
    expect(res.status).toBe(404);
  });

  test('should toggle pin successfully for lecturer', async () => {
    const mock = { _id: 'msg1', sessionId: { _id: 'sess1', lecturer: { toString: () => 'lect1' } }, isPinned: false, togglePin: jest.fn().mockResolvedValue(true), save: jest.fn().mockResolvedValue(true) };
    Message.findById = jest.fn().mockReturnValue({ populate: jest.fn().mockResolvedValue(mock) });
    const res = await request(app).post('/api/messages/msg1/pin');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// POST /api/messages/:messageId/react
describe('POST /api/messages/:messageId/react', () => {
  let app;
  beforeEach(() => { jest.clearAllMocks(); app = createTestApp(); });

  test('should return 400 for missing emoji', async () => {
    const res = await request(app).post('/api/messages/msg1/react').send({});
    expect(res.status).toBe(400);
  });

  test('should return 400 for emoji longer than 10 chars', async () => {
    const res = await request(app).post('/api/messages/msg1/react').send({ emoji: 'a'.repeat(11) });
    expect(res.status).toBe(400);
  });

  test('should add reaction successfully', async () => {
    const mock = { _id: 'msg1', reactions: new Map(), sessionId: { _id: 'sess1' }, save: jest.fn().mockResolvedValue(true) };
    Message.findById = jest.fn().mockResolvedValue(mock);
    const res = await request(app).post('/api/messages/msg1/react').send({ emoji: '👍' });
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});

// POST /api/messages/:messageId/report
describe('POST /api/messages/:messageId/report', () => {
  let app;
  beforeEach(() => { jest.clearAllMocks(); app = createTestApp(); });

  test('should return 404 if message does not exist', async () => {
    Message.findById = jest.fn().mockResolvedValue(null);
    const res = await request(app).post('/api/messages/msg999/report');
    expect(res.status).toBe(404);
  });

  test('should report message successfully', async () => {
    const mock = { _id: 'msg1', isReported: false, sessionId: { _id: 'sess1' }, save: jest.fn().mockResolvedValue(true) };
    Message.findById = jest.fn().mockResolvedValue(mock);
    const res = await request(app).post('/api/messages/msg1/report');
    expect(res.status).toBe(200);
    expect(mock.isReported).toBe(true);
  });
});
