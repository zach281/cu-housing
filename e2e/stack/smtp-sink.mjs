// Minimal SMTP server that accepts every message and writes it to OUTBOX_DIR
// as <timestamp>-<recipient>.eml. TEST ONLY: lets end-to-end tests read the
// confirmation and password-reset links the auth server sends.
import net from "node:net";
import fs from "node:fs";
import path from "node:path";

const PORT = Number(process.env.SMTP_PORT ?? 2500);
const OUTBOX = process.env.OUTBOX_DIR;
if (!OUTBOX) throw new Error("OUTBOX_DIR required");
fs.mkdirSync(OUTBOX, { recursive: true });

net
  .createServer((sock) => {
    let rcpt = "unknown";
    let inData = false;
    let data = "";
    let buf = "";
    const say = (l) => sock.write(l + "\r\n");
    say("220 sink ESMTP");
    sock.on("data", (chunk) => {
      buf += chunk.toString("utf8");
      let i;
      while ((i = buf.indexOf("\r\n")) >= 0) {
        const line = buf.slice(0, i);
        buf = buf.slice(i + 2);
        if (inData) {
          if (line === ".") {
            inData = false;
            const file = path.join(OUTBOX, `${Date.now()}-${rcpt.replace(/[^a-z0-9@._-]/gi, "_")}.eml`);
            fs.writeFileSync(file, data);
            data = "";
            say("250 OK");
          } else data += (line.startsWith("..") ? line.slice(1) : line) + "\n";
          continue;
        }
        const cmd = line.slice(0, 4).toUpperCase();
        if (cmd === "EHLO" || cmd === "HELO") { sock.write("250-sink\r\n250-AUTH PLAIN LOGIN\r\n250 OK\r\n"); }
        else if (cmd === "AUTH") say("235 OK");
        else if (cmd === "MAIL") say("250 OK");
        else if (cmd === "RCPT") { rcpt = (line.match(/<([^>]+)>/) ?? [])[1] ?? rcpt; say("250 OK"); }
        else if (cmd === "DATA") { inData = true; say("354 go"); }
        else if (cmd === "QUIT") { say("221 bye"); sock.end(); }
        else say("250 OK");
      }
    });
    sock.on("error", () => {});
  })
  .listen(PORT, () => console.log(`smtp sink on :${PORT}`));
