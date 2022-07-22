const pathx = require('path');

const URL_SCHEME = /^\w+:/

function makeAbsUrl(url, path) {
  const urlp = new URL(url);

  if (!path) {
    return url;
  }

  if (path.startsWith(urlp.origin)) {
    path = (new URL(path)).pathname
  }

  if (URL_SCHEME.test(path)) {
    throw new Error(`Off-site link: ${path}`);
  }

  // Combine paths, handle relative / abs paths.
  urlp.pathname = pathx.join(urlp.pathname, path);

  return urlp.href;
}
  
module.exports = {
  makeAbsUrl,
};
