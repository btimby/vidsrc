const axios = require('axios');
const cheerio = require('cheerio');
const puppeteer = require('puppeteer');
const BaseSource = require('./base');
const utils = require('../utils');

RUMBLE_DOMAIN = /^https:\/\/rumble.com\/embed\//;
JSON_EXTRACT = /g\.f\["\w{7}"\]=({.*}),loaded:d()/;

class TCCheerioSource extends BaseSource {
  // async _login(options) {
  //   const { url, submit } = options.login;
  //   let uField = options.login.username[0];
  //   let pField = options.login.password[0];

  //   let r = await axios.get(url, { headers: { 'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.5060.114 Safari/537.36' }});
  //   console.log('headers:', r.headers);
  //   let $ = cheerio.load(r.data);
  //   uField = $(uField).attr('name');
  //   pField = $(pField).attr('name');
  //   const form = {
  //     [uField]: options.login.username[1],
  //     [pField]: options.login.password[1],
  //     'wp-submit': 'Log In',
  //     redirect_to: 'https://timcast.com/members-area/',
  //     testcookie: '1',
  //   };
  //   let ropts = {
  //     headers: {
  //       origin: this.url,
  //       referer: url,
  //       cookie: 'wordpress_test_cookie=WP Cookie check',
  //       'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/103.0.5060.114 Safari/537.36',
  //     },
  //   };

  //   console.log('Logging in to:', url, 'with:', form, 'and:', ropts);
  //   r = await axios.post(url, form, ropts);
  //   $ = cheerio.load(r.data);
  //   console.log('Login statusCode:', r.status);
  //   const cookies = r.headers['set-cookie'];
  //   console.log('headers:', r.headers);

  //   return cookies;
  // }

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

      const cookies = await page.cookies();
      let cookieStr = [];
      for (const cookie of cookies) {
        cookieStr.push(`${cookie.name}=${cookie.value}`);
      }
      return cookieStr.join('; ');
  
    } finally {
      await page.close();
      await browser.close();
    }
  }

  async scrape(path, options) {
    const cookieStr = await this._login(options);
    let url = utils.makeAbsUrl(this.url, path);

    const seen = new Set();
    const videos = new Set();

    const handle = async (url, depth) => {
      if (typeof depth === 'number') {
        if (depth === 0) {
          console.log('Depth reached');
          return;
        }
        depth--;
      }

      const ropts = {};
      if (cookieStr) {
        ropts.headers = { cookie: cookieStr };
      }
      console.log(url);
      const $ = cheerio.load(
        (await axios.get(url, ropts)).data
      );

      seen.add(url);

      const title = $('article > div > h1').html();

      const srcSeen = new Set();
      $('iframe').each(async (_, iframe) => {
        // Get iframe src, ensure it is a rumble embed.
        const src = $(iframe).attr('src');
        if (!src || !RUMBLE_DOMAIN.test(src) || srcSeen.has(src)) {
          return;
        }
        srcSeen.add(src);
  
        // Spoof referrer to pass whitelist check.
        console.log(src);
        let r = await axios.get(src, { headers: { referer: url} });
        const match = JSON_EXTRACT.exec(r.data);
        if (match) {
          const json = match[1] + '}';
          videos.add(JSON.parse(json));
        } else {
          console.log(r.data);
        }
      });

      for (const a of $('a')) {
        const href = $(a).attr('href');
        if (!href) continue;

        try {
          url = utils.makeAbsUrl(this.url, href);
        } catch (e) {
          continue;
        }

        if (seen.has(url)) {
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
      };
    }

    await handle(url, options.depth);

    return Array.from(videos);
  }
}

module.exports = TCCheerioSource;
