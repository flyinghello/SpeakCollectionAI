import http from "node:http";
import https from "node:https";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const distDir = path.join(__dirname, "dist");
const port = Number.parseInt(process.env.PORT || "4173", 10);

const send = (res, statusCode, headers, body) => {
  res.writeHead(statusCode, headers);
  res.end(body);
};

const guessContentType = (filePath) => {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".html") return "text/html; charset=utf-8";
  if (ext === ".js") return "text/javascript; charset=utf-8";
  if (ext === ".css") return "text/css; charset=utf-8";
  if (ext === ".json") return "application/json; charset=utf-8";
  if (ext === ".svg") return "image/svg+xml";
  if (ext === ".png") return "image/png";
  if (ext === ".jpg" || ext === ".jpeg") return "image/jpeg";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  if (ext === ".mp3") return "audio/mpeg";
  return "application/octet-stream";
};

const readBody = async (req) => {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  return Buffer.concat(chunks);
};

const proxyRequest = async (req, res, { targetOrigin, rewritePath }) => {
  const targetUrl = new URL(targetOrigin);
  const incomingUrl = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const outPath = rewritePath ? rewritePath(incomingUrl.pathname + incomingUrl.search) : incomingUrl.pathname + incomingUrl.search;

  const headers = { ...req.headers };
  delete headers.host;
  delete headers.connection;
  delete headers["content-length"];

  const body = await readBody(req);
  if (body.length > 0) headers["content-length"] = String(body.length);

  const options = {
    protocol: targetUrl.protocol,
    hostname: targetUrl.hostname,
    port: targetUrl.port || (targetUrl.protocol === "https:" ? 443 : 80),
    method: req.method,
    path: outPath,
    headers,
  };

  const client = targetUrl.protocol === "https:" ? https : http;

  const upstreamReq = client.request(options, (upstreamRes) => {
    const passHeaders = { ...upstreamRes.headers };
    sendStream(res, upstreamRes.statusCode || 502, passHeaders, upstreamRes);
  });

  upstreamReq.on("error", (err) => {
    send(res, 502, { "Content-Type": "application/json; charset=utf-8" }, JSON.stringify({ error: String(err) }));
  });

  if (body.length > 0) upstreamReq.write(body);
  upstreamReq.end();
};

const sendStream = (res, statusCode, headers, stream) => {
  res.writeHead(statusCode, headers);
  stream.pipe(res);
};

const serveFile = async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = decodeURIComponent(url.pathname);
  const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, "");
  const filePath = path.join(distDir, safePath);
  const resolved = fs.existsSync(filePath) && fs.statSync(filePath).isFile() ? filePath : path.join(distDir, "index.html");
  const stream = fs.createReadStream(resolved);
  stream.on("error", () => {
    send(res, 404, { "Content-Type": "text/plain; charset=utf-8" }, "Not found");
  });
  sendStream(res, 200, { "Content-Type": guessContentType(resolved) }, stream);
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/v3")) {
    await proxyRequest(req, res, { targetOrigin: "https://ark.cn-beijing.volces.com" });
    return;
  }
  if (url.pathname.startsWith("/dmx/v1")) {
    await proxyRequest(req, res, { targetOrigin: "https://www.dmxapi.cn", rewritePath: (p) => p.replace(/^\/dmx/, "") });
    return;
  }
  await serveFile(req, res);
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Server running at http://localhost:${port}`);
});
