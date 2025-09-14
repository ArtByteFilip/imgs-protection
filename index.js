const http = require("http");
const fs = require("fs");
const crypto = require("crypto");
const formidable = require("formidable");
const readline = require("readline");

const hostname = "localhost";
const port = 3333;

const dataFile = "data.json";
const keyFile = "key.json";

function getKeyAndIv() {
    if (fs.existsSync(keyFile)) {
        const { key, iv } = JSON.parse(fs.readFileSync(keyFile, "utf8"));
        return {
            encryptionKey: Buffer.from(key, "hex"),
            iv: Buffer.from(iv, "hex")
        };
    } else {
        const encryptionKey = crypto.randomBytes(32);
        const iv = crypto.randomBytes(16);
        fs.writeFileSync(keyFile, JSON.stringify({
            key: encryptionKey.toString("hex"),
            iv: iv.toString("hex")
        }));
        return { encryptionKey, iv };
    }
}

const { encryptionKey, iv } = getKeyAndIv();

function encryptData(buffer) {
    const cipher = crypto.createCipheriv("aes-256-cbc", encryptionKey, iv);
    const encrypted = Buffer.concat([
        cipher.update(buffer),
        cipher.final()
    ]);
    return encrypted.toString("base64");
}

function decryptData(encryptedData) {
    const decipher = crypto.createDecipheriv("aes-256-cbc", encryptionKey, iv);
    const decrypted = Buffer.concat([
        decipher.update(Buffer.from(encryptedData, "base64")),
        decipher.final()
    ]);
    return decrypted;
}

function saveData(data) {
    const json = JSON.stringify(data);
    const encryptedData = encryptData(Buffer.from(json, "utf8"));
    fs.writeFileSync(dataFile, encryptedData, "utf8");
}

function loadData() {
    if (!fs.existsSync(dataFile)) {
        return [];
    }
    const encryptedData = fs.readFileSync(dataFile, "utf8");
    const decryptedData = decryptData(encryptedData);
    return JSON.parse(decryptedData.toString("utf8"));
}

let storage = loadData();

let AUTH_KEY = null;
const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});
rl.question("Enter gallery key (will not be saved): ", (answer) => {
    AUTH_KEY = answer;
    rl.close();
    startServer();
});

function checkAuth(req, res) {
    const authHeader = req.headers["authorization"];
    if (!authHeader) {
        res.writeHead(401, { "WWW-Authenticate": "Basic realm=\"Gallery\"" });
        res.end("Authentication required");
        return false;
    }
    const base64 = authHeader.split(" ")[1];
    const [user, pass] = Buffer.from(base64, "base64").toString().split(":");
    if (pass !== AUTH_KEY) {
        res.writeHead(401, { "WWW-Authenticate": "Basic realm=\"Gallery\"" });
        res.end("Invalid credentials");
        return false;
    }
    return true;
}

function startServer() {
    const server = http.createServer((req, res) => {
        if (!checkAuth(req, res)) return;
        if (req.method === "GET") {
            res.statusCode = 200;
            res.setHeader("Content-Type", "text/html");
            const images = storage.map((img, idx) => {
                const buffer = decryptData(img.data);
                const base64 = buffer.toString("base64");
                return `
                    <div class="bg-[#191919] rounded-lg shadow-lg overflow-hidden hover:scale-105 transition-transform duration-200 border-2 border-[#eb2e4c]">
                        <img src="data:${img.mimetype};base64,${base64}" 
                             class="w-full h-48 object-cover cursor-pointer"
                             onclick="showLightbox('${base64}', '${img.mimetype}')"
                             alt="Image ${idx+1}" />
                    </div>
                `;
            }).join("");
            res.end(`
                <!DOCTYPE html>
                <html lang="en">
                <head>
                    <meta charset="UTF-8">
                    <title>Gallery</title>
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
                    <script src="https://cdn.tailwindcss.com"></script>
                    <style>
                        body { background-color: #191919; }
                        .accent { color: #eb2e4c; }
                        .accent-bg { background-color: #eb2e4c; }
                        .accent-border { border-color: #eb2e4c; }
                    </style>
                </head>
                <body class="min-h-screen flex flex-col items-center text-white">
                    <div class="w-full max-w-2xl mt-10 p-6 bg-[#191919] rounded-xl shadow-xl border-4 accent-border">
                        <h1 class="text-4xl font-extrabold mb-6 text-center accent drop-shadow">Gallery</h1>
                        <form action="/" method="post" enctype="multipart/form-data" class="flex flex-col md:flex-row items-center gap-4 mb-8">
                            <input type="file" name="file" accept="image/*" multiple required class="flex-1 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-[#eb2e4c] file:text-white hover:file:bg-pink-600" />
                            <button type="submit" class="accent-bg hover:bg-pink-600 text-white font-bold py-2 px-6 rounded-lg shadow transition border-2 border-[#191919]">Upload</button>
                        </form>
                        <h2 class="text-2xl font-semibold mb-4 accent">Uploaded Images</h2>
                        <div class="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                            ${images}
                        </div>
                    </div>
                    <footer class="mt-8 accent text-sm">
                        Gallery
                    </footer>
                    <div id="lightbox" class="fixed inset-0 bg-black bg-opacity-80 flex items-center justify-center z-50 hidden" onclick="hideLightbox()">
                        <img id="lightbox-img" src="" class="max-w-full max-h-full rounded-lg border-4 accent-border shadow-2xl" />
                    </div>
                    <script>
                        function showLightbox(base64, mimetype) {
                            const lightbox = document.getElementById('lightbox');
                            const img = document.getElementById('lightbox-img');
                            img.src = 'data:' + mimetype + ';base64,' + base64;
                            lightbox.style.display = 'flex';
                        }
                        function hideLightbox() {
                            document.getElementById('lightbox').style.display = 'none';
                        }
                    </script>
                </body>
                </html>
            `);
        } else if (req.method === "POST") {
            const form = new formidable.IncomingForm();
            form.parse(req, async (err, fields, files) => {
                if (err) {
                    res.statusCode = 500;
                    res.end("Error processing file upload");
                    return;
                }
                const fileArr = files.file;
                const filesToProcess = Array.isArray(fileArr) ? fileArr : [fileArr];
                let anyUploaded = false;
                for (const file of filesToProcess) {
                    if (!file) continue;
                    const buffer = await fs.promises.readFile(file.filepath);
                    const encryptedImage = encryptData(buffer);
                    storage.push({
                        data: encryptedImage,
                        mimetype: file.mimetype || "image/png"
                    });
                    anyUploaded = true;
                }
                if (anyUploaded) {
                    saveData(storage);
                    res.writeHead(302, { Location: "/" });
                    res.end();
                } else {
                    res.statusCode = 400;
                    res.end("No files uploaded.");
                }
            });
        }
    });

    if (!fs.existsSync("uploads")) {
        fs.mkdirSync("uploads");
    }

    server.listen(port, hostname, () => {
        console.log(`Server running at http://${hostname}:${port}/`);
    });
}