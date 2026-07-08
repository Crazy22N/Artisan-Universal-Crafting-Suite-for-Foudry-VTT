import { build } from "esbuild";
import { cpSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import config from "./build.config.mjs";

const isWatch = process.argv.includes("--watch");

const outdir = resolve(config.destination);

// Pulisce la cartella destinazione
if (existsSync(outdir)) {
    rmSync(outdir, { recursive: true, force: true });
}
mkdirSync(outdir, { recursive: true });

// Funzione copia sicura
function copy(src, dest) {
    if (existsSync(src)) {
        cpSync(src, dest, { recursive: true });
    }
}

// Build TypeScript → JS
async function buildModule() {
    await build({
        entryPoints: ["src/module.ts"],
        bundle: true,
        outfile: `${outdir}/module.js`,
        format: "esm",
        platform: "browser",
        target: "es2022",
        sourcemap: true,
        logLevel: "info"
    });

    // Copia file statici
    copy("module.json", `${outdir}/module.json`);
    copy("src/lang", `${outdir}/lang`);
    copy("src/styles", `${outdir}/styles`);
    copy("src/templates", `${outdir}/templates`);

    console.log("\n✔ Artisan build completata\n");
}

// Watch mode
if (isWatch) {
    console.log("👀 Watch mode attivo...");
    buildModule();
    const { context } = await build({
        entryPoints: ["src/module.ts"],
        bundle: true,
        outfile: `${outdir}/module.js`,
        format: "esm",
        platform: "browser",
        target: "es2022",
        sourcemap: true,
        logLevel: "info",
        watch: {
            onRebuild(error) {
                if (error) console.error("❌ Build error:", error);
                else console.log("🔁 Ricompilazione completata");
            }
        }
    });
} else {
    await buildModule();
}