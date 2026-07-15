import { CraftingRecipe } from "../recipe";

export class RecipeDatabase {

    private readonly recipes = new Map<string, CraftingRecipe>();

    public add(recipe: CraftingRecipe): void {
        this.recipes.set(recipe.id, recipe);
    }

    public get(id: string): CraftingRecipe | undefined {
        return this.recipes.get(id);
    }

    public has(id: string): boolean {
        return this.recipes.has(id);
    }

    public all(): CraftingRecipe[] {
        return [...this.recipes.values()];
    }

    public clear(): void {
        this.recipes.clear();
    }

    public size(): number {
        return this.recipes.size;
    }

}