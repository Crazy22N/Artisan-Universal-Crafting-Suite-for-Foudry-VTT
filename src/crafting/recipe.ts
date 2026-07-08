export interface CraftingIngredient {
    id: string;
    name: string;
    quantity: number;
}

export interface CraftingResult {
    id: string;
    name: string;
    quantity: number;
}

export interface CraftingRecipe {
    id: string;
    name: string;

    ingredients: CraftingIngredient[];

    result: CraftingResult;

    skill?: {
        type: string;
        dc: number;
    };

    tool?: string;

    breakChance?: number;
}