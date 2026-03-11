/**
 * AI Keyword Extraction Service - Google Gemini
 * Alternative to Hugging Face for comparison study
 *
 * Setup: Get free API key from https://aistudio.google.com/
 * Add to .env: GEMINI_API_KEY=your-key-here
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

/**
 * Extract keywords using Google Gemini API
 * @param {string} text - Combined text from messages
 * @param {number} maxKeywords - Maximum number of keywords to return
 * @returns {Promise<Array>} Array of {word, count} objects
 */
async function extractKeywordsGemini(text, maxKeywords = 15) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || !text || text.trim().length < 50) {
    console.log('Gemini Keywords: API key not configured or text too short');
    return [];
  }

  try {
    console.log('Gemini Keywords: Calling Google Gemini API...');
    const startTime = Date.now();

    const prompt = `Extract the ${maxKeywords} most important academic/technical keywords or keyphrases from this lecture chat discussion.

Rules:
- Return ONLY meaningful academic terms (e.g., "neural networks", "authentication", "recursion")
- Do NOT include filler words like "thanks", "good", "interesting", "understand", "question"
- Do NOT include common words like "lecture", "class", "slide", "example"
- Return as JSON array of strings, nothing else

Text:
${text.substring(0, 3000)}

Response format: ["keyword1", "keyword2", "keyword3"]`;

    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 200
        }
      })
    });

    const latency = Date.now() - startTime;

    if (!response.ok) {
      const error = await response.text();
      console.error('Gemini Keywords Error:', error);
      return [];
    }

    const data = await response.json();
    const resultText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

    // Parse JSON array from response
    const jsonMatch = resultText.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      console.log('Gemini Keywords: Could not parse response');
      return [];
    }

    const keywords = JSON.parse(jsonMatch[0]);
    console.log(`Gemini Keywords: Extracted ${keywords.length} keywords in ${latency}ms`);

    // Return with count of 1 (Gemini returns unique keywords, not counts)
    return keywords.slice(0, maxKeywords).map(word => ({
      word: word.toLowerCase().trim(),
      count: 1
    }));

  } catch (error) {
    console.error('Gemini Keywords Error:', error.message);
    return [];
  }
}

/**
 * Check if Gemini service is available
 * @returns {boolean}
 */
function isAvailable() {
  return !!process.env.GEMINI_API_KEY;
}

module.exports = {
  extractKeywordsGemini,
  isAvailable
};
