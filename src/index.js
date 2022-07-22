const { URL } = require('url');

const BACKENDS = [
  {
    pattern: /^timcast.com/,
    // Factory: require('./timcast_puppeteer'),
    Factory: require('./sources/timcast_cheerio'),
  },
];

async function scrape(url, options) {
  const urlp = new URL(url);
  const backend = BACKENDS.find(o => o.pattern.test(urlp.hostname));

  if (!backend || !backend.Factory) {
    throw new Error('No backend for domain:', urlp.hostname);
  }

  const scraper = new backend.Factory(urlp.origin);
  return await scraper.scrape(urlp.pathname, options);
}

module.exports = {
  scrape,
};
