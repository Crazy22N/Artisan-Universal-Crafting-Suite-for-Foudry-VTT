import process from "node:process";

const customDestination = String(
    process.env.ARTISAN_BUILD_DIR ?? ""
).trim();

export default {
    moduleName: "artisan",
    source: "./src",
    destination: customDestination || "dist/artisan"
};
