import { pipeline, env } from '@xenova/transformers';
import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure transformers for GitHub Actions
env.allowRemoteFiles = true;
env.allowLocalFiles = true;
env.cacheDir = path.join(__dirname, '../.cache');

// Suppress ONNX runtime warnings - more aggressive approach
process.env.ORT_LOG_LEVEL = '3'; // Only show errors
process.env.ONNX_DISABLE_WARNINGS = '1';
process.env.ONNXRUNTIME_LOG_LEVEL = '3'; // ERROR level only
process.env.OMP_NUM_THREADS = '1'; // Reduce threading warnings
process.env.ONNX_LOGGING_LEVEL = '3'; // ERROR level
process.env.ONNXRUNTIME_LOG_SEVERITY_LEVEL = '3'; // ERROR level

// Suppress Node.js warnings
process.removeAllListeners('warning');
process.on('warning', () => {}); // Suppress warnings

// Suppress specific console warnings from ONNX runtime
const originalConsoleWarn = console.warn;
console.warn = function(...args) {
  const message = args.join(' ');
  // Skip ONNX runtime warnings about removing unused initializers
  if (message.includes('CleanUnusedInitializersAndNodeArgs') || 
      message.includes('Removing initializer') ||
      message.includes('onnxruntime') ||
      message.includes('should be removed from the model') ||
      message.includes('[W:onnxruntime')) {
    return;
  }
  originalConsoleWarn.apply(console, args);
};

// Also suppress stderr warnings from child processes
const originalStderrWrite = process.stderr.write;
process.stderr.write = function(chunk, encoding, fd) {
  if (typeof chunk === 'string' && 
      (chunk.includes('CleanUnusedInitializersAndNodeArgs') ||
       chunk.includes('Removing initializer') ||
       chunk.includes('onnxruntime') ||
       chunk.includes('should be removed from the model') ||
       chunk.includes('[W:onnxruntime'))) {
    return;
  }
  return originalStderrWrite.call(process.stderr, chunk, encoding, fd);
};

// Categories for classification
const categories = [
  'model-release',
  'research-paper', 
  'developer-tool',
  'product-launch',
  'tutorial-guide',
  'industry-news',
  'ai-agents',
  'creative-ai',
  'infrastructure',
  'safety-ethics'
];

let classifier, summarizer, ner;

// Initialize pipelines with working models only
async function initializeModels() {
  try {
    console.log('Loading classifier...');
    classifier = await pipeline('zero-shot-classification', 'Xenova/distilbert-base-uncased-mnli', {
      cache_dir: env.cacheDir,
      quantized: true
    });
    console.log('✓ Classifier loaded');

    console.log('Loading summarizer...');
    summarizer = await pipeline('summarization', 'Xenova/distilbart-cnn-6-6', {
      cache_dir: env.cacheDir,
      quantized: true
    });
    console.log('✓ Summarizer loaded');

    console.log('Loading NER...');
    ner = await pipeline('ner', 'Xenova/bert-base-NER', {
      cache_dir: env.cacheDir,
      quantized: true
    });
    console.log('✓ NER loaded');

    return true;
  } catch (error) {
    console.log('❌ Failed to load models:', error.message);
    console.log('🔄 Using rule-based processing...');
    return false;
  }
}

// Rule-based category classification as fallback
function classifyCategory(title, source) {
  const titleLower = title.toLowerCase();
  const sourceLower = source.toLowerCase();
  
  // Model releases
  if (titleLower.match(/\b(gpt-\d+|claude|gemini|llama|mistral|release|model)\b/) ||
      sourceLower.includes('openai') || sourceLower.includes('anthropic')) {
    return { category: 'model-release', confidence: 0.85 };
  }
  
  // Research papers
  if (titleLower.match(/\b(paper|arxiv|research|study|analysis)\b/) ||
      sourceLower.includes('arxiv')) {
    return { category: 'research-paper', confidence: 0.9 };
  }
  
  // Developer tools
  if (titleLower.match(/\b(api|sdk|framework|tool|library|code|programming)\b/) ||
      sourceLower.includes('hugging')) {
    return { category: 'developer-tool', confidence: 0.8 };
  }
  
  // AI Agents
  if (titleLower.match(/\b(agent|workflow|automation|autonomous)\b/)) {
    return { category: 'ai-agents', confidence: 0.85 };
  }
  
  // Tutorials
  if (titleLower.match(/\b(tutorial|guide|how to|step by step|learn)\b/) ||
      sourceLower.includes('data science') || sourceLower.includes('mastery')) {
    return { category: 'tutorial-guide', confidence: 0.8 };
  }
  
  // Creative AI
  if (titleLower.match(/\b(image|video|audio|creative|art|generate)\b/)) {
    return { category: 'creative-ai', confidence: 0.75 };
  }
  
  // Default to industry news
  return { category: 'industry-news', confidence: 0.6 };
}

// Extract entities using simple regex patterns
function extractEntities(title) {
  const entities = [];
  
  // Companies/Organizations
  const companies = ['OpenAI', 'Anthropic', 'Google', 'Meta', 'Microsoft', 'NVIDIA', 'Apple', 'Amazon', 'Tesla', 'Hugging Face', 'LangChain', 'Pinecone', 'Weights & Biases', 'DeepMind', 'Stability AI', 'Midjourney', 'RunwayML'];
  companies.forEach(company => {
    if (title.toLowerCase().includes(company.toLowerCase())) {
      entities.push({ text: company, label: 'ORG' });
    }
  });
  
  // AI Models/Products
  const models = ['GPT-4', 'GPT-5', 'Claude', 'Gemini', 'LLaMA', 'Llama', 'ChatGPT', 'DALL-E', 'Midjourney', 'Stable Diffusion', 'BERT', 'Transformer'];
  models.forEach(model => {
    if (title.toLowerCase().includes(model.toLowerCase())) {
      entities.push({ text: model, label: 'PRODUCT' });
    }
  });
  
  // Technologies
  const technologies = ['AI', 'ML', 'NLP', 'Computer Vision', 'Deep Learning', 'Machine Learning', 'Neural Network', 'Transformer', 'LLM', 'API', 'SDK'];
  technologies.forEach(tech => {
    if (title.toLowerCase().includes(tech.toLowerCase())) {
      entities.push({ text: tech, label: 'TECH' });
    }
  });
  
  return entities;
}

// Calculate difficulty based on technical terms
function calculateDifficulty(title, entities) {
  const technicalTerms = ['transformer', 'neural', 'deep learning', 'api', 'sdk', 'algorithm', 'model', 'training', 'inference'];
  const researchTerms = ['paper', 'study', 'research', 'analysis', 'arxiv'];
  const advancedTerms = ['rlhf', 'fine-tuning', 'quantization', 'distillation', 'embedding'];
  
  let difficulty = 3; // Base difficulty
  
  const titleLower = title.toLowerCase();
  
  // Increase for technical terms
  technicalTerms.forEach(term => {
    if (titleLower.includes(term)) difficulty += 1;
  });
  
  // Increase for research terms
  researchTerms.forEach(term => {
    if (titleLower.includes(term)) difficulty += 2;
  });
  
  // Increase for advanced terms
  advancedTerms.forEach(term => {
    if (titleLower.includes(term)) difficulty += 3;
  });
  
  // Increase based on entities
  difficulty += entities.length * 0.5;
  
  return Math.min(Math.max(Math.round(difficulty), 1), 10);
}

// Generate summary
async function generateSummary(title, metaDescription, source, useAI = false) {
  // Check if metaDescription is meaningful (not just Reddit boilerplate)
  const isRedditBoilerplate = metaDescription && (
    metaDescription.includes('submitted by') && metaDescription.includes('[link]') ||
    metaDescription.trim().length < 30 ||
    metaDescription.includes('https://preview.redd.it') ||
    metaDescription.match(/^https?:\/\//)
  );
  
  // Use meaningful metaDescription for summarization, skip Reddit boilerplate
  const contentToSummarize = metaDescription && metaDescription.trim() && !isRedditBoilerplate && metaDescription.length > 50 
    ? metaDescription.trim() 
    : null;
  
  // For Reddit posts without meaningful content, create topic-based summary from title
  if (!contentToSummarize && source && source.includes('reddit')) {
    return createTopicBasedSummary(title);
  }
  
  if (!useAI || !summarizer || !contentToSummarize) {
    // Rule-based summary with meaningful content
    if (contentToSummarize) {
      const cleaned = contentToSummarize.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      return cleaned.length > 120 ? cleaned.substring(0, 120) + '...' : cleaned;
    }
    return createTopicBasedSummary(title);
  }
  
  try {
    const summary = await summarizer(contentToSummarize, {
      max_length: 60,
      min_length: 25
    });
    return summary[0].summary_text;
  } catch (error) {
    // Fallback to rule-based summary on error
    if (contentToSummarize) {
      const cleaned = contentToSummarize.replace(/\n/g, ' ').replace(/\s+/g, ' ').trim();
      return cleaned.length > 120 ? cleaned.substring(0, 120) + '...' : cleaned;
    }
    return createTopicBasedSummary(title);
  }
}

// Create a topic-based summary from title for Reddit posts
function createTopicBasedSummary(title) {
  const titleLower = title.toLowerCase();
  
  // Model/Tool mentions
  if (titleLower.match(/\b(gpt|chatgpt|claude|gemini|llama|mistral|ollama|lmstudio)\b/)) {
    return `Discussion about AI models and tools mentioned in the title.`;
  }
  
  // Technical questions
  if (titleLower.match(/\b(how to|help|issue|error|problem|question|which|best|recommend)\b/)) {
    return `Community discussion seeking help or recommendations on AI-related topics.`;
  }
  
  // Model releases
  if (titleLower.match(/\b(release|releasing|available|launched|new|update)\b/)) {
    return `Announcement or discussion about new AI model releases and updates.`;
  }
  
  // Creative/Image generation
  if (titleLower.match(/\b(image|generate|create|art|stable diffusion|midjourney)\b/)) {
    return `Discussion about AI-powered creative content generation and tools.`;
  }
  
  // Research/Papers
  if (titleLower.match(/\b(paper|research|study|arxiv|analysis)\b/)) {
    return `Discussion of AI research findings and academic papers.`;
  }
  
  // Default based on source
  return `Community discussion about AI developments and related topics.`;
}

// Main processing function
async function processArticlesWithAI() {
  console.log('🤖 Starting article processing...');
  
  // Load raw articles
  const rawDataPath = path.join(__dirname, '../data/latest-raw.json');
  const rawData = JSON.parse(await fs.readFile(rawDataPath, 'utf-8'));
  
  // Load existing processed articles to avoid reprocessing
  const processedDataPath = path.join(__dirname, '../data/latest-processed.json');
  let existingProcessed = { articles: [] };
  
  try {
    const existingData = await fs.readFile(processedDataPath, 'utf-8');
    existingProcessed = JSON.parse(existingData);
    console.log(`📋 Found ${existingProcessed.articles.length} already processed articles`);
  } catch (error) {
    console.log('📋 No existing processed data found, processing all articles');
  }
  
  // Load rejected articles cache to avoid reprocessing low-confidence articles
  const rejectedDataPath = path.join(__dirname, '../data/rejected-articles.json');
  let rejectedArticles = { articles: [] };
  
  try {
    const rejectedData = await fs.readFile(rejectedDataPath, 'utf-8');
    rejectedArticles = JSON.parse(rejectedData);
    console.log(`🚫 Found ${rejectedArticles.articles.length} previously rejected articles`);
  } catch (error) {
    console.log('🚫 No rejected articles cache found, starting fresh');
  }
  
  // Create sets for quick lookup
  const processedIds = new Set(existingProcessed.articles.map(a => a.id));
  const rejectedIds = new Set(rejectedArticles.articles.map(a => a.id));
  
  // Filter out already processed AND rejected articles
  const articlesToProcess = rawData.articles.filter(article => 
    !processedIds.has(article.id) && !rejectedIds.has(article.id)
  );
  
  // Apply configurable processing limit for testing (via env var)
  const testLimit = process.env.PROCESSING_LIMIT ? parseInt(process.env.PROCESSING_LIMIT) : null;
  const finalArticlesToProcess = testLimit ? articlesToProcess.slice(0, testLimit) : articlesToProcess;
  
  console.log(`📊 Found ${rawData.articles.length} total articles, ${articlesToProcess.length} new articles to process`);
  if (rejectedArticles.articles.length > 0) {
    console.log(`⏭️ Skipping ${rejectedArticles.articles.length} previously rejected articles`);
  }
  if (testLimit && testLimit < articlesToProcess.length) {
    console.log(`🧪 TESTING MODE: Processing only first ${testLimit} articles (set PROCESSING_LIMIT=${testLimit})`);
  }
  
  if (finalArticlesToProcess.length === 0) {
    console.log('✅ All articles already processed! Updating metadata...');
    
    // Apply 15-day rolling cleanup to existing articles too
    const cleanupThresholdDays = 15;
    const cleanupThreshold = new Date(Date.now() - cleanupThresholdDays * 24 * 60 * 60 * 1000);
    
    const beforeCleanup = existingProcessed.articles.length;
    const recentArticles = existingProcessed.articles.filter(article => {
      const pubDate = new Date(article.pubDate || article.published_at);
      return pubDate > cleanupThreshold;
    });
    
    const cleanedUpCount = beforeCleanup - recentArticles.length;
    if (cleanedUpCount > 0) {
      console.log(`🧹 Cleaned up ${cleanedUpCount} articles older than ${cleanupThresholdDays} days from existing data`);
    }
    
    // Update the latest file with recent articles only (15-day rolling window)
    const latestData = {
      ...rawData,
      articles: recentArticles,
      processedAt: new Date().toISOString(),
      processingMethod: 'cached',
      totalArticles: recentArticles.length,
      cleanupApplied: cleanedUpCount > 0,
      cleanedUpCount: cleanedUpCount,
      rollingWindowDays: cleanupThresholdDays
    };
    
    // Create today's file with ONLY today's articles
    const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
    const todayStart = new Date(today + 'T00:00:00.000Z');
    const todayEnd = new Date(today + 'T23:59:59.999Z');
    
    // Filter articles that were published or processed today
    const todaysArticles = recentArticles.filter(article => {
      const pubDate = new Date(article.pubDate || article.published_at);
      const processedDate = new Date(article.processed_at || article.crawledAt);
      
      // Include articles published today OR processed today
      return (pubDate >= todayStart && pubDate <= todayEnd) || 
             (processedDate >= todayStart && processedDate <= todayEnd);
    });
    
    const dailyData = {
      ...rawData,
      articles: todaysArticles,
      processedAt: new Date().toISOString(),
      processingMethod: 'cached',
      totalArticles: todaysArticles.length,
      dailyArticlesCount: todaysArticles.length,
      filterDate: today
    };
    
    // Save files
    const latestPath = path.join(__dirname, '../data/latest-processed.json');
    const datePath = path.join(__dirname, `../data/${today}-processed.json`);
    
    await fs.writeFile(latestPath, JSON.stringify(latestData, null, 2));
    await fs.writeFile(datePath, JSON.stringify(dailyData, null, 2));
    
    console.log(`💾 Updated: ${latestPath} (${recentArticles.length} articles in 15-day rolling window)`);
    console.log(`📅 Historical backup: ${datePath} (${todaysArticles.length} today's articles)`);
    console.log('🎉 Processing completed (no new articles)!');
    return latestData;
  }
  
  // Initialize AI models only if we have articles to process
  const useAI = await initializeModels();
  
  console.log(`🧠 Processing ${finalArticlesToProcess.length} new articles with ${useAI ? 'AI' : 'rule-based'} analysis...`);
  
  const newlyProcessedArticles = [];
  const newlyRejectedArticles = [];
  const categoryStats = {};
  let duplicateCount = 0;
  let rejectedLowConfidence = 0;
  
  for (let i = 0; i < finalArticlesToProcess.length; i++) {
    const article = finalArticlesToProcess[i];
    console.log(`Processing ${i+1}/${finalArticlesToProcess.length}: ${article.title.substring(0, 50)}...`);
    
    let result;
    
    if (useAI && classifier) {
      try {
        // AI-powered classification
        const classification = await classifier(article.title, categories);
        const topLabel = classification.labels[0];
        const confidence = classification.scores[0];
        
        result = {
          category: topLabel,
          confidence: confidence
        };
      } catch (error) {
        // Fallback to rule-based
        result = classifyCategory(article.title, article.source);
      }
    } else {
      // Rule-based classification
      result = classifyCategory(article.title, article.source);
    }
    
    // Extract entities
    let entities = [];
    if (useAI && ner) {
      try {
        const nerResults = await ner(article.title);
        entities = nerResults.filter(entity => entity.score > 0.8);
      } catch (error) {
        entities = extractEntities(article.title);
      }
    } else {
      entities = extractEntities(article.title);
    }
    
    // Calculate difficulty
    const difficulty = calculateDifficulty(article.title, entities);
    
    // Generate summary
    const summary = await generateSummary(article.title, article.metaDescription, article.source, useAI);
    
    // Apply confidence threshold filter - reject articles below threshold (configurable via PROCESS_CONFIDENCE_THRESHOLD env var)
    const confidenceThreshold = parseFloat(process.env.PROCESS_CONFIDENCE_THRESHOLD || '0.25');
    if (result.confidence < confidenceThreshold) {
      console.log(`❌ Rejected low confidence (${(result.confidence * 100).toFixed(1)}%): ${article.title.substring(0, 60)}...`);
      
      // Save rejected article to cache to avoid reprocessing
      const rejectedArticle = {
        ...article,
        rejectedReason: 'low_confidence',
        confidence: result.confidence,
        confidenceThreshold: confidenceThreshold,
        rejected_at: new Date().toISOString()
      };
      
      newlyRejectedArticles.push(rejectedArticle);
      rejectedLowConfidence++;
      continue; // Skip this article
    }
    
    // Create processed article
    const processedArticle = {
      ...article,
      category: result.category,
      confidence: result.confidence,
      difficulty: difficulty,
      entities: entities,
      summary: summary,
      language: 'en', // Default to English since we removed language detection
      processed_at: new Date().toISOString()
    };
    
    newlyProcessedArticles.push(processedArticle);
    
    // Update stats
    categoryStats[result.category] = (categoryStats[result.category] || 0) + 1;
  }
  
  // Merge newly processed articles with existing ones
  const allProcessedArticles = [...existingProcessed.articles, ...newlyProcessedArticles];
  
  // Sort by publication date (newest first)
  allProcessedArticles.sort((a, b) => new Date(b.pubDate || b.published_at) - new Date(a.pubDate || a.published_at));
  
  // Apply 15-day rolling cleanup to latest-processed.json to maintain consistency
  const cleanupThresholdDays = 15;
  const cleanupThreshold = new Date(Date.now() - cleanupThresholdDays * 24 * 60 * 60 * 1000);
  
  const beforeCleanup = allProcessedArticles.length;
  const recentArticles = allProcessedArticles.filter(article => {
    const pubDate = new Date(article.pubDate || article.published_at);
    return pubDate > cleanupThreshold;
  });
  
  const cleanedUpCount = beforeCleanup - recentArticles.length;
  if (cleanedUpCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedUpCount} articles older than ${cleanupThresholdDays} days from latest-processed.json`);
  }
  
  // Create data for latest file (contains recent articles only - 15-day rolling window)
  const latestData = {
    ...rawData,
    articles: recentArticles,
    processedAt: new Date().toISOString(),
    totalArticles: recentArticles.length,
    categories: [...new Set(recentArticles.map(a => a.category))],
    processingMethod: useAI ? 'ai-powered' : 'rule-based',
    newArticlesProcessed: newlyProcessedArticles.length,
    existingArticlesKept: existingProcessed.articles.length,
    cleanupApplied: cleanedUpCount > 0,
    cleanedUpCount: cleanedUpCount,
    rollingWindowDays: cleanupThresholdDays
  };
  
  // Create data for daily file (contains ONLY today's articles)
  const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD format
  const todayStart = new Date(today + 'T00:00:00.000Z');
  const todayEnd = new Date(today + 'T23:59:59.999Z');
  
  // Filter articles that were published or processed today
  const todaysArticles = recentArticles.filter(article => {
    const pubDate = new Date(article.pubDate || article.published_at);
    const processedDate = new Date(article.processed_at || article.crawledAt);
    
    // Include articles published today OR processed today
    return (pubDate >= todayStart && pubDate <= todayEnd) || 
           (processedDate >= todayStart && processedDate <= todayEnd);
  });
  
  const dailyData = {
    ...rawData,
    articles: todaysArticles,
    processedAt: new Date().toISOString(),
    totalArticles: todaysArticles.length,
    categories: [...new Set(todaysArticles.map(a => a.category))],
    processingMethod: useAI ? 'ai-powered' : 'rule-based',
    newArticlesProcessed: newlyProcessedArticles.length,
    dailyArticlesCount: todaysArticles.length,
    filterDate: today
  };
  
  // Save files
  const latestPath = path.join(__dirname, '../data/latest-processed.json');
  const datePath = path.join(__dirname, `../data/${today}-processed.json`);
  
  // Save latest file (for current site build) - contains ALL articles
  await fs.writeFile(latestPath, JSON.stringify(latestData, null, 2));
  
  // Save date-specific file (for historical tracking) - contains ONLY today's articles
  await fs.writeFile(datePath, JSON.stringify(dailyData, null, 2));
  
  // Save updated rejected articles cache if we have new rejections
  if (newlyRejectedArticles.length > 0) {
    let allRejectedArticles = [...rejectedArticles.articles, ...newlyRejectedArticles];
    
    // Clean up old rejected articles (align with 15-day rolling archive) to prevent cache bloat
    const cleanupThresholdDays = parseInt(process.env.REJECTED_CACHE_CLEANUP_DAYS || '15');
    const cleanupThreshold = new Date(Date.now() - cleanupThresholdDays * 24 * 60 * 60 * 1000);
    const beforeCleanup = allRejectedArticles.length;
    
    allRejectedArticles = allRejectedArticles.filter(article => {
      const rejectedDate = new Date(article.rejected_at);
      return rejectedDate > cleanupThreshold;
    });
    
    const cleanedUp = beforeCleanup - allRejectedArticles.length;
    
    const rejectedOutputData = {
      articles: allRejectedArticles,
      updatedAt: new Date().toISOString(),
      totalRejected: allRejectedArticles.length,
      newlyRejected: newlyRejectedArticles.length,
      cleanupThresholdDays: cleanupThresholdDays,
      cleanedUpCount: cleanedUp
    };
    
    await fs.writeFile(rejectedDataPath, JSON.stringify(rejectedOutputData, null, 2));
    console.log(`🚫 Updated rejected articles cache: ${newlyRejectedArticles.length} new rejections, ${allRejectedArticles.length} total`);
    if (cleanedUp > 0) {
      console.log(`🧹 Cleaned up ${cleanedUp} rejected articles older than ${cleanupThresholdDays} days`);
    }
  }
  
  console.log(`✅ Successfully processed ${newlyProcessedArticles.length} new articles with ${useAI ? 'AI' : 'rule-based'} analysis`);
  console.log(`📊 Total articles in 15-day window: ${recentArticles.length} (${existingProcessed.articles.length} existing + ${newlyProcessedArticles.length} new)`);
  if (cleanedUpCount > 0) {
    console.log(`🧹 Cleaned up ${cleanedUpCount} articles older than ${cleanupThresholdDays} days`);
  }
  console.log(`🎯 New categories found:`, Object.keys(categoryStats).join(', ') || 'none');
  if (rejectedLowConfidence > 0) {
    const threshold = parseFloat(process.env.PROCESS_CONFIDENCE_THRESHOLD || '0.25');
    console.log(`🚫 Rejected ${rejectedLowConfidence} articles with confidence < ${(threshold * 100).toFixed(0)}%`);
  }
  console.log(`💾 Saved to: ${latestPath} (${recentArticles.length} articles in 15-day rolling window)`);
  console.log(`📅 Historical backup: ${datePath} (${todaysArticles.length} today's articles)`);
  console.log('🎉 AI processing completed successfully!');
  
  return latestData;
}

// Run if called directly
if (import.meta.url === `file://${__filename}`) {
  processArticlesWithAI().catch(console.error);
}

export default processArticlesWithAI; 