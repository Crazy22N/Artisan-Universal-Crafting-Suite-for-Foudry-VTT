import { ArtisanManager } from "../applications";

export class UIService {

    private static manager: ArtisanManager | null = null;

    public static getManager(): ArtisanManager {

        if (!this.manager) {
            this.manager = new ArtisanManager();
        }

        return this.manager;

    }

    public static openManager(): void {

        const manager = this.getManager();

        manager.render(true);

    }

    public static closeManager(): void {

        this.manager?.close();

    }

}