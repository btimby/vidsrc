const md5 = require('md5');
const puppeteer = require('puppeteer');
const utils = require('../utils');
const BaseSource = require('./base');

class TCPuppeteerSource extends BaseSource {
  async _login(options) {
    const { url, submit } = options.login;
    const [uField, uValue] = options.login.username;
    const [pField, pValue] = options.login.password;

    const browser = await puppeteer.launch({
      headless: options.headless,
      args: ['--start-maximized'],
    });

    const page = await browser.newPage();
    try {
      await page.setViewport({ width: 1366, height: 768});
  //    await page.setDefaultTimeout(60000);
      await page.setRequestInterception(true);
      page.on('request', (r) => {
        if (r.resourceType() === 'image') r.abort();
        else r.continue();
      });

      console.log('Logging in at:', url);
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.type(uField, uValue);
      await page.type(pField, pValue);

      await Promise.all([
        page.click(submit),
        page.waitForNavigation({ waitUntil: 'domcontentloaded' }),
      ]);

    } finally {
      await page.close();
    }

    return browser;
  }

  async _parse(browser, url) {
    const videos = [], links = [];
    const results = { videos, links };
    const page = await browser.newPage();
    await page.setViewport({ width: 1366, height: 768});
//    await page.setDefaultTimeout(60000);
    await page.setRequestInterception(true);
    page.on('request', (r) => {
      if (r.resourceType() === 'image') r.abort();
      else r.continue();
    });

    try {
      console.log(url);
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('a');

      (await page.evaluate(() => {
        const links = [];

        document.querySelectorAll('a').forEach(a => {
          const href = a.getAttribute('href');
          if (!href) return;
          links.push(href);
        });

        return links;
      })).forEach(link => links.push(link));

      const title = await page.evaluate(() => {
        const title = document.querySelector('article > div > h1');
        if (!title) return;
        return title.innerHTML;
      });

      const frames = await page.$$('iframe');

      for (const fh of frames) {
        const frame = await fh.contentFrame();

        try {
          await frame.waitForSelector('video');
        } catch (e) {
          if (e.constructor.name !== 'TimeoutError') {
            console.error(e);
          }
          continue;
        }

        const frameVideos = await frame.evaluate(() => {
          const videos = [];

          document.querySelectorAll('video').forEach(video => {
            const src = video.getAttribute('src');
            if (!src) return;
            videos.push({
              src,
              poster: video.getAttribute('poster'),
            });
          });

          return videos;
        })
        frameVideos.forEach(video => {
          video.id = md5(video.src);
          video.title = title;
          videos.push(video);
        });
      }

    } catch (e) {
      if (e.constructor.name !== 'TimeoutError') {
        console.error(e);
      }
    } finally {
      await page.close();
    }

    return results;
  }

  async scrape(path, options) {
    const browser = await this._login(options);

    let url = utils.makeAbsUrl(this.url, path);

    const seen = new Set([url]);
    const videos = new Set();

    const handle = async (url, depth) => {
      if (typeof depth === 'number') {
        if (depth === 0) {
          console.log('Depth reached');
          return;
        }
        depth--;
      }

      let results;
      seen.add(url);
  
      try {
        results = await this._parse(browser, url);

      } catch (e) {
        console.error(e);
        return;
      }
  
      results.videos.forEach(video => videos.add(video));

      for (const link of results.links) {
        try {
          url = utils.makeAbsUrl(this.url, link);
        } catch (e) {
          continue;
        }

        if (seen.has(url)) {
          // Don't double-parse.
          continue;
        }

        if (Array.isArray(options.whitelist)) {
          if (!options.whitelist.filter(p => p.test(url)).length) {
            continue;
          }
        }

        await handle(url, depth);

        if (typeof options.limit === 'number') {
          console.log('Video count:', videos.size, 'of', options.limit);
          if (videos.size >= options.limit) {
            console.log('Limit reached');
            return;
          }
        }
      }
    };

    try {
      await handle(url, options.depth);
    } finally {
      await browser.close();
    }

    return Array.from(videos);
  }
};

module.exports = TCPuppeteerSource;
