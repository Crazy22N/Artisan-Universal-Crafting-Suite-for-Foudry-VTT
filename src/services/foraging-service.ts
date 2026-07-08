import { ProfessionService } from "./profession-service";

export type ForagingComponentCollection = "resources" | "tools";

export interface ForagingComponent {
    uuid: string;
    quantity: number;
    weight: number;
    minQuantity: number;
    maxQuantity: number;
}

export interface ForagingComponentView extends ForagingComponent {
    index: number;
    collection: ForagingComponentCollection;
    profileId: string;
    name: string;
    img: string;
    found: boolean;
    documentType: string;
    quantityLabel: string;
}

export interface ForagingProfile {
    id: string;
    name: string;
    biome: string;
    profession: string;
    professionLevel: number;
    skill: string;
    dc: number;
    time: number;
    maxResources: number;
    resources: ForagingComponent[];
    tools: ForagingComponent[];
}

interface ForagingProfileView extends ForagingProfile {
    resources: ForagingComponentView[];
    tools: ForagingComponentView[];
    resourceCount: number;
    toolCount: number;
    totalResourceWeight: number;
    gatheringMultiplier: number;
    gatheringMultiplierLabel: string;
    craftingMultiplier: number;
    craftingMultiplierLabel: string;
}

interface AddForagingComponentOptions {
    weight?: number;
    minQuantity?: number;
    maxQuantity?: number;
}

interface SelectedForagingResource extends ForagingComponentView {
    rolledQuantity: number;
}

interface CollectedForagingResource extends SelectedForagingResource {
    normalQuantity: number;
    multipliedQuantity: number;
    finalQuantity: number;
}

interface ForagingToolBonusDetail {
    name: string;
    quantity: number;
    possessed: boolean;
    proficient: boolean;
    applied: boolean;
}

interface ForagingToolBonusResult {
    totalBonus: number;
    details: ForagingToolBonusDetail[];
}

export class ForagingService {

    private static readonly SETTING_SCOPE = "artisan";

    private static readonly SETTING_KEY = "foragingProfiles";

    public async getManagerData(selectedProfileId: string | null): Promise<{
        profiles: object[];
        selectedProfile: ForagingProfileView | null;
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

    public getProfiles(): ForagingProfile[] {

        this.ensureSettingsRegistered();

        const value = game.settings.get(
            ForagingService.SETTING_SCOPE,
            ForagingService.SETTING_KEY
        ) as unknown;

        if (!Array.isArray(value)) {
            return [];
        }

        return value.map(profile => this.normalizeProfile(profile as Partial<ForagingProfile>));

    }

    public getProfile(id: string): ForagingProfile | null {

        return this.getProfiles().find(profile => profile.id === id) ?? null;

    }

    public async createProfile(): Promise<ForagingProfile> {

        const profile: ForagingProfile = {
            id: foundry.utils.randomID(),
            name: "Nuova lista Foraging",
            biome: "foresta",
            profession: "erborista",
            professionLevel: 1,
            skill: "nature",
            dc: 10,
            time: 1,
            maxResources: 3,
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
        data: Partial<Omit<ForagingProfile, "id" | "resources" | "tools">>
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
        collection: ForagingComponentCollection,
        uuid: string,
        quantity: number,
        options: AddForagingComponentOptions = {}
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

        if (document.documentName !== "Item") {
            ui.notifications.warn("Puoi aggiungere solo Item dal mondo o dai compendi.");
            return;
        }

        const importedWeight = this.getItemWeight(document);

        const profiles = this.getProfiles();

        const nextProfiles = profiles.map(profile => {

            if (profile.id !== profileId) {
                return profile;
            }

            const component = this.normalizeComponent({
                uuid: cleanUuid,
                quantity,
                weight: collection === "resources"
                    ? this.resolveResourceWeight(options.weight, importedWeight)
                    : options.weight,
                minQuantity: options.minQuantity,
                maxQuantity: options.maxQuantity
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
                        quantity: component.maxQuantity
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
            } as ForagingProfile;

        });

        await this.saveProfiles(nextProfiles);

        ui.notifications.info(`${document.name} aggiunto alla lista Foraging.`);

    }

    public async removeComponent(
        profileId: string,
        collection: ForagingComponentCollection,
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
            } as ForagingProfile;

        });

        await this.saveProfiles(nextProfiles);

    }

    public async updateComponent(
        profileId: string,
        collection: ForagingComponentCollection,
        index: number,
        data: Partial<Pick<ForagingComponent, "quantity" | "weight" | "minQuantity" | "maxQuantity">>
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

            nextCollection[index] = this.normalizeComponent({
                ...current,
                ...data
            });

            return {
                ...profile,
                [collection]: nextCollection
            } as ForagingProfile;

        });

        await this.saveProfiles(nextProfiles);

    }

    public async deleteProfile(id: string): Promise<void> {

        const profiles = this.getProfiles();

        const target = profiles.find(profile => profile.id === id);

        if (!target) {
            ui.notifications.warn("Lista Foraging non trovata.");
            return;
        }

        const nextProfiles = profiles.filter(profile => profile.id !== id);

        await this.saveProfiles(nextProfiles);

        ui.notifications.info(`Lista Foraging eliminata: ${target.name}`);

    }

    public exportProfiles(): void {

        const data = JSON.stringify(
            {
                type: "artisan-foraging-profiles",
                version: 4,
                exportedAt: new Date().toISOString(),
                profiles: this.getProfiles()
            },
            null,
            4
        );

        saveDataToFile(
            data,
            "application/json",
            "artisan-foraging-liste.json"
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

        if (data.type === "artisan-foraging-profiles" && Array.isArray(data.foragingProfiles)) {
            return data.foragingProfiles;
        }

        if (data.name && (Array.isArray(data.resources) || Array.isArray(data.tools))) {
            return [data];
        }

        return [];

    }

    private normalizeImportedProfile(entry: unknown): ForagingProfile | null {

        if (!entry || typeof entry !== "object") {
            return null;
        }

        const raw = entry as Partial<ForagingProfile>;
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

    public async startForaging(profileId: string): Promise<void> {

        const profile = this.getProfile(profileId);

        if (!profile) {
            ui.notifications.warn("Lista Foraging non trovata.");
            return;
        }

        const actor = this.getSelectedActor();

        if (!actor) {
            ui.notifications.warn("Seleziona un token con attore prima di usare Foraging.");
            return;
        }

        if (profile.resources.length === 0) {
            ui.notifications.warn("La lista Foraging non contiene risorse.");
            return;
        }

        const confirmation = await this.confirmForaging(profile, actor);

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
            ? await this.getMixedResolvedResources(profile)
            : [];

        const professionService = new ProfessionService();

        const actorProfession = professionService.getActorProfession(actor, profile.profession);

        const effectiveProfessionLevel = actorProfession.level;

        const gatheringMultiplier = actorProfession.gatheringMultiplier;

        const collectedResources: CollectedForagingResource[] = selectedResources.map(resource => {
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

            await this.addItemToActor(
                actor,
                resource.uuid,
                resource.finalQuantity
            );
        }

        const criticalFailureToolDamage = criticalFailure
            ? await this.damageForagingTool(actor, profile)
            : null;

        const professionXpGained = success
            ? this.calculateForagingXp(profile, collectedResources.length, criticalSuccess)
            : 0;

        const actorProfessionAfterXp = professionXpGained > 0
            ? await professionService.addActorProfessionXp(actor, profile.profession, professionXpGained)
            : actorProfession;

        await this.sendForagingResultToChat({
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
            criticalFailureToolDamage
        });

        if (criticalSuccess) {
            ui.notifications.info("Foraging riuscito con successo critico.");
        } else if (success) {
            ui.notifications.info("Foraging riuscito.");
        } else if (criticalFailure) {
            ui.notifications.error("Foraging fallito criticamente.");
        } else {
            ui.notifications.warn("Foraging fallito.");
        }

    }

    private async confirmForaging(
        profile: ForagingProfile,
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
                return `<li>${this.escapeHtml(resource.name)} — peso ${resource.weight}, quantità ${this.escapeHtml(resource.quantityLabel)}</li>`;
            }).join("")
            : "<li><em>Nessuna risorsa configurata.</em></li>";

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
                <p><strong>Bioma:</strong> ${this.escapeHtml(this.getBiomeLabel(profile.biome))}</p>
                <p><strong>Professione:</strong> ${this.escapeHtml(this.getProfessionLabel(profile.profession))}</p>
                <p><strong>Livello professione PG:</strong> ${actorProfession.level}</p>
                <p><strong>XP professione PG:</strong> ${actorProfession.xp}</p>
                <p><strong>Moltiplicatore raccolta PG:</strong> ${this.escapeHtml(actorProfession.gatheringMultiplierLabel)}</p>
                <p><strong>Abilità:</strong> ${this.escapeHtml(profile.skill || "Non impostata")}</p>
                <p><strong>CD:</strong> ${profile.dc}</p>
                <p><strong>Tempo:</strong> ${this.formatMinutes(profile.time)}</p>
                <p><strong>Massimo risorse diverse:</strong> ${profile.maxResources}</p>

                <h4>Risorse possibili</h4>
                <ul>${resourceRows}</ul>

                <h4>Strumenti bonus</h4>
                <ul>${toolRows}</ul>
            </form>
        `;

        return new Promise(resolve => {
            new Dialog({
                title: "Avvia Foraging",
                content,
                buttons: {
                    cancel: {
                        label: "Annulla",
                        callback: () => resolve(false)
                    },
                    confirm: {
                        label: "Tira Foraging",
                        callback: () => resolve(true)
                    }
                },
                default: "confirm",
                close: () => resolve(false)
            }).render(true);
        });

    }

    private async getMixedResolvedResources(
        profile: ForagingProfile
    ): Promise<SelectedForagingResource[]> {

        const resources = await this.toComponentViews(
            profile,
            "resources",
            profile.resources
        );

        const availableResources = resources.filter(resource => resource.found && resource.weight > 0);

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

        const selected: SelectedForagingResource[] = [];

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
        profile: ForagingProfile
    ): Promise<SelectedForagingResource | null> {

        const resources = await this.toComponentViews(
            profile,
            "resources",
            profile.resources
        );

        const validResources = resources.filter(resource => resource.found && resource.weight > 0);

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

    private async getToolQuantityBonus(
        actor: Actor,
        profile: ForagingProfile
    ): Promise<ForagingToolBonusResult> {

        let totalBonus = 0;

        const details: ForagingToolBonusDetail[] = [];

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

            const quantity = Math.max(0, proficiencyBonus);

            const applied = possessed && proficient && quantity > 0;

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

    private async damageForagingTool(
        actor: Actor,
        profile: ForagingProfile
    ): Promise<string | null> {

        if (profile.tools.length === 0) {
            return "Nessuno strumento configurato nella lista Foraging.";
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

    private async addItemToActor(
        actor: Actor,
        uuid: string,
        quantity: number
    ): Promise<void> {

        const source = await this.safeFromUuid(uuid) as any;

        if (!source || source.documentName !== "Item") {
            ui.notifications.warn(`Output Foraging non valido: ${uuid}`);
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

    private calculateForagingXp(
        profile: ForagingProfile,
        collectedResourceCount: number,
        criticalSuccess: boolean
    ): number {

        const resourceBonus = Math.max(1, Math.floor(Number(collectedResourceCount ?? 0)));

        const baseXp = resourceBonus;

        return criticalSuccess
            ? baseXp * 2
            : baseXp;

    }

    private async sendForagingResultToChat(data: {
        actor: Actor;
        profile: ForagingProfile;
        rollFormula: string;
        natural: number | null;
        total: number;
        skillModifier: number;
        success: boolean;
        criticalSuccess: boolean;
        criticalFailure: boolean;
        collectedResources: CollectedForagingResource[];
        toolBonus: number;
        toolBonusDetails: ForagingToolBonusDetail[];
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
    }): Promise<void> {

        const title = data.criticalSuccess
            ? "🌟 Successo critico Foraging"
            : data.criticalFailure
                ? "💥 Fallimento critico Foraging"
                : data.success
                    ? "✅ Foraging riuscito"
                    : "❌ Foraging fallito";

        const specialResultText = data.criticalSuccess
            ? "Successo critico: quantità dopo moltiplicatore raddoppiata."
            : data.criticalFailure
                ? `Fallimento critico: prova fallita automaticamente, nessuna risorsa raccolta. ${data.criticalFailureToolDamage ?? ""}`.trim()
                : "-";

        const resourceRows = data.collectedResources.length > 0
            ? data.collectedResources.map(resource => `
                <tr>
                    <td>${this.escapeHtml(resource.name)}</td>
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
                    <td colspan="7">Nessuna risorsa raccolta.</td>
                </tr>
            `;

        const resultText = data.success && data.collectedResources.length > 0
            ? `${data.collectedResources.length} risorse diverse aggiunte all'attore.`
            : "Nessuna risorsa raccolta.";

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
                            <td><strong>Bioma</strong></td>
                            <td>${this.escapeHtml(this.getBiomeLabel(data.profile.biome))}</td>
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
                            <td><strong>Moltiplicatore raccolta PG</strong></td>
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
                            <td>${this.formatMinutes(data.profile.time)}</td>
                        </tr>
                        <tr>
                            <td><strong>Massimo risorse diverse</strong></td>
                            <td>${data.profile.maxResources}</td>
                        </tr>
                        <tr>
                            <td><strong>Risorse diverse raccolte</strong></td>
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
                    </tbody>
                </table>

                <h3>Risorse raccolte</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Risorsa</th>
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

    private async saveProfiles(profiles: ForagingProfile[]): Promise<void> {

        this.ensureSettingsRegistered();

        await game.settings.set(
            ForagingService.SETTING_SCOPE,
            ForagingService.SETTING_KEY,
            profiles.map(profile => this.normalizeProfile(profile))
        );

    }

    private ensureSettingsRegistered(): void {

        const key = `${ForagingService.SETTING_SCOPE}.${ForagingService.SETTING_KEY}`;

        if (game.settings.settings.has(key)) {
            return;
        }

        game.settings.register(
            ForagingService.SETTING_SCOPE,
            ForagingService.SETTING_KEY,
            {
                name: "Artisan Foraging Profiles",
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

    private formatMinutes(value: number): string {

        const minutes = Math.max(0, Number(value ?? 0));

        if (minutes === 1) {
            return "1 minuto";
        }

        return `${minutes} minuti`;

    }

    private normalizeProfile(profile: Partial<ForagingProfile>): ForagingProfile {

        const professionService = new ProfessionService();

        const rawProfession = String(profile.profession || "erborista");

        const profession = professionService.getProfession(rawProfession)
            ? professionService.normalizeId(rawProfession)
            : rawProfession;

        return {
            id: String(profile.id || foundry.utils.randomID()),
            name: String(profile.name || "Lista Foraging"),
            biome: String(profile.biome || "foresta"),
            profession,
            professionLevel: professionService.normalizeLevel((profile as any).professionLevel ?? 1),
            skill: String(profile.skill || professionService.getDefaultSkill(profession) || "survival"),
            dc: Number(profile.dc ?? 10),
            time: Number(profile.time ?? 1),
            maxResources: Math.max(1, Math.floor(Number((profile as any).maxResources ?? 1))),
            resources: this.normalizeComponents(profile.resources),
            tools: this.normalizeComponents(profile.tools)
        };

    }

    private normalizeComponents(components: unknown): ForagingComponent[] {

        if (!Array.isArray(components)) {
            return [];
        }

        return components.map(component => this.normalizeComponent(component as Partial<ForagingComponent>));

    }

    private normalizeComponent(component: Partial<ForagingComponent>): ForagingComponent {

        const legacyQuantity = Math.max(1, Number(component.quantity ?? 1));

        const minQuantity = Math.max(1, Number(component.minQuantity ?? legacyQuantity));

        const maxQuantity = Math.max(minQuantity, Number(component.maxQuantity ?? legacyQuantity));

        return {
            uuid: String(component.uuid ?? "").trim(),
            quantity: legacyQuantity,
            weight: Math.max(0.1, Number(component.weight ?? 0.1)),
            minQuantity,
            maxQuantity
        };

    }

    private async toProfileView(profile: ForagingProfile): Promise<ForagingProfileView> {

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
        profile: ForagingProfile,
        collection: ForagingComponentCollection,
        components: ForagingComponent[]
    ): Promise<ForagingComponentView[]> {

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
        profile: ForagingProfile,
        collection: ForagingComponentCollection,
        component: ForagingComponent,
        index: number
    ): Promise<ForagingComponentView> {

        const normalized = this.normalizeComponent(component);

        const fallback: ForagingComponentView = {
            index,
            collection,
            profileId: profile.id,
            uuid: normalized.uuid,
            quantity: normalized.quantity,
            weight: normalized.weight,
            minQuantity: normalized.minQuantity,
            maxQuantity: normalized.maxQuantity,
            quantityLabel: collection === "resources"
                ? this.getQuantityLabel(normalized)
                : "Bonus competenza PG alla prova",
            name: normalized.uuid,
            img: "icons/svg/item-bag.svg",
            found: false,
            documentType: ""
        };

        const document = await this.safeFromUuid(normalized.uuid) as any;

        if (!document) {
            return fallback;
        }

        return {
            ...fallback,
            name: document.name ?? normalized.uuid,
            img: document.img ?? "icons/svg/item-bag.svg",
            found: document.documentName === "Item",
            documentType: document.documentName ?? ""
        };

    }


    private getProfessionLabel(profession: string): string {

        return new ProfessionService().getLabel(profession);

    }

    private getBiomeLabel(biome: string): string {

        const labels: Record<string, string> = {
            foresta: "Foresta",
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

    private getQuantityLabel(component: ForagingComponent): string {

        if (component.minQuantity === component.maxQuantity) {
            return String(component.minQuantity);
        }

        return `${component.minQuantity}-${component.maxQuantity}`;

    }

    private resolveResourceWeight(
        configuredWeight: number | undefined,
        importedWeight: number | null
    ): number {

        if (typeof configuredWeight === "number" && Number.isFinite(configuredWeight) && configuredWeight > 0) {
            return configuredWeight;
        }

        if (typeof importedWeight === "number" && Number.isFinite(importedWeight) && importedWeight > 0) {
            return importedWeight;
        }

        return 0.1;

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

    private escapeHtml(value: string): string {

        return String(value)
            .replaceAll("&", "&amp;")
            .replaceAll("<", "&lt;")
            .replaceAll(">", "&gt;")
            .replaceAll('"', "&quot;")
            .replaceAll("'", "&#039;");

    }

}
