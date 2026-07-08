import { Logger } from "../utils/logger";
import { ArtisanSettings } from "../settings/settings";
import { SkillCheck } from "./skill-check";
import { BaseRecipes } from "./recipes/base-recipes";
import { RecipeRegistry } from "./recipe-registry";
import { CraftingRecipe } from "./recipe";

export class CraftingSystem {

    private registry = new RecipeRegistry();

    constructor() {
        this.loadBaseRecipes();
    }

    private loadBaseRecipes(): void {
        BaseRecipes.forEach(recipe => this.registerRecipe(recipe));

        Logger.info(`Caricate ${BaseRecipes.length} ricette base`);
    }

    public registerRecipe(recipe: CraftingRecipe): void {
        this.registry.register(recipe);

        if (ArtisanSettings.isDebug()) {
            Logger.debug(`Recipe registrata: ${recipe.name}`);
        }
    }

    public getRecipe(id: string): CraftingRecipe | undefined {
        return this.registry.get(id);
    }

    public getAllRecipes(): CraftingRecipe[] {
        return this.registry.getAll();
    }

    public craft(recipeId: string): boolean {

        const recipe = this.registry.get(recipeId);

        if (!recipe) {
            Logger.error(`Recipe non trovata: ${recipeId}`);
            return false;
        }

        Logger.info(`CRAFT → ${recipe.name}`);

        if (recipe.skill) {

            const result = SkillCheck.roll(
                recipe.skill.type,
                recipe.skill.dc
            );

            if (!result.success) {
                Logger.warn("Craft fallito - nessun output generato");
                return false;
            }
        }

        Logger.info(`Output → ${recipe.result.name} x${recipe.result.quantity}`);

        return true;
    }

}