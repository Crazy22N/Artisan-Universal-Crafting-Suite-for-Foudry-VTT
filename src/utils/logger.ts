import { MODULE_TITLE } from "../core/constants";

export class Logger {

    static info(message: string): void {
        console.log(`%c[${MODULE_TITLE}] ${message}`, "color: orange");
    }

    static warn(message: string): void {
        console.warn(`[${MODULE_TITLE}] ${message}`);
    }

    static error(message: string): void {
        console.error(`[${MODULE_TITLE}] ${message}`);
    }

    static debug(message: string): void {
        console.debug(`[${MODULE_TITLE} DEBUG] ${message}`);
    }
}