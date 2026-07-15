import { Dice } from "../utils/dice";
import { Logger } from "../utils/logger";

export interface SkillCheckResult {
    roll: number;
    dc: number;
    success: boolean;
}

export class SkillCheck {

    public static roll(skill: string, dc: number): SkillCheckResult {

        const roll = Dice.rollD20();

        const success = roll >= dc;

        Logger.info(`Skill Check (${skill}) → d20: ${roll} vs DC: ${dc}`);

        if (success) {
            Logger.info("✔ SUCCESSO");
        } else {
            Logger.warn("✖ FALLIMENTO");
        }

        return {
            roll,
            dc,
            success
        };
    }

}