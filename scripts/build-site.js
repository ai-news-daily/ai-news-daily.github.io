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
  <meta property="og:url" content="https://ai-news-daily.github.io">
  
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

// Get available dates from data directory
async function getAvailableDates() {
  const dataDir = path.join(__dirname, '../data');
  const files = await fs.readdir(dataDir);
  
  // Find all processed files with date format YYYY-MM-DD-processed.json
  const dateFiles = files
    .filter(file => file.match(/^\d{4}-\d{2}-\d{2}-processed\.json$/))
    .map(file => file.replace('-processed.json', ''))
    .sort()
    .reverse(); // Most recent first
  
  return dateFiles;
}

// Load data for a specific date
async function loadDateData(date = null) {
  const dataDir = path.join(__dirname, '../data');
  
  if (date) {
    // Load specific date
    const dateFile = path.join(dataDir, `${date}-processed.json`);
    try {
      return JSON.parse(await fs.readFile(dateFile, 'utf-8'));
    } catch (error) {
      console.log(`⚠️ No data found for ${date}, falling back to latest`);
    }
  }
  
  // Load latest
  const processedPath = path.join(dataDir, 'latest-processed.json');
  const rawPath = path.join(dataDir, 'latest-raw.json');
  
  try {
    return JSON.parse(await fs.readFile(processedPath, 'utf-8'));
  } catch (error) {
    console.log('⚠️ AI-processed data not found, using raw data');
    return JSON.parse(await fs.readFile(rawPath, 'utf-8'));
  }
}

// Main build function
async function buildSite(selectedDate = null) {
  console.log('🏗️ Building static site...');
  
  try {
    console.log('📖 Loading crawled data...');
    
    // Get available dates and load data
    const availableDates = await getAvailableDates();
    const articlesData = await loadDateData(selectedDate);
    
    if (selectedDate) {
      console.log(`✅ Using data for ${selectedDate}`);
    } else {
      console.log('✅ Using latest AI-processed data');
    }
    
    const articles = articlesData.articles || [];
    const crawledAt = articlesData.crawledAt || new Date().toISOString();
    
    console.log(`📊 Found ${articles.length} articles`);
    
    // Get category statistics with AI categories
    const categoryStats = {};
    const sourceStats = {};
    const difficultyStats = { easy: 0, medium: 0, hard: 0 };
    
    articles.forEach(article => {
      const category = article.category || article.source_category || 'uncategorized';
      const source = article.source_category || 'other';
      const difficulty = article.difficulty || 5;
      
      categoryStats[category] = (categoryStats[category] || 0) + 1;
      sourceStats[source] = (sourceStats[source] || 0) + 1;
      
      if (difficulty <= 3) difficultyStats.easy++;
      else if (difficulty <= 7) difficultyStats.medium++;
      else difficultyStats.hard++;
    });
    
    console.log('🎨 Generating HTML...');
    
    // Generate the full HTML
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>AI News Daily - Latest AI News from 50+ Sources</title>
  <meta name="description" content="Latest AI news and updates from ${articles.length} articles. Updated ${new Date(crawledAt).toLocaleDateString()}.">
  
  <!-- Open Graph -->
  <meta property="og:title" content="AI News Daily - Latest AI News Aggregator">
  <meta property="og:description" content="Curated AI news from 50+ sources">
  <meta property="og:type" content="website">
      <meta property="og:url" content="https://ai-news-daily.github.io">
  
  <!-- Favicon -->
  <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><text y='.9em' font-size='90'>🤖</text></svg>">
  
  <!-- Styles -->
  <link rel="stylesheet" href="style.css">
</head>
<body>
  <!-- Header -->
  <header class="header">
    <div class="header-content">
      <div class="logo">
        🤖 AI News Daily
      </div>
      
      <div class="search-container">
        <input type="text" id="searchInput" class="search-input" placeholder="Search articles, sources, or topics...">
        <button id="clearSearch" class="clear-search">Clear</button>
      </div>
      
      <div class="header-controls">
        <div class="date-selector">
          <select id="dateSelect" class="date-select" title="Select date to view articles">
            <option value="">Latest</option>
            ${availableDates.map(date => 
              `<option value="${date}" ${selectedDate === date ? 'selected' : ''}>
                ${new Date(date).toLocaleDateString('en-US', { 
                  weekday: 'short', 
                  month: 'short', 
                  day: 'numeric' 
                })}
              </option>`
            ).join('')}
          </select>
        </div>
        
        <button id="themeToggle" class="theme-toggle" title="Toggle dark/light mode">
          <span class="theme-icon">🌙</span>
        </button>
        
        <div class="stats">
          <span id="showCount">${articles.length}</span> of <span id="totalCount">${articles.length}</span> articles
        </div>
      </div>
    </div>
  </header>

  <!-- Filters -->
  <div class="filters">
    <div class="filters-content">
      <!-- Category Filters -->
      <div class="filter-group">
        <label class="filter-label">Categories</label>
        <div class="filter-buttons">
          <button class="filter-btn active" data-category="all">All (${articles.length})</button>
          ${Object.entries(categoryStats)
            .sort(([,a], [,b]) => b - a)
            .map(([category, count]) => 
              `<button class="filter-btn" data-category="${category}">${category.replace('-', ' ')} (${count})</button>`
            ).join('')}
        </div>
      </div>
      
      <!-- Source Type Filters -->
      <div class="filter-group">
        <label class="filter-label">Source Types</label>
        <div class="filter-buttons">
          <button class="filter-btn active" data-source="all">All Sources</button>
          ${Object.entries(sourceStats)
            .sort(([,a], [,b]) => b - a)
            .slice(0, 8)
            .map(([source, count]) => 
              `<button class="filter-btn" data-source="${source}">${source} (${count})</button>`
            ).join('')}
        </div>
      </div>
      
      <!-- Difficulty Filters -->
      <div class="filter-group">
        <label class="filter-label">Difficulty Level</label>
        <div class="filter-buttons">
          <button class="filter-btn active" data-difficulty="all">All Levels</button>
          <button class="filter-btn" data-difficulty="easy">Easy (${difficultyStats.easy})</button>
          <button class="filter-btn" data-difficulty="medium">Medium (${difficultyStats.medium})</button>
          <button class="filter-btn" data-difficulty="hard">Hard (${difficultyStats.hard})</button>
        </div>
      </div>
    </div>
  </div>

  <!-- Main Content -->
  <main class="main">
    <div class="main-content">
      <!-- Articles Grid -->
      <div class="articles-grid" id="articlesGrid">
        ${articles.map(article => generateArticleHTML(article)).join('')}
      </div>
      
      <!-- Load More Button -->
      <button id="loadMoreBtn" class="load-more">Load More Articles</button>
    </div>
  </main>

  <!-- Scripts -->
  <script src="app.js"></script>
</body>
</html>`;

    // Write the HTML file
    const siteDir = path.join(__dirname, '../site');
    await fs.mkdir(siteDir, { recursive: true });
    await fs.writeFile(path.join(siteDir, 'index.html'), html);
    
    // Write the main data.json for the frontend
    await fs.writeFile(
      path.join(siteDir, 'data.json'), 
      JSON.stringify(articlesData, null, 2)
    );
    
    // Write available dates list for frontend
    await fs.writeFile(
      path.join(siteDir, 'dates.json'), 
      JSON.stringify({ availableDates }, null, 2)
    );
    
    // Copy individual date files for client-side access
    const dataDir = path.join(siteDir, 'data');
    await fs.mkdir(dataDir, { recursive: true });
    
    for (const date of availableDates) {
      const sourceFile = path.join(__dirname, `../data/${date}-processed.json`);
      const targetFile = path.join(dataDir, `${date}.json`);
      try {
        const dateData = await fs.readFile(sourceFile, 'utf-8');
        await fs.writeFile(targetFile, dateData);
      } catch (error) {
        console.log(`⚠️ Could not copy ${date} data file`);
      }
    }
    
    console.log('✅ Site built successfully!');
    console.log(`📊 Generated page with ${articles.length} articles`);
    console.log(`📈 Categories: ${Object.keys(categoryStats).length}`);
    console.log(`🔗 Sources: ${Object.keys(sourceStats).length}`);
    
  } catch (error) {
    console.error('❌ Build failed:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  buildSite()
    .then(() => {
      console.log('✅ Build complete! All features restored');
    })
    .catch((error) => {
      console.error('❌ Build failed:', error);
      process.exit(1);
    });
}

export default buildSite; 