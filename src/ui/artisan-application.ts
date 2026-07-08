export abstract class ArtisanApplication {

    public readonly id: string;

    constructor(id: string) {

        this.id = id;

    }

    public open(): void {

        console.log(`${this.id} opened`);

    }

    public close(): void {

        console.log(`${this.id} closed`);

    }

}