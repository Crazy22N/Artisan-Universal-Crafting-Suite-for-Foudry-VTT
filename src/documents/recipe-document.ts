export type RecipeComponentCollection = "ingredients" | "tools" | "outputs";

export interface ArtisanRecipeComponent {
    uuid: string;
    quantity: number;
}

export interface ArtisanRecipeComponentView extends ArtisanRecipeComponent {
    index: number;
    recipeId: string;
    collection: RecipeComponentCollection;
    name: string;
    img: string;
    documentType: string;
    found: boolean;
}

export interface ArtisanRecipeData {
    category: string;
    profile: string;
    difficulty: number;
    craftingTime: number;
    craftingXp: number;
    currencyCost: number;
    currencyDenomination: string;
    consumeCurrencyOnFailure: boolean;
    toolRequirement: string;
    toolCriticalDamage: boolean;
    qualityFormulaPath: string;
    qualityBonusGood: number;
    qualityBonusSuperior: number;
    qualityBonusExcellent: number;
    qualityDiceGood: string;
    qualityDiceSuperior: string;
    qualityDiceExcellent: string;
    qualityEffectGood: string;
    qualityEffectSuperior: string;
    qualityEffectExcellent: string;
    skill: string;
    dc: number;
    ingredients: ArtisanRecipeComponent[];
    tools: ArtisanRecipeComponent[];
    outputs: ArtisanRecipeComponent[];
}

export interface ArtisanRecipeFlags {
    type: "recipe";
    version: number;
    recipe: ArtisanRecipeData;
}

export class RecipeDocument {

    public static readonly FLAG_SCOPE = "artisan";

    public static readonly FLAG_TYPE = "type";

    public static readonly FLAG_RECIPE = "recipe";

    public static readonly TYPE = "recipe";

    public static isRecipe(item: Item): boolean {

        return item.getFlag(this.FLAG_SCOPE, this.FLAG_TYPE) === this.TYPE;

    }

    public static getDefaultData(): ArtisanRecipeData {

        return {
            category: "",
            profile: "",
            difficulty: 0,
            craftingTime: 0,
            craftingXp: 0,
            currencyCost: 0,
            currencyDenomination: "gp",
            consumeCurrencyOnFailure: false,
            toolRequirement: "optional",
            toolCriticalDamage: false,
            qualityFormulaPath: "",
            qualityBonusGood: 0,
            qualityBonusSuperior: 0,
            qualityBonusExcellent: 0,
            qualityDiceGood: "",
            qualityDiceSuperior: "",
            qualityDiceExcellent: "",
            qualityEffectGood: "auto",
            qualityEffectSuperior: "auto",
            qualityEffectExcellent: "auto",
            skill: "",
            dc: 10,
            ingredients: [],
            tools: [],
            outputs: []
        };

    }

    public static getData(item: Item): ArtisanRecipeData {

        const data = item.getFlag(
            this.FLAG_SCOPE,
            this.FLAG_RECIPE
        ) as Partial<ArtisanRecipeData> | undefined;

        const merged = {
            ...this.getDefaultData(),
            ...(data ?? {})
        };

        return {
            category: String(merged.category ?? ""),
            profile: String(merged.profile ?? ""),
            difficulty: Number(merged.difficulty ?? 0),
            craftingTime: Math.max(0, Math.floor(Number(merged.craftingTime ?? 0))),
            craftingXp: Math.max(0, Math.floor(Number((merged as any).craftingXp ?? (merged as any).xp ?? 0))),
            currencyCost: Math.max(0, Number((merged as any).currencyCost ?? (merged as any).goldCost ?? 0)),
            currencyDenomination: this.normalizeCurrencyDenomination((merged as any).currencyDenomination ?? (merged as any).currency ?? "gp"),
            consumeCurrencyOnFailure: Boolean((merged as any).consumeCurrencyOnFailure ?? false),
            toolRequirement: String((merged as any).toolRequirement || "optional") === "required" ? "required" : "optional",
            toolCriticalDamage: Boolean((merged as any).toolCriticalDamage ?? false),
            qualityFormulaPath: String((merged as any).qualityFormulaPath ?? ""),
            qualityBonusGood: Math.max(0, Math.floor(Number((merged as any).qualityBonusGood ?? 0))),
            qualityBonusSuperior: Math.max(0, Math.floor(Number((merged as any).qualityBonusSuperior ?? 0))),
            qualityBonusExcellent: Math.max(0, Math.floor(Number((merged as any).qualityBonusExcellent ?? 0))),
            qualityDiceGood: String((merged as any).qualityDiceGood ?? ""),
            qualityDiceSuperior: String((merged as any).qualityDiceSuperior ?? ""),
            qualityDiceExcellent: String((merged as any).qualityDiceExcellent ?? ""),
            qualityEffectGood: this.normalizeQualityEffectType((merged as any).qualityEffectGood ?? "auto"),
            qualityEffectSuperior: this.normalizeQualityEffectType((merged as any).qualityEffectSuperior ?? "auto"),
            qualityEffectExcellent: this.normalizeQualityEffectType((merged as any).qualityEffectExcellent ?? "auto"),
            skill: String(merged.skill ?? ""),
            dc: Number(merged.dc ?? 10),
            ingredients: this.normalizeComponents(merged.ingredients),
            tools: this.normalizeComponents(merged.tools),
            outputs: this.normalizeComponents(merged.outputs)
        };

    }

    public static async create(): Promise<Item> {

        const item = await Item.create({
            name: "Nuova Ricetta",
            type: "loot",
            img: "icons/svg/book.svg",
            flags: {
                artisan: {
                    type: "recipe",
                    version: 1,
                    recipe: this.getDefaultData()
                }
            }
        });

        return item as Item;

    }

    public static async setRecipeData(
        item: Item,
        data: Partial<ArtisanRecipeData>
    ): Promise<void> {

        const current = this.getData(item);

        await item.setFlag(
            this.FLAG_SCOPE,
            this.FLAG_RECIPE,
            {
                ...current,
                ...data
            }
        );

    }

    public static async addComponent(
        item: Item,
        collection: RecipeComponentCollection,
        component: ArtisanRecipeComponent
    ): Promise<void> {

        const current = this.getData(item);

        const nextComponent = this.normalizeComponent(component);

        const nextCollection = [...current[collection]];

        const existingIndex = nextCollection.findIndex(entry => {
            return entry.uuid === nextComponent.uuid;
        });

        if (existingIndex >= 0) {
            const existing = nextCollection[existingIndex];

            nextCollection[existingIndex] = {
                ...existing,
                quantity: Math.max(
                    1,
                    Number(existing.quantity ?? 1) + nextComponent.quantity
                )
            };
        } else {
            nextCollection.push(nextComponent);
        }

        await this.setRecipeData(
            item,
            {
                [collection]: nextCollection
            } as Partial<ArtisanRecipeData>
        );

    }

    public static async updateComponentQuantity(
        item: Item,
        collection: RecipeComponentCollection,
        index: number,
        quantity: number
    ): Promise<void> {

        const current = this.getData(item);

        const nextCollection = [...current[collection]];

        if (!nextCollection[index]) {
            return;
        }

        nextCollection[index] = {
            ...nextCollection[index],
            quantity: Math.max(1, Number(quantity || 1))
        };

        await this.setRecipeData(
            item,
            {
                [collection]: nextCollection
            } as Partial<ArtisanRecipeData>
        );

    }

    public static async removeComponent(
        item: Item,
        collection: RecipeComponentCollection,
        index: number
    ): Promise<void> {

        const current = this.getData(item);

        const nextCollection = current[collection].filter((_entry, entryIndex) => {
            return entryIndex !== index;
        });

        await this.setRecipeData(
            item,
            {
                [collection]: nextCollection
            } as Partial<ArtisanRecipeData>
        );

    }

    public static toExplorerItem(item: Item): {
        id: string;
        label: string;
        icon: string;
    } {

        return {
            id: item.id ?? "",
            label: item.name ?? "Senza nome",
            icon: "fa-solid fa-scroll"
        };

    }

    public static async toInspectorData(item: Item): Promise<object> {

        const recipe = this.getData(item);

        const ingredients = await this.toComponentViews(
            item,
            "ingredients",
            recipe.ingredients
        );

        const tools = await this.toComponentViews(
            item,
            "tools",
            recipe.tools
        );

        const outputs = await this.toComponentViews(
            item,
            "outputs",
            recipe.outputs
        );

        return {
            id: item.id,
            uuid: item.uuid,
            name: item.name,
            img: item.img,
            type: item.type,

            category: recipe.category,
            profile: recipe.profile,
            difficulty: recipe.difficulty,
            craftingTime: recipe.craftingTime,
            craftingXp: recipe.craftingXp,
            currencyCost: recipe.currencyCost,
            currencyDenomination: recipe.currencyDenomination,
            consumeCurrencyOnFailure: recipe.consumeCurrencyOnFailure,
            toolRequirement: recipe.toolRequirement,
            qualityFormulaPath: recipe.qualityFormulaPath,
            qualityBonusGood: recipe.qualityBonusGood,
            qualityBonusSuperior: recipe.qualityBonusSuperior,
            qualityBonusExcellent: recipe.qualityBonusExcellent,
            qualityDiceGood: recipe.qualityDiceGood,
            qualityDiceSuperior: recipe.qualityDiceSuperior,
            qualityDiceExcellent: recipe.qualityDiceExcellent,
            qualityEffectGood: recipe.qualityEffectGood,
            qualityEffectSuperior: recipe.qualityEffectSuperior,
            qualityEffectExcellent: recipe.qualityEffectExcellent,
            skill: recipe.skill,
            dc: recipe.dc,

            ingredients,
            tools,
            outputs,

            ingredientCount: ingredients.length,
            toolCount: tools.length,
            outputCount: outputs.length
        };

    }


    private static normalizeCurrencyDenomination(value: unknown): string {

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

    private static normalizeQualityEffectType(value: unknown): string {

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

    private static normalizeComponents(
        components: unknown
    ): ArtisanRecipeComponent[] {

        if (!Array.isArray(components)) {
            return [];
        }

        return components.map(component => {
            return this.normalizeComponent(component as Partial<ArtisanRecipeComponent>);
        });

    }

    private static normalizeComponent(
        component: Partial<ArtisanRecipeComponent>
    ): ArtisanRecipeComponent {

        return {
            uuid: String(component.uuid ?? "").trim(),
            quantity: Math.max(1, Number(component.quantity ?? 1))
        };

    }

    private static async toComponentViews(
        item: Item,
        collection: RecipeComponentCollection,
        components: ArtisanRecipeComponent[]
    ): Promise<ArtisanRecipeComponentView[]> {

        const views = components.map(async (component, index) => {
            return this.toComponentView(
                item,
                collection,
                component,
                index
            );
        });

        return Promise.all(views);

    }

    private static async toComponentView(
        item: Item,
        collection: RecipeComponentCollection,
        component: ArtisanRecipeComponent,
        index: number
    ): Promise<ArtisanRecipeComponentView> {

        const fallback: ArtisanRecipeComponentView = {
            index,
            recipeId: item.id ?? "",
            collection,
            uuid: component.uuid,
            quantity: component.quantity,
            name: component.uuid,
            img: "icons/svg/item-bag.svg",
            documentType: "",
            found: false
        };

        try {

            const document = await fromUuid(component.uuid) as any;

            if (!document) {
                return fallback;
            }

            return {
                ...fallback,
                name: document.name ?? component.uuid,
                img: document.img ?? "icons/svg/item-bag.svg",
                documentType: document.documentName ?? "",
                found: true
            };

        } catch (_error) {

            return fallback;

        }

    }

}