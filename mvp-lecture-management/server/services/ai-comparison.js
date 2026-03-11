/**
 * AI Comparison Service
 * Compares keyword extraction quality between different AI providers
 * For dissertation study: Hugging Face vs Gemini vs RAKE baseline
 */

const aiKeywordsHF = require('./ai-keywords');
const aiKeywordsGemini = require('./ai-keywords-gemini');

/**
 * Run comparison study between AI providers
 * @param {string} text - Text to extract keywords from
 * @param {number} maxKeywords - Maximum keywords per provider
 * @returns {Promise<Object>} Comparison results with metrics
 */
async function runComparison(text, maxKeywords = 10) {
  const results = {
    timestamp: new Date().toISOString(),
    textLength: text.length,
    providers: {}
  };

  // 1. Hugging Face (KBIR-Inspec model)
  if (aiKeywordsHF.isAvailable()) {
    const startHF = Date.now();
    try {
      const hfKeywords = await aiKeywordsHF.extractKeywordsAI(text, maxKeywords);
      results.providers.huggingface = {
        available: true,
        latency: Date.now() - startHF,
        keywords: hfKeywords,
        model: 'ml6team/keyphrase-extraction-kbir-inspec',
        type: 'Token Classification (BERT-based)'
      };
    } catch (error) {
      results.providers.huggingface = {
        available: true,
        error: error.message,
        latency: Date.now() - startHF
      };
    }
  } else {
    results.providers.huggingface = { available: false, reason: 'HUGGINGFACE_API_KEY not configured' };
  }

  // 2. Google Gemini
  if (aiKeywordsGemini.isAvailable()) {
    const startGemini = Date.now();
    try {
      const geminiKeywords = await aiKeywordsGemini.extractKeywordsGemini(text, maxKeywords);
      results.providers.gemini = {
        available: true,
        latency: Date.now() - startGemini,
        keywords: geminiKeywords,
        model: 'gemini-1.5-flash',
        type: 'Large Language Model (Prompt-based)'
      };
    } catch (error) {
      results.providers.gemini = {
        available: true,
        error: error.message,
        latency: Date.now() - startGemini
      };
    }
  } else {
    results.providers.gemini = { available: false, reason: 'GEMINI_API_KEY not configured' };
  }

  // 3. RAKE Baseline (local, no API)
  const startRAKE = Date.now();
  try {
    const rakeKeywords = aiKeywordsHF.extractKeywordsFallback(text, maxKeywords);
    results.providers.rake = {
      available: true,
      latency: Date.now() - startRAKE,
      keywords: rakeKeywords,
      model: 'keyword-extractor (RAKE algorithm)',
      type: 'Rule-based (Local processing)'
    };
  } catch (error) {
    results.providers.rake = {
      available: true,
      error: error.message,
      latency: Date.now() - startRAKE
    };
  }

  // Calculate comparison metrics
  results.analysis = analyzeResults(results.providers);

  return results;
}

/**
 * Analyze comparison results
 * @param {Object} providers - Results from each provider
 * @returns {Object} Analysis metrics
 */
function analyzeResults(providers) {
  const analysis = {
    latencyComparison: {},
    keywordOverlap: {},
    recommendations: []
  };

  // Latency comparison
  for (const [name, data] of Object.entries(providers)) {
    if (data.latency) {
      analysis.latencyComparison[name] = data.latency + 'ms';
    }
  }

  // Find fastest provider
  const latencies = Object.entries(providers)
    .filter(([_, d]) => d.latency)
    .map(([name, d]) => ({ name, latency: d.latency }));

  if (latencies.length > 0) {
    const fastest = latencies.reduce((a, b) => a.latency < b.latency ? a : b);
    analysis.fastestProvider = fastest.name;
  }

  // Keyword overlap analysis
  const allKeywordSets = {};
  for (const [name, data] of Object.entries(providers)) {
    if (data.keywords && Array.isArray(data.keywords)) {
      allKeywordSets[name] = new Set(data.keywords.map(k => k.word.toLowerCase()));
    }
  }

  // Calculate pairwise overlap
  const providerNames = Object.keys(allKeywordSets);
  for (let i = 0; i < providerNames.length; i++) {
    for (let j = i + 1; j < providerNames.length; j++) {
      const p1 = providerNames[i];
      const p2 = providerNames[j];
      const set1 = allKeywordSets[p1];
      const set2 = allKeywordSets[p2];

      if (set1 && set2) {
        const intersection = new Set([...set1].filter(x => set2.has(x)));
        const union = new Set([...set1, ...set2]);
        const jaccardSimilarity = intersection.size / union.size;

        analysis.keywordOverlap[`${p1}_vs_${p2}`] = {
          sharedKeywords: Array.from(intersection),
          similarity: (jaccardSimilarity * 100).toFixed(1) + '%'
        };
      }
    }
  }

  // Generate recommendations
  if (providers.huggingface?.keywords?.length > 0) {
    analysis.recommendations.push('Hugging Face: Best for academic text (model trained on scientific abstracts)');
  }
  if (providers.gemini?.keywords?.length > 0) {
    analysis.recommendations.push('Gemini: Good for general text, prompt-based approach allows customization');
  }
  if (providers.rake?.latency < 50) {
    analysis.recommendations.push('RAKE: Best for offline/low-latency requirements (no API dependency)');
  }

  return analysis;
}

/**
 * Generate comparison report for dissertation
 * @param {Array} sessionIds - Session IDs to analyze
 * @returns {Promise<Object>} Full comparison report
 */
async function generateDissertationReport(sessions) {
  const report = {
    title: 'AI Keyword Extraction Comparison Study',
    generatedAt: new Date().toISOString(),
    methodology: {
      providers: ['Hugging Face KBIR-Inspec', 'Google Gemini 1.5 Flash', 'RAKE Algorithm'],
      metrics: ['Latency', 'Keyword Relevance', 'Keyword Overlap', 'Availability'],
      sampleSize: sessions.length
    },
    results: [],
    summary: {}
  };

  // Run comparison for each session
  for (const session of sessions) {
    const comparison = await runComparison(session.text, 10);
    report.results.push({
      sessionId: session.id,
      messageCount: session.messageCount,
      comparison
    });
  }

  // Aggregate summary
  const avgLatencies = { huggingface: [], gemini: [], rake: [] };
  for (const result of report.results) {
    for (const [provider, data] of Object.entries(result.comparison.providers)) {
      if (data.latency && avgLatencies[provider]) {
        avgLatencies[provider].push(data.latency);
      }
    }
  }

  report.summary.averageLatency = {};
  for (const [provider, latencies] of Object.entries(avgLatencies)) {
    if (latencies.length > 0) {
      report.summary.averageLatency[provider] =
        Math.round(latencies.reduce((a, b) => a + b, 0) / latencies.length) + 'ms';
    }
  }

  return report;
}

module.exports = {
  runComparison,
  generateDissertationReport
};
