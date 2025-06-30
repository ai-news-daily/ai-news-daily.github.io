import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Time ago helper
function timeAgo(dateString) {
  const now = new Date();
  const date = new Date(dateString);
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

// Generate article HTML - simple version without AI processing for now
function generateArticleHTML(article) {
  return `
    <article class="news-item" data-category="${article.source_category}" data-source="${article.source_category}">
      <div class="source-bar">
        <img src="https://www.google.com/s2/favicons?domain=${article.source_domain}" alt="${article.source}" width="16" height="16">
        <span class="source-name">${article.source}</span>
        <time class="pub-time">${timeAgo(article.pubDate)}</time>
      </div>
      
      <h3 class="article-title">
        <a href="${article.url}" target="_blank" rel="noopener" title="${article.title}">
          ${article.title} ↗
        </a>
      </h3>
      
      <div class="metadata">
        <span class="category category-${article.source_category}">${article.source_category}</span>
      </div>
    </article>
  `;
}

// Generate complete HTML page
function generateHTML(data) {
  const { articles, crawledAt, totalArticles } = data;
  
  // Get unique categories for filters
  const categories = [...new Set(articles.map(a => a.source_category))].sort();
  
  const categoryFilters = categories.map(cat => 
    `<button class="filter-btn" data-category="${cat}">
      ${cat} 
     </button>`
  ).join('');

  const articlesHTML = articles.map(generateArticleHTML).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI News Daily - Latest AI News from 50+ Sources</title>
  <meta name="description" content="Latest AI news and updates from ${totalArticles} articles. Updated ${new Date(crawledAt).toLocaleDateString()}.">
  
  <!-- Open Graph -->
  <meta property="og:title" content="AI News Daily - Latest AI News Aggregator">
  <meta property="og:description" content="Curated AI news from 50+ sources">
  <meta property="og:type" content="website">
  <meta property="og:url" content="https://yourusername.github.io/ai-news-daily">
  
  <!-- Favicon -->
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🤖</text></svg>">
  
  <!-- Styles -->
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <header class="header">
    <div class="container">
      <h1 class="logo">
        🤖 AI News Daily
      </h1>
      <p class="tagline">
        Latest AI news from 50+ sources • ${totalArticles} articles • Updated ${timeAgo(crawledAt)}
      </p>
    </div>
  </header>

  <main class="main">
    <div class="container">
      <!-- Filters -->
      <div class="filters">
        <div class="filter-group">
          <h3>Categories</h3>
          <button class="filter-btn active" data-category="all">All (${totalArticles})</button>
          ${categoryFilters}
        </div>
      </div>

      <!-- Search -->
      <div class="search-bar">
        <input type="text" id="searchInput" placeholder="Search articles..." />
        <button id="clearSearch">Clear</button>
      </div>

      <!-- Articles -->
      <div class="articles-grid" id="articlesGrid">
        ${articlesHTML}
      </div>

      <!-- Load More -->
      <div class="load-more-container">
        <button id="loadMoreBtn" class="load-more-btn">Load More Articles</button>
        <p class="show-count">Showing <span id="showCount">${Math.min(20, articles.length)}</span> of <span id="totalCount">${articles.length}</span> articles</p>
      </div>
    </div>
  </main>

  <footer class="footer">
    <div class="container">
      <p>&copy; 2024 AI News Daily. Built with ❤️ and AI. <a href="https://github.com/ai-news-daily/ai-news-daily.github.io" target="_blank">Open Source</a></p>
      <p class="disclaimer">We aggregate links from public RSS feeds. All content belongs to original publishers.</p>
    </div>
  </footer>

  <script src="app.js"></script>
</body>
</html>`;
}

// Main build function
async function buildSite() {
  console.log('🏗️ Building static site...');
  
  try {
    // Load raw data (skip AI processing for now)
    const dataDir = path.join(__dirname, '../data');
    const rawDataPath = path.join(dataDir, 'latest-raw.json');
    
    console.log('📖 Loading crawled data...');
    const rawData = JSON.parse(await fs.readFile(rawDataPath, 'utf-8'));
    
    // Generate HTML
    console.log('🎨 Generating HTML...');
    const html = generateHTML(rawData);
    
    // Ensure site directory exists
    const siteDir = path.join(__dirname, '../site');
    await fs.mkdir(siteDir, { recursive: true });
    
    // Write HTML file
    await fs.writeFile(path.join(siteDir, 'index.html'), html);
    
    // Copy data file for frontend JS
    await fs.writeFile(
      path.join(siteDir, 'data.json'), 
      JSON.stringify(rawData, null, 2)
    );
    
    console.log(`✅ Site built successfully!`);
    console.log(`📊 Generated page with ${rawData.articles.length} articles`);
    
    return rawData;
    
  } catch (error) {
    console.error('❌ Site build failed:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  buildSite()
    .then(data => {
      console.log(`✅ Build complete! ${data.articles.length} articles published`);
    })
    .catch(error => {
      console.error('❌ Build failed:', error);
      process.exit(1);
    });
}

export { buildSite }; 