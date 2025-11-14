// server.js
const path = require("path");
const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();

// Serve ./UI and map "/" to index.html
const UI_DIR = path.join(__dirname, "UI");
const INDEX_PATH = path.join(UI_DIR, "index.html");
app.use(express.static(UI_DIR));
app.get("/", (req, res) => res.sendFile(INDEX_PATH));

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// Broadcast helper
function broadcast(obj) {
  const data = JSON.stringify(obj);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  }
}

// Wrap any inbound into a standard chat payload
function toChatPayload(d) {
  // d can be string or object {user,text}
  if (typeof d === "string") {
    return { type: "chat", user: "User-????", text: d, ts: Date.now() };
  }
  const user = typeof d.user === "string" ? d.user.slice(0, 32) : "User-????";
  const text = typeof d.text === "string" ? d.text.slice(0, 2000) : "";
  return { type: "chat", user, text, ts: Date.now() };
}

wss.on("connection", (ws) => {
  console.log("WS client connected");

  // Send a system message only to this client so we know receive works
  ws.send(JSON.stringify({
    type: "system",
    text: "Connected to server. Start sending messages.",
    ts: Date.now()
  }));

  ws.on("message", (buffer) => {
    let inbound = buffer.toString();
    console.log("raw received:", inbound);

    // Try to parse JSON; fall back to raw text
    try {
      const parsed = JSON.parse(inbound);
      const payload = toChatPayload(parsed);
      if (!payload.text) return;
      console.log("broadcasting:", payload);
      broadcast(payload);
    } catch {
      const payload = toChatPayload(inbound);
      if (!payload.text) return;
      console.log("broadcasting(raw):", payload);
      broadcast(payload);
    }
  });

  ws.on("close", () => console.log("WS client disconnected"));
});

// Bind to all interfaces so phone can reach it too
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log("UI_DIR:", UI_DIR);
  console.log(`test: open http://localhost:${PORT} and http://<laptop-ip>:${PORT}`);
});
