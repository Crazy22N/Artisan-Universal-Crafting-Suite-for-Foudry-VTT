import { MODULE_ID } from "../core/constants";
import { Logger } from "../utils/logger";

export class ArtisanSettings {

    public static register(): void {

        Logger.info("Registering settings...");

        game.settings.register(MODULE_ID, "debugMode", {
            name: "Debug Mode",
            hint: "Abilita log dettagliati per Artisan",
            scope: "world",
            config: true,
            type: Boolean,
            default: false
        });

        game.settings.register(MODULE_ID, "craftingDifficulty", {
            name: "Crafting Difficulty",
            hint: "Modificatore globale difficoltà crafting",
            scope: "world",
            config: true,
            type: Number,
            default: 0
        });

        game.settings.register(MODULE_ID, "breakChanceMultiplier", {
            name: "Tool Break Chance",
            hint: "Moltiplicatore probabilità rottura strumenti",
            scope: "world",
            config: true,
            type: Number,
            default: 1
        });

        Logger.info("Settings registrati");
    }

    public static isDebug(): boolean {
        return game.settings.get(MODULE_ID, "debugMode") as boolean;
    }

    public static getCraftingDifficulty(): number {
        return game.settings.get(MODULE_ID, "craftingDifficulty") as number;
    }

    public static getBreakMultiplier(): number {
        return game.settings.get(MODULE_ID, "breakChanceMultiplier") as number;
    }
}