import { ProfessionService } from "./profession-service";

export type HarvestComponentCollection = "resources" | "tools";

export type HarvestPartRarity = "common" | "uncommon" | "rare" | "veryRare" | "legendary";

export type HarvestOutputMode = "random" | "all";

export interface HarvestComponent {
    uuid: string;
    quantity: number;
    weight: number;
    minQuantity: number;
    maxQuantity: number;
    rarity: HarvestPartRarity;
    requiredToolUuid: string;
}

export interface HarvestComponentView extends HarvestComponent {
    index: number;
    collection: HarvestComponentCollection;
    profileId: string;
    name: string;
    img: string;
    found: boolean;
    documentType: string;
    quantityLabel: string;
    rarityLabel: string;
    requiredToolName: string;
    requiredToolFound: boolean;
}

export interface HarvestProfile {
    id: string;
    name: string;
    biome: string;
    creatureType: string;
    profession: string;
    professionLevel: number;
    skill: string;
    dc: number;
    time: number;
    maxResources: number;
    harvestOutputMode: HarvestOutputMode;
    toolRequirement: string;
    toolCriticalDamage: boolean;
    consumeRequiredTools: boolean;
    resources: HarvestComponent[];
    tools: HarvestComponent[];
}

interface HarvestProfileView extends HarvestProfile {
    resources: HarvestComponentView[];
    tools: HarvestComponentView[];
    resourceCount: number;
    toolCount: number;
    totalResourceWeight: number;
    gatheringMultiplier: number;
    gatheringMultiplierLabel: string;
    craftingMultiplier: number;
    craftingMultiplierLabel: string;
}

interface AddHarvestComponentOptions {
    weight?: number;
    minQuantity?: number;
    maxQuantity?: number;
    rarity?: string;
    requiredToolUuid?: string;
}

interface SelectedHarvestResource extends HarvestComponentView {
    rolledQuantity: number;
}


interface CollectedHarvestResource extends SelectedHarvestResource {
    normalQuantity: number;
    multipliedQuantity: number;
    finalQuantity: number;
}

interface HarvestToolBonusDetail {
    name: string;
    quantity: number;
    possessed: boolean;
    proficient: boolean;
    applied: boolean;
}

interface HarvestToolBonusResult {
    totalBonus: number;
    details: HarvestToolBonusDetail[];
}

interface ConsumedHarvestToolDetail {
    name: string;
    beforeQuantity: number;
    afterQuantity: number;
    consumed: boolean;
    removed: boolean;
    reason: string;
}

export class HarvestService {

    private static readonly SETTING_SCOPE = "artisan";

    private static readonly SETTING_KEY = "harvestProfiles";

    public async getManagerData(selectedProfileId: string | null): Promise<{
        profiles: object[];
        selectedProfile: HarvestProfileView | null;
    }> {

        const profiles = this.getProfiles();

        let selected = selectedProfileId
            ? this.getProfile(selectedProfileId)
            : null;

        if (!selected && profiles.length > 0) {
            selected = profiles[0];
        }

        return {
            profiles: profiles.map(profile => ({
                id: profile.id,
                label: profile.name,
                icon: "fa-solid fa-leaf",
                selected: selected?.id === profile.id
            })),
            selectedProfile: selected
                ? await this.toProfileView(selected)
                : null
        };

    }

    public getProfiles(): HarvestProfile[] {

        this.ensureSettingsRegistered();

        const value = game.settings.get(
            HarvestService.SETTING_SCOPE,
            HarvestService.SETTING_KEY
        ) as unknown;

        if (!Array.isArray(value)) {
            return [];
        }

        return value.map(profile => this.normalizeProfile(profile as Partial<HarvestProfile>));

    }

    public getProfile(id: string): HarvestProfile | null {

        return this.getProfiles().find(profile => profile.id === id) ?? null;

    }

    public async createProfile(): Promise<HarvestProfile> {

        const profile: HarvestProfile = {
            id: foundry.utils.randomID(),
            name: "Nuova lista Caccia",
            biome: "creatura",
            creatureType: "beast",
            profession: "erborista",
            professionLevel: 1,
            skill: "nature",
            dc: 10,
            time: 1,
            maxResources: 3,
            harvestOutputMode: "all",
            toolRequirement: "optional",
            toolCriticalDamage: false,
            consumeRequiredTools: false,
            resources: [],
            tools: []
        };

        const profiles = this.getProfiles();

        await this.saveProfiles([
            ...profiles,
            profile
        ]);

        return profile;

    }

    public async updateProfile(
        id: string,
        data: Partial<Omit<HarvestProfile, "id" | "resources" | "tools">>
    ): Promise<void> {

        const profiles = this.getProfiles();

        const nextProfiles = profiles.map(profile => {

            if (profile.id !== id) {
                return profile;
            }

            return this.normalizeProfile({
                ...profile,
                ...data
            });

        });

        await this.saveProfiles(nextProfiles);

    }

    public async addComponent(
        profileId: string,
        collection: HarvestComponentCollection,
        uuid: string,
        quantity: number,
        options: AddHarvestComponentOptions = {}
    ): Promise<void> {

        const cleanUuid = uuid.trim();

        if (!cleanUuid) {
            ui.notifications.warn("Inserisci un UUID valido.");
            return;
        }

        let document: any = null;

        try {
            document = await fromUuid(cleanUuid);
        } catch (_error) {
            ui.notifications.warn(`UUID non leggibile: ${cleanUuid}`);
            return;
        }

        if (!document) {
            ui.notifications.warn(`Nessun documento trovato: ${cleanUuid}`);
            return;
        }

        const isResourceCollection = collection === "resources";
        const isItemDocument = document.documentName === "Item";
        const isActorDocument = document.documentName === "Actor";

        if (isResourceCollection ? (!isItemDocument && !isActorDocument) : !isItemDocument) {
            ui.notifications.warn("Puoi aggiungere Item o Actor/NPG come risultati; gli strumenti devono essere Item.");
            return;
        }

        const importedWeight = isItemDocument ? this.getItemWeight(document) : null;

        const profiles = this.getProfiles();

        const nextProfiles = profiles.map(profile => {

            if (profile.id !== profileId) {
                return profile;
            }

            const component = this.normalizeComponent({
                uuid: cleanUuid,
                quantity,
                weight: collection === "resources"
                    ? this.resolveResourceWeight(options.weight, importedWeight, options.rarity)
                    : options.weight,
                minQuantity: options.minQuantity,
                maxQuantity: options.maxQuantity,
                rarity: options.rarity,
                requiredToolUuid: options.requiredToolUuid
            });

            const nextCollection = [...profile[collection]];

            const existingIndex = nextCollection.findIndex(entry => entry.uuid === component.uuid);

            if (existingIndex >= 0) {
                const existing = nextCollection[existingIndex];

                if (collection === "resources") {
                    nextCollection[existingIndex] = this.normalizeComponent({
                        ...existing,
                        weight: component.weight,
                        minQuantity: component.minQuantity,
                        maxQuantity: component.maxQuantity,
                        quantity: component.maxQuantity,
                        rarity: component.rarity,
                        requiredToolUuid: component.requiredToolUuid
                    });
                } else {
                    nextCollection[existingIndex] = this.normalizeComponent({
                        ...existing,
                        quantity: Math.max(1, Number(existing.quantity ?? 1) + component.quantity)
                    });
                }
            } else {
                nextCollection.push(component);
            }

            return {
                ...profile,
                [collection]: nextCollection
            } as HarvestProfile;

        });

        await this.saveProfiles(nextProfiles);

        ui.notifications.info(`${document.name} aggiunto alla lista Caccia.`);

    }

    public async removeComponent(
        profileId: string,
        collection: HarvestComponentCollection,
        index: number
    ): Promise<void> {

        const profiles = this.getProfiles();

        const nextProfiles = profiles.map(profile => {

            if (profile.id !== profileId) {
                return profile;
            }

            return {
                ...profile,
                [collection]: profile[collection].filter((_entry, entryIndex) => entryIndex !== index)
            } as HarvestProfile;

        });

        await this.saveProfiles(nextProfiles);

    }

    public async updateComponent(
        profileId: string,
        collection: HarvestComponentCollection,
        index: number,
        data: Partial<Pick<HarvestComponent, "quantity" | "weight" | "minQuantity" | "maxQuantity" | "rarity" | "requiredToolUuid">>
    ): Promise<void> {

        const profiles = this.getProfiles();

        const nextProfiles = profiles.map(profile => {

            if (profile.id !== profileId) {
                return profile;
            }

            const nextCollection = [...profile[collection]];

            const current = nextCollection[index];

            if (!current) {
                return profile;
            }

            const nextData = { ...data } as Partial<HarvestComponent>;

            if (collection === "resources" && typeof nextData.rarity === "string" && typeof nextData.weight === "undefined") {
                nextData.weight = this.getRarityWeight(nextData.rarity);
            }

            nextCollection[index] = this.normalizeComponent({
                ...current,
                ...nextData
            });

            return {
                ...profile,
                [collection]: nextCollection
            } as HarvestProfile;

        });

        await this.saveProfiles(nextProfiles);

    }

    public async deleteProfile(id: string): Promise<void> {

        const profiles = this.getProfiles();

        const target = profiles.find(profile => profile.id === id);

        if (!target) {
            ui.notifications.warn("Lista di caccia non trovata.");
            return;
        }

        const nextProfiles = profiles.filter(profile => profile.id !== id);

        await this.saveProfiles(nextProfiles);

        ui.notifications.info(`Lista Caccia eliminata: ${target.name}`);

    }

    public exportProfiles(): void {

        const data = JSON.stringify(
            {
                type: "artisan-harvest-profiles",
                version: 6,
                exportedAt: new Date().toISOString(),
                profiles: this.getProfiles()
            },
            null,
            4
        );

        saveDataToFile(
            data,
            "application/json",
            "artisan-harvest-liste.json"
        );

    }

    public async importProfiles(payload: unknown): Promise<{ imported: number; skipped: number }> {

        const entries = this.getImportEntries(payload);

        if (!entries.length) {
            return { imported: 0, skipped: 0 };
        }

        const existingProfiles = this.getProfiles();
        const existingNames = new Set(existingProfiles.map(profile => profile.name.trim().toLowerCase()));
        const nextProfiles = [...existingProfiles];

        let imported = 0;
        let skipped = 0;

        for (const entry of entries) {
            const profile = this.normalizeImportedProfile(entry);

            if (!profile) {
                skipped += 1;
                continue;
            }

            const duplicateKey = profile.name.trim().toLowerCase();

            if (existingNames.has(duplicateKey)) {
                skipped += 1;
                continue;
            }

            existingNames.add(duplicateKey);
            nextProfiles.push(profile);
            imported += 1;
        }

        if (imported > 0) {
            await this.saveProfiles(nextProfiles);
        }

        return { imported, skipped };

    }

    private getImportEntries(payload: unknown): unknown[] {

        if (Array.isArray(payload)) {
            return payload;
        }

        if (!payload || typeof payload !== "object") {
            return [];
        }

        const data = payload as any;

        if (Array.isArray(data.profiles)) {
            return data.profiles;
        }

        if (data.type === "artisan-harvest-profiles" && Array.isArray(data.harvestProfiles)) {
            return data.harvestProfiles;
        }

        if (data.name && (Array.isArray(data.resources) || Array.isArray(data.tools))) {
            return [data];
        }

        return [];

    }

    private normalizeImportedProfile(entry: unknown): HarvestProfile | null {

        if (!entry || typeof entry !== "object") {
            return null;
        }

        const raw = entry as Partial<HarvestProfile>;
        const name = String(raw.name ?? "").trim();

        if (!name) {
            return null;
        }

        return this.normalizeProfile({
            ...raw,
            id: foundry.utils.randomID(),
            name
        });

    }

    public async startHarvest(profileId: string): Promise<void> {

        const profile = this.getProfile(profileId);

        if (!profile) {
            ui.notifications.warn("Lista di caccia non trovata.");
            return;
        }

        const actor = this.getSelectedActor();

        if (!actor) {
            ui.notifications.warn("Seleziona un token con attore prima di usare Caccia.");
            return;
        }

        if (profile.resources.length === 0) {
            ui.notifications.warn("La lista di caccia non contiene parti.");
            return;
        }

        const toolRequirementResult = await this.checkHarvestToolRequirement(actor, profile);

        if (!toolRequirementResult.allowed) {
            await this.sendHarvestBlockedByToolRequirementToChat(actor, profile, toolRequirementResult.details);
            ui.notifications.warn("Caccia bloccata: manca uno strumento richiesto.");
            return;
        }

        const confirmation = await this.confirmHarvest(profile, actor);

        if (!confirmation) {
            return;
        }

        const skillModifier = this.getSkillModifier(actor, profile.skill);

        const toolBonusResult = await this.getToolQuantityBonus(actor, profile);

        const toolBonus = toolBonusResult.totalBonus;

        const totalModifier = skillModifier + toolBonus;

        const formula = totalModifier === 0
            ? "1d20"
            : `1d20 ${totalModifier >= 0 ? "+" : "-"} ${Math.abs(totalModifier)}`;

        const roll = await new Roll(formula).evaluate();

        const total = Number(roll.total ?? 0);

        const natural = this.getNaturalD20(roll);

        const criticalSuccess = natural === 20;

        const criticalFailure = natural === 1;

        const success = !criticalFailure && (criticalSuccess || total >= profile.dc);

        const selectedResources = success
            ? await this.getMixedResolvedResources(profile, actor)
            : [];

        const professionService = new ProfessionService();

        const actorProfession = professionService.getActorProfession(actor, profile.profession);

        const effectiveProfessionLevel = actorProfession.level;

        const gatheringMultiplier = actorProfession.gatheringMultiplier;

        const collectedResources: CollectedHarvestResource[] = selectedResources.map(resource => {
            const rolledQuantity = Math.max(0, Number(resource.rolledQuantity ?? 0));

            const normalQuantity = Math.max(
                1,
                rolledQuantity
            );

            const multipliedQuantity = this.applyProfessionMultiplier(normalQuantity, gatheringMultiplier);

            const finalQuantity = criticalSuccess
                ? multipliedQuantity * 2
                : multipliedQuantity;

            return {
                ...resource,
                normalQuantity,
                multipliedQuantity,
                finalQuantity
            };
        });

        for (const resource of collectedResources) {
            if (resource.finalQuantity <= 0) {
                continue;
            }

            await this.addRewardToActor(
                actor,
                resource.uuid,
                resource.finalQuantity
            );
        }

        const consumedRequiredTools = success
            ? await this.consumeRequiredHarvestTools(actor, profile, collectedResources)
            : [];

        const criticalFailureToolDamage = criticalFailure
            ? this.isProfileToolCriticalDamageEnabled(profile)
                ? await this.damageHarvestTool(actor, profile)
                : game.i18n.localize("ARTISAN.ToolDamageDisabled")
            : null;

        const professionXpGained = success
            ? this.calculateHarvestXp(profile, collectedResources.length, criticalSuccess)
            : 0;

        const actorProfessionAfterXp = professionXpGained > 0
            ? await professionService.addActorProfessionXp(actor, profile.profession, professionXpGained)
            : actorProfession;

        await this.sendHarvestResultToChat({
            actor,
            profile,
            rollFormula: formula,
            natural,
            total,
            skillModifier,
            success,
            criticalSuccess,
            criticalFailure,
            collectedResources,
            toolBonus,
            toolBonusDetails: toolBonusResult.details,
            gatheringMultiplier,
            gatheringMultiplierLabel: actorProfession.gatheringMultiplierLabel,
            actorProfessionLevel: effectiveProfessionLevel,
            actorProfessionLevelAfter: actorProfessionAfterXp.level,
            actorProfessionXp: actorProfession.xp,
            actorProfessionSource: actorProfession.hasActorValue ? "PG" : "Default livello 0",
            xpGained: professionXpGained,
            actorProfessionXpAfter: actorProfessionAfterXp.xp,
            xpToNextLevel: actorProfessionAfterXp.xpToNextLevel,
            xpForNextLevel: actorProfessionAfterXp.xpForNextLevel,
            progressPercent: actorProfessionAfterXp.progressPercent,
            criticalFailureToolDamage,
            consumedRequiredTools
        });

        if (criticalSuccess) {
            ui.notifications.info("Caccia riuscita con successo critico.");
        } else if (success) {
            ui.notifications.info("Caccia riuscita.");
        } else if (criticalFailure) {
            ui.notifications.error("Caccia fallita criticamente.");
        } else {
            ui.notifications.warn("Caccia fallita.");
        }

    }

    private async confirmHarvest(
        profile: HarvestProfile,
        actor: Actor
    ): Promise<boolean> {

        const resources = await this.toComponentViews(
            profile,
            "resources",
            profile.resources
        );

        const tools = await this.toComponentViews(
            profile,
            "tools",
            profile.tools
        );

        const resourceRows = resources.length > 0
            ? resources.map(resource => {
                const requiredTool = resource.requiredToolUuid
                    ? `, strumento richiesto: ${this.escapeHtml(resource.requiredToolName)}`
                    : "";
                return `<li>${this.escapeHtml(resource.name)} — rarità ${this.escapeHtml(resource.rarityLabel)}, peso/probabilità ${resource.weight}, quantità ${this.escapeHtml(resource.quantityLabel)}${requiredTool}</li>`;
            }).join("")
            : "<li><em>Nessuna parte configurata.</em></li>";

        const toolBonusPreview = await this.getToolQuantityBonus(actor, profile);

        const toolRows = toolBonusPreview.details.length > 0
            ? toolBonusPreview.details.map(tool => {
                const status = tool.applied
                    ? "bonus alla prova applicato"
                    : tool.possessed
                        ? "posseduto ma non competente"
                        : "non posseduto";

                return `<li>${this.escapeHtml(tool.name)}: +${tool.quantity} alla prova — ${this.escapeHtml(status)}</li>`;
            }).join("")
            : "<li><em>Nessuno strumento bonus configurato.</em></li>";

        const actorProfession = new ProfessionService().getActorProfession(actor, profile.profession);

        const content = `
            <form>
                <p><strong>Attore:</strong> ${this.escapeHtml(actor.name ?? "Attore")}</p>
                <p><strong>Lista:</strong> ${this.escapeHtml(profile.name)}</p>
                <p><strong>Tipo creatura:</strong> ${this.escapeHtml(this.getCreatureTypeLabel(profile.creatureType))}</p>
                <p><strong>Professione:</strong> ${this.escapeHtml(this.getProfessionLabel(profile.profession))}</p>
                <p><strong>Livello professione PG:</strong> ${actorProfession.level}</p>
                <p><strong>XP professione PG:</strong> ${actorProfession.xp}</p>
                <p><strong>Moltiplicatore caccia PG:</strong> ${this.escapeHtml(actorProfession.gatheringMultiplierLabel)}</p>
                <p><strong>Abilità:</strong> ${this.escapeHtml(profile.skill || "Non impostata")}</p>
                <p><strong>CD:</strong> ${profile.dc}</p>
                <p><strong>Tempo:</strong> ${this.formatHours(profile.time)}</p>
                <p><strong>Massimo parti diverse:</strong> ${profile.maxResources}</p>
                <p><strong>Modalità risultati:</strong> ${this.escapeHtml(this.getHarvestOutputModeLabel(profile.harvestOutputMode))}</p>
                <p><strong>Strumenti:</strong> ${this.escapeHtml(this.getToolRequirementLabel(profile.toolRequirement))}</p>
                <p><strong>Consuma strumenti richiesti:</strong> ${profile.consumeRequiredTools ? "Sì" : "No"}</p>

                <h4>Parti possibili</h4>
                <ul>${resourceRows}</ul>

                <h4>Strumenti bonus</h4>
                <ul>${toolRows}</ul>
            </form>
        `;

        return new Promise(resolve => {
            new Dialog({
                title: "Avvia Caccia",
                content,
                buttons: {
                    cancel: {
                        label: "Annulla",
                        callback: () => resolve(false)
                    },
                    confirm: {
                        label: "Tira Caccia",
                        callback: () => resolve(true)
                    }
                },
                default: "confirm",
                close: () => resolve(false)
            }).render(true);
        });

    }
    private async getMixedResolvedResources(
        profile: HarvestProfile,
        actor?: Actor
    ): Promise<SelectedHarvestResource[]> {

        const resources = await this.toComponentViews(
            profile,
            "resources",
            profile.resources
        );

        const baseAvailableResources = resources.filter(resource => {
            if (!resource.found) {
                return false;
            }

            if (!actor) {
                return true;
            }

            return this.actorHasRequiredToolForResource(actor, resource);
        });

        if (baseAvailableResources.length === 0) {
            return [];
        }

        if (profile.harvestOutputMode === "all") {
            return baseAvailableResources.map(resource => ({
                ...resource,
                rolledQuantity: this.rollQuantityRange(
                    resource.minQuantity,
                    resource.maxQuantity
                )
            }));
        }

        const availableResources = baseAvailableResources.filter(resource => resource.weight > 0);

        if (availableResources.length === 0) {
            return [];
        }

        const maxResources = Math.max(
            1,
            Math.min(
                availableResources.length,
                Math.floor(Number(profile.maxResources ?? 1))
            )
        );

        const targetCount = 1 + Math.floor(Math.random() * maxResources);

        const remaining = [...availableResources];

        const selected: SelectedHarvestResource[] = [];

        while (selected.length < targetCount && remaining.length > 0) {

            const totalWeight = remaining.reduce((total, resource) => {
                return total + Math.max(0, Number(resource.weight ?? 0));
            }, 0);

            if (totalWeight <= 0) {
                break;
            }

            let roll = Math.random() * totalWeight;

            let selectedIndex = 0;

            for (let index = 0; index < remaining.length; index += 1) {
                roll -= Math.max(0, Number(remaining[index].weight ?? 0));

                if (roll <= 0) {
                    selectedIndex = index;
                    break;
                }
            }

            const [resource] = remaining.splice(selectedIndex, 1);

            selected.push({
                ...resource,
                rolledQuantity: this.rollQuantityRange(
                    resource.minQuantity,
                    resource.maxQuantity
                )
            });

        }

        return selected;

    }

    private async getWeightedResolvedResource(
        profile: HarvestProfile,
        actor?: Actor
    ): Promise<SelectedHarvestResource | null> {

        const resources = await this.toComponentViews(
            profile,
            "resources",
            profile.resources
        );

        const validResources = resources.filter(resource => {
            if (!resource.found || resource.weight <= 0) {
                return false;
            }

            if (!actor) {
                return true;
            }

            return this.actorHasRequiredToolForResource(actor, resource);
        });

        if (validResources.length === 0) {
            return null;
        }

        const totalWeight = validResources.reduce((total, resource) => {
            return total + Math.max(0, Number(resource.weight ?? 0));
        }, 0);

        let roll = Math.random() * totalWeight;

        let selected = validResources[0];

        for (const resource of validResources) {
            roll -= Math.max(0, Number(resource.weight ?? 0));

            if (roll <= 0) {
                selected = resource;
                break;
            }
        }

        return {
            ...selected,
            rolledQuantity: this.rollQuantityRange(
                selected.minQuantity,
                selected.maxQuantity
            )
        };

    }

    private rollQuantityRange(minQuantity: number, maxQuantity: number): number {

        const min = Math.max(1, Math.floor(Number(minQuantity || 1)));

        const max = Math.max(min, Math.floor(Number(maxQuantity || min)));

        return min + Math.floor(Math.random() * (max - min + 1));

    }

    private async checkHarvestToolRequirement(
        actor: Actor,
        profile: HarvestProfile
    ): Promise<{ allowed: boolean; details: HarvestToolBonusDetail[] }> {

        const preview = await this.getToolQuantityBonus(actor, profile);

        if (profile.toolRequirement !== "required") {
            return {
                allowed: true,
                details: preview.details
            };
        }

        if (profile.tools.length === 0) {
            return {
                allowed: true,
                details: preview.details
            };
        }

        const hasAnyPossessedTool = preview.details.some(detail => detail.possessed);

        return {
            allowed: hasAnyPossessedTool,
            details: preview.details
        };

    }

    private async sendHarvestBlockedByToolRequirementToChat(
        actor: Actor,
        profile: HarvestProfile,
        details: HarvestToolBonusDetail[]
    ): Promise<void> {

        const toolRows = details.length > 0
            ? details.map(detail => {
                const status = detail.possessed
                    ? detail.proficient
                        ? "posseduto e competente"
                        : "posseduto ma non competente"
                    : "non posseduto";

                return `<li>${this.escapeHtml(detail.name)} — ${this.escapeHtml(status)}</li>`;
            }).join("")
            : "<li><em>Nessuno strumento configurato.</em></li>";

        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `
                <div class="artisan-chat-card artisan-chat-card--blocked">
                    <h2>Caccia bloccata</h2>
                    <p><strong>Attore:</strong> ${this.escapeHtml(actor.name ?? "Attore")}</p>
                    <p><strong>Lista:</strong> ${this.escapeHtml(profile.name)}</p>
                    <p>Questa lista richiede almeno uno degli strumenti configurati.</p>
                    <h3>Strumenti richiesti</h3>
                    <ul>${toolRows}</ul>
                </div>
            `
        });

    }


    private normalizeHarvestOutputMode(value: unknown): HarvestOutputMode {

        const clean = String(value ?? "all").trim().toLowerCase();

        if (!clean || clean === "all" || clean === "tutte" || clean === "tutti" || clean === "complete" || clean === "completo") {
            return "all";
        }

        return "random";

    }

    private getHarvestOutputModeLabel(value: unknown): string {

        return this.normalizeHarvestOutputMode(value) === "all"
            ? "Tutte le parti disponibili"
            : "Mista casuale";

    }

    private getToolRequirementLabel(value: string): string {

        return value === "required"
            ? "richiede almeno uno strumento posseduto"
            : "facoltativi, usati solo come bonus alla prova";

    }

    private actorHasRequiredToolForResource(
        actor: Actor,
        resource: HarvestComponentView
    ): boolean {

        const requiredToolUuid = String(resource.requiredToolUuid ?? "").trim();

        if (!requiredToolUuid) {
            return true;
        }

        const requiredToolName = resource.requiredToolName === requiredToolUuid
            ? ""
            : resource.requiredToolName;

        return !!this.findActorItemBySource(actor, requiredToolUuid, requiredToolName);

    }

    private async getToolQuantityBonus(
        actor: Actor,
        profile: HarvestProfile
    ): Promise<HarvestToolBonusResult> {

        let totalBonus = 0;

        const details: HarvestToolBonusDetail[] = [];

        for (const tool of profile.tools) {

            const document = await this.safeFromUuid(tool.uuid) as any;

            const name = document?.name ?? tool.uuid;

            const actorItem = document
                ? this.findActorItemBySource(actor, tool.uuid, document.name ?? "")
                : null;

            const possessed = !!actorItem;

            const proficient = possessed
                ? this.actorIsProficientWithTool(actor, actorItem as any, document)
                : false;

            const proficiencyBonus = this.getActorProficiencyBonus(actor);

            const applied = possessed && proficient && proficiencyBonus > 0;

            const quantity = applied
                ? Math.max(0, proficiencyBonus)
                : 0;

            if (applied) {
                totalBonus += quantity;
            }

            details.push({
                name,
                quantity,
                possessed,
                proficient,
                applied
            });

        }

        return {
            totalBonus,
            details
        };

    }

    private async consumeRequiredHarvestTools(
        actor: Actor,
        profile: HarvestProfile,
        collectedResources: CollectedHarvestResource[]
    ): Promise<ConsumedHarvestToolDetail[]> {

        if (!profile.consumeRequiredTools) {
            return [];
        }

        const details: ConsumedHarvestToolDetail[] = [];

        for (const resource of collectedResources) {
            const requiredToolUuid = String(resource.requiredToolUuid ?? "").trim();

            if (!requiredToolUuid) {
                continue;
            }

            const requiredToolName = resource.requiredToolName === requiredToolUuid
                ? ""
                : resource.requiredToolName;

            const actorItem = this.findActorItemBySource(
                actor,
                requiredToolUuid,
                requiredToolName
            );

            if (!actorItem) {
                details.push({
                    name: requiredToolName || requiredToolUuid,
                    beforeQuantity: 0,
                    afterQuantity: 0,
                    consumed: false,
                    removed: false,
                    reason: `Strumento richiesto per ${resource.name} non trovato al momento del consumo.`
                });
                continue;
            }

            const itemName = actorItem.name ?? requiredToolName ?? "Strumento";

            const beforeQuantity = Math.max(
                1,
                Number(foundry.utils.getProperty(actorItem, "system.quantity") ?? 1)
            );

            if (beforeQuantity > 1) {
                await actorItem.update({
                    "system.quantity": beforeQuantity - 1
                });

                details.push({
                    name: itemName,
                    beforeQuantity,
                    afterQuantity: beforeQuantity - 1,
                    consumed: true,
                    removed: false,
                    reason: `Consumata 1 unità per estrarre ${resource.name}.`
                });

                continue;
            }

            await actorItem.delete();

            details.push({
                name: itemName,
                beforeQuantity,
                afterQuantity: 0,
                consumed: true,
                removed: true,
                reason: `Strumento consumato completamente per estrarre ${resource.name}.`
            });
        }

        return details;

    }

    private isProfileToolCriticalDamageEnabled(profile: { toolCriticalDamage?: boolean }): boolean {

        return Boolean((profile as any).toolCriticalDamage ?? false);

    }

    private getArtisanModuleSetting(key: string, defaultValue: boolean): boolean {

        try {
            const settings = game.settings.get("artisan", "moduleSettings") as any;

            if (settings && typeof settings[key] === "boolean") {
                return settings[key];
            }

            if (settings && typeof settings.enableToolDamage === "boolean") {
                return settings.enableToolDamage;
            }
        } catch (_error) {
            return defaultValue;
        }

        return defaultValue;

    }

    private async damageHarvestTool(
        actor: Actor,
        profile: HarvestProfile
    ): Promise<string | null> {

        if (profile.tools.length === 0) {
            return "Nessuno strumento configurato nella lista Caccia.";
        }

        for (const tool of profile.tools) {

            const document = await this.safeFromUuid(tool.uuid) as any;

            if (!document) {
                continue;
            }

            const actorItem = this.findActorItemBySource(actor, tool.uuid, document.name ?? "");

            if (!actorItem) {
                continue;
            }

            if (!this.actorIsProficientWithTool(actor, actorItem as any, document)) {
                continue;
            }

            const itemName = actorItem.name ?? document.name ?? "Strumento";

            const currentQuantity = Math.max(
                1,
                Number(foundry.utils.getProperty(actorItem, "system.quantity") ?? 1)
            );

            if (currentQuantity > 1) {
                await actorItem.update({
                    "system.quantity": currentQuantity - 1
                });

                return `${itemName} danneggiato: quantità ${currentQuantity} → ${currentQuantity - 1}.`;
            }

            await actorItem.delete();

            return `${itemName} distrutto.`;

        }

        return "Nessuno strumento posseduto e competente da danneggiare.";

    }

    private getActorProficiencyBonus(actor: Actor): number {

        const candidates = [
            foundry.utils.getProperty(actor, "system.attributes.prof"),
            foundry.utils.getProperty(actor, "system.attributes.prof.value"),
            foundry.utils.getProperty(actor, "system.attributes.proficiency"),
            foundry.utils.getProperty(actor, "system.attributes.proficiency.value"),
            foundry.utils.getProperty(actor, "system.prof"),
            foundry.utils.getProperty(actor, "system.prof.value"),
            foundry.utils.getProperty(actor, "system.details.proficiencyBonus"),
            foundry.utils.getProperty(actor, "system.details.prof")
        ];

        for (const value of candidates) {
            const numeric = Number(value);

            if (Number.isFinite(numeric) && numeric > 0) {
                return Math.floor(numeric);
            }
        }

        return 0;

    }

    private actorIsProficientWithTool(
        actor: Actor,
        actorItem: any,
        sourceItem: any
    ): boolean {

        if (!actorItem) {
            return false;
        }

        if (this.readItemProficiency(actorItem)) {
            return true;
        }

        const identifierCandidates = this.getToolIdentifierCandidates(actorItem, sourceItem);

        const actorTools = foundry.utils.getProperty(actor, "system.tools") as Record<string, any> | undefined;

        if (!actorTools || typeof actorTools !== "object") {
            return false;
        }

        for (const key of identifierCandidates) {
            const toolData = actorTools[key];

            if (this.readToolDataProficiency(toolData)) {
                return true;
            }
        }

        for (const toolData of Object.values(actorTools)) {
            const label = String(
                toolData?.label
                ?? toolData?.name
                ?? toolData?.id
                ?? ""
            ).trim().toLowerCase();

            if (!label) {
                continue;
            }

            if (identifierCandidates.includes(label) && this.readToolDataProficiency(toolData)) {
                return true;
            }
        }

        return false;

    }

    private readItemProficiency(item: any): boolean {

        const candidates = [
            foundry.utils.getProperty(item, "system.proficient"),
            foundry.utils.getProperty(item, "system.proficiency"),
            foundry.utils.getProperty(item, "system.prof"),
            foundry.utils.getProperty(item, "system.prof.hasProficiency"),
            foundry.utils.getProperty(item, "system.proficiencies.value")
        ];

        return candidates.some(value => {
            if (typeof value === "boolean") {
                return value;
            }

            if (typeof value === "number") {
                return value > 0;
            }

            if (typeof value === "string") {
                const clean = value.trim().toLowerCase();
                return clean === "true" || clean === "proficient" || clean === "prof" || Number(clean) > 0;
            }

            return false;
        });

    }

    private readToolDataProficiency(toolData: any): boolean {

        if (!toolData) {
            return false;
        }

        const candidates = [
            toolData.value,
            toolData.prof,
            toolData.proficient,
            toolData.proficiency,
            toolData.hasProficiency
        ];

        return candidates.some(value => {
            if (typeof value === "boolean") {
                return value;
            }

            if (typeof value === "number") {
                return value > 0;
            }

            if (typeof value === "string") {
                const clean = value.trim().toLowerCase();
                return clean === "true" || clean === "proficient" || clean === "prof" || Number(clean) > 0;
            }

            return false;
        });

    }

    private getToolIdentifierCandidates(actorItem: any, sourceItem: any): string[] {

        const values = [
            actorItem?.system?.identifier,
            actorItem?.system?.type?.value,
            actorItem?.system?.type,
            actorItem?.slug,
            actorItem?.name,
            sourceItem?.system?.identifier,
            sourceItem?.system?.type?.value,
            sourceItem?.system?.type,
            sourceItem?.slug,
            sourceItem?.name
        ];

        return Array.from(new Set(
            values
                .map(value => String(value ?? "").trim().toLowerCase())
                .filter(value => value.length > 0)
        ));

    }

    private async addRewardToActor(
        actor: Actor,
        uuid: string,
        quantity: number
    ): Promise<void> {

        const source = await this.safeFromUuid(uuid) as any;

        if (!source) {
            ui.notifications.warn(`Output Caccia non valido: ${uuid}`);
            return;
        }

        if (source.documentName === "Actor") {
            ui.notifications.info(`${source.name ?? uuid} aggiunto come risultato Caccia. Gli Actor/NPG vengono mostrati in chat e non inseriti nell'inventario del PG.`);
            return;
        }

        if (source.documentName !== "Item") {
            ui.notifications.warn(`Output Caccia non valido: ${uuid}`);
            return;
        }

        const existing = this.findActorItemBySource(actor, uuid, source.name ?? "");

        if (existing) {
            const currentQuantity = Number(foundry.utils.getProperty(existing, "system.quantity") ?? 1);

            await existing.update({
                "system.quantity": currentQuantity + quantity
            });

            return;
        }

        const itemData = source.toObject();

        foundry.utils.setProperty(
            itemData,
            "system.quantity",
            quantity
        );

        foundry.utils.setProperty(
            itemData,
            "flags.artisan.sourceUuid",
            uuid
        );

        await actor.createEmbeddedDocuments(
            "Item",
            [itemData]
        );

    }

    private findActorItemBySource(
        actor: Actor,
        sourceUuid: string,
        sourceName: string
    ): Item | null {

        return actor.items.find(item => {
            const flagUuid = item.getFlag("artisan", "sourceUuid");

            if (flagUuid === sourceUuid) {
                return true;
            }

            return item.name === sourceName;
        }) ?? null;

    }

    private getSelectedActor(): Actor | null {

        const token = canvas.tokens?.controlled?.[0];

        return token?.actor ?? null;

    }

    private getSkillModifier(actor: Actor, skill: string): number {

        const key = this.resolveSkillKey(skill);

        if (!key) {
            return 0;
        }

        const skillData = foundry.utils.getProperty(actor, `system.skills.${key}`) as any;

        return Number(skillData?.total ?? skillData?.mod ?? 0);

    }

    private resolveSkillKey(skill: string): string {

        const clean = skill.trim().toLowerCase();

        const map: Record<string, string> = {
            acrobatics: "acr",
            acrobazia: "acr",
            animalhandling: "ani",
            "animal handling": "ani",
            addestrareanimali: "ani",
            "addestrare animali": "ani",
            arcana: "arc",
            athletics: "ath",
            atletica: "ath",
            deception: "dec",
            inganno: "dec",
            history: "his",
            storia: "his",
            insight: "ins",
            intuizione: "ins",
            intimidation: "itm",
            intimidire: "itm",
            investigation: "inv",
            indagare: "inv",
            medicine: "med",
            medicina: "med",
            nature: "nat",
            natura: "nat",
            perception: "prc",
            percezione: "prc",
            performance: "prf",
            intrattenere: "prf",
            persuasion: "per",
            persuasione: "per",
            religion: "rel",
            religione: "rel",
            sleightofhand: "slt",
            "sleight of hand": "slt",
            rapiditadimano: "slt",
            "rapidità di mano": "slt",
            stealth: "ste",
            furtivita: "ste",
            furtività: "ste",
            survival: "sur",
            sopravvivenza: "sur"
        };

        return map[clean] ?? clean;

    }

    private getNaturalD20(roll: Roll): number | null {

        const firstTerm = roll.terms.find((term: any) => {
            return Array.isArray(term.results);
        }) as any;

        const result = firstTerm?.results?.[0]?.result;

        return typeof result === "number"
            ? result
            : null;

    }

    private calculateHarvestXp(
        profile: HarvestProfile,
        collectedResourceCount: number,
        criticalSuccess: boolean
    ): number {

        const resourceBonus = Math.max(1, Math.floor(Number(collectedResourceCount ?? 0)));

        const baseXp = resourceBonus;

        return criticalSuccess
            ? baseXp * 2
            : baseXp;

    }

    private async sendHarvestResultToChat(data: {
        actor: Actor;
        profile: HarvestProfile;
        rollFormula: string;
        natural: number | null;
        total: number;
        skillModifier: number;
        success: boolean;
        criticalSuccess: boolean;
        criticalFailure: boolean;
        collectedResources: CollectedHarvestResource[];
        toolBonus: number;
        toolBonusDetails: HarvestToolBonusDetail[];
        gatheringMultiplier: number;
        gatheringMultiplierLabel: string;
        actorProfessionLevel: number;
        actorProfessionLevelAfter: number;
        actorProfessionXp: number;
        actorProfessionSource: string;
        xpGained: number;
        actorProfessionXpAfter: number;
        xpToNextLevel: number;
        xpForNextLevel: number | null;
        progressPercent: number;
        criticalFailureToolDamage: string | null;
        consumedRequiredTools: ConsumedHarvestToolDetail[];
    }): Promise<void> {

        const title = data.criticalSuccess
            ? "🌟 Successo critico Caccia"
            : data.criticalFailure
                ? "💥 Fallimento critico Caccia"
                : data.success
                    ? "✅ Caccia riuscita"
                    : "❌ Caccia fallita";

        const specialResultText = data.criticalSuccess
            ? "Successo critico: quantità dopo moltiplicatore raddoppiata."
            : data.criticalFailure
                ? `Fallimento critico: prova fallita automaticamente, nessuna parte da caccia. ${data.criticalFailureToolDamage ?? ""}`.trim()
                : "-";

        const resourceRows = data.collectedResources.length > 0
            ? data.collectedResources.map(resource => `
                <tr>
                    <td>${this.formatRewardName(resource)}</td>
                    <td>${this.escapeHtml(resource.rarityLabel)}</td>
                    <td>${resource.weight}</td>
                    <td>${this.escapeHtml(resource.quantityLabel)}</td>
                    <td>${resource.rolledQuantity}</td>
                    <td>${resource.normalQuantity}</td>
                    <td>${resource.multipliedQuantity}</td>
                    <td>${resource.finalQuantity}</td>
                </tr>
            `).join("")
            : `
                <tr>
                    <td colspan="8">Nessuna parte da caccia.</td>
                </tr>
            `;
        const resultText = data.success && data.collectedResources.length > 0
            ? `${data.collectedResources.length} parti diverse aggiunte all'attore.`
            : "Nessuna parte da caccia.";

        const consumedRequiredToolsText = data.consumedRequiredTools.length > 0
            ? data.consumedRequiredTools.map(tool => {
                const quantityText = tool.consumed
                    ? `${tool.beforeQuantity} → ${tool.afterQuantity}`
                    : "non consumato";

                return `${this.escapeHtml(tool.name)}: ${quantityText} — ${this.escapeHtml(tool.reason)}`;
            }).join("<br>")
            : data.profile.consumeRequiredTools
                ? "Nessuno strumento richiesto consumato."
                : "Opzione non attiva.";

        const toolDetailsText = data.toolBonusDetails.length > 0
            ? data.toolBonusDetails.map(tool => {
                const status = tool.applied
                    ? "applicato"
                    : tool.possessed
                        ? "non competente"
                        : "non posseduto";

                return `${this.escapeHtml(tool.name)} +${tool.quantity} alla prova: ${this.escapeHtml(status)}`;
            }).join("<br>")
            : "Nessuno";

        const content = `
            <div class="artisan-chat-card">
                <h2>${title}</h2>

                <p>
                    <strong>${this.escapeHtml(data.profile.name)}</strong><br>
                    Attore: ${this.escapeHtml(data.actor.name ?? "Attore")}
                </p>

                <table>
                    <tbody>
                        <tr>
                            <td><strong>Tipo creatura</strong></td>
                            <td>${this.escapeHtml(this.getCreatureTypeLabel(data.profile.creatureType))}</td>
                        </tr>
                        <tr>
                            <td><strong>Professione</strong></td>
                            <td>${this.escapeHtml(this.getProfessionLabel(data.profile.profession))}</td>
                        </tr>
                        <tr>
                            <td><strong>Livello professione PG</strong></td>
                            <td>${data.actorProfessionLevel} → ${data.actorProfessionLevelAfter}${data.actorProfessionLevelAfter > data.actorProfessionLevel ? " ⭐ Avanzamento" : ""}</td>
                        </tr>
                        <tr>
                            <td><strong>XP professione PG</strong></td>
                            <td>${data.actorProfessionXp} → ${data.actorProfessionXpAfter}</td>
                        </tr>
                        <tr>
                            <td><strong>XP guadagnata</strong></td>
                            <td>+${data.xpGained}</td>
                        </tr>
                        <tr>
                            <td><strong>Prossimo livello</strong></td>
                            <td>${data.xpForNextLevel === null ? "Livello massimo" : `${data.xpToNextLevel} XP mancanti (${data.progressPercent}%)`}</td>
                        </tr>
                        <tr>
                            <td><strong>Sorgente professione</strong></td>
                            <td>${this.escapeHtml(data.actorProfessionSource)}</td>
                        </tr>
                        <tr>
                            <td><strong>Moltiplicatore caccia PG</strong></td>
                            <td>${this.escapeHtml(data.gatheringMultiplierLabel)}</td>
                        </tr>
                        <tr>
                            <td><strong>Abilità</strong></td>
                            <td>${this.escapeHtml(data.profile.skill || "Non impostata")}</td>
                        </tr>
                        <tr>
                            <td><strong>Formula</strong></td>
                            <td>${this.escapeHtml(data.rollFormula)}</td>
                        </tr>
                        <tr>
                            <td><strong>Naturale</strong></td>
                            <td>${data.natural ?? "-"}</td>
                        </tr>
                        <tr>
                            <td><strong>Modificatore</strong></td>
                            <td>${data.skillModifier}</td>
                        </tr>
                        <tr>
                            <td><strong>Totale</strong></td>
                            <td>${data.total}</td>
                        </tr>
                        <tr>
                            <td><strong>CD</strong></td>
                            <td>${data.profile.dc}</td>
                        </tr>
                        <tr>
                            <td><strong>Esito speciale</strong></td>
                            <td>${this.escapeHtml(specialResultText)}</td>
                        </tr>
                        <tr>
                            <td><strong>Danno strumento</strong></td>
                            <td>${data.criticalFailure ? this.escapeHtml(data.criticalFailureToolDamage ?? "Nessuno") : "-"}</td>
                        </tr>
                        <tr>
                            <td><strong>Tempo</strong></td>
                            <td>${this.formatHours(data.profile.time)}</td>
                        </tr>
                        <tr>
                            <td><strong>Massimo parti diverse</strong></td>
                            <td>${data.profile.maxResources}</td>
                        </tr>
                        <tr>
                            <td><strong>Modalità risultati</strong></td>
                            <td>${this.escapeHtml(this.getHarvestOutputModeLabel(data.profile.harvestOutputMode))}</td>
                        </tr>
                        <tr>
                            <td><strong>Parti diverse raccolte</strong></td>
                            <td>${data.collectedResources.length}</td>
                        </tr>
                        <tr>
                            <td><strong>Bonus strumenti competenti alla prova</strong></td>
                            <td>+${data.toolBonus}</td>
                        </tr>
                        <tr>
                            <td><strong>Dettaglio strumenti</strong></td>
                            <td>${toolDetailsText}</td>
                        </tr>
                        <tr>
                            <td><strong>Strumenti richiesti consumati</strong></td>
                            <td>${consumedRequiredToolsText}</td>
                        </tr>
                    </tbody>
                </table>

                <h3>Parti raccolte</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Parte</th>
                            <th>Rarità</th>
                            <th>Peso</th>
                            <th>Range</th>
                            <th>Base</th>
                            <th>Prima mult.</th>
                            <th>Dopo mult.</th>
                            <th>Finale</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${resourceRows}
                    </tbody>
                </table>

                <p><strong>${resultText}</strong></p>
            </div>
        `;

        await ChatMessage.create({
            content,
            speaker: ChatMessage.getSpeaker({ actor: data.actor })
        });

    }

    private async saveProfiles(profiles: HarvestProfile[]): Promise<void> {

        this.ensureSettingsRegistered();

        await game.settings.set(
            HarvestService.SETTING_SCOPE,
            HarvestService.SETTING_KEY,
            profiles.map(profile => this.normalizeProfile(profile))
        );

    }

    private ensureSettingsRegistered(): void {

        const key = `${HarvestService.SETTING_SCOPE}.${HarvestService.SETTING_KEY}`;

        if (game.settings.settings.has(key)) {
            return;
        }

        game.settings.register(
            HarvestService.SETTING_SCOPE,
            HarvestService.SETTING_KEY,
            {
                name: "Artisan Caccia Profiles",
                scope: "world",
                config: false,
                type: Array,
                default: []
            }
        );

    }

    private applyProfessionMultiplier(quantity: number, multiplier: number): number {

        if (!Number.isFinite(multiplier) || multiplier <= 0) {
            return 0;
        }

        const baseQuantity = Math.max(0, Number(quantity ?? 0));

        if (baseQuantity <= 0) {
            return 0;
        }

        return Math.max(1, Math.floor(baseQuantity * multiplier));

    }

    private formatHours(value: number): string {

        const hours = Math.max(0, Number(value ?? 0));

        if (hours === 1) {
            return "1 ora";
        }

        return `${hours} ore`;

    }

    private normalizeProfile(profile: Partial<HarvestProfile>): HarvestProfile {

        const professionService = new ProfessionService();

        const rawProfession = String(profile.profession || "erborista");

        const profession = professionService.getProfession(rawProfession)
            ? professionService.normalizeId(rawProfession)
            : rawProfession;

        return {
            id: String(profile.id || foundry.utils.randomID()),
            name: String(profile.name || "Lista Caccia"),
            biome: String(profile.biome || "creatura"),
            creatureType: this.normalizeCreatureType((profile as any).creatureType ?? profile.biome ?? "beast"),
            profession,
            professionLevel: professionService.normalizeLevel((profile as any).professionLevel ?? 1),
            skill: String(profile.skill || professionService.getDefaultSkill(profession) || "survival"),
            dc: Number(profile.dc ?? 10),
            time: Number(profile.time ?? 1),
            maxResources: Math.max(1, Math.floor(Number((profile as any).maxResources ?? 1))),
            harvestOutputMode: this.normalizeHarvestOutputMode((profile as any).harvestOutputMode),
            toolRequirement: String((profile as any).toolRequirement || "optional") === "required" ? "required" : "optional",
            toolCriticalDamage: Boolean((profile as any).toolCriticalDamage ?? false),
            consumeRequiredTools: Boolean((profile as any).consumeRequiredTools ?? false),
            resources: this.normalizeComponents(profile.resources),
            tools: this.normalizeComponents(profile.tools)
        };

    }

    private normalizeComponents(components: unknown): HarvestComponent[] {

        if (!Array.isArray(components)) {
            return [];
        }

        return components.map(component => this.normalizeComponent(component as Partial<HarvestComponent>));

    }

    private normalizeComponent(component: Partial<HarvestComponent>): HarvestComponent {

        const legacyQuantity = Math.max(1, Number(component.quantity ?? 1));

        const minQuantity = Math.max(1, Number(component.minQuantity ?? legacyQuantity));

        const maxQuantity = Math.max(minQuantity, Number(component.maxQuantity ?? legacyQuantity));

        return {
            uuid: String(component.uuid ?? "").trim(),
            quantity: legacyQuantity,
            weight: Math.max(0.1, Number(component.weight ?? 0.1)),
            minQuantity,
            maxQuantity,
            rarity: this.normalizeRarity((component as any).rarity),
            requiredToolUuid: String((component as any).requiredToolUuid ?? "").trim()
        };

    }

    private async toProfileView(profile: HarvestProfile): Promise<HarvestProfileView> {

        const resources = await this.toComponentViews(
            profile,
            "resources",
            profile.resources
        );

        const tools = await this.toComponentViews(
            profile,
            "tools",
            profile.tools
        );

        return {
            ...profile,
            resources,
            tools,
            resourceCount: resources.length,
            toolCount: tools.length,
            totalResourceWeight: resources.reduce((total, resource) => total + resource.weight, 0),
            gatheringMultiplier: new ProfessionService().getGatheringMultiplier(profile.professionLevel),
            gatheringMultiplierLabel: new ProfessionService().getMultiplierLabel(profile.professionLevel),
            craftingMultiplier: new ProfessionService().getCraftingMultiplier(profile.professionLevel),
            craftingMultiplierLabel: new ProfessionService().getMultiplierLabel(profile.professionLevel)
        };

    }

    private async toComponentViews(
        profile: HarvestProfile,
        collection: HarvestComponentCollection,
        components: HarvestComponent[]
    ): Promise<HarvestComponentView[]> {

        const views = components.map(async (component, index) => {
            return this.toComponentView(
                profile,
                collection,
                component,
                index
            );
        });

        return Promise.all(views);

    }

    private async toComponentView(
        profile: HarvestProfile,
        collection: HarvestComponentCollection,
        component: HarvestComponent,
        index: number
    ): Promise<HarvestComponentView> {

        const normalized = this.normalizeComponent(component);

        const fallback: HarvestComponentView = {
            index,
            collection,
            profileId: profile.id,
            uuid: normalized.uuid,
            quantity: normalized.quantity,
            weight: normalized.weight,
            minQuantity: normalized.minQuantity,
            maxQuantity: normalized.maxQuantity,
            rarity: normalized.rarity,
            requiredToolUuid: normalized.requiredToolUuid,
            requiredToolName: normalized.requiredToolUuid || "Nessuno",
            requiredToolFound: !normalized.requiredToolUuid,
            rarityLabel: collection === "resources"
                ? this.getRarityLabel(normalized.rarity)
                : "-",
            quantityLabel: collection === "resources"
                ? this.getQuantityLabel(normalized)
                : "Bonus competenza PG alla prova",
            name: normalized.uuid,
            img: "icons/svg/item-bag.svg",
            found: false,
            documentType: ""
        };

        const document = await this.safeFromUuid(normalized.uuid) as any;

        const requiredToolDocument = normalized.requiredToolUuid
            ? await this.safeFromUuid(normalized.requiredToolUuid) as any
            : null;

        const requiredToolName = normalized.requiredToolUuid
            ? requiredToolDocument?.name ?? normalized.requiredToolUuid
            : "Nessuno";

        if (!document) {
            return {
                ...fallback,
                requiredToolName,
                requiredToolFound: !normalized.requiredToolUuid || !!requiredToolDocument
            };
        }

        return {
            ...fallback,
            name: document.name ?? normalized.uuid,
            img: document.img ?? "icons/svg/item-bag.svg",
            found: document.documentName === "Item" || document.documentName === "Actor",
            documentType: document.documentName ?? "",
            requiredToolName,
            requiredToolFound: !normalized.requiredToolUuid || !!requiredToolDocument
        };

    }


    private getProfessionLabel(profession: string): string {

        return new ProfessionService().getLabel(profession);

    }

    private normalizeCreatureType(value: unknown): string {

        const key = String(value ?? "beast").trim().toLowerCase();

        const aliases: Record<string, string> = {
            creatura: "beast",
            bestia: "beast",
            beast: "beast",
            umanoide: "humanoid",
            humanoid: "humanoid",
            mostro: "monstrosity",
            mostruosita: "monstrosity",
            monstrosity: "monstrosity",
            drago: "dragon",
            dragon: "dragon",
            nonmorto: "undead",
            "non-morto": "undead",
            undead: "undead",
            vegetale: "plant",
            plant: "plant",
            costrutto: "construct",
            construct: "construct",
            elementale: "elemental",
            elemental: "elemental",
            folletto: "fey",
            fey: "fey",
            immondo: "fiend",
            fiend: "fiend",
            celestiale: "celestial",
            celestial: "celestial",
            gigante: "giant",
            giant: "giant",
            melma: "ooze",
            ooze: "ooze",
            aberrazione: "aberration",
            aberration: "aberration"
        };

        return aliases[key] ?? key ?? "beast";

    }

    private getCreatureTypeLabel(creatureType: string): string {

        const labels: Record<string, string> = {
            beast: "Bestia",
            humanoid: "Umanoide",
            monstrosity: "Mostruosità",
            dragon: "Drago",
            undead: "Non morto",
            plant: "Vegetale",
            construct: "Costrutto",
            elemental: "Elementale",
            fey: "Folletto",
            fiend: "Immondo",
            celestial: "Celestiale",
            giant: "Gigante",
            ooze: "Melma",
            aberration: "Aberrazione"
        };

        return labels[creatureType] ?? creatureType ?? "Bestia";

    }

    private getBiomeLabel(biome: string): string {

        const labels: Record<string, string> = {
            creatura: "Creatura",
            montagna: "Montagna",
            palude: "Palude",
            costa: "Costa",
            caverna: "Caverna",
            deserto: "Deserto",
            artico: "Artico",
            urbano: "Urbano",
            pianura: "Pianura",
            collina: "Collina",
            fiume: "Fiume / Lago"
        };

        return labels[biome] ?? biome ?? "Non impostato";

    }


    private normalizeRarity(value: unknown): HarvestPartRarity {

        const clean = String(value ?? "common").trim().toLowerCase();

        const aliases: Record<string, HarvestPartRarity> = {
            common: "common",
            comune: "common",
            uncommon: "uncommon",
            noncomune: "uncommon",
            "non comune": "uncommon",
            rare: "rare",
            rara: "rare",
            veryrare: "veryRare",
            "very rare": "veryRare",
            moltorara: "veryRare",
            "molto rara": "veryRare",
            legendary: "legendary",
            leggendaria: "legendary"
        };

        return aliases[clean] ?? "common";

    }


    private getRarityWeight(rarity: unknown): number {

        const weights: Record<HarvestPartRarity, number> = {
            common: 100,
            uncommon: 45,
            rare: 20,
            veryRare: 8,
            legendary: 2
        };

        return weights[this.normalizeRarity(rarity)];

    }

    private getRarityLabel(rarity: string): string {

        const labels: Record<string, string> = {
            common: "Comune",
            uncommon: "Non comune",
            rare: "Rara",
            veryRare: "Molto rara",
            legendary: "Leggendaria"
        };

        return labels[rarity] ?? "Comune";

    }

    private getQuantityLabel(component: HarvestComponent): string {

        if (component.minQuantity === component.maxQuantity) {
            return String(component.minQuantity);
        }

        return `${component.minQuantity}-${component.maxQuantity}`;

    }

    private resolveResourceWeight(
        configuredWeight: number | undefined,
        importedWeight: number | null,
        rarity: string | undefined
    ): number {

        if (typeof configuredWeight === "number" && Number.isFinite(configuredWeight) && configuredWeight > 0) {
            return configuredWeight;
        }

        if (rarity) {
            return this.getRarityWeight(rarity);
        }

        if (typeof importedWeight === "number" && Number.isFinite(importedWeight) && importedWeight > 0) {
            return importedWeight;
        }

        return this.getRarityWeight("common");

    }

    private getItemWeight(document: any): number | null {

        const candidates = [
            foundry.utils.getProperty(document, "system.weight"),
            foundry.utils.getProperty(document, "system.properties.weight"),
            foundry.utils.getProperty(document, "system.bulk"),
            foundry.utils.getProperty(document, "system.quantity.weight")
        ];

        for (const candidate of candidates) {
            const value = Number(candidate);

            if (Number.isFinite(value) && value > 0) {
                return value;
            }
        }

        return null;

    }

    private async safeFromUuid(uuid: string): Promise<unknown | null> {

        try {
            return await fromUuid(uuid);
        } catch (_error) {
            return null;
        }

    }

    private formatRewardName(resource: { name: string; uuid: string; documentType?: string }): string {
        const icon = resource.documentType === "Actor" ? "fa-user" : "fa-suitcase";
        const label = resource.documentType === "Actor" ? "NPG" : "Item";
        const uuid = this.escapeHtml(resource.uuid ?? "");
        const name = this.escapeHtml(resource.name ?? resource.uuid ?? "Risultato");
        return `<a class="content-link" draggable="true" data-uuid="${uuid}"><i class="fas ${icon}"></i> ${name}</a> <small class="artisan-muted-note">${label}</small>`;
    }

    private escapeHtml(value: string): string {

        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");

    }

}
