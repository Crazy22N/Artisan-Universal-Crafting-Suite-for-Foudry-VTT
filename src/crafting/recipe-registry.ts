import { RecipeDatabase } from "./database/recipe-database";
import { CraftingRecipe } from "./recipe";

export class RecipeRegistry {

    private readonly database = new RecipeDatabase();

    public register(recipe: CraftingRecipe): void {

        if (this.database.has(recipe.id)) {
            throw new Error(`Recipe '${recipe.id}' già registrata.`);
        }

        this.database.add(recipe);

    }

    public get(id: string): CraftingRecipe | undefined {
        return this.database.get(id);
    }

    public getAll(): CraftingRecipe[] {
        return this.database.all();
    }

    public count(): number {
        return this.database.size();
    }

    public clear(): void {
        this.database.clear();
    }

}