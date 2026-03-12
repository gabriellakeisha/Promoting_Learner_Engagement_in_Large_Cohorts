// tests for ai services - keyword extraction fallback and comparison logic

const { extractKeywordsFallback } = require('../server/services/ai-keywords');

describe('extractKeywordsFallback (RAKE)', () => {
  test('should extract keywords from text', () => {
    const text = 'neural networks use backpropagation for training deep learning models. ' +
      'convolutional neural networks are used for image recognition. ' +
      'recurrent neural networks handle sequential data processing.';

    const result = extractKeywordsFallback(text, 10);

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(result.length).toBeLessThanOrEqual(10);

    // each item should have word and count
    result.forEach(item => {
      expect(item).toHaveProperty('word');
      expect(item).toHaveProperty('count');
      expect(typeof item.word).toBe('string');
      expect(typeof item.count).toBe('number');
    });
  });

  test('should return empty array for empty text', () => {
    expect(extractKeywordsFallback('', 10)).toEqual([]);
    expect(extractKeywordsFallback(null, 10)).toEqual([]);
  });

  test('should respect maxKeywords limit', () => {
    const text = 'authentication authorization encryption hashing tokens ' +
      'certificates passwords sessions cookies headers middleware ' +
      'validation sanitisation firewall proxy server security';

    const result = extractKeywordsFallback(text, 3);
    expect(result.length).toBeLessThanOrEqual(3);
  });

  test('should filter out common stopwords', () => {
    const text = 'thanks for the great lecture, really interesting topic, ' +
      'good explanation of databases and normalization';

    const result = extractKeywordsFallback(text, 10);
    const words = result.map(r => r.word);

    // these should be filtered out by our custom stopwords
    expect(words).not.toContain('thanks');
    expect(words).not.toContain('great');
    expect(words).not.toContain('interesting');
  });

  test('should sort results by count (descending)', () => {
    const text = 'database database database query query index ' +
      'database normalization query performance optimization';

    const result = extractKeywordsFallback(text, 10);

    // should be sorted highest count first
    for (let i = 1; i < result.length; i++) {
      expect(result[i - 1].count).toBeGreaterThanOrEqual(result[i].count);
    }
  });
});

// test the comparison analysis logic
describe('ai-comparison analyzeResults', () => {
  const { runComparison } = require('../server/services/ai-comparison');

  test('should return results with expected structure', async () => {
    const text = 'neural networks use backpropagation for training models. ' +
      'deep learning algorithms process data through multiple layers. ' +
      'convolutional networks are good for image recognition tasks.';

    const result = await runComparison(text, 5);

    expect(result).toHaveProperty('timestamp');
    expect(result).toHaveProperty('textLength');
    expect(result).toHaveProperty('providers');
    expect(result).toHaveProperty('analysis');

    // RAKE should always work (no api needed)
    expect(result.providers.rake).toBeDefined();
    expect(result.providers.rake.available).toBe(true);
    expect(result.providers.rake.keywords).toBeDefined();
  });

  test('should report unavailable providers when no api keys', async () => {
    const text = 'some test text for keyword extraction testing purposes';
    const result = await runComparison(text, 5);

    // without env vars, huggingface should be unavailable
    if (!process.env.HUGGINGFACE_API_KEY) {
      expect(result.providers.huggingface.available).toBe(false);
    }
  });

  test('should include analysis with latency and overlap data', async () => {
    const text = 'machine learning classification regression clustering ' +
      'supervised unsupervised reinforcement neural networks deep learning';

    const result = await runComparison(text, 5);

    expect(result.analysis).toHaveProperty('latencyComparison');
    expect(result.analysis).toHaveProperty('keywordOverlap');
    expect(result.analysis).toHaveProperty('recommendations');
  });
});
