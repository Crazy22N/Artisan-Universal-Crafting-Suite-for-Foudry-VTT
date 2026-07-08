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
            craftingTime: Number(merged.craftingTime ?? 0),
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