// Temporary mock backend for local reproduction of the flicker/freeze bug.
// Mimics POST http://localhost:8000/api/generate -> { "svg": "<svg.../>" }
const http = require("http");

function buildSVG(count) {
    const parts = [
        `<defs>
        <linearGradient id="g1" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stop-color="#FF6B35"/>
            <stop offset="100%" stop-color="#FF312E"/>
        </linearGradient>
        <radialGradient id="g2">
            <stop offset="0%" stop-color="#4FC3F7"/>
            <stop offset="100%" stop-color="#1565C0"/>
        </radialGradient>
    </defs>`
    ];
    for (let i = 0; i < count; i++) {
        const x = ((i * 47) % 700) + 30;
        const y = ((i * 31) % 500) + 30;
        const w = 18 + (i % 4) * 14;
        const h = 18 + (i % 4) * 14;
        if (i % 6 === 0) {
            parts.push(`<text x="${x}" y="${y}" font-family="Arial" font-size="18" fill="#333">Label ${i}</text>`);
        } else if (i % 6 === 1) {
            parts.push(`<path d="M${x} ${y} L${x + w} ${y + h} L${x} ${y + h} Z" fill="url(#g1)"/>`);
        } else {
            parts.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3" fill="url(#g2)"/>`);
        }
    }
    return (
        `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">` +
        parts.join("") +
        `</svg>`
    );
}

http
    .createServer((req, res) => {
        const chunks = [];
        req.on("data", (c) => chunks.push(c));
        req.on("end", () => {
            if (req.method === "OPTIONS") {
                res.writeHead(204, {
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                    "Access-Control-Allow-Headers": "Content-Type",
                    "Access-Control-Allow-Methods": "POST",
                });
                res.end();
                return;
            }
            if (req.method === "POST" && req.url === "/api/generate") {
                const body = JSON.parse(Buffer.concat(chunks).toString() || "{}");
                const count = (body.prompt || "").includes("BIG") ? 400 : 12;
                console.log("generate:", (body.prompt || "").slice(0, 30), "shapes:", count);
                res.writeHead(200, {
                    "Content-Type": "application/json",
                    "Access-Control-Allow-Origin": "http://localhost:3000",
                });
                res.end(JSON.stringify({ svg: buildSVG(count) }));
            } else {
                res.writeHead(200, { "Access-Control-Allow-Origin": "http://localhost:3000" });
                res.end("ok");
            }
        });
    })
    .listen(8000, () => console.log("mock backend listening on :8000"));