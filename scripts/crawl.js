import Parser from 'rss-parser';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { pipeline, env } from '@xenova/transformers';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configure transformers
env.allowRemoteFiles = true;
env.allowLocalFiles = true;
env.cacheDir = path.join(__dirname, '../.cache');

const parser = new Parser({
  timeout: 10000,
  maxRedirects: 3
});

let aiClassifier = null;

// Initialize AI classifier for intelligent filtering
async function initializeAIFilter() {
  try {
    console.log('🧠 Loading AI classifier for intelligent filtering...');
    aiClassifier = await pipeline('zero-shot-classification', 'Xenova/distilbert-base-uncased-mnli', {
      cache_dir: env.cacheDir,
      quantized: true
    });
    console.log('✅ AI classifier ready for content filtering');
    return true;
  } catch (error) {
    console.log('⚠️ AI classifier failed to load, falling back to keyword filtering:', error.message);
    return false;
  }
}

// AI-powered content relevance and quality check
async function isAIRelevantAI(title, description = '') {
  if (!aiClassifier) return null;
  
  try {
    const text = `${title} ${description}`.substring(0, 500); // Limit for performance
    
    // Define AI-related and non-AI categories for classification
    const categories = [
      'artificial intelligence and machine learning',
      'computer science and programming', 
      'mathematics and pure science',
      'sports and entertainment',
      'politics and current events'
    ];
    
    const result = await aiClassifier(text, categories);
    
    // Check if AI/CS categories score higher than non-AI categories
    const aiScore = result.scores[0] + result.scores[1]; // AI + CS
    const nonAiScore = result.scores[2] + result.scores[3] + result.scores[4]; // Math + Sports + Politics
    
    const isAIRelated = aiScore > nonAiScore && result.scores[0] > 0.3; // AI category should be reasonably confident
    
    // Apply 60% confidence threshold for quality filtering
    const meetsQualityThreshold = result.scores[0] >= 0.60;
    
    return {
      isRelevant: isAIRelated,
      confidence: result.scores[0],
      topCategory: result.labels[0],
      aiScore,
      nonAiScore,
      meetsQualityThreshold
    };
  } catch (error) {
    console.log('AI classification error:', error.message);
    return null;
  }
}

// Load sources
async function loadSources() {
  const sourcesPath = path.join(__dirname, '../sources.json');
  const sourcesData = await fs.readFile(sourcesPath, 'utf-8');
  const { 
    sources, 
    medium_blogs,
    reddit_sources, 
    youtube_channels, 
    newsletters, 
    developer_blogs,
    academic_sources,
    getting_started
  } = JSON.parse(sourcesData);
  
  return [
    ...sources,
    ...(medium_blogs || []),
    ...(reddit_sources || []),
    ...(youtube_channels || []),
    ...(newsletters || []),
    ...(developer_blogs || []),
    ...(academic_sources || []),
    ...(getting_started || [])
  ];
}

// Extract domain from URL
function extractDomain(url) {
  try {
    return new URL(url).hostname.replace('www.', '');
  } catch {
    return 'unknown';
  }
}

// Clean and normalize title
function cleanTitle(title) {
  return title
    .replace(/\[.*?\]/g, '') // Remove [tags]
    .replace(/\(.*?\)/g, '') // Remove (parentheses) 
    .replace(/\s+/g, ' ')    // Normalize whitespace
    .trim();
}

// Check if content is AI-related
function isAIRelated(item) {
  const text = `${item.title || ''} ${item.description || ''} ${item.content || ''}`.toLowerCase();
  
  // Exclude obviously non-AI mathematics/science content
  const excludeKeywords = [
    'fields medal', 'nobel prize', 'pure mathematics', 'number theory',
    'quantum physics', 'astrophysics', 'cosmology', 'particle physics',
    'climate change', 'global warming', 'biology', 'chemistry',
    'sports', 'football', 'basketball', 'soccer', 'tennis'
  ];
  
  const hasExcludeKeyword = excludeKeywords.some(keyword => text.includes(keyword));
  if (hasExcludeKeyword) {
    return false;
  }
  
  // AI-related keywords
  const aiKeywords = [
    'artificial intelligence', 'ai', 'machine learning', 'ml', 'deep learning',
    'neural network', 'transformer', 'gpt', 'llm', 'large language model',
    'chatbot', 'automation', 'algorithm', 'data science', 'computer vision',
    'natural language processing', 'nlp', 'robotics', 'autonomous',
    'generative', 'diffusion', 'stable diffusion', 'midjourney', 'dall-e',
    'openai', 'anthropic', 'claude', 'gemini', 'llama', 'mistral',
    'agent', 'agentic', 'rag', 'fine-tuning', 'prompt engineering',
    'embeddings', 'vector', 'classification', 'regression', 'clustering',
    'reinforcement learning', 'supervised learning', 'unsupervised learning'
  ];
  
  return aiKeywords.some(keyword => text.includes(keyword));
}

// Filter AI-relevant content
function isAIRelevant(title, source) {
  const aiKeywords = [
    // Core AI terms
    'ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning',
    'neural network', 'neural net', 'deep neural', 'artificial neural',
    
    // LLMs and models
    'llm', 'large language model', 'language model', 'foundation model',
    'gpt', 'claude', 'gemini', 'llama', 'alpaca', 'vicuna', 'falcon',
    'transformer', 'bert', 'roberta', 't5', 'bart', 'electra',
    
    // Companies and products
    'openai', 'anthropic', 'google ai', 'deepmind', 'meta ai',
    'hugging face', 'langchain', 'pinecone', 'weaviate', 'chroma',
    'chatgpt', 'copilot', 'github copilot', 'cursor ai', 'replit ai',
    'dall-e', 'midjourney', 'stable diffusion', 'runway', 'pika',
    
    // Techniques and concepts
    'fine-tuning', 'fine tuning', 'prompt', 'prompting', 'prompt engineering',
    'rag', 'retrieval augmented', 'embeddings', 'vector database',
    'attention', 'self-attention', 'multi-head attention',
    'backpropagation', 'gradient descent', 'optimization',
    'reinforcement learning', 'rl', 'rlhf', 'constitutional ai',
    
    // Applications
    'computer vision', 'cv', 'image recognition', 'object detection',
    'nlp', 'natural language processing', 'natural language',
    'speech recognition', 'text-to-speech', 'voice synthesis',
    'generative', 'generation', 'synthesis', 'diffusion',
    'chatbot', 'agent', 'autonomous', 'automation', 'robotics',
    
    // Technical terms
    'pytorch', 'tensorflow', 'keras', 'transformers',
    'dataset', 'training', 'inference', 'model', 'algorithm',
    'benchmark', 'evaluation', 'metrics', 'loss function',
    'overfitting', 'regularization', 'dropout', 'batch norm'
  ];
  
  // Always include content from AI-specific sources
  const aiSources = [
    'openai', 'anthropic', 'huggingface', 'hugging face', 'langchain', 
    'deepmind', 'google ai', 'meta ai', 'nvidia', 'cohere',
    'replicate', 'gradio', 'wandb', 'weights & biases'
  ];
  
  if (aiSources.some(s => source.toLowerCase().includes(s))) {
    return true;
  }
  
  const titleLower = title.toLowerCase();
  return aiKeywords.some(keyword => titleLower.includes(keyword));
}

// Main crawl function
async function crawlAllSources() {
  console.log('🤖 Starting AI news crawl...');
  
  // Initialize AI classifier for intelligent filtering
  const aiFilterReady = await initializeAIFilter();
  
  const sources = await loadSources();
  console.log(`Found ${sources.length} sources to crawl`);
  
  // Crawl all sources in parallel (but with some delay to be nice)
  const allArticles = [];
  const crawlStats = { totalProcessed: 0, qualityFiltered: 0, aiFiltered: 0 };
  const batchSize = 5; // Process 5 sources at a time
  
  for (let i = 0; i < sources.length; i += batchSize) {
    const batch = sources.slice(i, i + batchSize);
    const promises = batch.map(source => crawlFeed(source, aiFilterReady, crawlStats));
    const results = await Promise.all(promises);
    
    for (const result of results) {
      if (result.articles) {
        allArticles.push(...result.articles);
      }
    }
    
    // Small delay between batches
    if (i + batchSize < sources.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  // Remove duplicates
  const uniqueArticles = removeDuplicates(allArticles);
  
  // Sort by publication date (newest first)
  uniqueArticles.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  
  console.log(`📰 Found ${uniqueArticles.length} unique AI articles`);
  console.log(`🧠 AI filtering: ${aiFilterReady ? 'ENABLED' : 'Fallback to keywords'}`);
  if (aiFilterReady && crawlStats.qualityFiltered > 0) {
    console.log(`🚫 Quality filtered during crawl: ${crawlStats.qualityFiltered} articles (< 60% confidence)`);
  }
  if (aiFilterReady && crawlStats.aiFiltered > 0) {
    console.log(`🤖 AI relevance filtered: ${crawlStats.aiFiltered} articles`);
  }
  console.log(`📊 Crawl stats: ${crawlStats.totalProcessed} processed → ${uniqueArticles.length} kept`);
  
  // Ensure data directory exists
  const dataDir = path.join(__dirname, '../data');
  await fs.mkdir(dataDir, { recursive: true });
  
  // Save raw crawled data
  const output = {
    crawledAt: new Date().toISOString(),
    totalSources: sources.length,
    totalArticles: uniqueArticles.length,
    aiFilterUsed: aiFilterReady,
    articles: uniqueArticles
  };
  
  // Save only as latest-raw.json (no dated duplicates)
  const filepath = path.join(dataDir, 'latest-raw.json');
  await fs.writeFile(filepath, JSON.stringify(output, null, 2));
  console.log(`💾 Saved raw data to: latest-raw.json`);
  
  return uniqueArticles;
}

// Crawl a single RSS feed with AI-powered filtering
async function crawlFeed(source, useAIFilter = false, stats = null) {
  try {
    console.log(`Crawling: ${source.name}`);
    
    const feed = await parser.parseURL(source.url);
    const articles = [];
    
    // Different limits based on source type
    const itemLimit = source.category === 'youtube' ? 10 : 
                     source.category === 'research' ? 15 :
                     source.category === 'community' ? 25 :
                     source.category === 'medium' ? 15 :
                     source.category === 'developer' ? 12 :
                     source.category === 'agentic' ? 20 : 20;
    
    const items = feed.items.slice(0, itemLimit);
    
    for (const item of items) {
      const title = cleanTitle(item.title || '');
      const url = item.link || item.guid;
      
      if (!title || !url) continue;
      
      if (stats) stats.totalProcessed++;
      
      // Extract description for AI classification
      let description = '';
      if (item.contentSnippet) {
        description = item.contentSnippet.substring(0, 200);
      } else if (item.content) {
        description = item.content.replace(/<[^>]*>/g, '').substring(0, 200);
      } else if (item.summary) {
        description = item.summary.replace(/<[^>]*>/g, '').substring(0, 200);
      }
      
      // AI-powered filtering (preferred) or fallback to keywords
      let isRelevant = false;
      
      if (useAIFilter) {
        // Use AI classifier for intelligent filtering with 75% confidence threshold
        const aiResult = await isAIRelevantAI(title, description);
        
        if (aiResult) {
          // Apply 60% confidence threshold for quality filtering
          isRelevant = aiResult.isRelevant && aiResult.meetsQualityThreshold;
          
          // Log AI decisions for debugging and track stats
          if (aiResult.isRelevant && !aiResult.meetsQualityThreshold) {
            console.log(`🚫 Quality filtered: "${title.substring(0, 50)}..." (confidence: ${(aiResult.confidence * 100).toFixed(1)}% < 60%)`);
            if (stats) stats.qualityFiltered++;
          } else if (!aiResult.isRelevant && aiResult.confidence > 0.2) {
            console.log(`🤖 AI filtered out: "${title}" (confidence: ${aiResult.confidence.toFixed(2)}, category: ${aiResult.topCategory})`);
            if (stats) stats.aiFiltered++;
          }
        } else {
          // AI failed, fallback to keyword filtering
          isRelevant = isAIRelevant(title, source.name);
        }
      } else {
        // Fallback keyword filtering with improved logic
        const basicAIRelevance = isAIRelevant(title, source.name);
        
        if (source.category === 'youtube' || source.category === 'research' || 
            source.category === 'tutorial' || source.category === 'newsletter') {
          // Educational sources: broader keywords but still filtered
          const educationalAIKeywords = [
            'ai', 'artificial intelligence', 'machine learning', 'ml', 'deep learning',
            'neural', 'algorithm', 'model', 'data science', 'automation', 'robotics',
            'computer science', 'programming', 'coding', 'software', 'tech', 'agent'
          ];
          const hasEducationalAI = educationalAIKeywords.some(keyword => 
            title.toLowerCase().includes(keyword)
          );
          isRelevant = basicAIRelevance || hasEducationalAI;
        } else {
          // News/business sources: stricter AI relevance
          isRelevant = basicAIRelevance;
        }
        
        // Hard exclusions for clearly non-AI content
        const excludeTerms = [
          'fields medal', 'nobel prize', 'pure mathematics', 'number theory',
          'sports', 'football', 'basketball', 'soccer', 'tennis', 'olympics',
          'politics', 'election', 'climate change', 'global warming'
        ];
        const hasExcludedTerm = excludeTerms.some(term => 
          title.toLowerCase().includes(term)
        );
        
        if (hasExcludedTerm) {
          isRelevant = false;
        }
      }
      
      if (!isRelevant) continue;
      
      // Different time windows based on source type
      const daysBack = source.category === 'youtube' ? 14 :
                      source.category === 'research' ? 30 :
                      source.category === 'community' ? 3 :
                      source.category === 'medium' ? 7 :
                      source.category === 'developer' ? 14 :
                      source.category === 'tutorial' ? 14 :
                      source.category === 'agentic' ? 10 : 7;
      
      const pubDate = new Date(item.pubDate || item.isoDate || item.published);
      const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
      if (pubDate < cutoffDate) continue;
      
      articles.push({
        title: title,
        url: url,
        source: source.name,
        source_domain: extractDomain(url),
        source_category: source.category,
        source_priority: source.priority,
        pubDate: pubDate.toISOString(),
        metaDescription: description,
        
        // Will be filled by LLM processing
        category: null,
        difficulty: null,
        confidence: null,
        
        // Metadata
        crawledAt: new Date().toISOString(),
        id: generateId(title, url)
      });
    }
    
    console.log(`✓ ${source.name}: ${articles.length} AI articles found`);
    return { articles, stats };
    
  } catch (error) {
    console.error(`✗ Failed to crawl ${source.name}:`, error.message);
    return { articles: [], stats };
  }
}

// Generate unique ID for article
function generateId(title, url) {
  const content = title + url;
  let hash = 0;
  for (let i = 0; i < content.length; i++) {
    const char = content.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  return Math.abs(hash).toString(36);
}

// Remove duplicates based on similarity
function removeDuplicates(articles) {
  const unique = [];
  const seen = new Set();
  
  for (const article of articles) {
    // Create a normalized key for duplicate detection
    const key = article.title
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .split(' ')
      .slice(0, 8) // First 8 words
      .join(' ');
    
    if (!seen.has(key)) {
      seen.add(key);
      unique.push(article);
    }
  }
  
  return unique;
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  crawlAllSources()
    .then(articles => {
      console.log(`✅ Crawl complete! Found ${articles.length} articles`);
    })
    .catch(error => {
      console.error('❌ Crawl failed:', error);
      process.exit(1);
    });
}

export { crawlAllSources }; 