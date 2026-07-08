import { ArtisanManager } from "../applications";


const ArtisanSettingsMenuBase = ((globalThis as any).FormApplication ?? foundry.applications.api.ApplicationV2) as any;

class ArtisanSettingsMenuBridge extends ArtisanSettingsMenuBase {

    public static sectionId = "settings";

    public render(_force?: boolean, _options?: any): this {

        const sectionId = (this.constructor as typeof ArtisanSettingsMenuBridge).sectionId ?? "settings";
        Artisan.openSection(sectionId);

        return this;

    }

}

class ArtisanPackagesSettingsMenu extends ArtisanSettingsMenuBridge {

    public static override sectionId = "presets";

}

class ArtisanHelpSettingsMenu extends ArtisanSettingsMenuBridge {

    public static override sectionId = "help";

    public override render(_force?: boolean, _options?: any): this {

        Artisan.openHelpDialog();

        return this;

    }

}

class ArtisanModuleSettingsMenu extends ArtisanSettingsMenuBridge {

    public static override sectionId = "settings";

}

export class Artisan {

    private static manager: ArtisanManager | null = null;
    private static originalLocalize: ((key: string) => string) | null = null;
    private static languageDictionaries: Record<string, Record<string, string>> = {};

    public static initialize(): void {

        console.log("Artisan | Module initialization");

        this.registerLanguageSetting();
        this.registerUtilityMenus();
        this.patchLocalization();
        this.exposeApi();

        Hooks.once("ready", async () => {
            await this.loadLanguageDictionaries();
            this.createLauncherButton();
        });

    }

    public static open(): void {

        if (!this.manager) {
            this.manager = new ArtisanManager();
        }

        this.manager.openMainSection();

    }

    public static openSection(sectionId: string): void {

        if (!this.manager) {
            this.manager = new ArtisanManager();
        }

        this.manager.openSection(sectionId);

    }

    public static openHelpDialog(): void {

        const title = Artisan.localize("ARTISAN.HelpDialogTitle");
        const content = Artisan.buildHelpDialogContent();

        const DialogClass = (globalThis as any).Dialog;

        if (DialogClass) {
            new DialogClass({
                title,
                content,
                buttons: {
                    close: {
                        icon: '<i class="fa-solid fa-check"></i>',
                        label: Artisan.localize("ARTISAN.Close")
                    }
                },
                default: "close"
            }, {
                width: 780,
                height: "auto",
                classes: ["artisan-help-dialog-window"]
            }).render(true);

            return;
        }

        const wrapper = document.createElement("section");
        wrapper.classList.add("artisan-help-dialog-fallback");
        wrapper.innerHTML = content;
        document.body.appendChild(wrapper);

    }

    public static localize(key: string): string {

        const selectedLanguage = this.getSelectedLanguage();

        if (selectedLanguage !== "system" && key.startsWith("ARTISAN.")) {
            const dictionary = this.languageDictionaries[selectedLanguage];
            const translated = dictionary?.[key];

            if (translated) {
                return translated;
            }
        }

        if (this.originalLocalize) {
            return this.originalLocalize(key);
        }

        return game.i18n.localize(key);

    }

    private static buildHelpDialogContent(): string {

        const l = (key: string) => Artisan.localize(key);

        const list = (keys: string[]): string => {
            return keys.map(key => `<li>${l(key)}</li>`).join("");
        };

        return `
            <article class="artisan-help-dialog">
                <header class="artisan-help-dialog__hero">
                    <div class="artisan-help-dialog__icon"><i class="fa-solid fa-hammer"></i></div>
                    <div>
                        <h2>${l("ARTISAN.HelpDialogHeroTitle")}</h2>
                        <p>${l("ARTISAN.HelpDialogHeroText")}</p>
                    </div>
                </header>

                <section class="artisan-help-dialog__section">
                    <h3><i class="fa-solid fa-play"></i> ${l("ARTISAN.HelpDialogStartTitle")}</h3>
                    <ol>${list([
                        "ARTISAN.HelpDialogStart1",
                        "ARTISAN.HelpDialogStart2",
                        "ARTISAN.HelpDialogStart3",
                        "ARTISAN.HelpDialogStart4"
                    ])}</ol>
                </section>

                <section class="artisan-help-dialog__grid">
                    <article>
                        <h3><i class="fa-solid fa-book"></i> ${l("ARTISAN.HelpCraftingTitle")}</h3>
                        <p>${l("ARTISAN.HelpDialogCraftingText")}</p>
                        <ul>${list([
                            "ARTISAN.HelpDialogCrafting1",
                            "ARTISAN.HelpDialogCrafting2",
                            "ARTISAN.HelpDialogCrafting3"
                        ])}</ul>
                    </article>

                    <article>
                        <h3><i class="fa-solid fa-leaf"></i> ${l("ARTISAN.HelpForagingTitle")}</h3>
                        <p>${l("ARTISAN.HelpDialogForagingText")}</p>
                        <ul>${list([
                            "ARTISAN.HelpDialogForaging1",
                            "ARTISAN.HelpDialogForaging2",
                            "ARTISAN.HelpDialogForaging3"
                        ])}</ul>
                    </article>

                    <article>
                        <h3><i class="fa-solid fa-paw"></i> ${l("ARTISAN.HelpHarvestTitle")}</h3>
                        <p>${l("ARTISAN.HelpDialogHarvestText")}</p>
                        <ul>${list([
                            "ARTISAN.HelpDialogHarvest1",
                            "ARTISAN.HelpDialogHarvest2",
                            "ARTISAN.HelpDialogHarvest3"
                        ])}</ul>
                    </article>

                    <article>
                        <h3><i class="fa-solid fa-user-gear"></i> ${l("ARTISAN.HelpProfessionsTitle")}</h3>
                        <p>${l("ARTISAN.HelpDialogProfessionsText")}</p>
                        <ul>${list([
                            "ARTISAN.HelpDialogProfessions1",
                            "ARTISAN.HelpDialogProfessions2",
                            "ARTISAN.HelpDialogProfessions3"
                        ])}</ul>
                    </article>
                </section>

                <section class="artisan-help-dialog__section artisan-help-dialog__note">
                    <h3><i class="fa-solid fa-floppy-disk"></i> ${l("ARTISAN.HelpDialogDataTitle")}</h3>
                    <p>${l("ARTISAN.HelpDialogDataText")}</p>
                </section>
            </article>
        `;

    }

    private static exposeApi(): void {

        (game as any).artisan = {
            open: () => Artisan.open(),
            openSection: (sectionId: string) => Artisan.openSection(sectionId),
            openHelp: () => Artisan.openHelpDialog(),
            localize: (key: string) => Artisan.localize(key)
        };

    }

    private static registerLanguageSetting(): void {

        const settings = (game.settings as any).settings;

        if (settings?.has?.("artisan.interfaceLanguage")) {
            return;
        }

        game.settings.register("artisan", "interfaceLanguage", {
            name: "ARTISAN.InterfaceLanguageSettingName",
            hint: "ARTISAN.InterfaceLanguageSettingHint",
            scope: "client",
            config: true,
            type: String,
            choices: {
                system: "ARTISAN.LanguageSystem",
                it: "ARTISAN.LanguageItalian",
                en: "ARTISAN.LanguageEnglish"
            },
            default: "system",
            onChange: () => {
                ui.notifications.info(Artisan.localize("ARTISAN.LanguageReloadHint"));
            }
        });

    }

    private static registerUtilityMenus(): void {

        const menus = (game.settings as any).menus;

        if (!menus?.has?.("artisan.packagesMenu")) {
            game.settings.registerMenu("artisan", "packagesMenu", {
                name: "ARTISAN.SettingsMenuPackagesName",
                label: "ARTISAN.Open",
                hint: "ARTISAN.SettingsMenuPackagesHint",
                icon: "fas fa-box-open",
                type: ArtisanPackagesSettingsMenu as any,
                restricted: true,
            });
        }

        if (!menus?.has?.("artisan.helpMenu")) {
            game.settings.registerMenu("artisan", "helpMenu", {
                name: "ARTISAN.SettingsMenuHelpName",
                label: "ARTISAN.Open",
                hint: "ARTISAN.SettingsMenuHelpHint",
                icon: "fas fa-circle-question",
                type: ArtisanHelpSettingsMenu as any,
                restricted: false,
            });
        }

        if (!menus?.has?.("artisan.moduleSettingsMenu")) {
            game.settings.registerMenu("artisan", "moduleSettingsMenu", {
                name: "ARTISAN.SettingsMenuModuleSettingsName",
                label: "ARTISAN.Open",
                hint: "ARTISAN.SettingsMenuModuleSettingsHint",
                icon: "fas fa-gear",
                type: ArtisanModuleSettingsMenu as any,
                restricted: true,
            });
        }

    }

    private static patchLocalization(): void {

        if (this.originalLocalize) {
            return;
        }

        this.originalLocalize = game.i18n.localize.bind(game.i18n);

        (game.i18n as any).localize = (key: string): string => {
            return Artisan.localize(key);
        };

    }

    private static async loadLanguageDictionaries(): Promise<void> {

        const languages = ["it", "en"];

        for (const language of languages) {
            try {
                const response = await fetch(`modules/artisan/lang/${language}.json`);

                if (!response.ok) {
                    continue;
                }

                this.languageDictionaries[language] = await response.json();
            } catch (error) {
                console.warn(`Artisan | Unable to load ${language} localization`, error);
            }
        }

    }

    private static getSelectedLanguage(): string {

        try {
            const value = game.settings.get("artisan", "interfaceLanguage") as string;

            if (["system", "it", "en"].includes(value)) {
                return value;
            }
        } catch (_error) {
            return "system";
        }

        return "system";

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
        artisanButton.title = Artisan.localize("ARTISAN.OpenArtisan");

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
