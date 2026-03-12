// tests for the security middleware - sanitisation and headers

const { sanitiseText, sanitiseInput, sanitiseBody, securityHeaders } = require('../server/middleware/security');

describe('sanitiseText', () => {
  test('should escape html tags', () => {
    const input = '<script>alert("xss")</script>';
    const result = sanitiseText(input);
    expect(result).not.toContain('<script>');
    expect(result).toContain('&lt;script&gt;');
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

  test('should escape ampersands and quotes', () => {
    const result = sanitiseText('a & b "c"');
    expect(result).toContain('&amp;');
    expect(result).toContain('&quot;');
  });

  test('should handle normal text without changes', () => {
    expect(sanitiseText('hello world')).toBe('hello world');
  });
});

describe('sanitiseInput', () => {
  test('should sanitise string values in object', () => {
    const input = { name: '<b>bold</b>', age: 25 };
    const result = sanitiseInput(input);
    expect(result.name).not.toContain('<b>');
    expect(result.age).toBe(25);
  });

  test('should preserve password fields (not escape them)', () => {
    const input = { password: 'p@ss<word>' };
    const result = sanitiseInput(input);
    // password should only be trimmed, not escaped
    expect(result.password).toBe('p@ss<word>');
  });

  test('should preserve token and sessionId fields', () => {
    const input = { token: 'abc<123>', sessionId: 'xyz<456>' };
    const result = sanitiseInput(input);
    expect(result.token).toBe('abc<123>');
    expect(result.sessionId).toBe('xyz<456>');
  });

  test('should handle nested objects', () => {
    const input = { user: { name: '<script>bad</script>' } };
    const result = sanitiseInput(input);
    expect(result.user.name).not.toContain('<script>');
  });

  test('should handle arrays of strings', () => {
    const input = { tags: ['<b>tag1</b>', 'tag2'] };
    const result = sanitiseInput(input);
    expect(result.tags[0]).not.toContain('<b>');
    expect(result.tags[1]).toBe('tag2');
  });

  test('should handle arrays of objects', () => {
    const input = { items: [{ text: '<img src=x>' }] };
    const result = sanitiseInput(input);
    expect(result.items[0].text).not.toContain('<img');
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
  test('should sanitise req.body and call next', () => {
    const req = { body: { name: '<script>xss</script>' } };
    const res = {};
    const next = jest.fn();

    sanitiseBody(req, res, next);

    expect(req.body.name).not.toContain('<script>');
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
