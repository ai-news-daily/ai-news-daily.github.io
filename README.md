<div align="center">

![AI News Daily Logo](logo.svg)

</div>

---

## ✨ About

**AI News Daily** is a free, open-source AI news aggregator that collects and categorizes articles from 50+ sources using local LLM processing. Built for GitHub Pages with zero monthly costs. Features a modern, animated interface with professional styling and runs 6 times daily automated updates.

## ✨ Features

- **📰 50+ AI News Sources** - OpenAI, Anthropic, Google AI, research papers, tools, and more
- **🧠 AI-Powered Categorization** - Local LLM processing with Transformers.js
- **📱 Mobile-First Design** - Clean, fast, responsive interface
- **🔍 Advanced Filtering** - Filter by category, difficulty, source, or search
- **🚀 Zero Cost Hosting** - Completely free using GitHub Pages + Actions
- **⚡ Fast & Lightweight** - No external dependencies, pure static site
- **🎯 SEO Optimized** - Structured data, meta descriptions, sitemap

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   RSS Feeds     │───▶│  GitHub Actions  │───▶│  GitHub Pages   │
│   (50+ sources) │    │  + Local LLM     │    │  (Static Site)  │
└─────────────────┘    └──────────────────┘    └─────────────────┘
                              │
                              ▼
                       ┌──────────────────┐
                       │   Data Storage   │
                       │   (JSON files)   │
                       └──────────────────┘
```

### Cost Breakdown: ₹0/month 🎉

- **Hosting**: GitHub Pages (FREE)
- **Database**: Git repository (FREE)  
- **Automation**: GitHub Actions (FREE - using 900/2000 mins/month)
- **AI Processing**: Local Transformers.js (FREE)
- **Domain**: Optional custom domain (₹500/year)

**With 6x daily updates**: Still completely free with 55% GitHub Actions capacity remaining!

## 🚀 Quick Start

### 1. Fork & Clone
```bash
git clone https://github.com/ai-news-daily/ai-news-daily.github.io.git
cd ai-news-daily
npm install
```

### 2. Test Locally
```bash
# Run full pipeline
npm test

# Or run individual steps
npm run crawl      # Crawl RSS feeds
npm run categorize # AI processing  
npm run build      # Build site
npm run dev        # Serve locally
```

### 3. Deploy to GitHub Pages

1. **Enable GitHub Pages**:
   - Go to Settings → Pages
   - Source: GitHub Actions
   - Save

2. **Enable GitHub Actions**:
   - Go to Actions tab
   - Enable workflows
   - The workflow will run automatically 6 times daily (every 4 hours: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC)

3. **Customize**:
   - Update `sources.json` with your preferred RSS feeds
   - Modify GitHub username in workflow files
   - Customize design in `site/style.css`

## 📁 Project Structure

```
ai-news-daily/
├── 📂 .github/workflows/
│   └── daily-crawl.yml          # Automation workflow
├── 📂 data/                     # Generated data files
│   ├── latest.json             # Current processed articles
│   └── YYYY-MM-DD.json         # Historical data
├── 📂 scripts/
│   ├── crawl.js                # RSS crawler
│   ├── process-with-llm.js     # AI categorization
│   └── build-site.js           # Static site generator
├── 📂 site/                    # Generated static site
│   ├── index.html              # Main page
│   ├── style.css               # Styles
│   ├── app.js                  # Frontend JS
│   └── data.json               # Article data
├── sources.json                # RSS feed configuration
├── package.json               # Dependencies
└── README.md                  # This file
```

## 🔧 Configuration

### Environment Variables

You can customize the AI processing behavior using environment variables:

```bash
# AI Confidence Threshold (0.0 - 1.0)
# Articles below this confidence score will be filtered out
# Lower values = more articles but potentially lower quality
# Higher values = fewer articles but higher quality
# Default: 0.30 (30%)
export CONFIDENCE_THRESHOLD=0.30

# For local development
CONFIDENCE_THRESHOLD=0.20 npm run crawl  # Get more articles
CONFIDENCE_THRESHOLD=0.40 npm run crawl  # Get fewer, higher-quality articles
```

**In GitHub Actions**: Edit `.github/workflows/daily-crawl.yml` and update:
```yaml
env:
  CONFIDENCE_THRESHOLD: '0.30'  # Adjust as needed
```

### Adding RSS Sources

Edit `sources.json`:

```json
{
  "sources": [
    {
      "name": "Your AI Blog",
      "url": "https://yourblog.com/rss.xml",
      "category": "company",
      "priority": "high"
    }
  ]
}
```

### Categories

The AI automatically categorizes articles into:

- `model-release` - New AI models (GPT-5, Claude, etc.)
- `research-paper` - Academic papers and research
- `developer-tool` - SDKs, APIs, frameworks
- `product-launch` - New AI products and features
- `tutorial-guide` - How-to guides and tutorials
- `industry-news` - Business and industry updates
- `ai-agents` - Autonomous AI systems
- `creative-ai` - Art, music, content generation
- `infrastructure` - AI deployment and scaling
- `safety-ethics` - AI safety and ethics

### Difficulty Levels

Articles are automatically rated 1-10:
- **1-3**: Beginner (tutorials, basic concepts)
- **4-7**: Intermediate (product updates, tools)
- **8-10**: Expert (research papers, technical deep-dives)

## 🤖 AI Processing Pipeline

1. **RSS Crawling** - Fetch latest articles from all sources
2. **Content Filtering** - Keep only AI-relevant articles
3. **Language Detection** - Filter for English content
4. **Duplicate Detection** - Remove duplicate articles across sources
5. **Categorization** - AI-powered category classification
6. **Entity Extraction** - Extract companies, products, technologies
7. **Difficulty Estimation** - Assess technical complexity
8. **SEO Enhancement** - Generate meta descriptions
9. **Site Generation** - Build static HTML with all features

## 📊 GitHub Actions Workflow

Runs automatically 6 times daily (every 4 hours: 00:00, 04:00, 08:00, 12:00, 16:00, 20:00 UTC):

```yaml
- Crawl 50+ RSS feeds
- Process with local LLM
- Generate static site
- Deploy to GitHub Pages
- Update data files
- Health check
```

**Free Tier Usage**: ~900 minutes/month (well under 2000 limit, ~5 mins per run)

### 🌍 Global Coverage Benefits

Running 6 times daily provides optimal coverage for all time zones:
- **00:00 UTC**: Asia-Pacific morning updates
- **04:00 UTC**: Europe early morning
- **08:00 UTC**: Europe business hours
- **12:00 UTC**: Americas morning
- **16:00 UTC**: Americas afternoon  
- **20:00 UTC**: Asia-Pacific evening

This ensures fresh content regardless of your location, with maximum 4-hour delays.

**Efficiency**: Each run takes ~5 minutes, totaling just 900 minutes/month of the 2000-minute GitHub Actions free tier.

## 🎨 Frontend Features

- **Enhanced UI/UX** - Animated gradient title with professional styling
- **Dynamic Branding** - "Your daily source for cutting-edge AI breakthroughs" subtitle
- **Interactive Effects** - Smooth hover animations and visual feedback
- **Responsive Design** - Mobile-first, works on all devices
- **📱 Mobile Optimizations** - Dedicated mobile context cards, optimized card heights, improved touch targets
- **Real-time Filtering** - Filter by category, source, difficulty
- **Smart Search** - Search titles, sources, entities
- **Infinite Scroll** - Load more articles seamlessly
- **Dark/Light Theme** - Easy on the eyes with theme toggle
- **Fast Loading** - Optimized for performance
- **Keyboard Shortcuts** - Ctrl+K for search, Esc to clear

## 🔍 SEO Features

- **Structured Data** - Rich snippets for search engines
- **Meta Descriptions** - AI-generated descriptions
- **Sitemap** - Auto-generated XML sitemap
- **Open Graph** - Social media sharing
- **Performance** - Lighthouse score 95+
- **Accessibility** - WCAG compliant

## 📈 Customization

### Styling
Modify `site/style.css` - Built with CSS custom properties for easy theming.

### Adding Features
- Edit `site/app.js` for frontend functionality
- Modify `scripts/build-site.js` for site generation
- Update `scripts/process-with-llm.js` for AI processing

### Analytics
Add Google Analytics, Plausible, or any analytics provider to the HTML template.

## 🚦 Monitoring

The workflow includes:
- **Health Checks** - Verify site deployment
- **Data Validation** - Ensure JSON integrity  
- **Article Count Monitoring** - Alert on low article counts
- **Error Reporting** - GitHub Actions logs

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Add your RSS sources or improvements
4. Test locally with `npm test`
5. Submit a pull request

### Contribution Ideas

- Add more RSS sources
- Improve AI categorization
- Enhance UI/UX
- Add new features
- Optimize performance
- Improve documentation

## 📝 Legal & Ethics

- **No Content Scraping** - Only titles, links, and metadata from RSS feeds
- **Publisher Friendly** - Drives traffic TO original publishers
- **Attribution** - Clear source attribution on every article
- **Respectful Crawling** - Rate-limited, follows robots.txt
- **Open Source** - MIT licensed, fully transparent

## 🛠️ Troubleshooting

### Common Issues

**Workflow fails:**
- Check RSS feed URLs in `sources.json`
- Verify GitHub Pages is enabled
- Check Actions permissions

**No articles showing:**
- Run `npm run crawl` locally to test
- Check network connectivity
- Verify RSS feeds are accessible

**AI processing slow:**
- Models cache after first run
- Check GitHub Actions minutes usage
- Consider reducing sources for testing

### Getting Help

- Check GitHub Issues
- Review workflow logs
- Test components individually
- Reach out on discussions

## 📊 Stats & Performance

- **Sources**: 50+ RSS feeds
- **Update Frequency**: 6 times daily
- **Page Load**: <2 seconds
- **Lighthouse Score**: 95+
- **Monthly Cost**: ₹0
- **AI Accuracy**: 85%+ categorization

## 🎯 Roadmap

- [ ] Newsletter functionality
- [ ] Bookmark system
- [ ] User preferences
- [ ] RSS feed for filtered content
- [ ] Mobile app (PWA)
- [ ] More AI models
- [ ] Custom domains
- [ ] Analytics dashboard

## 📄 License

MIT License - see [LICENSE](LICENSE) file.

## 🙏 Acknowledgments

- Transformers.js for local AI processing
- GitHub for free hosting and CI/CD
- All the AI companies and researchers sharing their work
- Open source community

---

**Built with ❤️ and AI** | [Live Demo](https://ai-news-daily.github.io) | [Issues](https://github.com/ai-news-daily/ai-news-daily.github.io/issues) | [Discussions](https://github.com/ai-news-daily/ai-news-daily.github.io/discussions) 