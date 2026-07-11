import { ExplorerSection, ExplorerItemData } from "./explorer-section";

export class Explorer {

    private readonly sections: ExplorerSection[];

    constructor(sections: ExplorerSection[]) {

        this.sections = sections;

    }

    public static createDefault(data?: {
        recipes?: ExplorerItemData[];
        selectedRecipeId?: string | null;
    }): Explorer {

        const recipes = (data?.recipes ?? []).map(recipe => ({
            ...recipe,
            selected: recipe.id === data?.selectedRecipeId
        }));

        return new Explorer([
            new ExplorerSection({
                id: "recipes",
                label: "Ricette",
                icon: "fa-solid fa-book",
                items: recipes
            }),
            new ExplorerSection({
                id: "professions",
                label: "Professioni",
                icon: "fa-solid fa-user-gear"
            }),
            new ExplorerSection({
                id: "tools",
                label: "Strumenti",
                icon: "fa-solid fa-hammer"
            }),
            new ExplorerSection({
                id: "foraging",
                label: "Foraging",
                icon: "fa-solid fa-leaf"
            }),
            new ExplorerSection({
                id: "harvest",
                label: "Harvest",
                icon: "fa-solid fa-paw"
            })
        ]);

    }

    public toJSON(): object[] {

        return this.sections.map(section => section.toJSON());

    }

}