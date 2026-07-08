import { ArtisanManager } from "../applications";

export class Artisan {

    private static manager: ArtisanManager | null = null;

    public static initialize(): void {

        console.log("Artisan | Inizializzazione modulo");

        this.exposeApi();

        Hooks.once("ready", () => {
            this.createLauncherButton();
        });

    }

    public static open(): void {

        if (!this.manager) {
            this.manager = new ArtisanManager();
        }

        this.manager.render(true);

    }

    private static exposeApi(): void {

        (game as any).artisan = {
            open: () => Artisan.open()
        };

    }

    private static createLauncherButton(): void {

        this.removeOldLaunchers();

        const launcher = document.createElement("div");
        launcher.id = "artisan-launcher";
        launcher.classList.add("artisan-launcher");

        const artisanButton = document.createElement("button");
        artisanButton.type = "button";
        artisanButton.classList.add("artisan-launcher__button");
        artisanButton.innerHTML = `<i class="fa-solid fa-hammer"></i><span>Artisan</span>`;
        artisanButton.title = "Apri Artisan";

        artisanButton.addEventListener("click", event => {
            event.preventDefault();
            Artisan.open();
        });

        launcher.appendChild(artisanButton);

        document.body.appendChild(launcher);

    }

    private static removeOldLaunchers(): void {

        const oldLaunchers = document.querySelectorAll(
            "#artisan-launcher, .artisan-launcher, #artisan-foraging-launcher, .artisan-foraging-launcher"
        );

        oldLaunchers.forEach(launcher => {
            launcher.remove();
        });

    }

}
