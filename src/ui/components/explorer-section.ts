export interface ExplorerItemData {
    id: string;
    label: string;
    icon?: string;
    selected?: boolean;
}

export class ExplorerSection {

    public readonly id: string;

    public readonly label: string;

    public readonly icon: string;

    public readonly items: ExplorerItemData[];

    constructor(data: {
        id: string;
        label: string;
        icon: string;
        items?: ExplorerItemData[];
    }) {

        this.id = data.id;

        this.label = data.label;

        this.icon = data.icon;

        this.items = data.items ?? [];

    }

    public get count(): number {

        return this.items.length;

    }

    public toJSON(): object {

        return {
            id: this.id,
            label: this.label,
            icon: this.icon,
            count: this.count,
            items: this.items
        };

    }

}