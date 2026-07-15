import { build, context } from "esbuild";
import { cpSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import config from "./build.config.mjs";

const isWatch = process.argv.includes("--watch");
const outdir = resolve(config.destination);

if (existsSync(outdir)) {
    rmSync(outdir, { recursive: true, force: true });
}
mkdirSync(outdir, { recursive: true });

function copy(src, dest) {
    if (existsSync(src)) {
        cpSync(src, dest, { recursive: true });
    }
}

function copyStaticFiles() {
    copy("module.json", `${outdir}/module.json`);
    copy("lang", `${outdir}/lang`);
    copy("styles", `${outdir}/styles`);
    copy("templates", `${outdir}/templates`);
}

const buildOptions = {
    entryPoints: ["src/module.ts"],
    bundle: true,
    outfile: `${outdir}/module.js`,
    format: "esm",
    platform: "browser",
    target: "es2022",
    sourcemap: true,
    logLevel: "info"
};

if (isWatch) {
    console.log("👀 Watch mode attivo... In ascolto per modifiche...");
    
    const watchPlugin = {
        name: "watch-assets",
        setup(build) {
            build.onEnd((result) => {
                if (result.errors.length === 0) {
                    copyStaticFiles();
                    console.log("🔁 Ricompilazione e copia asset completate");
                }
            });
        }
    };

    const ctx = await context({
        ...buildOptions,
        plugins: [watchPlugin]
    });

    await ctx.watch();
} else {
    try {
        await build(buildOptions);
        copyStaticFiles();
        console.log("\n✔ Artisan build completata con successo!\n");
    } catch (error) {
        console.error("❌ Errore durante la build:", error);
        process.exit(1);
    }
}