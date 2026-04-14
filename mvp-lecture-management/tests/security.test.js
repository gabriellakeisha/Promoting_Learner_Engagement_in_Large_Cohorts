// tests for the security middleware - sanitisation and headers

const { sanitiseText, sanitiseInput, sanitiseBody, securityHeaders } = require('../server/middleware/security');

describe('sanitiseText', () => {
  // SBT Session 5 Finding 1.1: server no longer HTML-escapes. HTML escaping is
  // done client-side by escapeHtml() at render time to prevent the
  // double-encoding bug (&lt; becoming &amp;lt;). Server strips control
  // characters and trims whitespace only.
  test('should preserve html tags (client handles escaping at render)', () => {
    const input = '<script>alert("xss")</script>';
    const result = sanitiseText(input);
    expect(result).toBe('<script>alert("xss")</script>');
  });

  test('should return empty string for null input', () => {
    expect(sanitiseText(null)).toBe('');
    expect(sanitiseText(undefined)).toBe('');
    expect(sanitiseText('')).toBe('');
  });

  test('should return empty string for non-string input', () => {
    expect(sanitiseText(123)).toBe('');
    expect(sanitiseText({})).toBe('');
  });

  test('should trim whitespace', () => {
    expect(sanitiseText('  hello  ')).toBe('hello');
  });

  test('should strip control characters', () => {
    // validator.stripLow removes ASCII 0-31 and 127 (control chars)
    const result = sanitiseText('hello\x00\x01world');
    expect(result).toBe('helloworld');
  });

  test('should preserve ampersands and quotes (client escapes at render)', () => {
    const result = sanitiseText('a & b "c"');
    expect(result).toBe('a & b "c"');
  });

  test('should handle normal text without changes', () => {
    expect(sanitiseText('hello world')).toBe('hello world');
  });
});

describe('sanitiseInput', () => {
  test('should trim string values in object', () => {
    const input = { name: '  bold  ', age: 25 };
    const result = sanitiseInput(input);
    expect(result.name).toBe('bold');
    expect(result.age).toBe(25);
  });

  test('should preserve html in string values (client handles escaping)', () => {
    const input = { name: '<b>bold</b>' };
    const result = sanitiseInput(input);
    expect(result.name).toBe('<b>bold</b>');
  });

  test('should preserve password fields (not sanitise them)', () => {
    const input = { password: 'p@ss<word>' };
    const result = sanitiseInput(input);
    // password should only be trimmed, never touched by sanitiseText
    expect(result.password).toBe('p@ss<word>');
  });

  test('should preserve token and sessionId fields', () => {
    const input = { token: 'abc<123>', sessionId: 'xyz<456>' };
    const result = sanitiseInput(input);
    expect(result.token).toBe('abc<123>');
    expect(result.sessionId).toBe('xyz<456>');
  });

  test('should handle nested objects', () => {
    const input = { user: { name: '  trimme  ' } };
    const result = sanitiseInput(input);
    expect(result.user.name).toBe('trimme');
  });

  test('should handle arrays of strings', () => {
    const input = { tags: ['  tag1  ', 'tag2'] };
    const result = sanitiseInput(input);
    expect(result.tags[0]).toBe('tag1');
    expect(result.tags[1]).toBe('tag2');
  });

  test('should handle arrays of objects', () => {
    const input = { items: [{ text: '  hello  ' }] };
    const result = sanitiseInput(input);
    expect(result.items[0].text).toBe('hello');
  });

  test('should return non-object input as-is', () => {
    expect(sanitiseInput(null)).toBe(null);
    expect(sanitiseInput(undefined)).toBe(undefined);
    expect(sanitiseInput(42)).toBe(42);
  });

  test('should preserve boolean and number values', () => {
    const input = { active: true, count: 5, name: 'test' };
    const result = sanitiseInput(input);
    expect(result.active).toBe(true);
    expect(result.count).toBe(5);
    expect(result.name).toBe('test');
  });
});

describe('sanitiseBody middleware', () => {
  test('should trim and strip control chars from req.body and call next', () => {
    const req = { body: { name: '  hello\x00world  ' } };
    const res = {};
    const next = jest.fn();

    sanitiseBody(req, res, next);

    expect(req.body.name).toBe('helloworld');
    expect(next).toHaveBeenCalled();
  });

  test('should call next even if body is empty', () => {
    const req = { body: null };
    const res = {};
    const next = jest.fn();

    sanitiseBody(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  test('should call next if body is not an object', () => {
    const req = { body: 'string body' };
    const res = {};
    const next = jest.fn();

    sanitiseBody(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});

describe('securityHeaders middleware', () => {
  test('should set all security headers', () => {
    const req = {};
    const headers = {};
    const res = {
      setHeader: (key, value) => { headers[key] = value; }
    };
    const next = jest.fn();

    securityHeaders(req, res, next);

    expect(headers['X-Frame-Options']).toBe('SAMEORIGIN');
    expect(headers['X-XSS-Protection']).toBe('1; mode=block');
    expect(headers['X-Content-Type-Options']).toBe('nosniff');
    expect(headers['Referrer-Policy']).toBe('strict-origin-when-cross-origin');
    expect(next).toHaveBeenCalled();
  });
});
