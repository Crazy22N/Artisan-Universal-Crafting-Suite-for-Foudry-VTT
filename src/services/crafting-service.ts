import {
    ArtisanRecipeComponent,
    ArtisanRecipeData,
    RecipeComponentCollection,
    RecipeDocument
} from "../documents";

import { RecipeRepository } from "../repositories";
import { ProfessionService } from "./profession-service";

interface CraftingValidationEntry {
    collection: RecipeComponentCollection;
    collectionLabel: string;
    uuid: string;
    quantity: number;
    name: string;
    found: boolean;
    isItem: boolean;
    message: string;
    document?: Item;
}

interface CraftingValidationResult {
    recipeName: string;
    recipeUuid: string;
    recipeData: ArtisanRecipeData;
    valid: boolean;
    entries: CraftingValidationEntry[];
    errors: string[];
    warnings: string[];
}

interface ActorInventoryMatch {
    recipeEntry: CraftingValidationEntry;
    actorItem: Item | null;
    requiredQuantity: number;
    availableQuantity: number;
    beforeQuantity: number;
    afterQuantity: number;
    sufficient: boolean;
    status: string;
}

interface CraftingToolProficiencyDetail {
    name: string;
    possessed: boolean;
    proficient: boolean;
    bonus: number;
    applied: boolean;
}

interface CraftingToolProficiencyResult {
    totalBonus: number;
    details: CraftingToolProficiencyDetail[];
}

interface CraftingProfessionRequirement {
    professionId: string;
    professionLabel: string;
    requiredLevel: number;
    actorLevel: number;
    actorXp: number;
    allowed: boolean;
    source: string;
}

interface CraftingProfessionXpResult {
    gained: number;
    beforeXp: number;
    afterXp: number;
    beforeLevel: number;
    afterLevel: number;
    xpToNextLevel: number;
    xpForNextLevel: number | null;
    progressPercent: number;
}

interface CraftingCurrencyCost {
    amount: number;
    denomination: string;
    totalCopper: number;
    label: string;
    consumeOnFailure: boolean;
}

interface CraftingCurrencyMatch {
    cost: CraftingCurrencyCost;
    requiredCopper: number;
    availableCopper: number;
    beforeCurrency: Record<string, number>;
    afterCurrency: Record<string, number>;
    sufficient: boolean;
    consumed: boolean;
    status: string;
}

interface CraftingExecutionContext {
    actor: Actor;
    recipeItem: Item;
    validation: CraftingValidationResult;
    professionRequirement: CraftingProfessionRequirement;
    lots: number;
    maxLots: number;
    ingredients: ActorInventoryMatch[];
    tools: ActorInventoryMatch[];
    outputs: CraftingValidationEntry[];
    currency: CraftingCurrencyMatch;
}

interface CraftingRollResult {
    natural: number;
    modifier: number;
    skillModifier: number;
    toolProficiencyBonus: number;
    toolProficiencyDetails: CraftingToolProficiencyDetail[];
    total: number;
    formula: string;
    dc: number;
    success: boolean;
    criticalSuccess: boolean;
    criticalFailure: boolean;
    outcomeLabel: string;
}

interface CraftingOutputQuality {
    key: string;
    label: string;
    margin: number;
    description: string;
}

interface CraftingQualityModification {
    bonus: number;
    dice: string;
    effectType: string;
    preferredPath: string;
}

export class CraftingService {

    private readonly repository = new RecipeRepository();

    public async validateRecipe(recipeId: string): Promise<void> {

        const recipeItem = this.repository.getRecipe(recipeId);

        if (!recipeItem) {
            ui.notifications.warn("Ricetta non trovata.");
            return;
        }

        const result = await this.buildValidationResult(recipeItem);

        await this.sendValidationResultToChat(result);

        if (result.valid) {
            ui.notifications.info("Ricetta valida.");
        } else {
            ui.notifications.warn("La ricetta contiene problemi.");
        }

    }

    public async previewCrafting(recipeId: string): Promise<void> {

        const recipeItem = this.repository.getRecipe(recipeId);

        if (!recipeItem) {
            ui.notifications.warn("Ricetta non trovata.");
            return;
        }

        await this.previewCraftingItem(recipeItem);

    }

    public async previewCraftingItem(recipeItem: Item): Promise<void> {

        if (!RecipeDocument.isRecipe(recipeItem)) {
            ui.notifications.warn("Ricetta Artisan non valida.");
            return;
        }

        const result = await this.buildValidationResult(recipeItem);

        await this.sendCraftingPreviewToChat(result);

        if (result.valid) {
            ui.notifications.info("Anteprima crafting generata.");
        } else {
            ui.notifications.warn("Anteprima generata, ma la ricetta contiene problemi.");
        }

    }

    public async rollCrafting(recipeId: string): Promise<void> {

        const recipeItem = this.repository.getRecipe(recipeId);

        if (!recipeItem) {
            ui.notifications.warn("Ricetta non trovata.");
            return;
        }

        await this.rollCraftingItem(recipeItem);

    }

    public async rollCraftingItem(recipeItem: Item): Promise<void> {

        if (!RecipeDocument.isRecipe(recipeItem)) {
            ui.notifications.warn("Ricetta Artisan non valida.");
            return;
        }

        const actor = this.getSelectedActor();

        if (!actor) {
            ui.notifications.warn("Seleziona un token con attore prima di eseguire il crafting.");
            return;
        }

        const validation = await this.buildValidationResult(recipeItem);

        if (!validation.valid) {
            await this.sendCraftingBlockedToChat(
                actor,
                recipeItem,
                validation,
                []
            );
            ui.notifications.warn("Crafting non eseguibile: la ricetta contiene errori.");
            return;
        }

        const ownedRecipeCopy = this.findRecipeCopyInActorInventory(actor, recipeItem);

        if (!ownedRecipeCopy) {
            await this.sendCraftingRecipeCopyBlockedToChat(
                actor,
                recipeItem,
                validation
            );
            ui.notifications.warn("Crafting non eseguibile: il PG deve possedere una copia della ricetta nell'inventario.");
            return;
        }

        const professionRequirement = this.getCraftingProfessionRequirement(
            actor,
            recipeItem,
            validation.recipeData
        );

        if (!professionRequirement.allowed) {
            await this.sendCraftingProfessionBlockedToChat(
                actor,
                recipeItem,
                validation,
                professionRequirement
            );

            ui.notifications.warn("Crafting non eseguibile: livello professione insufficiente.");
            return;
        }

        const maxLots = this.calculateMaxLots(actor, validation);

        if (maxLots <= 0) {
            const context = this.buildExecutionContext(
                actor,
                recipeItem,
                validation,
                1,
                maxLots
            );

            await this.sendCraftingBlockedToChat(
                actor,
                recipeItem,
                validation,
                this.getBlockingMissingMatches(context),
                context.currency
            );

            ui.notifications.warn("Crafting non eseguibile: ingredienti, strumenti obbligatori o monete insufficienti.");
            return;
        }

        const requestedLots = await this.askLots(maxLots);

        if (!requestedLots) {
            return;
        }

        const lots = Math.max(
            1,
            Math.min(
                requestedLots,
                maxLots
            )
        );

        const context = this.buildExecutionContext(
            actor,
            recipeItem,
            validation,
            lots,
            maxLots
        );

        const missing = this.getBlockingMissingMatches(context);

        if (missing.length > 0 || !context.currency.sufficient) {
            await this.sendCraftingBlockedToChat(
                actor,
                recipeItem,
                validation,
                missing,
                context.currency
            );

            ui.notifications.warn("Crafting non eseguibile: risorse o monete insufficienti.");
            return;
        }

        const confirmed = await this.confirmCrafting(context);

        if (!confirmed) {
            ui.notifications.info("Crafting annullato.");
            return;
        }

        const roll = await this.rollSkillCheck(
            actor,
            validation.recipeData,
            context.tools
        );

        await this.consumeIngredients(context);

        if (roll.success || this.shouldConsumeCurrencyOnFailure(validation.recipeData)) {
            await this.consumeCurrency(context);
        }

        const criticalFailureToolDamageEnabled = this.isRecipeToolCriticalDamageEnabled(validation.recipeData);

        if (roll.criticalFailure && criticalFailureToolDamageEnabled) {
            await this.destroyTools(context);
        }

        const outputQuality = this.getCraftingOutputQuality(roll);

        if (roll.success) {
            await this.createOutputs(
                context,
                roll.criticalSuccess ? 2 : 1,
                outputQuality
            );
        }

        const professionXp = roll.success
            ? await this.awardCraftingProfessionXp(context, roll)
            : {
                gained: 0,
                beforeXp: context.professionRequirement.actorXp,
                afterXp: context.professionRequirement.actorXp,
                beforeLevel: context.professionRequirement.actorLevel,
                afterLevel: context.professionRequirement.actorLevel,
                xpToNextLevel: new ProfessionService().getActorProfession(context.actor, context.professionRequirement.professionId).xpToNextLevel,
                xpForNextLevel: new ProfessionService().getActorProfession(context.actor, context.professionRequirement.professionId).xpForNextLevel,
                progressPercent: new ProfessionService().getActorProfession(context.actor, context.professionRequirement.professionId).progressPercent
            };

        await this.sendCraftingResultToChat(
            context,
            roll,
            professionXp,
            outputQuality
        );

        if (roll.criticalSuccess) {
            ui.notifications.info("Successo critico: output raddoppiato.");
            return;
        }

        if (roll.criticalFailure) {
            ui.notifications.error(
                criticalFailureToolDamageEnabled
                    ? "Fallimento critico: strumenti distrutti."
                    : "Fallimento critico: danno strumenti disattivato."
            );
            return;
        }

        if (roll.success) {
            ui.notifications.info("Crafting riuscito.");
        } else {
            ui.notifications.warn("Crafting fallito: ingredienti consumati.");
        }

    }

    private async buildValidationResult(recipeItem: Item): Promise<CraftingValidationResult> {

        const recipe = RecipeDocument.getData(recipeItem);

        const entries: CraftingValidationEntry[] = [];

        entries.push(
            ...await this.validateCollection(
                "ingredients",
                recipe.ingredients
            )
        );

        entries.push(
            ...await this.validateCollection(
                "tools",
                recipe.tools
            )
        );

        entries.push(
            ...await this.validateCollection(
                "outputs",
                recipe.outputs
            )
        );

        const errors: string[] = [];

        const warnings: string[] = [];

        if (recipe.outputs.length === 0) {
            errors.push("La ricetta non ha nessun output.");
        }

        if (recipe.ingredients.length === 0) {
            warnings.push("La ricetta non ha ingredienti.");
        }

        if (recipe.tools.length === 0) {
            warnings.push("La ricetta non richiede strumenti.");
        }

        for (const entry of entries) {

            if (!entry.found) {
                errors.push(`${entry.collectionLabel}: UUID non trovato → ${entry.uuid}`);
                continue;
            }

            if (!entry.isItem) {
                errors.push(`${entry.collectionLabel}: il documento non è un Item → ${entry.uuid}`);
            }

        }

        return {
            recipeName: recipeItem.name ?? "Ricetta senza nome",
            recipeUuid: recipeItem.uuid,
            recipeData: recipe,
            valid: errors.length === 0,
            entries,
            errors,
            warnings
        };

    }

    private async validateCollection(
        collection: RecipeComponentCollection,
        components: ArtisanRecipeComponent[]
    ): Promise<CraftingValidationEntry[]> {

        const entries = components.map(component => {
            return this.validateComponent(
                collection,
                component
            );
        });

        return Promise.all(entries);

    }

    private async validateComponent(
        collection: RecipeComponentCollection,
        component: ArtisanRecipeComponent
    ): Promise<CraftingValidationEntry> {

        const collectionLabel = this.getCollectionLabel(collection);

        const fallback: CraftingValidationEntry = {
            collection,
            collectionLabel,
            uuid: component.uuid,
            quantity: component.quantity,
            name: component.uuid,
            found: false,
            isItem: false,
            message: "Documento non trovato"
        };

        if (!component.uuid || !component.uuid.trim()) {
            return {
                ...fallback,
                message: "UUID vuoto"
            };
        }

        try {

            const document = await fromUuid(component.uuid) as any;

            if (!document) {
                return fallback;
            }

            const isItem = document.documentName === "Item";

            return {
                collection,
                collectionLabel,
                uuid: component.uuid,
                quantity: component.quantity,
                name: document.name ?? component.uuid,
                found: true,
                isItem,
                document: isItem ? document as Item : undefined,
                message: isItem ? "OK" : "Il documento non è un Item"
            };

        } catch (_error) {

            return {
                ...fallback,
                message: "UUID non leggibile"
            };

        }

    }

    private getSelectedActor(): Actor | null {

        const controlled = canvas?.tokens?.controlled ?? [];

        if (controlled.length !== 1) {
            return null;
        }

        return controlled[0]?.actor ?? null;

    }

    private getCraftingProfessionRequirement(
        actor: Actor,
        recipeItem: Item,
        recipe: ArtisanRecipeData
    ): CraftingProfessionRequirement {

        const professionService = new ProfessionService();

        const rawRecipeFlag = recipeItem.getFlag("artisan", "recipe") as any;

        const professionId = String(
            (recipe as any).profile
                ?? rawRecipeFlag?.profile
                ?? ""
        ).trim();

        const rawRequiredLevel =
            (recipe as any).professionLevel
            ?? rawRecipeFlag?.professionLevel
            ?? rawRecipeFlag?.requiredProfessionLevel
            ?? 0;

        const requiredLevel = professionService.normalizeLevel(rawRequiredLevel);

        const actorProfession = professionService.getActorProfession(actor, professionId);

        return {
            professionId: actorProfession.id,
            professionLabel: actorProfession.label,
            requiredLevel,
            actorLevel: actorProfession.level,
            actorXp: actorProfession.xp,
            allowed: requiredLevel <= 0 || actorProfession.level >= requiredLevel,
            source: actorProfession.hasActorValue ? "PG" : "Default livello 0"
        };

    }

    private buildExecutionContext(
        actor: Actor,
        recipeItem: Item,
        validation: CraftingValidationResult,
        lots: number,
        maxLots: number
    ): CraftingExecutionContext {

        const ingredients = validation.entries
            .filter(entry => entry.collection === "ingredients")
            .map(entry => this.buildActorInventoryMatch(actor, entry, lots));

        const tools = validation.entries
            .filter(entry => entry.collection === "tools")
            .map(entry => this.buildActorInventoryMatch(actor, entry, 1));

        const outputs = validation.entries.filter(entry => entry.collection === "outputs");

        const currency = this.buildCurrencyMatch(actor, validation.recipeData, lots);

        return {
            actor,
            recipeItem,
            validation,
            professionRequirement: this.getCraftingProfessionRequirement(actor, recipeItem, validation.recipeData),
            lots,
            maxLots,
            ingredients,
            tools,
            outputs,
            currency
        };

    }

    private buildActorInventoryMatch(
        actor: Actor,
        entry: CraftingValidationEntry,
        multiplier: number
    ): ActorInventoryMatch {

        const actorItem = this.findMatchingActorItem(actor, entry);

        const requiredQuantity = Math.max(
            1,
            Number(entry.quantity || 1)
        ) * Math.max(1, multiplier);

        const availableQuantity = actorItem
            ? this.getItemQuantity(actorItem)
            : 0;

        const sufficient = availableQuantity >= requiredQuantity;

        return {
            recipeEntry: entry,
            actorItem,
            requiredQuantity,
            availableQuantity,
            beforeQuantity: availableQuantity,
            afterQuantity: sufficient ? availableQuantity - requiredQuantity : availableQuantity,
            sufficient,
            status: sufficient ? "Disponibile" : "Insufficiente"
        };

    }

    private findRecipeCopyInActorInventory(
        actor: Actor,
        recipeItem: Item
    ): Item | null {

        if (this.isItemOwnedByActor(actor, recipeItem)) {
            return recipeItem;
        }

        const recipeKeys = this.getRecipeIdentityKeys(recipeItem);
        const recipeName = this.normalizeItemName(recipeItem.name ?? "");
        const recipeType = recipeItem.type;

        const candidates = Array.from(actor.items ?? []) as Item[];

        for (const candidate of candidates) {
            if (!RecipeDocument.isRecipe(candidate)) {
                continue;
            }

            if (this.isItemOwnedByActor(actor, candidate) && candidate.id === recipeItem.id) {
                return candidate;
            }

            const candidateKeys = this.getRecipeIdentityKeys(candidate);
            const sameKnownSource = [...candidateKeys].some(key => recipeKeys.has(key));

            if (sameKnownSource) {
                return candidate;
            }

            const sameName = this.normalizeItemName(candidate.name ?? "") === recipeName;
            const sameType = recipeType ? candidate.type === recipeType : true;

            if (sameName && sameType) {
                return candidate;
            }
        }

        return null;

    }

    private isItemOwnedByActor(
        actor: Actor,
        item: Item
    ): boolean {

        const parent = (item as any).parent ?? null;
        const itemActor = (item as any).actor ?? null;

        return parent?.id === actor.id
            || itemActor?.id === actor.id
            || parent === actor
            || itemActor === actor;

    }

    private getRecipeIdentityKeys(item: Item): Set<string> {

        const flags = ((item as any).flags ?? {}) as any;
        const stats = ((item as any)._stats ?? {}) as any;

        return new Set([
            item.uuid,
            flags?.artisan?.sourceUuid,
            flags?.core?.sourceId,
            stats?.compendiumSource,
            stats?.sourceId
        ].filter(value => typeof value === "string" && value.trim().length > 0));

    }

    private normalizeItemName(name: string): string {

        return String(name ?? "")
            .trim()
            .toLowerCase();

    }

    private calculateMaxLots(
        actor: Actor,
        validation: CraftingValidationResult
    ): number {

        const ingredientEntries = validation.entries.filter(entry => entry.collection === "ingredients");

        const toolEntries = validation.entries.filter(entry => entry.collection === "tools");

        if (this.getRecipeToolRequirement(validation.recipeData) === "required") {
            for (const tool of toolEntries) {
                const match = this.buildActorInventoryMatch(actor, tool, 1);

                if (!match.sufficient) {
                    return 0;
                }
            }
        }

        const currencyCost = this.getRecipeCurrencyCost(validation.recipeData);
        const currencyMaxLots = currencyCost.totalCopper > 0
            ? Math.floor(this.getActorCurrencyTotalCopper(actor) / currencyCost.totalCopper)
            : 99;

        if (currencyCost.totalCopper > 0 && currencyMaxLots <= 0) {
            return 0;
        }

        if (ingredientEntries.length === 0) {
            return Math.max(0, currencyMaxLots);
        }

        const availableLots = ingredientEntries.map(entry => {
            const actorItem = this.findMatchingActorItem(actor, entry);

            if (!actorItem) {
                return 0;
            }

            const available = this.getItemQuantity(actorItem);

            const required = Math.max(1, Number(entry.quantity || 1));

            return Math.floor(available / required);
        });

        return Math.max(
            0,
            Math.min(...availableLots, currencyMaxLots)
        );

    }

    private findMatchingActorItem(
        actor: Actor,
        entry: CraftingValidationEntry
    ): Item | null {

        const items = Array.from(actor.items ?? []) as Item[];

        const sourceItem = entry.document as any;

        const sourceName = String(entry.name ?? "").trim().toLowerCase();

        const sourceType = sourceItem?.type;

        const sourceSystemIdentifier = sourceItem?.system?.identifier;

        const byUuid = items.find(item => {
            const flags = (item as any).flags ?? {};
            return flags?.artisan?.sourceUuid === entry.uuid;
        });

        if (byUuid) {
            return byUuid;
        }

        const byIdentifier = sourceSystemIdentifier
            ? items.find(item => {
                return (item as any).system?.identifier === sourceSystemIdentifier;
            })
            : null;

        if (byIdentifier) {
            return byIdentifier;
        }

        const byNameAndType = items.find(item => {
            const sameName = String(item.name ?? "").trim().toLowerCase() === sourceName;
            const sameType = sourceType ? item.type === sourceType : true;
            return sameName && sameType;
        });

        if (byNameAndType) {
            return byNameAndType;
        }

        return null;

    }

    private findMatchingActorOutputItem(
        actor: Actor,
        entry: CraftingValidationEntry,
        quality: CraftingOutputQuality
    ): Item | null {

        const items = Array.from(actor.items ?? []) as Item[];

        const sourceItem = entry.document as any;

        const sourceName = String(entry.name ?? "").trim().toLowerCase();

        const sourceType = sourceItem?.type;

        const sourceSystemIdentifier = sourceItem?.system?.identifier;

        const matchingItems = items.filter(item => {
            const flags = (item as any).flags ?? {};

            if (flags?.artisan?.sourceUuid === entry.uuid) {
                return true;
            }

            if (sourceSystemIdentifier && (item as any).system?.identifier === sourceSystemIdentifier) {
                return true;
            }

            const cleanItemName = String(item.name ?? "")
                .replace(/\s*\((Normale|Buona|Superiore|Eccellente)\)\s*$/i, "")
                .trim()
                .toLowerCase();

            const sameName = cleanItemName === sourceName;
            const sameType = sourceType ? item.type === sourceType : true;

            return sameName && sameType;
        });

        return matchingItems.find(item => {
            const flags = (item as any).flags ?? {};
            const itemQuality = String(flags?.artisan?.craftingQuality ?? "normal");
            return itemQuality === quality.key;
        }) ?? null;

    }

    private getItemQuantity(item: Item): number {

        const system = (item as any).system ?? {};

        const quantity = system.quantity
            ?? system.qty
            ?? system.uses?.value
            ?? 1;

        return Math.max(
            0,
            Number(quantity || 0)
        );

    }

    private async setItemQuantity(
        item: Item,
        quantity: number
    ): Promise<void> {

        const safeQuantity = Math.max(
            0,
            Number(quantity || 0)
        );

        if (safeQuantity <= 0) {
            await item.delete();
            return;
        }

        const system = (item as any).system ?? {};

        if (Object.prototype.hasOwnProperty.call(system, "quantity")) {
            await item.update({ "system.quantity": safeQuantity });
            return;
        }

        if (Object.prototype.hasOwnProperty.call(system, "qty")) {
            await item.update({ "system.qty": safeQuantity });
            return;
        }

        await item.update({ "system.quantity": safeQuantity });

    }


    private getRecipeCurrencyCost(recipe: ArtisanRecipeData): CraftingCurrencyCost {

        const amount = Math.max(
            0,
            Number((recipe as any).currencyCost ?? 0)
        );

        const denomination = this.normalizeCurrencyDenomination(
            (recipe as any).currencyDenomination ?? "gp"
        );

        const totalCopper = Math.round(amount * this.getCurrencyCopperValue(denomination));

        return {
            amount,
            denomination,
            totalCopper,
            label: this.formatCurrencyAmount(amount, denomination),
            consumeOnFailure: Boolean((recipe as any).consumeCurrencyOnFailure ?? false)
        };

    }

    private shouldConsumeCurrencyOnFailure(recipe: ArtisanRecipeData): boolean {

        return Boolean((recipe as any).consumeCurrencyOnFailure ?? false);

    }

    private normalizeCurrencyDenomination(value: unknown): string {

        const raw = String(value ?? "gp").trim().toLowerCase();

        const aliases: Record<string, string> = {
            cp: "cp",
            rame: "cp",
            copper: "cp",
            sp: "sp",
            argento: "sp",
            silver: "sp",
            ep: "ep",
            electrum: "ep",
            gp: "gp",
            oro: "gp",
            gold: "gp",
            mo: "gp",
            pp: "pp",
            platino: "pp",
            platinum: "pp"
        };

        return aliases[raw] ?? "gp";

    }

    private getCurrencyCopperValue(denomination: string): number {

        const values: Record<string, number> = {
            cp: 1,
            sp: 10,
            ep: 50,
            gp: 100,
            pp: 1000
        };

        return values[this.normalizeCurrencyDenomination(denomination)] ?? 100;

    }

    private getCurrencyLabel(denomination: string): string {

        const labels: Record<string, string> = {
            cp: "mr",
            sp: "ma",
            ep: "me",
            gp: "mo",
            pp: "mp"
        };

        return labels[this.normalizeCurrencyDenomination(denomination)] ?? "mo";

    }

    private formatCurrencyAmount(amount: number, denomination: string): string {

        const cleanAmount = Number.isInteger(amount)
            ? String(amount)
            : amount.toFixed(2).replace(/\.?0+$/, "");

        return `${cleanAmount} ${this.getCurrencyLabel(denomination)}`;

    }

    private getActorCurrency(actor: Actor): Record<string, number> {

        const raw = foundry.utils.getProperty(actor, "system.currency") as any;

        const result: Record<string, number> = {
            cp: 0,
            sp: 0,
            ep: 0,
            gp: 0,
            pp: 0
        };

        if (!raw || typeof raw !== "object") {
            return result;
        }

        for (const key of Object.keys(result)) {
            const value = raw[key];
            result[key] = Math.max(0, Number(value ?? 0));
        }

        return result;

    }

    private getActorCurrencyTotalCopper(actor: Actor): number {

        return this.currencyToCopper(this.getActorCurrency(actor));

    }

    private currencyToCopper(currency: Record<string, number>): number {

        return Math.round(
            Math.max(0, Number(currency.cp ?? 0))
            + Math.max(0, Number(currency.sp ?? 0)) * 10
            + Math.max(0, Number(currency.ep ?? 0)) * 50
            + Math.max(0, Number(currency.gp ?? 0)) * 100
            + Math.max(0, Number(currency.pp ?? 0)) * 1000
        );

    }

    private copperToCurrency(totalCopper: number): Record<string, number> {

        let remaining = Math.max(0, Math.floor(Number(totalCopper || 0)));

        const pp = Math.floor(remaining / 1000);
        remaining -= pp * 1000;

        const gp = Math.floor(remaining / 100);
        remaining -= gp * 100;

        const ep = Math.floor(remaining / 50);
        remaining -= ep * 50;

        const sp = Math.floor(remaining / 10);
        remaining -= sp * 10;

        const cp = remaining;

        return { cp, sp, ep, gp, pp };

    }

    private buildCurrencyMatch(
        actor: Actor,
        recipe: ArtisanRecipeData,
        lots: number
    ): CraftingCurrencyMatch {

        const cost = this.getRecipeCurrencyCost(recipe);
        const requiredCopper = cost.totalCopper * Math.max(1, Math.floor(Number(lots || 1)));
        const beforeCurrency = this.getActorCurrency(actor);
        const availableCopper = this.currencyToCopper(beforeCurrency);
        const sufficient = requiredCopper <= 0 || availableCopper >= requiredCopper;
        const afterCurrency = sufficient
            ? this.copperToCurrency(availableCopper - requiredCopper)
            : { ...beforeCurrency };

        return {
            cost,
            requiredCopper,
            availableCopper,
            beforeCurrency,
            afterCurrency,
            sufficient,
            consumed: false,
            status: requiredCopper <= 0
                ? "Nessun costo"
                : sufficient
                    ? "Disponibile"
                    : "Insufficiente"
        };

    }

    private async consumeCurrency(context: CraftingExecutionContext): Promise<void> {

        if (context.currency.cost.totalCopper <= 0 || context.currency.requiredCopper <= 0) {
            return;
        }

        if (!context.currency.sufficient) {
            return;
        }

        await context.actor.update({
            "system.currency": context.currency.afterCurrency
        });

        context.currency.consumed = true;
        context.currency.status = "Consumate";

    }

    private formatCurrencyBreakdown(currency: Record<string, number>): string {

        const parts = ["pp", "gp", "ep", "sp", "cp"]
            .filter(key => Number(currency[key] ?? 0) > 0)
            .map(key => `${Number(currency[key] ?? 0)} ${this.getCurrencyLabel(key)}`);

        return parts.length > 0 ? parts.join(", ") : "0 mo";

    }

    private getRecipeToolRequirement(recipe: ArtisanRecipeData): "required" | "optional" {

        return String((recipe as any).toolRequirement || "optional") === "required"
            ? "required"
            : "optional";

    }

    private getBlockingMissingMatches(context: CraftingExecutionContext): ActorInventoryMatch[] {

        const missingIngredients = context.ingredients.filter(match => !match.sufficient);

        const missingRequiredTools = this.getRecipeToolRequirement(context.validation.recipeData) === "required"
            ? context.tools.filter(match => !match.sufficient)
            : [];

        return [
            ...missingIngredients,
            ...missingRequiredTools
        ];

    }

    private async consumeIngredients(context: CraftingExecutionContext): Promise<void> {

        for (const match of context.ingredients) {
            if (!match.actorItem || !match.sufficient) {
                continue;
            }

            await this.setItemQuantity(
                match.actorItem,
                match.afterQuantity
            );
        }

    }

    private isRecipeToolCriticalDamageEnabled(recipe: ArtisanRecipeData): boolean {

        return Boolean((recipe as any).toolCriticalDamage ?? false);

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

    private async destroyTools(context: CraftingExecutionContext): Promise<void> {

        for (const match of context.tools) {
            if (!match.actorItem || !match.sufficient) {
                continue;
            }

            await this.setItemQuantity(
                match.actorItem,
                Math.max(
                    0,
                    match.beforeQuantity - match.requiredQuantity
                )
            );
        }

    }

    private async createOutputs(
        context: CraftingExecutionContext,
        outputMultiplier: number,
        quality: CraftingOutputQuality
    ): Promise<void> {

        for (const output of context.outputs) {
            const source = output.document as any;

            if (!source) {
                continue;
            }

            const quantity = Math.max(
                1,
                Number(output.quantity || 1)
            ) * context.lots * outputMultiplier;

            const existing = this.findMatchingActorOutputItem(
                context.actor,
                output,
                quality
            );

            if (existing) {
                await this.setItemQuantity(
                    existing,
                    this.getItemQuantity(existing) + quantity
                );
                continue;
            }

            const data = source.toObject ? source.toObject() : foundry.utils.deepClone(source);

            delete data._id;

            data.system = data.system ?? {};

            data.system.quantity = quantity;

            const qualityModification = this.getQualityModification(
                context.validation.recipeData,
                quality
            );

            const qualityModifiedPaths = this.applyQualityModificationToItemData(
                data,
                qualityModification
            );

            if (quality.key !== "normal") {
                data.name = `${data.name ?? output.name} (${quality.label})`;
            }

            data.flags = data.flags ?? {};

            data.flags.artisan = {
                ...(data.flags.artisan ?? {}),
                sourceUuid: output.uuid,
                craftingQuality: quality.key,
                craftingQualityLabel: quality.label,
                craftingQualityMargin: quality.margin,
                craftingQualityFormulaBonus: qualityModification.bonus,
                craftingQualityDice: qualityModification.dice,
                craftingQualityEffectType: qualityModification.effectType,
                craftingQualityFormulaPath: qualityModification.preferredPath,
                craftingQualityModifiedPaths: qualityModifiedPaths
            };

            await context.actor.createEmbeddedDocuments(
                "Item",
                [data]
            );
        }

    }

    private getQualityModification(
        recipe: ArtisanRecipeData,
        quality: CraftingOutputQuality
    ): CraftingQualityModification {

        let bonus = 0;
        let dice = "";
        let effectType = "auto";

        if (quality.key === "good") {
            bonus = Math.max(0, Math.floor(Number((recipe as any).qualityBonusGood ?? 0)));
            dice = this.normalizeQualityDice((recipe as any).qualityDiceGood ?? "");
            effectType = this.normalizeQualityEffectType((recipe as any).qualityEffectGood ?? "auto");
        } else if (quality.key === "superior") {
            bonus = Math.max(0, Math.floor(Number((recipe as any).qualityBonusSuperior ?? 0)));
            dice = this.normalizeQualityDice((recipe as any).qualityDiceSuperior ?? "");
            effectType = this.normalizeQualityEffectType((recipe as any).qualityEffectSuperior ?? "auto");
        } else if (quality.key === "excellent") {
            bonus = Math.max(0, Math.floor(Number((recipe as any).qualityBonusExcellent ?? 0)));
            dice = this.normalizeQualityDice((recipe as any).qualityDiceExcellent ?? "");
            effectType = this.normalizeQualityEffectType((recipe as any).qualityEffectExcellent ?? "auto");
        }

        return {
            bonus,
            dice,
            effectType,
            preferredPath: String((recipe as any).qualityFormulaPath ?? "").trim()
        };

    }

    private applyQualityModificationToItemData(
        data: any,
        modification: CraftingQualityModification
    ): string[] {

        if (!data || (!modification.bonus && !modification.dice)) {
            return [];
        }

        const appliedPaths: string[] = [];

        if (modification.preferredPath) {
            if (this.applyQualityEffectAtPath(data, modification.preferredPath, modification)) {
                appliedPaths.push(modification.preferredPath);
                return appliedPaths;
            }
        }

        appliedPaths.push(...this.applyAutomaticQualityEffect(data, modification));

        if (appliedPaths.length > 0) {
            this.applyQualityDamageType(data, modification, appliedPaths);
        }

        return appliedPaths;

    }

    private applyAutomaticQualityEffect(
        data: any,
        modification: CraftingQualityModification
    ): string[] {

        const appliedPaths: string[] = [];
        const effectType = modification.effectType;
        const wantsHealing = effectType === "healing";
        const wantsDamage = this.isDamageEffectType(effectType);
        const activities = data?.system?.activities;

        if (activities && typeof activities === "object") {
            for (const [activityId, activity] of Object.entries<any>(activities)) {
                const candidatePaths = wantsHealing
                    ? [
                        `system.activities.${activityId}.healing.bonus`,
                        `system.activities.${activityId}.healing.formula`
                    ]
                    : wantsDamage
                        ? [
                            `system.activities.${activityId}.damage.formula`,
                            `system.activities.${activityId}.damage.parts.0.0`
                        ]
                        : [
                            `system.activities.${activityId}.healing.bonus`,
                            `system.activities.${activityId}.healing.formula`,
                            `system.activities.${activityId}.damage.formula`,
                            `system.activities.${activityId}.damage.parts.0.0`
                        ];

                for (const path of candidatePaths) {
                    if (this.applyQualityEffectAtPath(data, path, modification)) {
                        appliedPaths.push(path);
                        return appliedPaths;
                    }
                }
            }
        }

        const fallbackPaths = wantsHealing
            ? [
                "system.healing.bonus",
                "system.healing.formula",
                "system.formula"
            ]
            : wantsDamage
                ? [
                    "system.damage.parts.0.0",
                    "system.damage.formula",
                    "system.formula"
                ]
                : [
                    "system.healing.bonus",
                    "system.healing.formula",
                    "system.damage.parts.0.0",
                    "system.damage.formula",
                    "system.formula"
                ];

        for (const path of fallbackPaths) {
            if (this.applyQualityEffectAtPath(data, path, modification)) {
                appliedPaths.push(path);
                break;
            }
        }

        return appliedPaths;

    }

    private applyQualityEffectAtPath(
        data: any,
        path: string,
        modification: CraftingQualityModification
    ): boolean {

        const current = foundry.utils.getProperty(data, path);

        if (typeof current === "number") {
            foundry.utils.setProperty(data, path, current + modification.bonus);
            return modification.bonus > 0;
        }

        if (typeof current === "string") {
            const trimmed = current.trim();

            if (!trimmed && !modification.dice) {
                return false;
            }

            let updated = trimmed;

            if (modification.dice) {
                updated = this.addDiceToFormula(updated, modification.dice);
            }

            if (modification.bonus > 0) {
                updated = this.addFlatBonusToFormula(updated, modification.bonus);
            }

            if (updated !== trimmed && updated.trim().length > 0) {
                foundry.utils.setProperty(data, path, updated);
                return true;
            }
        }

        return false;

    }

    private applyQualityDamageType(
        data: any,
        modification: CraftingQualityModification,
        appliedPaths: string[]
    ): void {

        if (!this.isDamageEffectType(modification.effectType)) {
            return;
        }

        for (const path of appliedPaths) {
            if (path.includes(".damage.parts.")) {
                const typePath = path.replace(/\.0$/, ".1");
                foundry.utils.setProperty(data, typePath, modification.effectType);
                continue;
            }

            const activityMatch = path.match(/^system\.activities\.([^\.]+)\.damage\./);

            if (activityMatch) {
                const activityId = activityMatch[1];
                const partsPath = `system.activities.${activityId}.damage.parts`;
                const parts = foundry.utils.getProperty(data, partsPath);

                if (Array.isArray(parts) && Array.isArray(parts[0])) {
                    parts[0][1] = modification.effectType;
                    foundry.utils.setProperty(data, partsPath, parts);
                }
            }
        }

    }

    private normalizeQualityDice(value: unknown): string {

        const raw = String(value ?? "").trim().toLowerCase();

        if (!raw) {
            return "";
        }

        const cleaned = raw.replace(/\s+/g, "");

        if (/^\d*d\d+(kh\d+|kl\d+|ro?<?\d+|mi\d+|ma\d+)?$/i.test(cleaned)) {
            return cleaned;
        }

        if (/^\d+d\d+$/i.test(cleaned)) {
            return cleaned;
        }

        return "";

    }

    private normalizeQualityEffectType(value: unknown): string {

        const raw = String(value ?? "auto").trim().toLowerCase();

        const allowed = new Set([
            "auto",
            "healing",
            "acid",
            "fire",
            "poison",
            "cold",
            "lightning",
            "thunder",
            "necrotic",
            "radiant",
            "psychic",
            "force",
            "bludgeoning",
            "piercing",
            "slashing"
        ]);

        return allowed.has(raw) ? raw : "auto";

    }

    private isDamageEffectType(value: string): boolean {

        return [
            "acid",
            "fire",
            "poison",
            "cold",
            "lightning",
            "thunder",
            "necrotic",
            "radiant",
            "psychic",
            "force",
            "bludgeoning",
            "piercing",
            "slashing"
        ].includes(value);

    }

    private addDiceToFormula(
        formula: string,
        dice: string
    ): string {

        const cleanDice = this.normalizeQualityDice(dice);

        if (!cleanDice) {
            return formula;
        }

        const cleaned = formula.trim();

        if (!cleaned) {
            return cleanDice;
        }

        return `${cleaned} + ${cleanDice}`;

    }

    private addFlatBonusToFormula(
        formula: string,
        bonus: number
    ): string {

        const cleaned = formula.trim();

        if (!cleaned) {
            return bonus > 0 ? String(bonus) : formula;
        }

        const terminalFlatBonus = cleaned.match(/^(.*?)([+\-])\s*(\d+)\s*$/);

        if (terminalFlatBonus) {
            const prefix = terminalFlatBonus[1].trimEnd();
            const sign = terminalFlatBonus[2];
            const value = Number(terminalFlatBonus[3]);
            const signedValue = sign === "-" ? -value : value;
            const nextValue = signedValue + bonus;

            if (nextValue === 0) {
                return prefix.trim();
            }

            return `${prefix} ${nextValue >= 0 ? "+" : "-"} ${Math.abs(nextValue)}`;
        }

        if (/\d*d\d+/i.test(cleaned) || /^\d+$/.test(cleaned)) {
            return `${cleaned} + ${bonus}`;
        }

        return formula;

    }

    private async rollSkillCheck(
        actor: Actor,
        recipe: ArtisanRecipeData,
        tools: ActorInventoryMatch[] = []
    ): Promise<CraftingRollResult> {

        const skillModifier = this.getActorSkillModifier(
            actor,
            recipe.skill
        );

        const toolProficiency = this.getCraftingToolProficiencyBonus(
            actor,
            tools
        );

        const toolProficiencyBonus = toolProficiency.totalBonus;

        const modifier = skillModifier + toolProficiencyBonus;

        const formula = modifier === 0
            ? "1d20"
            : `1d20 ${modifier >= 0 ? "+" : "-"} ${Math.abs(modifier)}`;

        const roll = await new Roll(formula).evaluate();

        const firstDie = (roll as any).dice?.[0];

        const natural = Number(firstDie?.results?.[0]?.result ?? roll.total ?? 0);

        const total = Number(roll.total ?? 0);

        const dc = Number(recipe.dc ?? 10);

        const criticalSuccess = natural === 20;

        const criticalFailure = natural === 1;

        const success = criticalSuccess || (!criticalFailure && total >= dc);

        let outcomeLabel = "Fallimento";

        if (criticalSuccess) {
            outcomeLabel = "Successo critico";
        } else if (criticalFailure) {
            outcomeLabel = "Fallimento critico";
        } else if (success) {
            outcomeLabel = "Successo";
        }

        return {
            natural,
            modifier,
            skillModifier,
            toolProficiencyBonus,
            toolProficiencyDetails: toolProficiency.details,
            total,
            formula,
            dc,
            success,
            criticalSuccess,
            criticalFailure,
            outcomeLabel
        };

    }

    private getCraftingOutputQuality(roll: CraftingRollResult): CraftingOutputQuality {

        if (!roll.success) {
            return {
                key: "none",
                label: "Nessuna",
                margin: roll.total - roll.dc,
                description: "Nessun output creato."
            };
        }

        const margin = Math.max(
            0,
            Number(roll.total ?? 0) - Number(roll.dc ?? 0)
        );

        if (roll.criticalSuccess) {
            return {
                key: "excellent",
                label: "Eccellente",
                margin,
                description: "20 naturale: qualità eccellente."
            };
        }

        if (margin >= 10) {
            return {
                key: "superior",
                label: "Superiore",
                margin,
                description: "Margine 10 o superiore."
            };
        }

        if (margin >= 5) {
            return {
                key: "good",
                label: "Buona",
                margin,
                description: "Margine 5 o superiore."
            };
        }

        return {
            key: "normal",
            label: "Normale",
            margin,
            description: "Successo normale."
        };

    }

    private getCraftingToolProficiencyBonus(
        actor: Actor,
        tools: ActorInventoryMatch[]
    ): CraftingToolProficiencyResult {

        const proficiencyBonus = this.getActorProficiencyBonus(actor);

        let totalBonus = 0;

        const details: CraftingToolProficiencyDetail[] = [];

        for (const tool of tools) {
            const actorItem = tool.actorItem as any;
            const sourceItem = tool.recipeEntry.document as any;

            const possessed = !!actorItem && tool.sufficient;

            const proficient = possessed
                ? this.actorIsProficientWithTool(
                    actor,
                    actorItem,
                    sourceItem
                )
                : false;

            const bonus = possessed && proficient
                ? Math.max(0, proficiencyBonus)
                : 0;

            const applied = bonus > 0;

            if (applied) {
                totalBonus += bonus;
            }

            details.push({
                name: tool.recipeEntry.name,
                possessed,
                proficient,
                bonus,
                applied
            });
        }

        return {
            totalBonus,
            details
        };

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

        const identifierCandidates = this.getToolIdentifierCandidates(
            actorItem,
            sourceItem
        );

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

    private getActorSkillModifier(
        actor: Actor,
        skill: string
    ): number {

        const key = this.normalizeSkillKey(skill);

        if (!key) {
            return 0;
        }

        const system = (actor as any).system ?? {};

        const skills = system.skills ?? {};

        const direct = skills[key];

        if (direct) {
            return Number(
                direct.total
                ?? direct.mod
                ?? direct.value
                ?? 0
            );
        }

        return 0;

    }

    private normalizeSkillKey(skill: string): string {

        const clean = String(skill ?? "").trim().toLowerCase();

        const map: Record<string, string> = {
            survival: "sur",
            sopravvivenza: "sur",
            sur: "sur",
            arcana: "arc",
            arc: "arc",
            nature: "nat",
            natura: "nat",
            nat: "nat",
            athletics: "ath",
            atletica: "ath",
            ath: "ath",
            stealth: "ste",
            furtività: "ste",
            furtivita: "ste",
            ste: "ste",
            perception: "prc",
            percezione: "prc",
            prc: "prc",
            investigation: "inv",
            investigare: "inv",
            inv: "inv",
            history: "his",
            storia: "his",
            his: "his",
            medicine: "med",
            medicina: "med",
            med: "med",
            religion: "rel",
            religione: "rel",
            rel: "rel",
            acrobatics: "acr",
            acrobazia: "acr",
            acr: "acr",
            persuasion: "per",
            persuasione: "per",
            per: "per",
            deception: "dec",
            inganno: "dec",
            dec: "dec",
            intimidation: "itm",
            intimidire: "itm",
            itm: "itm",
            performance: "prf",
            intrattenere: "prf",
            prf: "prf",
            insight: "ins",
            intuizione: "ins",
            ins: "ins",
            animal: "ani",
            animalhandling: "ani",
            addestrareanimali: "ani",
            ani: "ani",
            sleightofhand: "slt",
            rapiditadimano: "slt",
            slt: "slt"
        };

        return map[clean] ?? clean;

    }

    private async askLots(maxLots: number): Promise<number | null> {

        const safeMax = Math.max(1, Number(maxLots || 1));

        const content = `
            <form>
                <p><strong>Massimo disponibile:</strong> ${safeMax}</p>
                <div class="form-group">
                    <label>Lotti da craftare</label>
                    <input type="number" name="lots" value="1" min="1" max="${safeMax}" step="1">
                </div>
            </form>
        `;

        return this.promptNumberDialog(
            "Quanti lotti vuoi craftare?",
            content,
            "lots",
            1,
            safeMax
        );

    }

    private async promptNumberDialog(
        title: string,
        content: string,
        fieldName: string,
        min: number,
        max: number
    ): Promise<number | null> {

        return new Promise(resolve => {
            new Dialog({
                title,
                content,
                buttons: {
                    confirm: {
                        label: "Continua",
                        callback: html => {
                            const raw = html.find(`[name="${fieldName}"]`).val();
                            const value = Math.max(
                                min,
                                Math.min(
                                    max,
                                    Number(raw || min)
                                )
                            );
                            resolve(value);
                        }
                    },
                    cancel: {
                        label: "Annulla",
                        callback: () => resolve(null)
                    }
                },
                default: "confirm",
                close: () => resolve(null)
            }).render(true);
        });

    }

    private async confirmCrafting(context: CraftingExecutionContext): Promise<boolean> {

        const content = `
            <div class="artisan-confirm-dialog">
                <p><strong>Ricetta:</strong> ${this.escapeHtml(context.validation.recipeName)}</p>
                <p><strong>Attore:</strong> ${this.escapeHtml(context.actor.name ?? "Attore")}</p>
                <p><strong>Lotti:</strong> ${context.lots} / ${context.maxLots}</p>
                <p><strong>Professione richiesta:</strong> ${this.escapeHtml(context.professionRequirement.professionLabel)} livello ${context.professionRequirement.requiredLevel}</p>
                <p><strong>Professione PG:</strong> livello ${context.professionRequirement.actorLevel}, XP ${context.professionRequirement.actorXp}</p>
                <p><strong>Abilità:</strong> ${this.escapeHtml(context.validation.recipeData.skill || "Non impostata")}</p>
                <p><strong>CD:</strong> ${context.validation.recipeData.dc}</p>
                ${this.buildInventoryConfirmSection("Ingredienti da consumare", context.ingredients)}
                ${this.buildInventoryConfirmSection("Strumenti richiesti", context.tools)}
                ${this.buildToolProficiencyConfirmSection(context.actor, context.tools)}
                ${this.buildCurrencyConfirmSection(context.currency)}
                ${this.buildOutputConfirmSection(context.outputs, context.lots)}
            </div>
        `;

        return new Promise(resolve => {
            new Dialog({
                title: "Conferma crafting",
                content,
                buttons: {
                    confirm: {
                        label: "Esegui Crafting",
                        callback: () => resolve(true)
                    },
                    cancel: {
                        label: "Annulla",
                        callback: () => resolve(false)
                    }
                },
                default: "confirm",
                close: () => resolve(false)
            }).render(true);
        });

    }

    private buildInventoryConfirmSection(
        title: string,
        matches: ActorInventoryMatch[]
    ): string {

        if (matches.length === 0) {
            return `<h4>${this.escapeHtml(title)}</h4><p><em>Nessuno.</em></p>`;
        }

        const rows = matches.map(match => {
            const icon = match.sufficient ? "✅" : "❌";
            return `
                <tr>
                    <td>${icon}</td>
                    <td>${this.escapeHtml(match.recipeEntry.name)}</td>
                    <td>${match.requiredQuantity}</td>
                    <td>${match.availableQuantity}</td>
                </tr>
            `;
        }).join("");

        return `
            <h4>${this.escapeHtml(title)}</h4>
            <table>
                <thead>
                    <tr>
                        <th></th>
                        <th>Oggetto</th>
                        <th>Richiesto</th>
                        <th>Disponibile</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;

    }

    private buildToolProficiencyConfirmSection(
        actor: Actor,
        tools: ActorInventoryMatch[]
    ): string {

        if (tools.length === 0) {
            return "";
        }

        const result = this.getCraftingToolProficiencyBonus(
            actor,
            tools
        );

        const rows = result.details.map(detail => {
            const icon = detail.applied ? "✅" : "➖";
            const status = detail.applied
                ? `Bonus +${detail.bonus}`
                : detail.possessed
                    ? detail.proficient
                        ? "Bonus non disponibile"
                        : "Posseduto, non competente"
                    : "Non posseduto";

            return `
                <tr>
                    <td>${icon}</td>
                    <td>${this.escapeHtml(detail.name)}</td>
                    <td>${detail.possessed ? "Sì" : "No"}</td>
                    <td>${detail.proficient ? "Sì" : "No"}</td>
                    <td>${this.escapeHtml(status)}</td>
                </tr>
            `;
        }).join("");

        return `
            <h4>Bonus strumenti competenti</h4>
            <p><strong>Bonus totale al tiro:</strong> +${result.totalBonus}</p>
            <table>
                <thead>
                    <tr>
                        <th></th>
                        <th>Strumento</th>
                        <th>Posseduto</th>
                        <th>Competente</th>
                        <th>Bonus</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;

    }


    private buildCurrencyConfirmSection(currency: CraftingCurrencyMatch): string {

        if (currency.cost.totalCopper <= 0 || currency.requiredCopper <= 0) {
            return `
                <h4>Costo monetario</h4>
                <p><em>Nessun costo in monete.</em></p>
            `;
        }

        return `
            <h4>Costo monetario</h4>
            <table>
                <thead>
                    <tr>
                        <th>Costo per lotto</th>
                        <th>Totale richiesto</th>
                        <th>Disponibile</th>
                        <th>Fallimento</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${this.escapeHtml(currency.cost.label)}</td>
                        <td>${this.escapeHtml(this.formatCurrencyAmount(currency.requiredCopper / 100, "gp"))}</td>
                        <td>${this.escapeHtml(this.formatCurrencyBreakdown(currency.beforeCurrency))}</td>
                        <td>${currency.cost.consumeOnFailure ? "Costo perso" : "Costo conservato"}</td>
                    </tr>
                </tbody>
            </table>
        `;

    }

    private buildOutputConfirmSection(
        outputs: CraftingValidationEntry[],
        lots: number
    ): string {

        if (outputs.length === 0) {
            return `<h4>Output previsto</h4><p><em>Nessun output.</em></p>`;
        }

        const rows = outputs.map(output => {
            return `
                <tr>
                    <td>${this.escapeHtml(output.name)}</td>
                    <td>${Math.max(1, Number(output.quantity || 1)) * lots}</td>
                </tr>
            `;
        }).join("");

        return `
            <h4>Output previsto</h4>
            <table>
                <thead>
                    <tr>
                        <th>Oggetto</th>
                        <th>Quantità</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;

    }

    private async sendCraftingProfessionBlockedToChat(
        actor: Actor,
        recipeItem: Item,
        validation: CraftingValidationResult,
        requirement: CraftingProfessionRequirement
    ): Promise<void> {

        const content = `
            <div class="artisan-chat-card">
                <h2>⛔ Requisito professione non soddisfatto</h2>
                <p>
                    <strong>${this.escapeHtml(recipeItem.name ?? "Ricetta")}</strong><br>
                    Attore: ${this.escapeHtml(actor.name ?? "Attore")}
                </p>
                <table>
                    <tbody>
                        <tr><td><strong>Professione richiesta</strong></td><td>${this.escapeHtml(requirement.professionLabel)}</td></tr>
                        <tr><td><strong>Livello richiesto</strong></td><td>${requirement.requiredLevel}</td></tr>
                        <tr><td><strong>Livello PG</strong></td><td>${requirement.actorLevel}</td></tr>
                        <tr><td><strong>XP PG</strong></td><td>${requirement.actorXp}</td></tr>
                        <tr><td><strong>Sorgente</strong></td><td>${this.escapeHtml(requirement.source)}</td></tr>
                    </tbody>
                </table>
                ${this.buildMessagesHtml("Errori ricetta", validation.errors)}
                ${this.buildMessagesHtml("Avvisi ricetta", validation.warnings)}
                <p><strong>La ricetta richiede un livello professione più alto.</strong></p>
            </div>
        `;

        await ChatMessage.create({
            content,
            speaker: ChatMessage.getSpeaker({ actor })
        });

    }

    private async sendCraftingRecipeCopyBlockedToChat(
        actor: Actor,
        recipeItem: Item,
        validation: CraftingValidationResult
    ): Promise<void> {

        const content = `
            <div class="artisan-chat-card">
                <h2>📖 Ricetta non posseduta</h2>
                <p>
                    <strong>${this.escapeHtml(recipeItem.name ?? "Ricetta")}</strong><br>
                    Attore: ${this.escapeHtml(actor.name ?? "Attore")}
                </p>
                ${this.buildMessagesHtml("Avvisi ricetta", validation.warnings)}
                <p><strong>Il PG deve avere una copia della ricetta nel proprio inventario per poterla usare.</strong></p>
                <p>Trascina o importa la ricetta nell'inventario del PG, poi riprova il crafting.</p>
            </div>
        `;

        await ChatMessage.create({
            content,
            speaker: ChatMessage.getSpeaker({ actor })
        });

    }

    private async sendCraftingBlockedToChat(
        actor: Actor,
        recipeItem: Item,
        validation: CraftingValidationResult,
        missing: ActorInventoryMatch[],
        currency?: CraftingCurrencyMatch
    ): Promise<void> {

        const missingHtml = missing.length > 0
            ? this.buildInventoryResultSection(
                "Risorse mancanti",
                missing,
                "❌",
                "Insufficienti"
            )
            : "";

        const currencyHtml = currency && currency.cost.totalCopper > 0
            ? this.buildCurrencyResultSection(currency, "💰", currency.sufficient ? "Disponibile" : "Insufficiente")
            : "";

        const content = `
            <div class="artisan-chat-card">
                <h2>❌ Crafting bloccato</h2>
                <p>
                    <strong>${this.escapeHtml(recipeItem.name ?? "Ricetta")}</strong><br>
                    Attore: ${this.escapeHtml(actor.name ?? "Attore")}
                </p>
                ${this.buildMessagesHtml("Errori", validation.errors)}
                ${this.buildMessagesHtml("Avvisi", validation.warnings)}
                ${missingHtml}
                ${currencyHtml}
            </div>
        `;

        await ChatMessage.create({
            content,
            speaker: ChatMessage.getSpeaker({ actor })
        });

    }

    private async awardCraftingProfessionXp(
        context: CraftingExecutionContext,
        roll: CraftingRollResult
    ): Promise<CraftingProfessionXpResult> {

        const professionService = new ProfessionService();

        const professionId = context.professionRequirement.professionId;

        const beforeXp = context.professionRequirement.actorXp;

        const gained = this.calculateCraftingXp(context, roll);

        if (gained <= 0) {
            return {
                gained: 0,
                beforeXp,
                afterXp: beforeXp,
                beforeLevel: context.professionRequirement.actorLevel,
                afterLevel: context.professionRequirement.actorLevel,
                xpToNextLevel: professionService.getActorProfession(context.actor, professionId).xpToNextLevel,
                xpForNextLevel: professionService.getActorProfession(context.actor, professionId).xpForNextLevel,
                progressPercent: professionService.getActorProfession(context.actor, professionId).progressPercent
            };
        }

        const updated = await professionService.addActorProfessionXp(
            context.actor,
            professionId,
            gained
        );

        return {
            gained,
            beforeXp,
            afterXp: updated.xp,
            beforeLevel: context.professionRequirement.actorLevel,
            afterLevel: updated.level,
            xpToNextLevel: updated.xpToNextLevel,
            xpForNextLevel: updated.xpForNextLevel,
            progressPercent: updated.progressPercent
        };

    }

    private calculateCraftingXp(
        context: CraftingExecutionContext,
        roll: CraftingRollResult
    ): number {

        const lotMultiplier = Math.max(1, Math.floor(Number(context.lots ?? 1)));

        const recipeCraftingXp = Math.max(
            0,
            Math.floor(Number((context.validation.recipeData as any).craftingXp ?? 0))
        );

        const baseXpPerLot = recipeCraftingXp > 0
            ? recipeCraftingXp
            : Math.max(
                1,
                Math.floor(Number(context.professionRequirement.requiredLevel ?? 0)) + 1
            );

        const baseXp = baseXpPerLot * lotMultiplier;

        return roll.criticalSuccess
            ? baseXp * 2
            : baseXp;

    }

    private async sendCraftingResultToChat(
        context: CraftingExecutionContext,
        roll: CraftingRollResult,
        professionXp: CraftingProfessionXpResult,
        outputQuality: CraftingOutputQuality
    ): Promise<void> {

        const outputIcon = roll.success ? "✅" : "➖";

        const outputStatus = roll.success
            ? roll.criticalSuccess
                ? "Creato, quantità raddoppiata"
                : "Creato"
            : "Non creato";

        const content = `
            <div class="artisan-chat-card">
                <h2>${this.getOutcomeIcon(roll)} ${this.escapeHtml(roll.outcomeLabel)}</h2>
                <p>
                    <strong>${this.escapeHtml(context.validation.recipeName)}</strong><br>
                    Attore: ${this.escapeHtml(context.actor.name ?? "Attore")}<br>
                    Lotti: ${context.lots}<br>
                    Professione richiesta: ${this.escapeHtml(context.professionRequirement.professionLabel)} livello ${context.professionRequirement.requiredLevel}<br>
                    Professione PG: livello ${professionXp.beforeLevel} → ${professionXp.afterLevel}${professionXp.afterLevel > professionXp.beforeLevel ? " ⭐ Avanzamento" : ""}<br>
                    XP professione: ${professionXp.beforeXp} → ${professionXp.afterXp}<br>
                    XP professione guadagnata: +${professionXp.gained}<br>
                    XP ricetta per lotto: ${Math.max(0, Math.floor(Number((context.validation.recipeData as any).craftingXp ?? 0))) || "automatici"}<br>
                    Prossimo livello: ${professionXp.xpForNextLevel === null ? "Livello massimo" : `${professionXp.xpToNextLevel} XP mancanti (${professionXp.progressPercent}%)`}
                </p>
                <table>
                    <tbody>
                        <tr><td><strong>Formula</strong></td><td>${this.escapeHtml(roll.formula)}</td></tr>
                        <tr><td><strong>Tiro naturale</strong></td><td>${roll.natural}</td></tr>
                        <tr><td><strong>Modificatore abilità</strong></td><td>${roll.skillModifier >= 0 ? "+" : ""}${roll.skillModifier}</td></tr>
                        <tr><td><strong>Bonus strumenti competenti</strong></td><td>+${roll.toolProficiencyBonus}</td></tr>
                        <tr><td><strong>Modificatore totale</strong></td><td>${roll.modifier >= 0 ? "+" : ""}${roll.modifier}</td></tr>
                        <tr><td><strong>Totale</strong></td><td>${roll.total}</td></tr>
                        <tr><td><strong>CD</strong></td><td>${roll.dc}</td></tr>
                        <tr><td><strong>Margine</strong></td><td>${roll.success ? outputQuality.margin : "—"}</td></tr>
                        <tr><td><strong>Qualità output</strong></td><td>${roll.success ? `${this.escapeHtml(outputQuality.label)} — ${this.escapeHtml(outputQuality.description)}` : "Nessuna"}</td></tr>
                        <tr><td><strong>Bonus qualità formula</strong></td><td>${roll.success ? this.getQualityModification(context.validation.recipeData, outputQuality).bonus > 0 ? `+${this.getQualityModification(context.validation.recipeData, outputQuality).bonus}${this.getQualityModification(context.validation.recipeData, outputQuality).preferredPath ? ` su ${this.escapeHtml(this.getQualityModification(context.validation.recipeData, outputQuality).preferredPath)}` : " automatico"}` : "Nessuno" : "Nessuno"}</td></tr>
                    </tbody>
                </table>
                ${this.buildToolProficiencyResultSection(roll.toolProficiencyDetails)}
                ${this.buildInventoryResultSection("Ingredienti", context.ingredients, "🔥", "Consumati")}
                ${this.buildCurrencyResultSection(
                    context.currency,
                    "💰",
                    context.currency.consumed
                        ? "Consumate"
                        : context.currency.cost.totalCopper > 0
                            ? "Non consumate"
                            : "Nessun costo"
                )}
                ${this.buildInventoryResultSection(
                    "Strumenti",
                    context.tools,
                    roll.criticalFailure ? "💥" : "🛠️",
                    roll.criticalFailure
                        ? this.isRecipeToolCriticalDamageEnabled(context.validation.recipeData)
                            ? "Distrutti"
                            : "Protetti: danno disattivato"
                        : "Non consumati"
                )}
                ${this.buildOutputResultSection(context.outputs, context.lots, roll.success ? (roll.criticalSuccess ? 2 : 1) : 0, outputIcon, outputStatus, outputQuality)}
            </div>
        `;

        await ChatMessage.create({
            content,
            speaker: ChatMessage.getSpeaker({ actor: context.actor })
        });

    }

    private getOutcomeIcon(roll: CraftingRollResult): string {

        if (roll.criticalSuccess) {
            return "🌟";
        }

        if (roll.criticalFailure) {
            return "💥";
        }

        return roll.success ? "✅" : "❌";

    }

    private buildToolProficiencyResultSection(
        details: CraftingToolProficiencyDetail[]
    ): string {

        if (details.length === 0) {
            return "";
        }

        const rows = details.map(detail => {
            const icon = detail.applied ? "✅" : "➖";
            const status = detail.applied
                ? `Applicato +${detail.bonus}`
                : detail.possessed
                    ? detail.proficient
                        ? "Nessun bonus"
                        : "Non competente"
                    : "Non posseduto";

            return `
                <tr>
                    <td>${icon}</td>
                    <td>${this.escapeHtml(detail.name)}</td>
                    <td>${detail.possessed ? "Sì" : "No"}</td>
                    <td>${detail.proficient ? "Sì" : "No"}</td>
                    <td>${this.escapeHtml(status)}</td>
                </tr>
            `;
        }).join("");

        return `
            <h4>Bonus strumenti alla prova</h4>
            <table>
                <thead>
                    <tr>
                        <th></th>
                        <th>Strumento</th>
                        <th>Posseduto</th>
                        <th>Competente</th>
                        <th>Stato</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;

    }


    private buildCurrencyResultSection(
        currency: CraftingCurrencyMatch,
        icon: string,
        status: string
    ): string {

        if (currency.cost.totalCopper <= 0 || currency.requiredCopper <= 0) {
            return `<h4>Costo monetario</h4><p><em>Nessun costo in monete.</em></p>`;
        }

        return `
            <h4>Costo monetario</h4>
            <table>
                <thead>
                    <tr>
                        <th></th>
                        <th>Costo per lotto</th>
                        <th>Totale richiesto</th>
                        <th>Prima</th>
                        <th>Dopo</th>
                        <th>Stato</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>${icon}</td>
                        <td>${this.escapeHtml(currency.cost.label)}</td>
                        <td>${this.escapeHtml(this.formatCurrencyAmount(currency.requiredCopper / 100, "gp"))}</td>
                        <td>${this.escapeHtml(this.formatCurrencyBreakdown(currency.beforeCurrency))}</td>
                        <td>${currency.consumed ? this.escapeHtml(this.formatCurrencyBreakdown(currency.afterCurrency)) : "—"}</td>
                        <td>${this.escapeHtml(status)}</td>
                    </tr>
                </tbody>
            </table>
        `;

    }

    private buildInventoryResultSection(
        title: string,
        matches: ActorInventoryMatch[],
        icon: string,
        status: string
    ): string {

        if (matches.length === 0) {
            return `<h4>${this.escapeHtml(title)}</h4><p><em>Nessuno.</em></p>`;
        }

        const rows = matches.map(match => {
            return `
                <tr>
                    <td>${icon}</td>
                    <td>${this.escapeHtml(match.recipeEntry.name)}</td>
                    <td>${match.requiredQuantity}</td>
                    <td>${match.beforeQuantity}</td>
                    <td>${match.afterQuantity}</td>
                    <td>${this.escapeHtml(status)}</td>
                </tr>
            `;
        }).join("");

        return `
            <h4>${this.escapeHtml(title)}</h4>
            <table>
                <thead>
                    <tr>
                        <th></th>
                        <th>Oggetto</th>
                        <th>Richiesto</th>
                        <th>Prima</th>
                        <th>Dopo</th>
                        <th>Stato</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;

    }

    private buildOutputResultSection(
        outputs: CraftingValidationEntry[],
        lots: number,
        multiplier: number,
        icon: string,
        status: string,
        quality: CraftingOutputQuality
    ): string {

        if (outputs.length === 0) {
            return `<h4>Output</h4><p><em>Nessun output.</em></p>`;
        }

        const rows = outputs.map(output => {
            const quantity = multiplier > 0
                ? Math.max(1, Number(output.quantity || 1)) * lots * multiplier
                : 0;

            return `
                <tr>
                    <td>${icon}</td>
                    <td>${this.escapeHtml(output.name)}</td>
                    <td>${quantity}</td>
                    <td>${multiplier > 0 ? this.escapeHtml(quality.label) : "—"}</td>
                    <td>${this.escapeHtml(status)}</td>
                </tr>
            `;
        }).join("");

        return `
            <h4>Output</h4>
            <table>
                <thead>
                    <tr>
                        <th></th>
                        <th>Oggetto</th>
                        <th>Quantità</th>
                        <th>Qualità</th>
                        <th>Stato</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;

    }

    private async sendValidationResultToChat(result: CraftingValidationResult): Promise<void> {

        const status = result.valid ? "✅ Ricetta valida" : "❌ Ricetta non valida";

        const rows = result.entries.length > 0
            ? result.entries.map(entry => {
                const icon = entry.found && entry.isItem ? "✅" : "❌";
                return `
                    <tr>
                        <td>${icon}</td>
                        <td>${this.escapeHtml(entry.collectionLabel)}</td>
                        <td>${this.escapeHtml(entry.name)}</td>
                        <td>${entry.quantity}</td>
                        <td><code>${this.escapeHtml(entry.uuid)}</code></td>
                        <td>${this.escapeHtml(entry.message)}</td>
                    </tr>
                `;
            }).join("")
            : `<tr><td colspan="6"><em>Nessun componente inserito.</em></td></tr>`;

        const content = `
            <div class="artisan-chat-card">
                <h2>${status}</h2>
                <p><strong>${this.escapeHtml(result.recipeName)}</strong><br><code>${this.escapeHtml(result.recipeUuid)}</code></p>
                ${this.buildMessagesHtml("Errori", result.errors)}
                ${this.buildMessagesHtml("Avvisi", result.warnings)}
                <h4>Componenti</h4>
                <table>
                    <thead>
                        <tr><th></th><th>Sezione</th><th>Nome</th><th>Q.tà</th><th>UUID</th><th>Stato</th></tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;

        await ChatMessage.create({
            content,
            speaker: ChatMessage.getSpeaker()
        });

    }

    private async sendCraftingPreviewToChat(result: CraftingValidationResult): Promise<void> {

        const status = result.valid ? "🧪 Anteprima Crafting" : "⚠️ Anteprima Crafting con problemi";

        const recipe = result.recipeData;

        const content = `
            <div class="artisan-chat-card">
                <h2>${status}</h2>
                <p><strong>${this.escapeHtml(result.recipeName)}</strong><br><code>${this.escapeHtml(result.recipeUuid)}</code></p>
                <table>
                    <tbody>
                        <tr><td><strong>Categoria</strong></td><td>${this.escapeHtml(recipe.category || "Non impostata")}</td></tr>
                        <tr><td><strong>Profilo / Professione</strong></td><td>${this.escapeHtml(new ProfessionService().getLabel(recipe.profile || ""))}</td></tr>
                        <tr><td><strong>Livello professione richiesto</strong></td><td>${new ProfessionService().normalizeLevel((recipe as any).professionLevel ?? 0)}</td></tr>
                        <tr><td><strong>Abilità</strong></td><td>${this.escapeHtml(recipe.skill || "Non impostata")}</td></tr>
                        <tr><td><strong>CD</strong></td><td>${recipe.dc}</td></tr>
                        <tr><td><strong>Tempo</strong></td><td>${recipe.craftingTime} minuti</td></tr>
                        <tr><td><strong>XP crafting</strong></td><td>${Math.max(0, Math.floor(Number((recipe as any).craftingXp ?? 0))) || "Automatici"}</td></tr>
                        <tr><td><strong>Costo monetario</strong></td><td>${this.getRecipeCurrencyCost(recipe).totalCopper > 0 ? this.escapeHtml(this.getRecipeCurrencyCost(recipe).label) : "Nessuno"}</td></tr>
                        <tr><td><strong>Costo su fallimento</strong></td><td>${this.shouldConsumeCurrencyOnFailure(recipe) ? "Consumare" : "Non consumare"}</td></tr>
                        <tr><td><strong>Strumenti</strong></td><td>${this.getRecipeToolRequirement(recipe) === "required" ? "Obbligatori" : "Opzionali / solo bonus se competente"}</td></tr>
                    </tbody>
                </table>
                ${this.buildMessagesHtml("Errori", result.errors)}
                ${this.buildMessagesHtml("Avvisi", result.warnings)}
                ${this.buildPreviewSection("Ingredienti richiesti", result.entries.filter(entry => entry.collection === "ingredients"), "Nessun ingrediente richiesto.")}
                ${this.buildPreviewSection("Strumenti richiesti", result.entries.filter(entry => entry.collection === "tools"), "Nessuno strumento richiesto.")}
                ${this.buildPreviewSection("Output prodotto", result.entries.filter(entry => entry.collection === "outputs"), "Nessun output impostato.")}
                <p><em>Questa è solo un’anteprima: nessun oggetto è stato consumato o creato.</em></p>
            </div>
        `;

        await ChatMessage.create({
            content,
            speaker: ChatMessage.getSpeaker()
        });

    }

    private buildPreviewSection(
        title: string,
        entries: CraftingValidationEntry[],
        emptyMessage: string
    ): string {

        if (entries.length === 0) {
            return `<h4>${this.escapeHtml(title)}</h4><p><em>${this.escapeHtml(emptyMessage)}</em></p>`;
        }

        const rows = entries.map(entry => {
            const icon = entry.found && entry.isItem ? "✅" : "❌";
            return `
                <tr>
                    <td>${icon}</td>
                    <td>${this.escapeHtml(entry.name)}</td>
                    <td>${entry.quantity}</td>
                    <td>${this.escapeHtml(entry.message)}</td>
                </tr>
            `;
        }).join("");

        return `
            <h4>${this.escapeHtml(title)}</h4>
            <table>
                <thead><tr><th></th><th>Oggetto</th><th>Q.tà</th><th>Stato</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        `;

    }

    private buildMessagesHtml(
        title: string,
        messages: string[]
    ): string {

        if (messages.length === 0) {
            return "";
        }

        return `
            <h4>${this.escapeHtml(title)}</h4>
            <ul>${messages.map(message => `<li>${this.escapeHtml(message)}</li>`).join("")}</ul>
        `;

    }

    private getCollectionLabel(collection: RecipeComponentCollection): string {

        switch (collection) {
            case "ingredients":
                return "Ingredienti";
            case "tools":
                return "Strumenti";
            case "outputs":
                return "Output";
            default:
                return collection;
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
