#!/usr/bin/env node

const url = require('url');
const {https} = require('follow-redirects');
const zlib = require('zlib');
const os = require('os');
const unzip = require('unzip');
const tarFs = require('tar-fs');

const userAgent = 'exokit-downloader';

const u = url.parse('https://api.github.com/repos/modulesio/exokit/releases');
u.headers = {
  'User-Agent': userAgent,
};
https.get(u, res => {
  if (res.statusCode >= 200 && res.statusCode < 300) {
    const bs = [];
    res.on('data', d => {
      bs.push(d);
    });
    res.on('end', () => {
      const b = Buffer.concat(bs);
      const s = b.toString('utf8');
      const releases = JSON.parse(s);

      const platform = os.platform();
      const requiredReleaseName = (() => {
        switch (platform) {
          case 'win32': return 'exokit-windows.zip';
          case 'linux': return 'exokit-linux.tar.gz';
          case 'darwin': return 'exokit-macos.tar.gz';
          default: return null;
        }
      })();
      if (requiredReleaseName) {
        let found = false;
        for (let i = 0; i < releases.length; i++) {
          const release = releases[i];
          const {assets} = release;
          const asset = assets.find(asset => asset.name === requiredReleaseName);
          if (asset) {
            const {tag_name} = release;
            process.stdout.write(`Downloading ${requiredReleaseName} ${tag_name}...`);

            const {browser_download_url} = asset;
            const u = url.parse(browser_download_url);
            u.headers = {
              'User-Agent': userAgent,
            };
            https.get(u, res => {
              if (res.statusCode >= 200 && res.statusCode < 300) {
                if (/\.zip$/.test(requiredReleaseName)) {
                  res.pipe(unzip.Extract({
                    path: __dirname,
                  }));
                } else if (/\.tar\.gz$/.test(requiredReleaseName)) {
                  res.pipe(zlib.createUnzip()).pipe(tarFs.extract(__dirname))
                    .on('end', () => {
                      console.log('done!');
                    });
                } else {
                  throw new Error('unknown file format for file: ' + requiredReleaseName);
                }
              } else {
                throw new Error('invalid status code: ' + res.statusCode);
              }
            });

            found = true;
            break;
          }
        }
        if (!found) {
          throw new Error('could not find any releases');
        }
      } else {
        throw new Error('unknown platform: ' + platform);
      }
    });
  } else {
    throw new Error('invalid status code: ' + res.statusCode);
  }
});
