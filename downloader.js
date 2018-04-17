#!/usr/bin/env node

const url = require('url');
const {https} = require('follow-redirects');
const zlib = require('zlib');
const os = require('os');
const unzipper = require('unzipper');
const tarFs = require('tar-fs');
const progress = require('progress');

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
          case 'win32': return 'exokit-windows-full.zip';
          case 'linux': return 'exokit-linux-full.tar.gz';
          case 'darwin': return 'exokit-macos-full.tar.gz';
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
            const {browser_download_url} = asset;
            const u = url.parse(browser_download_url);
            u.headers = {
              'User-Agent': userAgent,
            };
            https.get(u, res => {
              if (res.statusCode >= 200 && res.statusCode < 300) {
                const {tag_name} = release;
                const bar = new progress(`[:bar] ${requiredReleaseName} ${tag_name} :rate bps :percent :etas`, {
                  complete: '█',
                  incomplete: '.',
                  width: 20,
                  total: parseInt(res.headers['content-length'], 10),
                });

                if (/\.zip$/.test(requiredReleaseName)) {
                  res.pipe(unzipper.Extract({
                    path: __dirname,
                  }))
                    .on('end', () => {
                      console.log();
                    });
                  res.on('data', d => {
                    bar.tick(d.length);
                  });
                } else if (/\.tar\.gz$/.test(requiredReleaseName)) {
                  res.pipe(zlib.createUnzip()).pipe(tarFs.extract(__dirname))
                    .on('end', () => {
                      console.log();
                    });
                  res.on('data', d => {
                    bar.tick(d.length);
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
