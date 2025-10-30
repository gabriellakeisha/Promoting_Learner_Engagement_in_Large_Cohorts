// server.js
const path = require("path");
const express = require("express");
const http = require("http");
const WebSocket = require("ws");

const app = express();

// Serve ./UI
app.use(express.static(path.join(__dirname, "UI")));
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "UI", "index.html"));
});

const server = http.createServer(app);
const wss = new WebSocket.Server({ server });

// helpers
function broadcast(payloadObj) {
  const data = JSON.stringify(payloadObj);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) client.send(data);
  }
}
function broadcastChat({ text, clientId = null, ts = Date.now() }) {
  broadcast({ type: "chat", text, clientId, ts });
}
function broadcastPresence() {
  broadcast({ type: "presence", count: wss.clients.size, ts: Date.now() });
}

// WebSocket connection handler 
wss.on("connection", (ws) => {
  console.log("Client connected");

  // initial greeting
  ws.send(JSON.stringify({
    type: "chat",
    text: "Welcome! Send a message and I will try to answer. Type help for options.",
    clientId: "bot",
    ts: Date.now()
  }));

  // update everyone’s online count
  broadcastPresence();

  ws.on("message", (buf) => {
    let msg;
    try { msg = JSON.parse(buf.toString()); } catch { return; }

    if (msg?.type === "typing") {
      return;
    }

    if (msg?.type !== "chat" || typeof msg.text !== "string") return;

    // 1) send the user's message to everyone 
    const clipped = msg.text.slice(0, 2000);
    const ts = msg.ts || Date.now();
    const clientId = msg.clientId || null;

    broadcastChat({ text: clipped, clientId, ts });

    // 2) simple bot logic (auto-response) -- limited using conditional statements
    const txt = clipped.toLowerCase();
    let reply = null;
    if (txt.startsWith("help")) reply = "more testing: help, tip, test";
    else if (txt.includes("hello") || txt.includes("hi")) reply = "Hi there!";
    else if (txt.includes("test")) reply = "Test received";
    else if (txt.startsWith("tip")) reply = "initial test";
    else reply = "I cannot answer that yet, sorry.";

    if (reply) {
      setTimeout(() => broadcastChat({ text: reply, clientId: "bot" }), 400);
    }
  });

  ws.on("close", () => {
    console.log("Client disconnected");
    broadcastPresence();
  });
});

// listen on all interfaces so phone can reach it
const PORT = process.env.PORT || 3000;
server.listen(PORT, "0.0.0.0", () => {
  console.log(`Open http://localhost:${PORT} or http://<ip>:${PORT}`);
});
