// State management
let allArticles = [];
let filteredArticles = [];
let currentPage = 0;
const articlesPerPage = 20;

// DOM elements
const articlesGrid = document.getElementById('articlesGrid');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearch');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const showCount = document.getElementById('showCount');
const totalCount = document.getElementById('totalCount');

// Filters state
const filters = {
  category: 'all',
  source: 'all',
  difficulty: 'all',
  search: ''
};

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  try {
    await loadData();
    setupEventListeners();
    applyFilters();
    updateDisplay();
  } catch (error) {
    console.error('Failed to initialize app:', error);
    showError('Failed to load articles. Please refresh the page.');
  }
});

// Load article data
async function loadData() {
  try {
    const response = await fetch('data.json');
    const data = await response.json();
    allArticles = data.articles;
    filteredArticles = [...allArticles];
    
    console.log(`Loaded ${allArticles.length} articles`);
  } catch (error) {
    console.error('Failed to load data:', error);
    throw error;
  }
}

// Setup event listeners
function setupEventListeners() {
  // Filter buttons
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', handleFilterClick);
  });
  
  // Search
  searchInput.addEventListener('input', debounce(handleSearch, 300));
  clearSearchBtn.addEventListener('click', clearSearch);
  
  // Load more
  loadMoreBtn.addEventListener('click', loadMore);
  
  // Keyboard shortcuts
  document.addEventListener('keydown', handleKeyboard);
}

// Handle filter button clicks
function handleFilterClick(event) {
  const btn = event.target;
  const filterType = btn.dataset.category ? 'category' : 
                    btn.dataset.source ? 'source' : 'difficulty';
  const filterValue = btn.dataset.category || btn.dataset.source || btn.dataset.difficulty;
  
  // Remove active class from siblings
  btn.parentElement.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.remove('active');
  });
  
  // Add active class to clicked button
  btn.classList.add('active');
  
  // Update filter state
  filters[filterType] = filterValue;
  
  // Apply filters and reset pagination
  currentPage = 0;
  applyFilters();
  updateDisplay();
}

// Handle search input
function handleSearch(event) {
  filters.search = event.target.value.toLowerCase().trim();
  currentPage = 0;
  applyFilters();
  updateDisplay();
}

// Clear search
function clearSearch() {
  searchInput.value = '';
  filters.search = '';
  currentPage = 0;
  applyFilters();
  updateDisplay();
}

// Apply all filters
function applyFilters() {
  filteredArticles = allArticles.filter(article => {
    // Category filter - handle both AI categories and source categories
    if (filters.category !== 'all') {
      const articleCategory = article.category || article.source_category;
      if (articleCategory !== filters.category) {
        return false;
      }
    }
    
    // Source filter
    if (filters.source !== 'all' && article.source_category !== filters.source) {
      return false;
    }
    
    // Difficulty filter
    if (filters.difficulty !== 'all' && article.difficulty) {
      const difficulty = article.difficulty;
      if (filters.difficulty === 'easy' && difficulty > 3) return false;
      if (filters.difficulty === 'medium' && (difficulty < 4 || difficulty > 7)) return false;
      if (filters.difficulty === 'hard' && difficulty < 8) return false;
    }
    
    // Search filter
    if (filters.search) {
      const searchableText = [
        article.title,
        article.source,
        article.category || article.source_category,
        ...(article.entities?.organizations || []),
        ...(article.entities?.products || []),
        ...(article.entities?.technologies || [])
      ].join(' ').toLowerCase();
      
      if (!searchableText.includes(filters.search)) {
        return false;
      }
    }
    
    return true;
  });
  
  console.log(`Filtered to ${filteredArticles.length} articles`);
}

// Update display
function updateDisplay() {
  // Clear current articles
  articlesGrid.innerHTML = '';
  
  // Show filtered articles (paginated)
  const articlesToShow = filteredArticles.slice(0, (currentPage + 1) * articlesPerPage);
  
  if (articlesToShow.length === 0) {
    showEmptyState();
    return;
  }
  
  articlesToShow.forEach(article => {
    const articleElement = createArticleElement(article);
    articlesGrid.appendChild(articleElement);
  });
  
  // Update counters
  showCount.textContent = articlesToShow.length;
  totalCount.textContent = filteredArticles.length;
  
  // Update load more button
  const hasMore = articlesToShow.length < filteredArticles.length;
  loadMoreBtn.style.display = hasMore ? 'block' : 'none';
  loadMoreBtn.disabled = !hasMore;
}

// Create article DOM element - full AI-enhanced version
function createArticleElement(article) {
  const articleDiv = document.createElement('article');
  articleDiv.className = 'news-item';
  
  // Use AI category if available, otherwise use source category
  const category = article.category || article.source_category;
  const difficulty = article.difficulty || 5;
  const confidence = article.confidence || 0.5;
  
  articleDiv.dataset.category = category;
  articleDiv.dataset.difficulty = difficulty;
  articleDiv.dataset.source = article.source_category;
  
  // AI-enhanced features
  const duplicateBadge = article.duplicateOf ? '<span class="duplicate-badge">Duplicate</span>' : '';
  const difficultyDots = '●'.repeat(difficulty) + '○'.repeat(10 - difficulty);
  const confidenceIcon = confidence > 0.8 ? '✓' : '?';
  
  // Entity tags
  const entities = article.entities || { organizations: [], products: [], technologies: [] };
  const entityTags = [
    ...entities.organizations.map(org => `<span class="entity-tag org">${org}</span>`),
    ...entities.products.map(product => `<span class="entity-tag product">${product}</span>`),
    ...entities.technologies.slice(0, 3).map(tech => `<span class="entity-tag tech">${tech}</span>`)
  ].join('');

  articleDiv.innerHTML = `
    ${duplicateBadge}
    
    <div class="source-bar">
      <img src="https://www.google.com/s2/favicons?domain=${article.source_domain}" alt="${article.source}" width="16" height="16">
      <span class="source-name">${article.source}</span>
      <time class="pub-time">${timeAgo(article.pubDate)}</time>
    </div>
    
    <h3 class="article-title">
      <a href="${article.url}" target="_blank" rel="noopener" title="${article.metaDescription || article.title}">
        ${article.title} ↗
      </a>
    </h3>
    
    ${entityTags ? `<div class="entities">${entityTags}</div>` : ''}
    
    <div class="metadata">
      <span class="category category-${category}">${category.replace('-', ' ')}</span>
      ${article.difficulty ? `<span class="difficulty" title="Difficulty: ${difficulty}/10">${difficultyDots}</span>` : ''}
      ${article.confidence ? `<span class="confidence" title="AI confidence: ${(confidence*100).toFixed(0)}%">${confidenceIcon}</span>` : ''}
    </div>
  `;
  
  return articleDiv;
}

// Show empty state
function showEmptyState() {
  articlesGrid.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--text-secondary);">
      <h3>No articles found</h3>
      <p>Try adjusting your filters or search terms.</p>
    </div>
  `;
  
  showCount.textContent = '0';
  totalCount.textContent = filteredArticles.length;
  loadMoreBtn.style.display = 'none';
}

// Show error message
function showError(message) {
  articlesGrid.innerHTML = `
    <div style="grid-column: 1 / -1; text-align: center; padding: 2rem; color: var(--error);">
      <h3>Error</h3>
      <p>${message}</p>
    </div>
  `;
}

// Load more articles
function loadMore() {
  currentPage++;
  updateDisplay();
}

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

// Debounce helper
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Keyboard shortcuts
function handleKeyboard(event) {
  // Escape to clear search
  if (event.key === 'Escape') {
    clearSearch();
  }
  
  // Ctrl/Cmd + K to focus search
  if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
    event.preventDefault();
    searchInput.focus();
  }
}

// Performance monitoring
const observer = new IntersectionObserver((entries) => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      // Track article views for analytics if needed
      console.log('Article viewed:', entry.target.querySelector('.article-title a').textContent);
    }
  });
}, { threshold: 0.5 });

// Observe articles for analytics
function observeArticles() {
  document.querySelectorAll('.news-item').forEach(article => {
    observer.observe(article);
  });
}

// Initialize analytics after articles load
const originalUpdateDisplay = updateDisplay;
updateDisplay = function() {
  originalUpdateDisplay.call(this);
  observeArticles();
};

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    applyFilters,
    timeAgo,
    debounce
  };
} 