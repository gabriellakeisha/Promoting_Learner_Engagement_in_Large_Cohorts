/**
 * AI Summary Service
 * Uses Hugging Face Inference API for text summarization
 * Fallback to null if API unavailable (caller handles gracefully)
 */

const { HfInference } = require('@huggingface/inference');

// Initialize client (will be null if no API key)
let hf = null;
if (process.env.HUGGINGFACE_API_KEY) {
  hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
}

// Model for summarization - DistilBART is fast and good quality
const SUMMARIZATION_MODEL = 'sshleifer/distilbart-cnn-12-6';

/**
 * Generate AI summary from session messages
 * @param {Array} messages - Array of message objects with text property
 * @param {Object} context - Session context (title, stats)
 * @returns {Promise<string|null>} AI-generated summary or null if unavailable
 */
async function generateAISummary(messages, context) {
  // Check if API is configured
  if (!hf) {
    console.log('AI Summary: Hugging Face API key not configured, skipping AI summary');
    return null;
  }

  if (!messages || messages.length === 0) {
    return null;
  }

  try {
    // Prepare text for summarization
    // Only send message content (no usernames for privacy)
    const messageTexts = messages
      .filter(m => m.text && m.text.trim().length > 0)
      .map(m => {
        const typeLabel = m.type === 'QUESTION' ? '[Q]' :
                         m.type === 'CONFUSION' ? '[C]' : '';
        return `${typeLabel} ${m.text.trim()}`;
      })
      .join(' ');

    // Check if we have enough content to summarize
    if (messageTexts.length < 100) {
      console.log('AI Summary: Not enough content to summarize');
      return null;
    }

    // Prepare context prompt
    const inputText = `Session: ${context.title}. ` +
      `${context.totalMessages} messages from ${context.uniqueContributors} students. ` +
      `Discussion: ${messageTexts}`;

    // Truncate to model limit (1024 tokens ~= 4000 chars for safety)
    const truncatedInput = inputText.substring(0, 4000);

    console.log('AI Summary: Calling Hugging Face API...');

    // Call Hugging Face API
    const result = await hf.summarization({
      model: SUMMARIZATION_MODEL,
      inputs: truncatedInput,
      parameters: {
        max_length: 150,
        min_length: 40,
        do_sample: false
      }
    });

    if (result && result.summary_text) {
      console.log('AI Summary: Generated successfully');
      return result.summary_text;
    }

    return null;
  } catch (error) {
    console.error('AI Summary Error:', error.message);
    // Don't throw - allow graceful fallback
    return null;
  }
}

/**
 * Check if AI summary service is available
 * @returns {boolean}
 */
function isAvailable() {
  return hf !== null;
}

module.exports = {
  generateAISummary,
  isAvailable
};
