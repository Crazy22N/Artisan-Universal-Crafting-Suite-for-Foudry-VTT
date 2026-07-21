import { RecipeDocument } from "../documents";

export class RecipeRepository {

    public getRecipes(): Item[] {

        return game.items.filter((item: Item) => {
            return RecipeDocument.isRecipe(item);
        });

    }

    public getRecipe(id: string): Item | undefined {

        const item = game.items.get(id);

        if (!item) {
            return undefined;
        }

        if (!RecipeDocument.isRecipe(item)) {
            return undefined;
        }

        return item;

    }

}
