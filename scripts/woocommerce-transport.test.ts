import http from 'node:http';
import assert from 'node:assert/strict';
import { storeRequest } from '../lib/woocommerce/rest';
// Pinned-address transport must work with Node's { all: true } lookup contract.
const server = http.createServer((_q, r) => { r.setHeader('content-type','application/json'); r.end('{"namespaces":["wc/v3"]}'); });
server.listen(0, async () => {
  (process.env as Record<string,string>).NODE_ENV = 'development';
  const port = (server.address() as { port: number }).port;
  const r = await storeRequest(`http://localhost:${port}`, '/wp-json/');
  assert.equal(r.status, 200); console.log('pinned lookup ok'); server.close();
});
