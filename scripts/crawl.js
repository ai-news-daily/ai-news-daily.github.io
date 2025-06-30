import RSSParser from 'rss-parser';
import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const parser = new RSSParser({
  timeout: 10000,
  headers: {
    'User-Agent': 'AI-News-Daily/1.0 (https://github.com/ai-news-daily/ai-news-daily.github.io)'
  }
});

// Load sources
async function loadSources() {
  const sourcesPath = path.join(__dirname, '../sources.json');
  const sourcesData = await fs.readFile(sourcesPath, 'utf-8');
  const { 
    sources, 
    reddit_sources, 
    youtube_channels, 
    newsletters, 
    academic_sources 
  } = JSON.parse(sourcesData);
  
  return [
    ...sources,
    ...reddit_sources,
    ...youtube_channels,
    ...newsletters,
    ...academic_sources
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

// Crawl a single RSS feed
async function crawlFeed(source) {
  try {
    console.log(`Crawling: ${source.name}`);
    
    const feed = await parser.parseURL(source.url);
    const articles = [];
    
    // Different limits based on source type
    const itemLimit = source.category === 'youtube' ? 10 : 
                     source.category === 'research' ? 15 :
                     source.category === 'community' ? 25 : 20;
    
    const items = feed.items.slice(0, itemLimit);
    
    for (const item of items) {
      const title = cleanTitle(item.title || '');
      const url = item.link || item.guid;
      
      if (!title || !url) continue;
      
      // Filter for AI relevance (more lenient for YouTube and academic sources)
      const isRelevant = source.category === 'youtube' || 
                        source.category === 'research' ||
                        source.category === 'newsletter' ||
                        isAIRelevant(title, source.name);
      
      if (!isRelevant) continue;
      
      // Different time windows based on source type
      const daysBack = source.category === 'youtube' ? 14 :
                      source.category === 'research' ? 30 :
                      source.category === 'community' ? 3 : 7;
      
      const pubDate = new Date(item.pubDate || item.isoDate || item.published);
      const cutoffDate = new Date(Date.now() - daysBack * 24 * 60 * 60 * 1000);
      if (pubDate < cutoffDate) continue;
      
      // Extract description/summary
      let description = '';
      if (item.contentSnippet) {
        description = item.contentSnippet.substring(0, 200);
      } else if (item.content) {
        description = item.content.replace(/<[^>]*>/g, '').substring(0, 200);
      } else if (item.summary) {
        description = item.summary.replace(/<[^>]*>/g, '').substring(0, 200);
      }
      
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
    return articles;
    
  } catch (error) {
    console.error(`✗ Failed to crawl ${source.name}:`, error.message);
    return [];
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

// Main crawl function
async function crawlAllSources() {
  console.log('🤖 Starting AI news crawl...');
  
  const sources = await loadSources();
  console.log(`Found ${sources.length} sources to crawl`);
  
  // Crawl all sources in parallel (but with some delay to be nice)
  const allArticles = [];
  const batchSize = 5; // Process 5 sources at a time
  
  for (let i = 0; i < sources.length; i += batchSize) {
    const batch = sources.slice(i, i + batchSize);
    const promises = batch.map(source => crawlFeed(source));
    const results = await Promise.all(promises);
    
    for (const articles of results) {
      allArticles.push(...articles);
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
  
  // Ensure data directory exists
  const dataDir = path.join(__dirname, '../data');
  await fs.mkdir(dataDir, { recursive: true });
  
  // Save raw crawled data
  const output = {
    crawledAt: new Date().toISOString(),
    totalSources: sources.length,
    totalArticles: uniqueArticles.length,
    articles: uniqueArticles
  };
  
  // Save only as latest-raw.json (no dated duplicates)
  const filepath = path.join(dataDir, 'latest-raw.json');
  await fs.writeFile(filepath, JSON.stringify(output, null, 2));
  console.log(`💾 Saved raw data to: latest-raw.json`);
  
  return uniqueArticles;
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