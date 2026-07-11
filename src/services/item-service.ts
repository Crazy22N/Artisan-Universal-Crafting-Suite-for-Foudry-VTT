export class ItemService {

    public async getOrCreateRecipeFolder(): Promise<Folder> {

        let folder = game.folders.find(folder =>
            folder.type === "Item" &&
            folder.name === "Artisan Recipes"
        );

        if (folder) {
            return folder;
        }

        folder = await Folder.create({
            name: "Artisan Recipes",
            type: "Item",
            color: "#d18b47"
        });

        return folder as Folder;

    }

}