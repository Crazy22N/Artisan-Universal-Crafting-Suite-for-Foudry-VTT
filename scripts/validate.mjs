import { existsSync, readFileSync, readdirSync } from "node:fs";
import { dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const errors = [];

function fail(message) {
    errors.push(message);
}

function readJson(relativePath) {
    const absolutePath = resolve(projectRoot, relativePath);

    try {
        return JSON.parse(readFileSync(absolutePath, "utf8"));
    } catch (error) {
        fail(`${relativePath}: JSON non valido (${error.message})`);
        return {};
    }
}

function collectFiles(directory, extensions) {
    const results = [];

    if (!existsSync(directory)) {
        return results;
    }

    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const absolutePath = join(directory, entry.name);

        if (entry.isDirectory()) {
            results.push(...collectFiles(absolutePath, extensions));
        } else if (extensions.has(extname(entry.name))) {
            results.push(absolutePath);
        }
    }

    return results;
}

function assertFlatTranslationFile(relativePath) {
    const absolutePath = resolve(projectRoot, relativePath);
    const content = readFileSync(absolutePath, "utf8");
    const seen = new Set();

    for (const match of content.matchAll(/^\s*"([^"]+)"\s*:/gm)) {
        const key = match[1];

        if (seen.has(key)) {
            fail(`${relativePath}: chiave duplicata ${key}`);
        }

        seen.add(key);
    }
}

const manifest = readJson("module.json");
const packageJson = readJson("package.json");

if (manifest.id !== "artisan") {
    fail("module.json: id deve essere artisan");
}

if (!/^\d+\.\d+\.\d+$/.test(String(manifest.version ?? ""))) {
    fail("module.json: versione non valida");
}

if (manifest.version !== packageJson.version) {
    fail(`Versioni non allineate: module.json=${manifest.version}, package.json=${packageJson.version}`);
}

const expectedArchive = `artisan-v${manifest.version}.zip`;

if (!String(manifest.download ?? "").endsWith(`/v${manifest.version}/${expectedArchive}`)) {
    fail("module.json: URL download non allineato alla versione");
}

if (!String(manifest.manifest ?? "").endsWith("/releases/latest/download/module.json")) {
    fail("module.json: URL manifest latest non valido");
}

for (const relativePath of [
    ...(manifest.esmodules ?? []),
    ...(manifest.styles ?? []),
    ...(manifest.languages ?? []).map(language => language.path)
]) {
    if (!existsSync(resolve(projectRoot, relativePath)) && !existsSync(resolve(projectRoot, "dist/artisan", relativePath))) {
        fail(`File dichiarato nel manifest non trovato: ${relativePath}`);
    }
}

const languageFiles = manifest.languages ?? [];
const dictionaries = new Map();

for (const language of languageFiles) {
    assertFlatTranslationFile(language.path);
    dictionaries.set(language.lang, readJson(language.path));
}

const italianKeys = new Set(Object.keys(dictionaries.get("it") ?? {}));
const englishKeys = new Set(Object.keys(dictionaries.get("en") ?? {}));

for (const key of italianKeys) {
    if (!englishKeys.has(key)) {
        fail(`Traduzione inglese mancante: ${key}`);
    }
}

for (const key of englishKeys) {
    if (!italianKeys.has(key)) {
        fail(`Traduzione italiana mancante: ${key}`);
    }
}

const localizationSources = [
    resolve(projectRoot, "templates/artisan-manager.hbs"),
    ...collectFiles(resolve(projectRoot, "src"), new Set([".ts"]))
];

const templateContent = readFileSync(
    resolve(projectRoot, "templates/artisan-manager.hbs"),
    "utf8"
);

const rawTextNodes = templateContent.match(/>\s*[A-Za-zÀ-ÿ][^<{]*</g) ?? [];
const rawLocalizedAttributes = (templateContent.match(
    /(?:placeholder|title)="(?!\{\{localize\s)[^"{]*[A-Za-zÀ-ÿ][^"]*"/g
) ?? []).filter(attribute => !/^placeholder="\d+d\d+"$/i.test(attribute));

if (rawTextNodes.length > 0) {
    fail(`Template: testo non localizzato (${rawTextNodes[0].trim()})`);
}

if (rawLocalizedAttributes.length > 0) {
    fail(`Template: attributo non localizzato (${rawLocalizedAttributes[0]})`);
}

const usedKeys = new Set();
const keyPattern = /ARTISAN\.[A-Za-z0-9_.]+/g;

for (const file of localizationSources) {
    const content = readFileSync(file, "utf8");

    for (const key of content.match(keyPattern) ?? []) {
        if (key.endsWith(".")) {
            continue;
        }

        usedKeys.add(key);
    }
}

for (const key of usedKeys) {
    if (!italianKeys.has(key) || !englishKeys.has(key)) {
        fail(`Chiave usata ma non tradotta: ${key}`);
    }
}

const distRoot = resolve(projectRoot, "dist/artisan");

if (existsSync(distRoot)) {
    for (const relativePath of [
        "module.json",
        "module.js",
        "module.js.map",
        "styles/artisan.css",
        "templates/artisan-manager.hbs",
        "lang/it.json",
        "lang/en.json"
    ]) {
        if (!existsSync(resolve(distRoot, relativePath))) {
            fail(`Build incompleta: dist/artisan/${relativePath}`);
        }
    }

    const builtManifest = readJson("dist/artisan/module.json");

    if (builtManifest.version !== manifest.version) {
        fail("Build: versione manifest diversa dal sorgente");
    }
}

if (errors.length > 0) {
    console.error("\nValidazione Artisan fallita:\n");
    for (const error of errors) {
        console.error(`- ${error}`);
    }
    process.exit(1);
}

console.log(`Validazione Artisan ${manifest.version} completata: ${usedKeys.size} chiavi controllate.`);
