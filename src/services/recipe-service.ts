import {
    ArtisanRecipeData,
    RecipeComponentCollection,
    RecipeDocument
} from "../documents";

import { RecipeRepository } from "../repositories";
import { ItemService } from "./item-service";

export class RecipeService {

    private readonly repository = new RecipeRepository();

    private readonly itemService = new ItemService();

    public getRecipes(): Item[] {

        return this.repository.getRecipes();

    }

    public getRecipe(id: string): Item | undefined {

        return this.repository.getRecipe(id);

    }

    public async createRecipe(): Promise<Item> {

        const folder = await this.itemService.getOrCreateRecipeFolder();

        const item = await RecipeDocument.create();

        await item.update({
            folder: folder.id
        });

        return item;

    }

    public async updateRecipeName(
        id: string,
        name: string
    ): Promise<void> {

        const item = this.getRecipe(id);

        if (!item) {
            ui.notifications.warn("Ricetta non trovata.");
            return;
        }

        await item.update({
            name: name || "Nuova Ricetta"
        });

    }

    public async updateRecipeData(
        id: string,
        data: Partial<ArtisanRecipeData>
    ): Promise<void> {

        const item = this.getRecipe(id);

        if (!item) {
            ui.notifications.warn("Ricetta non trovata.");
            return;
        }

        await RecipeDocument.setRecipeData(item, data);

    }

    public async addRecipeComponent(
        id: string,
        collection: RecipeComponentCollection,
        uuid: string,
        quantity: number
    ): Promise<void> {

        const item = this.getRecipe(id);

        if (!item) {
            ui.notifications.warn("Ricetta non trovata.");
            return;
        }

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
            ui.notifications.warn(`Nessun documento trovato con questo UUID: ${cleanUuid}`);
            return;
        }

        if (document.documentName !== "Item") {
            ui.notifications.warn("Puoi aggiungere solo documenti di tipo Item.");
            return;
        }

        await RecipeDocument.addComponent(
            item,
            collection,
            {
                uuid: cleanUuid,
                quantity: Math.max(1, Number(quantity || 1))
            }
        );

        ui.notifications.info(`${document.name} aggiunto alla ricetta.`);

    }

    public async updateRecipeComponentQuantity(
        id: string,
        collection: RecipeComponentCollection,
        index: number,
        quantity: number
    ): Promise<void> {

        const item = this.getRecipe(id);

        if (!item) {
            ui.notifications.warn("Ricetta non trovata.");
            return;
        }

        await RecipeDocument.updateComponentQuantity(
            item,
            collection,
            index,
            Math.max(1, Number(quantity || 1))
        );

    }

    public async removeRecipeComponent(
        id: string,
        collection: RecipeComponentCollection,
        index: number
    ): Promise<void> {

        const item = this.getRecipe(id);

        if (!item) {
            ui.notifications.warn("Ricetta non trovata.");
            return;
        }

        await RecipeDocument.removeComponent(
            item,
            collection,
            index
        );

    }

    public async openComponentDocument(uuid: string): Promise<void> {

        const cleanUuid = uuid.trim();

        if (!cleanUuid) {
            ui.notifications.warn("UUID non valido.");
            return;
        }

        let document: any = null;

        try {
            document = await fromUuid(cleanUuid);
        } catch (_error) {
            ui.notifications.warn(`Impossibile aprire UUID: ${cleanUuid}`);
            return;
        }

        if (!document) {
            ui.notifications.warn(`Documento non trovato: ${cleanUuid}`);
            return;
        }

        if (document.sheet) {
            document.sheet.render(true);
            return;
        }

        ui.notifications.warn("Il documento esiste ma non ha una scheda apribile.");

    }

    public getExplorerRecipes(): object[] {

        return this.getRecipes().map(item => {
            return RecipeDocument.toExplorerItem(item);
        });

    }

    public async getInspectorData(id: string): Promise<object | null> {

        const item = this.getRecipe(id);

        if (!item) {
            return null;
        }

        return RecipeDocument.toInspectorData(item);

    }

}