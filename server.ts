import 'zone.js/node';

import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr';
import express, { Request, Response, NextFunction } from 'express';
import * as http from 'node:http';
import * as https from 'node:https';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import bootstrap from './src/main.server';

/**
 * Same-origin /api reverse proxy → ASP.NET (Railway private network).
 * Set API_UPSTREAM e.g. http://api.railway.internal:8080
 */
function attachApiProxy(server: express.Express): void {
  const raw = process.env['API_UPSTREAM']?.trim();
  if (!raw) {
    console.warn('[ssr] API_UPSTREAM is not set — /api will not be proxied (SSR-only mode).');
    return;
  }

  let target: URL;
  try {
    target = new URL(raw);
  } catch {
    throw new Error(`API_UPSTREAM is not a valid URL: ${raw}`);
  }

  const transport = target.protocol === 'https:' ? https : http;
  const port = target.port
    ? Number(target.port)
    : target.protocol === 'https:'
      ? 443
      : 80;

  server.use('/api', (req: Request, res: Response) => {
    // originalUrl keeps the /api prefix that ASP.NET controllers expect.
    const headers: http.OutgoingHttpHeaders = { ...req.headers, host: target.host };
    delete headers['connection'];

    const proxyReq = transport.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port,
        path: req.originalUrl,
        method: req.method,
        headers,
      },
      (proxyRes) => {
        res.writeHead(proxyRes.statusCode ?? 502, proxyRes.headers);
        proxyRes.pipe(res);
      }
    );

    proxyReq.on('error', (err) => {
      console.error('[ssr] API proxy error:', err.message);
      if (!res.headersSent) {
        res.status(502).json({ message: 'Cannot reach API upstream.' });
      }
    });

    req.pipe(proxyReq);
  });

  console.log(`[ssr] Proxying /api → ${target.origin}`);
}

// The Express app is exported so that it can be used by serverless Functions.
export function app(): express.Express {
  const server = express();
  const distFolder = join(process.cwd(), 'dist/swimxpert/browser');
  const indexHtml = existsSync(join(distFolder, 'index.original.html'))
    ? join(distFolder, 'index.original.html')
    : join(distFolder, 'index.html');

  const commonEngine = new CommonEngine();

  server.set('view engine', 'html');
  server.set('views', distFolder);

  // Must run before static + SSR catch-alls so /api never hits Angular.
  attachApiProxy(server);

  // Serve static files from /browser
  server.get('*.*', express.static(distFolder, {
    maxAge: '1y'
  }));

  // All regular routes use the Angular engine
  server.get('*', (req: Request, res: Response, next: NextFunction) => {
    const { protocol, originalUrl, baseUrl, headers } = req;

    commonEngine
      .render({
        bootstrap,
        documentFilePath: indexHtml,
        url: `${protocol}://${headers.host}${originalUrl}`,
        publicPath: distFolder,
        providers: [{ provide: APP_BASE_HREF, useValue: baseUrl }],
      })
      .then((html) => res.send(html))
      .catch((err) => next(err));
  });

  return server;
}

function run(): void {
  const port = process.env['PORT'] || 4000;

  // Start up the Node server
  const server = app();
  server.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

// Webpack will replace 'require' with '__webpack_require__'
// '__non_webpack_require__' is a proxy to Node 'require'
// The below code is to ensure that the server is run only when not requiring the bundle.
declare const __non_webpack_require__: NodeRequire;
const mainModule = __non_webpack_require__.main;
const moduleFilename = mainModule && mainModule.filename || '';
if (moduleFilename === __filename || moduleFilename.includes('iisnode')) {
  run();
}

export default bootstrap;
