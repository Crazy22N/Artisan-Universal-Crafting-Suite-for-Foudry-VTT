export interface ArtisanProfession {
    id: string;
    label: string;
    skill: string;
    description: string;
    maxLevel: number;
}

export interface ActorProfessionProgress {
    id: string;
    label: string;
    level: number;
    xp: number;
    maxLevel: number;
    xpForCurrentLevel: number;
    xpForNextLevel: number | null;
    xpToNextLevel: number;
    progressPercent: number;
    gatheringMultiplier: number;
    gatheringMultiplierLabel: string;
    craftingMultiplier: number;
    craftingMultiplierLabel: string;
    hasActorValue: boolean;
}

export type ActorProfessionFlagData = Record<string, {
    level?: number;
    xp?: number;
}>;

export class ProfessionService {

    private readonly professions: ArtisanProfession[] = [
        {
            id: "erborista",
            label: "Erborista",
            skill: "nature",
            description: "Raccoglie erbe, funghi, reagenti naturali e piante medicinali.",
            maxLevel: 5
        },
        {
            id: "alchimista",
            label: "Alchimista",
            skill: "arcana",
            description: "Lavora reagenti, essenze, veleni, pozioni e materiali instabili.",
            maxLevel: 5
        },
        {
            id: "fabbro",
            label: "Fabbro",
            skill: "athletics",
            description: "Lavora metalli, armi, armature, chiodi, utensili e componenti da forgia.",
            maxLevel: 5
        },
        {
            id: "cacciatore",
            label: "Cacciatore",
            skill: "survival",
            description: "Segue tracce, caccia prede e recupera carne, ossa e materiali animali.",
            maxLevel: 5
        },
        {
            id: "conciatore",
            label: "Conciatore",
            skill: "survival",
            description: "Recupera e lavora pelli, cuoio grezzo, tendini e pellicce.",
            maxLevel: 5
        },
        {
            id: "cuoco",
            label: "Cuoco",
            skill: "survival",
            description: "Prepara cibo, razioni, ingredienti commestibili e ricette alimentari.",
            maxLevel: 5
        },
        {
            id: "minatore",
            label: "Minatore",
            skill: "athletics",
            description: "Estrae minerali, pietre, gemme grezze e materiali rocciosi.",
            maxLevel: 5
        },
        {
            id: "boscaiolo",
            label: "Boscaiolo",
            skill: "survival",
            description: "Raccoglie legname, resine, cortecce e materiali forestali.",
            maxLevel: 5
        },
        {
            id: "artigiano",
            label: "Artigiano",
            skill: "sleightOfHand",
            description: "Crea, ripara e rifinisce oggetti comuni, utensili e componenti artigianali.",
            maxLevel: 5
        },
        {
            id: "sarto",
            label: "Sarto",
            skill: "sleightOfHand",
            description: "Lavora stoffe, abiti, imbottiture, fili e materiali tessili.",
            maxLevel: 5
        },
    ];

    private readonly levelXpThresholds: Record<number, number> = {
        0: 0,
        1: 100,
        2: 500,
        3: 1500,
        4: 3000,
        5: 5000
    };

    public getProfessions(): ArtisanProfession[] {

        return [...this.professions];

    }

    public getOptions(): object[] {

        return this.professions.map(profession => ({
            id: profession.id,
            label: this.getLocalizedLabel(profession),
            skill: profession.skill,
            description: this.getLocalizedDescription(profession),
            maxLevel: profession.maxLevel
        }));

    }

    public getProfession(id: string): ArtisanProfession | null {

        const clean = this.normalizeId(id);

        return this.professions.find(profession => profession.id === clean) ?? null;

    }

    public getLabel(id: string): string {

        if (!id) {
            return "Non impostata";
        }

        const profession = this.getProfession(id);

        return profession ? this.getLocalizedLabel(profession) : id;

    }

    public getDefaultSkill(id: string): string | null {

        return this.getProfession(id)?.skill ?? null;

    }

    public getMaxLevel(id: string): number {

        return this.getProfession(id)?.maxLevel ?? 5;

    }

    public normalizeLevel(value: unknown): number {

        const level = Math.floor(Number(value ?? 1));

        if (!Number.isFinite(level)) {
            return 1;
        }

        return Math.min(5, Math.max(0, level));

    }

    public getLevelLabel(value: unknown): string {

        return `${game.i18n.localize("ARTISAN.Level")} ${this.normalizeLevel(value)}`;

    }

    public getActorProfessions(actor: Actor | null | undefined): ActorProfessionProgress[] {

        return this.getProfessions().map(profession => {
            return this.getActorProfession(actor, profession.id);
        });

    }

    public getActorProfession(
        actor: Actor | null | undefined,
        professionId: string
    ): ActorProfessionProgress {

        const profession = this.getProfession(professionId);

        const id = profession
            ? profession.id
            : this.normalizeId(professionId || "sconosciuta");

        const label = profession
            ? this.getLocalizedLabel(profession)
            : (professionId || game.i18n.localize("ARTISAN.Unknown"));

        const maxLevel = profession?.maxLevel ?? 5;

        const stored = this.getActorProfessionFlagData(actor)[id];

        const hasActorValue = !!stored;

        const level = hasActorValue
            ? this.normalizeLevel(stored.level ?? 0)
            : 0;

        const xp = Math.max(0, Math.floor(Number(stored?.xp ?? 0)));

        const progression = this.getProgressionInfo(level, xp, maxLevel);

        return {
            id,
            label,
            level,
            xp,
            maxLevel,
            xpForCurrentLevel: progression.xpForCurrentLevel,
            xpForNextLevel: progression.xpForNextLevel,
            xpToNextLevel: progression.xpToNextLevel,
            progressPercent: progression.progressPercent,
            gatheringMultiplier: this.getGatheringMultiplier(level),
            gatheringMultiplierLabel: this.getMultiplierLabel(level),
            craftingMultiplier: this.getCraftingMultiplier(level),
            craftingMultiplierLabel: this.getMultiplierLabel(level),
            hasActorValue
        };

    }

    public getActorProfessionLevel(
        actor: Actor | null | undefined,
        professionId: string
    ): number {

        return this.getActorProfession(actor, professionId).level;

    }

    public async setActorProfession(
        actor: Actor,
        professionId: string,
        level: unknown,
        xp?: unknown
    ): Promise<void> {

        const id = this.getProfession(professionId)
            ? this.normalizeId(professionId)
            : this.normalizeId(professionId || "sconosciuta");

        const current = this.getActorProfession(actor, id);

        const nextLevel = this.normalizeLevel(level ?? current.level);

        const nextXp = Math.max(0, Math.floor(Number(xp ?? current.xp ?? 0)));

        const all = this.getActorProfessionFlagData(actor);

        all[id] = {
            level: nextLevel,
            xp: nextXp
        };

        await actor.setFlag("artisan", "professions", all);

    }

    public async addActorProfessionXp(
        actor: Actor,
        professionId: string,
        xpToAdd: unknown
    ): Promise<ActorProfessionProgress> {

        const current = this.getActorProfession(actor, professionId);

        const amount = Math.max(0, Math.floor(Number(xpToAdd ?? 0)));

        const nextXp = current.xp + amount;

        const levelFromXp = this.getLevelFromXp(nextXp, current.maxLevel);

        const nextLevel = Math.max(current.level, levelFromXp);

        await this.setActorProfession(
            actor,
            current.id,
            nextLevel,
            nextXp
        );

        return this.getActorProfession(actor, current.id);

    }

    public getLevelFromXp(xp: unknown, maxLevel: unknown = 5): number {

        const totalXp = Math.max(0, Math.floor(Number(xp ?? 0)));

        const maximum = this.normalizeLevel(maxLevel);

        let level = 0;

        for (let candidate = 0; candidate <= maximum; candidate += 1) {
            const threshold = this.getXpThresholdForLevel(candidate);

            if (totalXp >= threshold) {
                level = candidate;
            }
        }

        return Math.min(maximum, level);

    }

    public getXpThresholdForLevel(level: unknown): number {

        const normalized = this.normalizeLevel(level);

        return this.levelXpThresholds[normalized] ?? 0;

    }

    public getNextLevelXp(level: unknown, maxLevel: unknown = 5): number | null {

        const currentLevel = this.normalizeLevel(level);

        const maximum = this.normalizeLevel(maxLevel);

        if (currentLevel >= maximum) {
            return null;
        }

        return this.getXpThresholdForLevel(currentLevel + 1);

    }

    public getProgressionInfo(
        level: unknown,
        xp: unknown,
        maxLevel: unknown = 5
    ): {
        xpForCurrentLevel: number;
        xpForNextLevel: number | null;
        xpToNextLevel: number;
        progressPercent: number;
    } {

        const currentLevel = this.normalizeLevel(level);

        const totalXp = Math.max(0, Math.floor(Number(xp ?? 0)));

        const currentThreshold = this.getXpThresholdForLevel(currentLevel);

        const nextThreshold = this.getNextLevelXp(currentLevel, maxLevel);

        if (nextThreshold === null) {
            return {
                xpForCurrentLevel: currentThreshold,
                xpForNextLevel: null,
                xpToNextLevel: 0,
                progressPercent: 100
            };
        }

        const span = Math.max(1, nextThreshold - currentThreshold);

        const progress = Math.min(
            span,
            Math.max(0, totalXp - currentThreshold)
        );

        return {
            xpForCurrentLevel: currentThreshold,
            xpForNextLevel: nextThreshold,
            xpToNextLevel: Math.max(0, nextThreshold - totalXp),
            progressPercent: Math.round((progress / span) * 100)
        };

    }

    private getActorProfessionFlagData(actor: Actor | null | undefined): ActorProfessionFlagData {

        if (!actor) {
            return {};
        }

        const value = actor.getFlag("artisan", "professions") as unknown;

        if (!value || typeof value !== "object" || Array.isArray(value)) {
            return {};
        }

        const data = foundry.utils.deepClone(value) as ActorProfessionFlagData;

        if (data.archeologo && !data.fabbro) {
            data.fabbro = foundry.utils.deepClone(data.archeologo);
        }

        if (data.pescatore && !data.cacciatore) {
            data.cacciatore = foundry.utils.deepClone(data.pescatore);
        }

        return data;

    }

    public getGatheringMultiplier(value: unknown): number {

        return this.getLevelMultiplier(value);

    }

    public getCraftingMultiplier(value: unknown): number {

        return this.getLevelMultiplier(value);

    }

    public getMultiplierLabel(value: unknown): string {

        return `x${this.formatMultiplier(this.getLevelMultiplier(value))}`;

    }

    public getLevelMultiplier(value: unknown): number {

        const multipliers: Record<number, number> = {
            0: 1,
            1: 1.2,
            2: 1.5,
            3: 2,
            4: 2.5,
            5: 3
        };

        return multipliers[this.normalizeLevel(value)] ?? 1;

    }

    private formatMultiplier(value: number): string {

        const selectedLanguage = String(
            game.settings.get("artisan", "interfaceLanguage") ?? "system"
        );

        const locale = selectedLanguage === "system"
            ? String(game.i18n.lang ?? navigator.language ?? "it")
            : selectedLanguage;

        return new Intl.NumberFormat(locale, {
            maximumFractionDigits: 1
        }).format(value);

    }

    private getLocalizedLabel(profession: ArtisanProfession): string {

        const key = `ARTISAN.Profession.${profession.id}.Label`;
        const localized = game.i18n.localize(key);

        return localized === key ? profession.label : localized;

    }

    private getLocalizedDescription(profession: ArtisanProfession): string {

        const key = `ARTISAN.Profession.${profession.id}.Description`;
        const localized = game.i18n.localize(key);

        return localized === key ? profession.description : localized;

    }

    public normalizeId(id: string): string {

        const normalized = String(id ?? "")
            .trim()
            .toLowerCase();

        if (normalized === "archeologo") {
            return "fabbro";
        }

        if (normalized === "pescatore") {
            return "cacciatore";
        }

        return normalized;

    }

}
