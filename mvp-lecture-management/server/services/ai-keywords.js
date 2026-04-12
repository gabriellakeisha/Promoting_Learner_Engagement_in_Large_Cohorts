// ai keyword extraction - uses hugging face keyphrase model
// Falls back to RAKE algorithm if the API is not available

const { HfInference } = require('@huggingface/inference');
const keywordExtractor = require('keyword-extractor');

// Initialize client (will be null if no API key)
let hf = null;
if (process.env.HUGGINGFACE_API_KEY) {
  hf = new HfInference(process.env.HUGGINGFACE_API_KEY);
}

// Model for keyphrase extraction - trained on scientific/academic text
const KEYPHRASE_MODEL = 'ml6team/keyphrase-extraction-kbir-inspec';

// Fallback stopwords for RAKE method
const fallbackStopWords = new Set([
  'thanks', 'thank', 'good', 'great', 'nice', 'really', 'agree', 'agreed', 'interesting',
  'helpful', 'cool', 'wow', 'lol', 'haha', 'sure', 'right', 'well', 'bit', 'much', 'even',
  'still', 'lot', 'something', 'anything', 'everything', 'thing', 'things', 'now', 'going',
  'please', 'sorry', 'hello', 'hey', 'anyone', 'someone', 'everyone', 'nobody',
  'gonna', 'wanna', 'gotta', 'kinda', 'sorta', 'yeah', 'yep', 'okay', 'found', 'similar',
  'lecture', 'lectures', 'lecturer', 'class', 'session', 'slide', 'slides', 'example',
  'question', 'questions', 'answer', 'answers', 'topic', 'topics', 'material', 'content',
  'textbook', 'book', 'chapter', 'page', 'section', 'note', 'notes', 'explanation',
  'clearer', 'clear', 'understand', 'understanding', 'understood', 'learn', 'learning',
  'learned', 'study', 'studying', 'studied', 'help', 'helped', 'connection', 'previous',
  'comment', 'comments', 'testing', 'test', 'exam', 'way', 'see', 'get', 'got', 'also',
  'like', 'know', 'think', 'dont', 'cant', 'wont', 'just', 'back', 'come', 'take', 'give',
  'want', 'wanted', 'make', 'made', 'say', 'said', 'feel', 'feels', 'look', 'looks',
  'try', 'tried', 'use', 'using', 'work', 'works', 'point', 'points', 'part',
  'actually', 'basically', 'literally', 'definitely', 'probably', 'maybe', 'perhaps',
  'one', 'two', 'first', 'second', 'last', 'next', 'new', 'confused', 'clarification', 'clarify',
  'lost', 'finally', 'big', 'considered', 'clicks', 'small', 'different', 'important', 'need',
  'show', 'showing', 'start', 'started', 'end', 'ended', 'run', 'running', 'check', 'checking',
  'real', 'world', 'today', 'week', 'time', 'times', 'ago', 'already', 'yet', 'done',
  'called', 'means', 'mean', 'makes', 'sense', 'true', 'false', 'goes', 'went',
  'peer', 'review', 'group', 'project', 'assignment', 'coursework', 'deadline', 'canvas',
  'recommended', 'reading', 'list', 'coverage', 'room', 'moved', 'break', 'minutes'
]);

// extract keywords using hugging face model
// returns array of {word, count} objects
async function extractKeywordsAI(text, maxKeywords = 15) {
  if (!hf || !text || text.trim().length < 50) {
    return extractKeywordsFallback(text, maxKeywords);
  }

  try {
    console.log('AI Keywords: Calling Hugging Face API...');

    // Truncate text to model limit
    const truncatedText = text.substring(0, 3000);

    // Call token classification for keyphrase extraction
    const result = await hf.tokenClassification({
      model: KEYPHRASE_MODEL,
      inputs: truncatedText
    });

    if (!result || result.length === 0) {
      console.log('AI Keywords: No results from API, using fallback');
      return extractKeywordsFallback(text, maxKeywords);
    }

    console.log('AI Keywords: Received', result.length, 'keyphrases from API');

    // API returns complete keyphrases directly in the 'word' field
    // Count occurrences and filter
    const counts = {};
    result.forEach(item => {
      if (item.entity_group === 'KEY' && item.word) {
        const cleaned = item.word.toLowerCase().trim();
        if (cleaned.length > 2 && !fallbackStopWords.has(cleaned)) {
          counts[cleaned] = (counts[cleaned] || 0) + 1;
        }
      }
    });

    // Sort by count and return top keywords
    const keywords = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, maxKeywords)
      .map(([word, count]) => ({ word, count }));

    if (keywords.length > 0) {
      console.log('AI Keywords: Extracted', keywords.length, 'unique keywords');
      return keywords;
    }

    // If AI returned nothing useful, fallback
    return extractKeywordsFallback(text, maxKeywords);

  } catch (error) {
    console.error('AI Keywords Error:', error.message);
    return extractKeywordsFallback(text, maxKeywords);
  }
}

// Fallback keyword extraction using RAKE algorithm (no API dependency)
function extractKeywordsFallback(text, maxKeywords = 15) {
  if (!text || text.trim().length === 0) {
    return [];
  }

  console.log('AI Keywords: Using RAKE fallback');

  const extracted = keywordExtractor.extract(text, {
    language: 'english',
    remove_digits: true,
    return_changed_case: true,
    remove_duplicates: false
  });

  const counts = {};
  extracted.forEach(word => {
    if (word.length > 2 && !fallbackStopWords.has(word)) {
      counts[word] = (counts[word] || 0) + 1;
    }
  });

  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, maxKeywords)
    .map(([word, count]) => ({ word, count }));
}

// Check if the Hugging Face API key is configured
function isAvailable() {
  return hf !== null;
}

module.exports = {
  extractKeywordsAI,
  extractKeywordsFallback,
  isAvailable
};
