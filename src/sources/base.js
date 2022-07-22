class BaseSource {
  constructor(url, options) {
    this.url = url;
    this.options = options;
  }

  async scrape(path, options) {
      throw new Error('Not implemented');
  }
}

module.exports = BaseSource;
