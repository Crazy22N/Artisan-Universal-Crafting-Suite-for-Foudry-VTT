import process from "node:process";
import path from "node:path";
import os from "node:os";

const home = os.homedir();
let foundryPath = "";

if (process.platform === "win32") {
    const localAppData = process.env.LOCALAPPDATA || "";
    foundryPath = path.join(localAppData, "FoundryVTT", "Data", "modules", "artisan");
} else if (process.platform === "darwin") {
    foundryPath = path.join(home, "Library", "Application Support", "FoundryVTT", "Data", "modules", "artisan");
} else {
    foundryPath = path.join(home, ".local", "share", "FoundryVTT", "Data", "modules", "artisan");
}

export default {
    moduleName: "artisan",
    source: "./src",
    destination: foundryPath.replace(/\\/g, "/")
};