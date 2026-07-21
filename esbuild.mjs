import { build, context } from "esbuild";
import { cpSync, rmSync, existsSync, mkdirSync } from "node:fs";
import { basename, dirname, parse, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import config from "./build.config.mjs";

const isWatch = process.argv.includes("--watch");
const projectRoot = dirname(fileURLToPath(import.meta.url));
const outdir = resolve(projectRoot, config.destination);

if (outdir === projectRoot) {
    throw new Error("La cartella di build non può coincidere con la radice del progetto.");
}

if (basename(outdir) !== config.moduleName) {
    throw new Error(`La cartella di build deve terminare con /${config.moduleName}.`);
}

if (dirname(outdir) === parse(outdir).root) {
    throw new Error("La cartella di build non può trovarsi direttamente nella radice del disco.");
}

if (existsSync(outdir)) {
    rmSync(outdir, { recursive: true, force: true });
}
mkdirSync(outdir, { recursive: true });

function copy(src, dest) {
    const source = resolve(projectRoot, src);

    if (existsSync(source)) {
        cpSync(source, dest, { recursive: true });
    }
}

function copyStaticFiles() {
    copy("module.json", `${outdir}/module.json`);
    copy("lang", `${outdir}/lang`);
    copy("styles", `${outdir}/styles`);
    copy("templates", `${outdir}/templates`);
    copy("README.md", `${outdir}/README.md`);
    copy("CHANGELOG.md", `${outdir}/CHANGELOG.md`);
    copy("LICENSE", `${outdir}/LICENSE`);
}

const buildOptions = {
    entryPoints: [resolve(projectRoot, "src/module.ts")],
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
