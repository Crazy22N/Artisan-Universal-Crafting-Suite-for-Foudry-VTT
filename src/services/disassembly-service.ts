
import { ProfessionService } from "./profession-service";

export type DisassemblyComponentCollection = "resources" | "tools";

export type DisassemblyResourceRarity = "common" | "uncommon" | "rare" | "veryRare" | "legendary";

export interface DisassemblyComponent {
    uuid: string;
    quantity: number;
    weight: number;
    minQuantity: number;
    maxQuantity: number;
    rarity: DisassemblyResourceRarity;
}

export interface DisassemblyComponentView extends DisassemblyComponent {
    index: number;
    collection: DisassemblyComponentCollection;
    profileId: string;
    name: string;
    img: string;
    found: boolean;
    documentType: string;
    quantityLabel: string;
    rarityLabel: string;
}

export interface DisassemblyProfile {
    id: string;
    name: string;
    sourceUuid: string;
    sourceQuantity: number;
    profession: string;
    professionLevel: number;
    skill: string;
    dc: number;
    time: number;
    maxResources: number;
    toolRequirement: string;
    toolCriticalDamage: boolean;
    resources: DisassemblyComponent[];
    tools: DisassemblyComponent[];
}

interface DisassemblyProfileView extends DisassemblyProfile {
    sourceName: string;
    sourceImg: string;
    sourceFound: boolean;
    resources: DisassemblyComponentView[];
    tools: DisassemblyComponentView[];
    resourceCount: number;
    toolCount: number;
    totalResourceWeight: number;
    gatheringMultiplier: number;
    gatheringMultiplierLabel: string;
    craftingMultiplier: number;
    craftingMultiplierLabel: string;
}

interface AddDisassemblyComponentOptions {
    weight?: number;
    minQuantity?: number;
    maxQuantity?: number;
    rarity?: string;
}

interface SelectedDisassemblyResource extends DisassemblyComponentView {
    rolledQuantity: number;
}

interface CollectedDisassemblyResource extends SelectedDisassemblyResource {
    normalQuantity: number;
    multipliedQuantity: number;
    finalQuantity: number;
}

interface DisassemblyToolBonusDetail {
    name: string;
    quantity: number;
    possessed: boolean;
    proficient: boolean;
    applied: boolean;
}

interface DisassemblyToolBonusResult {
    totalBonus: number;
    details: DisassemblyToolBonusDetail[];
}

export class DisassemblyService {

    private static readonly SETTING_SCOPE = "artisan";

    private static readonly SETTING_KEY = "disassemblyProfiles";

    public async getManagerData(selectedProfileId: string | null): Promise<{
        profiles: object[];
        selectedProfile: DisassemblyProfileView | null;
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
                icon: "fa-solid fa-screwdriver-wrench",
                selected: selected?.id === profile.id
            })),
            selectedProfile: selected
                ? await this.toProfileView(selected)
                : null
        };
    }

    public getProfiles(): DisassemblyProfile[] {
        this.ensureSettingsRegistered();

        const value = game.settings.get(
            DisassemblyService.SETTING_SCOPE,
            DisassemblyService.SETTING_KEY
        ) as unknown;

        if (!Array.isArray(value)) {
            return [];
        }

        return value.map(profile => this.normalizeProfile(profile as Partial<DisassemblyProfile>));
    }

    public getProfile(id: string): DisassemblyProfile | null {
        return this.getProfiles().find(profile => profile.id === id) ?? null;
    }

    public async createProfile(): Promise<DisassemblyProfile> {
        const profile: DisassemblyProfile = {
            id: foundry.utils.randomID(),
            name: "Nuova lista Dissassemblare",
            sourceUuid: "",
            sourceQuantity: 1,
            profession: "conciatore",
            professionLevel: 1,
            skill: "survival",
            dc: 10,
            time: 1,
            maxResources: 3,
            toolRequirement: "optional",
            toolCriticalDamage: false,
            resources: [],
            tools: []
        };

        await this.saveProfiles([...this.getProfiles(), profile]);
        return profile;
    }

    public async updateProfile(
        id: string,
        data: Partial<Omit<DisassemblyProfile, "id" | "resources" | "tools">>
    ): Promise<void> {
        const nextProfiles = this.getProfiles().map(profile => {
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
        collection: DisassemblyComponentCollection,
        uuid: string,
        quantity: number,
        options: AddDisassemblyComponentOptions = {}
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
            ui.notifications.warn("Puoi aggiungere Item o Actor/NPG come materiali ottenibili; gli strumenti devono essere Item.");
            return;
        }

        const importedWeight = isItemDocument ? this.getItemWeight(document) : null;

        const nextProfiles = this.getProfiles().map(profile => {
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
                rarity: this.normalizeResourceRarity(options.rarity)
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
                        rarity: component.rarity,
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
            } as DisassemblyProfile;
        });

        await this.saveProfiles(nextProfiles);
        ui.notifications.info(`${document.name} aggiunto alla lista Dissassemblare.`);
    }

    public async removeComponent(
        profileId: string,
        collection: DisassemblyComponentCollection,
        index: number
    ): Promise<void> {
        const nextProfiles = this.getProfiles().map(profile => {
            if (profile.id !== profileId) {
                return profile;
            }

            return {
                ...profile,
                [collection]: profile[collection].filter((_entry, entryIndex) => entryIndex !== index)
            } as DisassemblyProfile;
        });

        await this.saveProfiles(nextProfiles);
    }

    public async updateComponent(
        profileId: string,
        collection: DisassemblyComponentCollection,
        index: number,
        data: Partial<Pick<DisassemblyComponent, "quantity" | "weight" | "minQuantity" | "maxQuantity" | "rarity">>
    ): Promise<void> {
        const nextProfiles = this.getProfiles().map(profile => {
            if (profile.id !== profileId) {
                return profile;
            }

            const nextCollection = [...profile[collection]];
            const current = nextCollection[index];

            if (!current) {
                return profile;
            }

            const nextData = { ...data } as Partial<DisassemblyComponent>;

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
            } as DisassemblyProfile;
        });

        await this.saveProfiles(nextProfiles);
    }

    public async deleteProfile(id: string): Promise<void> {
        const profiles = this.getProfiles();
        const target = profiles.find(profile => profile.id === id);

        if (!target) {
            ui.notifications.warn("Lista Dissassemblare non trovata.");
            return;
        }

        await this.saveProfiles(profiles.filter(profile => profile.id !== id));
        ui.notifications.info(`Lista Dissassemblare eliminata: ${target.name}`);
    }

    public exportProfiles(): void {
        const data = JSON.stringify(
            {
                type: "artisan-disassembly-profiles",
                version: 1,
                exportedAt: new Date().toISOString(),
                profiles: this.getProfiles()
            },
            null,
            4
        );

        saveDataToFile(
            data,
            "application/json",
            "artisan-dissassemblare-liste.json"
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

    public async startDisassembly(profileId: string): Promise<void> {
        const profile = this.getProfile(profileId);

        if (!profile) {
            ui.notifications.warn("Lista Dissassemblare non trovata.");
            return;
        }

        const actor = this.getSelectedActor();

        if (!actor) {
            ui.notifications.warn("Seleziona un token con attore prima di usare Dissassemblare.");
            return;
        }

        if (!profile.sourceUuid) {
            ui.notifications.warn("Imposta la risorsa sorgente da dissassemblare.");
            return;
        }

        if (profile.resources.length === 0) {
            ui.notifications.warn("La lista Dissassemblare non contiene materiali ottenibili.");
            return;
        }

        const sourceDocument = await this.safeFromUuid(profile.sourceUuid) as any;
        const sourceName = sourceDocument?.name ?? profile.sourceUuid;
        const sourceItem = this.findActorItemBySource(actor, profile.sourceUuid, sourceName);
        const sourceQuantityOwned = sourceItem
            ? Math.max(1, Number(foundry.utils.getProperty(sourceItem, "system.quantity") ?? 1))
            : 0;
        const sourceQuantityRequired = Math.max(1, Math.floor(Number(profile.sourceQuantity ?? 1)));

        if (!sourceItem || sourceQuantityOwned < sourceQuantityRequired) {
            ui.notifications.warn(`Dissassemblare bloccato: ${actor.name ?? "PG"} non possiede abbastanza ${sourceName}.`);
            await this.sendBlockedByMissingSourceToChat(actor, profile, sourceName, sourceQuantityOwned, sourceQuantityRequired);
            return;
        }

        const toolRequirementResult = await this.checkToolRequirement(actor, profile);

        if (!toolRequirementResult.allowed) {
            await this.sendBlockedByToolRequirementToChat(actor, profile, toolRequirementResult.details);
            ui.notifications.warn("Dissassemblare bloccato: manca uno strumento obbligatorio.");
            return;
        }

        const confirmation = await this.confirmDisassembly(profile, actor, sourceName, sourceQuantityOwned, sourceQuantityRequired);

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
        const gatheringMultiplier = actorProfession.gatheringMultiplier;
        const collectedResources: CollectedDisassemblyResource[] = selectedResources.map(resource => {
            const rolledQuantity = Math.max(0, Number(resource.rolledQuantity ?? 0));
            const normalQuantity = Math.max(1, rolledQuantity);
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

        let sourceConsumed = false;
        let sourceAfterQuantity = sourceQuantityOwned;

        if (success) {
            sourceAfterQuantity = await this.consumeActorItem(sourceItem, sourceQuantityRequired);
            sourceConsumed = true;

            for (const resource of collectedResources) {
                if (resource.finalQuantity <= 0) {
                    continue;
                }

                await this.addRewardToActor(actor, resource.uuid, resource.finalQuantity);
            }
        }

        const criticalFailureToolDamage = criticalFailure
            ? this.isProfileToolCriticalDamageEnabled(profile)
                ? await this.damageDisassemblyTool(actor, profile)
                : game.i18n.localize("ARTISAN.ToolDamageDisabled")
            : null;

        const professionXpGained = success
            ? this.calculateDisassemblyXp(profile, collectedResources.length, criticalSuccess)
            : 0;
        const actorProfessionAfterXp = professionXpGained > 0
            ? await professionService.addActorProfessionXp(actor, profile.profession, professionXpGained)
            : actorProfession;

        await this.sendDisassemblyResultToChat({
            actor,
            profile,
            sourceName,
            sourceQuantityOwned,
            sourceQuantityRequired,
            sourceAfterQuantity,
            sourceConsumed,
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
            gatheringMultiplierLabel: actorProfession.gatheringMultiplierLabel,
            actorProfessionLevel: actorProfession.level,
            actorProfessionLevelAfter: actorProfessionAfterXp.level,
            actorProfessionXp: actorProfession.xp,
            xpGained: professionXpGained,
            actorProfessionXpAfter: actorProfessionAfterXp.xp,
            xpToNextLevel: actorProfessionAfterXp.xpToNextLevel,
            xpForNextLevel: actorProfessionAfterXp.xpForNextLevel,
            progressPercent: actorProfessionAfterXp.progressPercent,
            criticalFailureToolDamage
        });

        if (criticalSuccess) {
            ui.notifications.info("Dissassemblare riuscito con successo critico.");
        } else if (success) {
            ui.notifications.info("Dissassemblare riuscito.");
        } else if (criticalFailure) {
            ui.notifications.error("Dissassemblare fallito criticamente.");
        } else {
            ui.notifications.warn("Dissassemblare fallito.");
        }
    }

    private async confirmDisassembly(
        profile: DisassemblyProfile,
        actor: Actor,
        sourceName: string,
        sourceQuantityOwned: number,
        sourceQuantityRequired: number
    ): Promise<boolean> {
        const resources = await this.toComponentViews(profile, "resources", profile.resources);
        const tools = await this.toComponentViews(profile, "tools", profile.tools);
        const toolBonusPreview = await this.getToolQuantityBonus(actor, profile);
        const actorProfession = new ProfessionService().getActorProfession(actor, profile.profession);

        const resourceRows = resources.length > 0
            ? resources.map(resource => `<li>${this.escapeHtml(resource.name)} — peso ${resource.weight}, quantità ${this.escapeHtml(resource.quantityLabel)}</li>`).join("")
            : "<li><em>Nessun materiale configurato.</em></li>";

        const toolRows = toolBonusPreview.details.length > 0
            ? toolBonusPreview.details.map(tool => {
                const status = tool.applied
                    ? "bonus alla prova applicato"
                    : tool.possessed
                        ? "posseduto ma non competente"
                        : "non posseduto";
                return `<li>${this.escapeHtml(tool.name)}: +${tool.quantity} alla prova — ${this.escapeHtml(status)}</li>`;
            }).join("")
            : tools.length > 0
                ? "<li><em>Strumenti configurati ma non risolti.</em></li>"
                : "<li><em>Nessuno strumento bonus configurato.</em></li>";

        const content = `
            <form>
                <p><strong>Attore:</strong> ${this.escapeHtml(actor.name ?? "Attore")}</p>
                <p><strong>Lista:</strong> ${this.escapeHtml(profile.name)}</p>
                <p><strong>Sorgente:</strong> ${this.escapeHtml(sourceName)} — richiesti ${sourceQuantityRequired}, posseduti ${sourceQuantityOwned}</p>
                <p><strong>Professione:</strong> ${this.escapeHtml(this.getProfessionLabel(profile.profession))}</p>
                <p><strong>Livello professione PG:</strong> ${actorProfession.level}</p>
                <p><strong>Moltiplicatore PG:</strong> ${this.escapeHtml(actorProfession.gatheringMultiplierLabel)}</p>
                <p><strong>Abilità:</strong> ${this.escapeHtml(profile.skill || "Non impostata")}</p>
                <p><strong>CD:</strong> ${profile.dc}</p>
                <p><strong>Tempo:</strong> ${this.formatHours(profile.time)}</p>
                <p><strong>Massimo materiali diversi:</strong> ${profile.maxResources}</p>

                <h4>Materiali possibili</h4>
                <ul>${resourceRows}</ul>

                <h4>Strumenti bonus</h4>
                <ul>${toolRows}</ul>
            </form>
        `;

        return new Promise(resolve => {
            new Dialog({
                title: "Avvia Dissassemblare",
                content,
                buttons: {
                    cancel: {
                        label: "Annulla",
                        callback: () => resolve(false)
                    },
                    confirm: {
                        label: "Dissassembla",
                        callback: () => resolve(true)
                    }
                },
                default: "confirm",
                close: () => resolve(false)
            }).render(true);
        });
    }

    private async sendBlockedByMissingSourceToChat(
        actor: Actor,
        profile: DisassemblyProfile,
        sourceName: string,
        owned: number,
        required: number
    ): Promise<void> {
        await ChatMessage.create({
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `
                <div class="artisan-chat-card artisan-chat-card--blocked">
                    <h2>Dissassemblare bloccato</h2>
                    <p><strong>Attore:</strong> ${this.escapeHtml(actor.name ?? "Attore")}</p>
                    <p><strong>Lista:</strong> ${this.escapeHtml(profile.name)}</p>
                    <p>Manca la risorsa sorgente richiesta.</p>
                    <p><strong>Sorgente:</strong> ${this.escapeHtml(sourceName)} — richiesti ${required}, posseduti ${owned}</p>
                </div>
            `
        });
    }

    private async getMixedResolvedResources(profile: DisassemblyProfile): Promise<SelectedDisassemblyResource[]> {
        const resources = await this.toComponentViews(profile, "resources", profile.resources);
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
        const selected: SelectedDisassemblyResource[] = [];

        while (selected.length < targetCount && remaining.length > 0) {
            const totalWeight = remaining.reduce((total, resource) => total + Math.max(0, Number(resource.weight ?? 0)), 0);

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
                rolledQuantity: this.rollQuantityRange(resource.minQuantity, resource.maxQuantity)
            });
        }

        return selected;
    }

    private rollQuantityRange(minQuantity: number, maxQuantity: number): number {
        const min = Math.max(1, Math.floor(Number(minQuantity || 1)));
        const max = Math.max(min, Math.floor(Number(maxQuantity || min)));
        return min + Math.floor(Math.random() * (max - min + 1));
    }

    private async checkToolRequirement(actor: Actor, profile: DisassemblyProfile): Promise<{ allowed: boolean; details: DisassemblyToolBonusDetail[] }> {
        const preview = await this.getToolQuantityBonus(actor, profile);

        if (profile.toolRequirement !== "required" || profile.tools.length === 0) {
            return { allowed: true, details: preview.details };
        }

        return {
            allowed: preview.details.some(detail => detail.possessed),
            details: preview.details
        };
    }

    private async sendBlockedByToolRequirementToChat(actor: Actor, profile: DisassemblyProfile, details: DisassemblyToolBonusDetail[]): Promise<void> {
        const rows = details.length > 0
            ? details.map(detail => `<li>${this.escapeHtml(detail.name)} — ${detail.possessed ? (detail.proficient ? "posseduto e competente" : "posseduto ma non competente") : "non posseduto"}</li>`).join("")
            : "<li>Nessuno strumento configurato.</li>";

        await ChatMessage.create({
            content: `
                <div class="artisan-chat-card">
                    <h2>Dissassemblare bloccato</h2>
                    <p><strong>${this.escapeHtml(actor.name ?? "PG")}</strong> non possiede nessuno degli strumenti obbligatori per <strong>${this.escapeHtml(profile.name)}</strong>.</p>
                    <ul>${rows}</ul>
                    <p><em>La competenza serve solo per il bonus; per sbloccare l’azione basta possedere almeno uno strumento obbligatorio.</em></p>
                </div>
            `,
            speaker: ChatMessage.getSpeaker({ actor })
        });
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

    private async damageDisassemblyTool(
        actor: Actor,
        profile: DisassemblyProfile
    ): Promise<string | null> {

        if (profile.tools.length === 0) {
            return "Nessuno strumento configurato nella lista Dissassemblare.";
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

    private async getToolQuantityBonus(actor: Actor, profile: DisassemblyProfile): Promise<DisassemblyToolBonusResult> {
        let totalBonus = 0;
        const details: DisassemblyToolBonusDetail[] = [];

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
            const applied = possessed && proficient && proficiencyBonus > 0 && totalBonus === 0;
            const quantity = applied
                ? Math.max(0, proficiencyBonus)
                : 0;

            if (applied) {
                totalBonus = quantity;
            }

            details.push({ name, quantity, possessed, proficient, applied });
        }

        return { totalBonus, details };
    }

    private async addRewardToActor(actor: Actor, uuid: string, quantity: number): Promise<void> {
        const source = await this.safeFromUuid(uuid) as any;

        if (!source) {
            ui.notifications.warn(`Output Dissassemblare non valido: ${uuid}`);
            return;
        }

        if (source.documentName === "Actor") {
            ui.notifications.info(`${source.name ?? uuid} aggiunto come risultato Dissassemblare. Gli Actor/NPG vengono mostrati in chat e non inseriti nell'inventario del PG.`);
            return;
        }

        if (source.documentName !== "Item") {
            ui.notifications.warn(`Output Dissassemblare non valido: ${uuid}`);
            return;
        }

        const existing = this.findActorItemBySource(actor, uuid, source.name ?? "");

        if (existing) {
            const currentQuantity = Number(foundry.utils.getProperty(existing, "system.quantity") ?? 1);
            await existing.update({ "system.quantity": currentQuantity + quantity });
            return;
        }

        const itemData = source.toObject();
        foundry.utils.setProperty(itemData, "system.quantity", quantity);
        foundry.utils.setProperty(itemData, "flags.artisan.sourceUuid", uuid);
        await actor.createEmbeddedDocuments("Item", [itemData]);
    }

    private async consumeActorItem(item: Item, quantity: number): Promise<number> {
        const beforeQuantity = Math.max(1, Number(foundry.utils.getProperty(item, "system.quantity") ?? 1));
        const afterQuantity = Math.max(0, beforeQuantity - Math.max(1, Math.floor(Number(quantity ?? 1))));

        if (afterQuantity > 0) {
            await item.update({ "system.quantity": afterQuantity });
            return afterQuantity;
        }

        await item.delete();
        return 0;
    }

    private findActorItemBySource(actor: Actor, sourceUuid: string, sourceName: string): Item | null {
        return actor.items.find((item: Item) => {
            const flagUuid = item.getFlag("artisan", "sourceUuid");

            if (flagUuid === sourceUuid) {
                return true;
            }

            return !!sourceName && item.name === sourceName;
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
        const firstTerm = roll.terms.find((term: any) => Array.isArray(term.results)) as any;
        const result = firstTerm?.results?.[0]?.result;
        return typeof result === "number" ? result : null;
    }

    private calculateDisassemblyXp(profile: DisassemblyProfile, collectedResourceCount: number, criticalSuccess: boolean): number {
        const resourceBonus = Math.max(1, Math.floor(Number(collectedResourceCount ?? 0)));
        const baseXp = resourceBonus + Math.max(0, Math.floor(Number(profile.sourceQuantity ?? 1)) - 1);
        return criticalSuccess ? baseXp * 2 : baseXp;
    }

    private async sendDisassemblyResultToChat(data: {
        actor: Actor;
        profile: DisassemblyProfile;
        sourceName: string;
        sourceQuantityOwned: number;
        sourceQuantityRequired: number;
        sourceAfterQuantity: number;
        sourceConsumed: boolean;
        rollFormula: string;
        natural: number | null;
        total: number;
        skillModifier: number;
        success: boolean;
        criticalSuccess: boolean;
        criticalFailure: boolean;
        collectedResources: CollectedDisassemblyResource[];
        toolBonus: number;
        toolBonusDetails: DisassemblyToolBonusDetail[];
        gatheringMultiplierLabel: string;
        actorProfessionLevel: number;
        actorProfessionLevelAfter: number;
        actorProfessionXp: number;
        xpGained: number;
        actorProfessionXpAfter: number;
        xpToNextLevel: number;
        xpForNextLevel: number | null;
        progressPercent: number;
        criticalFailureToolDamage: string | null;
    }): Promise<void> {
        const title = data.criticalSuccess
            ? "🌟 Successo critico Dissassemblare"
            : data.criticalFailure
                ? "💥 Fallimento critico Dissassemblare"
                : data.success
                    ? "✅ Dissassemblare riuscito"
                    : "❌ Dissassemblare fallito";

        const resourceRows = data.collectedResources.length > 0
            ? data.collectedResources.map(resource => `
                <tr>
                    <td>${this.formatRewardName(resource)}</td>
                    <td>${resource.weight}</td>
                    <td>${this.escapeHtml(resource.quantityLabel)}</td>
                    <td>${resource.rolledQuantity}</td>
                    <td>${resource.multipliedQuantity}</td>
                    <td>${resource.finalQuantity}</td>
                </tr>
            `).join("")
            : `<tr><td colspan="6">Nessun materiale ottenuto.</td></tr>`;

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

        const sourceText = data.sourceConsumed
            ? `${this.escapeHtml(data.sourceName)} consumato: ${data.sourceQuantityOwned} → ${data.sourceAfterQuantity}`
            : `${this.escapeHtml(data.sourceName)} non consumato.`;

        const content = `
            <div class="artisan-chat-card">
                <h2>${title}</h2>
                <p><strong>${this.escapeHtml(data.profile.name)}</strong><br>Attore: ${this.escapeHtml(data.actor.name ?? "Attore")}</p>
                <table>
                    <tbody>
                        <tr><td><strong>Sorgente</strong></td><td>${sourceText}</td></tr>
                        <tr><td><strong>Professione</strong></td><td>${this.escapeHtml(this.getProfessionLabel(data.profile.profession))}</td></tr>
                        <tr><td><strong>Livello professione PG</strong></td><td>${data.actorProfessionLevel} → ${data.actorProfessionLevelAfter}${data.actorProfessionLevelAfter > data.actorProfessionLevel ? " ⭐ Avanzamento" : ""}</td></tr>
                        <tr><td><strong>XP professione PG</strong></td><td>${data.actorProfessionXp} → ${data.actorProfessionXpAfter}</td></tr>
                        <tr><td><strong>XP guadagnata</strong></td><td>+${data.xpGained}</td></tr>
                        <tr><td><strong>Prossimo livello</strong></td><td>${data.xpForNextLevel === null ? "Livello massimo" : `${data.xpToNextLevel} XP mancanti (${data.progressPercent}%)`}</td></tr>
                        <tr><td><strong>Moltiplicatore PG</strong></td><td>${this.escapeHtml(data.gatheringMultiplierLabel)}</td></tr>
                        <tr><td><strong>Abilità</strong></td><td>${this.escapeHtml(data.profile.skill || "Non impostata")}</td></tr>
                        <tr><td><strong>Formula</strong></td><td>${this.escapeHtml(data.rollFormula)}</td></tr>
                        <tr><td><strong>Naturale</strong></td><td>${data.natural ?? "-"}</td></tr>
                        <tr><td><strong>Modificatore abilità</strong></td><td>${data.skillModifier}</td></tr>
                        <tr><td><strong>Bonus strumenti competenti</strong></td><td>+${data.toolBonus}</td></tr>
                        <tr><td><strong>Dettaglio strumenti</strong></td><td>${toolDetailsText}</td></tr>
                        <tr><td><strong>Totale</strong></td><td>${data.total}</td></tr>
                        <tr><td><strong>CD</strong></td><td>${data.profile.dc}</td></tr>
                        <tr><td><strong>Tempo</strong></td><td>${this.formatHours(data.profile.time)}</td></tr>
                        <tr><td><strong>Danno strumenti</strong></td><td>${data.criticalFailure ? this.escapeHtml(data.criticalFailureToolDamage ?? "Nessuno") : "-"}</td></tr>
                    </tbody>
                </table>

                <h3>Materiali ottenuti</h3>
                <table>
                    <thead>
                        <tr><th>Materiale</th><th>Peso</th><th>Range</th><th>Base</th><th>Dopo mult.</th><th>Finale</th></tr>
                    </thead>
                    <tbody>${resourceRows}</tbody>
                </table>
            </div>
        `;

        await ChatMessage.create({
            content,
            speaker: ChatMessage.getSpeaker({ actor: data.actor })
        });
    }

    private async saveProfiles(profiles: DisassemblyProfile[]): Promise<void> {
        this.ensureSettingsRegistered();
        await game.settings.set(
            DisassemblyService.SETTING_SCOPE,
            DisassemblyService.SETTING_KEY,
            profiles.map(profile => this.normalizeProfile(profile))
        );
    }

    private ensureSettingsRegistered(): void {
        const key = `${DisassemblyService.SETTING_SCOPE}.${DisassemblyService.SETTING_KEY}`;

        if (game.settings.settings.has(key)) {
            return;
        }

        game.settings.register(
            DisassemblyService.SETTING_SCOPE,
            DisassemblyService.SETTING_KEY,
            {
                name: "Artisan Disassembly Profiles",
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
        return hours === 1 ? "1 ora" : `${hours} ore`;
    }

    private normalizeProfile(profile: Partial<DisassemblyProfile>): DisassemblyProfile {
        const professionService = new ProfessionService();
        const rawProfession = String(profile.profession || "conciatore");
        const profession = professionService.getProfession(rawProfession)
            ? professionService.normalizeId(rawProfession)
            : rawProfession;

        return {
            id: String(profile.id || foundry.utils.randomID()),
            name: String(profile.name || "Lista Dissassemblare"),
            sourceUuid: String((profile as any).sourceUuid ?? "").trim(),
            sourceQuantity: Math.max(1, Math.floor(Number((profile as any).sourceQuantity ?? 1))),
            profession,
            professionLevel: professionService.normalizeLevel((profile as any).professionLevel ?? 1),
            skill: String(profile.skill || professionService.getDefaultSkill(profession) || "survival"),
            dc: Number(profile.dc ?? 10),
            time: Number(profile.time ?? 1),
            maxResources: Math.max(1, Math.floor(Number((profile as any).maxResources ?? 1))),
            toolRequirement: String((profile as any).toolRequirement || "optional") === "required" ? "required" : "optional",
            toolCriticalDamage: Boolean((profile as any).toolCriticalDamage ?? false),
            resources: this.normalizeComponents(profile.resources),
            tools: this.normalizeComponents(profile.tools)
        };
    }

    private normalizeComponents(components: unknown): DisassemblyComponent[] {
        if (!Array.isArray(components)) {
            return [];
        }

        return components.map(component => this.normalizeComponent(component as Partial<DisassemblyComponent>));
    }

    private normalizeComponent(component: Partial<DisassemblyComponent>): DisassemblyComponent {
        const legacyQuantity = Math.max(1, Number(component.quantity ?? 1));
        const minQuantity = Math.max(1, Number(component.minQuantity ?? legacyQuantity));
        const maxQuantity = Math.max(minQuantity, Number(component.maxQuantity ?? legacyQuantity));

        return {
            uuid: String(component.uuid ?? "").trim(),
            quantity: legacyQuantity,
            weight: Math.max(0.1, Number(component.weight ?? this.getRarityWeight(component.rarity))),
            minQuantity,
            maxQuantity,
            rarity: this.normalizeResourceRarity(component.rarity)
        };
    }

    private async toProfileView(profile: DisassemblyProfile): Promise<DisassemblyProfileView> {
        const resources = await this.toComponentViews(profile, "resources", profile.resources);
        const tools = await this.toComponentViews(profile, "tools", profile.tools);
        const sourceDocument = profile.sourceUuid
            ? await this.safeFromUuid(profile.sourceUuid) as any
            : null;

        return {
            ...profile,
            sourceName: sourceDocument?.name ?? profile.sourceUuid ?? "",
            sourceImg: sourceDocument?.img ?? "icons/svg/item-bag.svg",
            sourceFound: sourceDocument?.documentName === "Item",
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
        profile: DisassemblyProfile,
        collection: DisassemblyComponentCollection,
        components: DisassemblyComponent[]
    ): Promise<DisassemblyComponentView[]> {
        const views = components.map(async (component, index) => this.toComponentView(profile, collection, component, index));
        return Promise.all(views);
    }

    private async toComponentView(
        profile: DisassemblyProfile,
        collection: DisassemblyComponentCollection,
        component: DisassemblyComponent,
        index: number
    ): Promise<DisassemblyComponentView> {
        const normalized = this.normalizeComponent(component);
        const fallback: DisassemblyComponentView = {
            index,
            collection,
            profileId: profile.id,
            uuid: normalized.uuid,
            quantity: normalized.quantity,
            weight: normalized.weight,
            minQuantity: normalized.minQuantity,
            maxQuantity: normalized.maxQuantity,
            rarity: normalized.rarity,
            rarityLabel: this.getResourceRarityLabel(normalized.rarity),
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
            found: document.documentName === "Item" || document.documentName === "Actor",
            documentType: document.documentName ?? ""
        };
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

        if (data.type === "artisan-disassembly-profiles" && Array.isArray(data.disassemblyProfiles)) {
            return data.disassemblyProfiles;
        }

        if (data.name && (Array.isArray(data.resources) || Array.isArray(data.tools))) {
            return [data];
        }

        return [];
    }

    private normalizeImportedProfile(entry: unknown): DisassemblyProfile | null {
        if (!entry || typeof entry !== "object") {
            return null;
        }

        const raw = entry as Partial<DisassemblyProfile>;
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

    private getProfessionLabel(profession: string): string {
        return new ProfessionService().getLabel(profession);
    }

    private getQuantityLabel(component: DisassemblyComponent): string {
        if (component.minQuantity === component.maxQuantity) {
            return String(component.minQuantity);
        }

        return `${component.minQuantity}-${component.maxQuantity}`;
    }

    private resolveResourceWeight(
        configuredWeight: number | undefined,
        importedWeight: number | null,
        rarity?: string
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


    private normalizeResourceRarity(rarity: unknown): DisassemblyResourceRarity {

        const value = String(rarity ?? "common");

        if (["common", "uncommon", "rare", "veryRare", "legendary"].includes(value)) {
            return value as DisassemblyResourceRarity;
        }

        return "common";

    }

    private getRarityWeight(rarity: unknown): number {

        const weights: Record<DisassemblyResourceRarity, number> = {
            common: 100,
            uncommon: 45,
            rare: 20,
            veryRare: 8,
            legendary: 2
        };

        return weights[this.normalizeResourceRarity(rarity)];

    }

    private getResourceRarityLabel(rarity: unknown): string {

        const labels: Record<DisassemblyResourceRarity, string> = {
            common: "Comune",
            uncommon: "Non comune",
            rare: "Rara",
            veryRare: "Molto rara",
            legendary: "Leggendaria"
        };

        return labels[this.normalizeResourceRarity(rarity)];

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

    private actorIsProficientWithTool(actor: Actor, actorItem: any, sourceItem: any): boolean {
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
            const label = String(toolData?.label ?? toolData?.name ?? toolData?.id ?? "").trim().toLowerCase();

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

        const candidates = [toolData.value, toolData.prof, toolData.proficient, toolData.proficiency, toolData.hasProficiency];

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

        return Array.from(new Set(values.map(value => String(value ?? "").trim().toLowerCase()).filter(value => value.length > 0)));
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
