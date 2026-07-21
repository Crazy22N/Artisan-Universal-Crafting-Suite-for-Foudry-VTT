import AdmZip from "adm-zip";
import { createHash } from "node:crypto";
import {
    copyFileSync,
    existsSync,
    mkdirSync,
    readFileSync,
    readdirSync,
    rmSync,
    writeFileSync
} from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const manifest = JSON.parse(readFileSync(resolve(projectRoot, "module.json"), "utf8"));
const version = String(manifest.version);
const distRoot = resolve(projectRoot, "dist/artisan");
const releaseRoot = resolve(projectRoot, "release");

if (!existsSync(resolve(distRoot, "module.js"))) {
    throw new Error("Build mancante. Esegui npm run build prima di creare la release.");
}

mkdirSync(releaseRoot, { recursive: true });

const installableName = `artisan-v${version}.zip`;
const sourceName = `artisan-source-v${version}.zip`;
const installablePath = resolve(releaseRoot, installableName);
const sourcePath = resolve(releaseRoot, sourceName);
const releaseManifestPath = resolve(releaseRoot, "module.json");

for (const file of [installablePath, sourcePath, releaseManifestPath]) {
    if (existsSync(file)) {
        rmSync(file, { force: true });
    }
}

const installableZip = new AdmZip();
installableZip.addLocalFolder(distRoot, "artisan");
installableZip.writeZip(installablePath);

copyFileSync(resolve(distRoot, "module.js"), resolve(projectRoot, "module.js"));
copyFileSync(resolve(distRoot, "module.js.map"), resolve(projectRoot, "module.js.map"));

const ignoredDirectories = new Set([".git", "dist", "node_modules", "release"]);
const sourceZip = new AdmZip();

function addSourceTree(directory) {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        if (entry.isDirectory() && ignoredDirectories.has(entry.name)) {
            continue;
        }

        const absolutePath = join(directory, entry.name);

        if (entry.isDirectory()) {
            addSourceTree(absolutePath);
            continue;
        }

        if (!entry.isFile()) {
            continue;
        }

        const relativePath = relative(projectRoot, absolutePath).replaceAll("\\", "/");
        const zipFolder = dirname(`artisan/${relativePath}`).replaceAll("\\", "/");
        sourceZip.addLocalFile(absolutePath, zipFolder === "." ? "artisan" : zipFolder, basename(relativePath));
    }
}

addSourceTree(projectRoot);
sourceZip.writeZip(sourcePath);
copyFileSync(resolve(projectRoot, "module.json"), releaseManifestPath);

function sha256(file) {
    return createHash("sha256").update(readFileSync(file)).digest("hex");
}

const checksumLines = [installablePath, sourcePath, releaseManifestPath]
    .map(file => `${sha256(file)}  ${basename(file)}`)
    .join("\n");

writeFileSync(resolve(releaseRoot, "SHA256SUMS.txt"), `${checksumLines}\n`, "utf8");

console.log(`Release Artisan ${version} creata in ${releaseRoot}`);
