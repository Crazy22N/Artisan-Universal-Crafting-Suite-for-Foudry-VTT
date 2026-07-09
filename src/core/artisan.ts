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

        const card = (icon: string, titleKey: string, textKey: string, bulletKeys: string[]): string => {
            return `
                <article class="artisan-help-dialog__card">
                    <h3><i class="${icon}"></i> ${l(titleKey)}</h3>
                    <p>${l(textKey)}</p>
                    <ul>${list(bulletKeys)}</ul>
                </article>
            `;
        };

        const mini = (titleKey: string, textKey: string): string => {
            return `
                <article class="artisan-help-dialog__mini-card">
                    <strong>${l(titleKey)}</strong>
                    <span>${l(textKey)}</span>
                </article>
            `;
        };

        return `
            <article class="artisan-help-dialog artisan-help-dialog--full">
                <header class="artisan-help-dialog__hero">
                    <div class="artisan-help-dialog__icon"><i class="fa-solid fa-hammer"></i></div>
                    <div>
                        <h2>${l("ARTISAN.HelpDialogHeroTitle")}</h2>
                        <p>${l("ARTISAN.HelpDialogHeroText")}</p>
                    </div>
                </header>

                <nav class="artisan-help-dialog__toc" aria-label="Artisan help navigation">
                    <a href="#artisan-help-start">${l("ARTISAN.HelpDialogStartTitle")}</a>
                    <a href="#artisan-help-crafting">${l("ARTISAN.HelpCraftingTitle")}</a>
                    <a href="#artisan-help-foraging">${l("ARTISAN.HelpForagingTitle")}</a>
                    <a href="#artisan-help-harvest">${l("ARTISAN.HelpHarvestTitle")}</a>
                    <a href="#artisan-help-professions">${l("ARTISAN.HelpProfessionsTitle")}</a>
                    <a href="#artisan-help-data">${l("ARTISAN.HelpDialogDataTitle")}</a>
                </nav>

                <section id="artisan-help-start" class="artisan-help-dialog__section">
                    <h3><i class="fa-solid fa-play"></i> ${l("ARTISAN.HelpDialogStartTitle")}</h3>
                    <ol class="artisan-help-dialog__steps">${list([
                        "ARTISAN.HelpDialogStart1",
                        "ARTISAN.HelpDialogStart2",
                        "ARTISAN.HelpDialogStart3",
                        "ARTISAN.HelpDialogStart4",
                        "ARTISAN.HelpDialogStart5",
                        "ARTISAN.HelpDialogStart6"
                    ])}</ol>
                </section>

                <section class="artisan-help-dialog__mini-grid">
                    ${mini("ARTISAN.HelpMiniActorTitle", "ARTISAN.HelpMiniActorText")}
                    ${mini("ARTISAN.HelpMiniItemsTitle", "ARTISAN.HelpMiniItemsText")}
                    ${mini("ARTISAN.HelpMiniToolsTitle", "ARTISAN.HelpMiniToolsText")}
                    ${mini("ARTISAN.HelpMiniBackupTitle", "ARTISAN.HelpMiniBackupText")}
                </section>

                <section id="artisan-help-crafting" class="artisan-help-dialog__section">
                    <h3><i class="fa-solid fa-book"></i> ${l("ARTISAN.HelpCraftingTitle")}</h3>
                    <p>${l("ARTISAN.HelpDialogCraftingText")}</p>
                    <div class="artisan-help-dialog__split">
                        <article>
                            <h4>${l("ARTISAN.HelpRecipeSetupTitle")}</h4>
                            <ul>${list([
                                "ARTISAN.HelpDialogCrafting1",
                                "ARTISAN.HelpDialogCrafting2",
                                "ARTISAN.HelpDialogCrafting3",
                                "ARTISAN.HelpCraftingToolsBonus",
                                "ARTISAN.HelpCraftingXp"
                            ])}</ul>
                        </article>
                        <article>
                            <h4>${l("ARTISAN.HelpOutputQualityTitle")}</h4>
                            <table class="artisan-help-dialog__table">
                                <tbody>
                                    <tr><th>${l("ARTISAN.HelpRollResult")}</th><th>${l("ARTISAN.HelpEffect")}</th></tr>
                                    <tr><td>${l("ARTISAN.HelpQualityNormalRange")}</td><td>${l("ARTISAN.HelpQualityNormal")}</td></tr>
                                    <tr><td>${l("ARTISAN.HelpQualityGoodRange")}</td><td>${l("ARTISAN.HelpQualityGood")}</td></tr>
                                    <tr><td>${l("ARTISAN.HelpQualitySuperiorRange")}</td><td>${l("ARTISAN.HelpQualitySuperior")}</td></tr>
                                    <tr><td>${l("ARTISAN.HelpQualityExcellentRange")}</td><td>${l("ARTISAN.HelpQualityExcellent")}</td></tr>
                                </tbody>
                            </table>
                        </article>
                    </div>
                </section>

                <section id="artisan-help-foraging" class="artisan-help-dialog__section">
                    <h3><i class="fa-solid fa-leaf"></i> ${l("ARTISAN.HelpForagingTitle")}</h3>
                    <p>${l("ARTISAN.HelpDialogForagingText")}</p>
                    <div class="artisan-help-dialog__grid">
                        ${card("fa-solid fa-map", "ARTISAN.HelpForagingListsTitle", "ARTISAN.HelpForagingListsText", [
                            "ARTISAN.HelpDialogForaging1",
                            "ARTISAN.HelpForagingMixedResources",
                            "ARTISAN.HelpForagingMaxResources"
                        ])}
                        ${card("fa-solid fa-dice-d20", "ARTISAN.HelpForagingRollTitle", "ARTISAN.HelpForagingRollText", [
                            "ARTISAN.HelpDialogForaging2",
                            "ARTISAN.HelpDialogForaging3",
                            "ARTISAN.HelpForagingCrits"
                        ])}
                    </div>
                </section>

                <section id="artisan-help-harvest" class="artisan-help-dialog__section">
                    <h3><i class="fa-solid fa-paw"></i> ${l("ARTISAN.HelpHarvestTitle")}</h3>
                    <p>${l("ARTISAN.HelpDialogHarvestText")}</p>
                    <div class="artisan-help-dialog__grid">
                        ${card("fa-solid fa-layer-group", "ARTISAN.HelpHarvestPartsTitle", "ARTISAN.HelpHarvestPartsText", [
                            "ARTISAN.HelpDialogHarvest1",
                            "ARTISAN.HelpDialogHarvest2",
                            "ARTISAN.HelpHarvestCreatureType"
                        ])}
                        ${card("fa-solid fa-screwdriver-wrench", "ARTISAN.HelpHarvestToolsTitle", "ARTISAN.HelpHarvestToolsText", [
                            "ARTISAN.HelpDialogHarvest3",
                            "ARTISAN.HelpHarvestConsumableTools",
                            "ARTISAN.HelpHarvestNoTarget"
                        ])}
                    </div>
                </section>

                <section id="artisan-help-professions" class="artisan-help-dialog__section">
                    <h3><i class="fa-solid fa-user-gear"></i> ${l("ARTISAN.HelpProfessionsTitle")}</h3>
                    <p>${l("ARTISAN.HelpDialogProfessionsText")}</p>
                    <div class="artisan-help-dialog__split">
                        <article>
                            <h4>${l("ARTISAN.HelpProfessionRulesTitle")}</h4>
                            <ul>${list([
                                "ARTISAN.HelpDialogProfessions1",
                                "ARTISAN.HelpDialogProfessions2",
                                "ARTISAN.HelpDialogProfessions3",
                                "ARTISAN.HelpProfessionLevelSource"
                            ])}</ul>
                        </article>
                        <article>
                            <h4>${l("ARTISAN.HelpProfessionThresholdsTitle")}</h4>
                            <table class="artisan-help-dialog__table artisan-help-dialog__table--compact">
                                <tbody>
                                    <tr><th>${l("ARTISAN.Level")}</th><th>${l("ARTISAN.XP")}</th><th>${l("ARTISAN.Gathering")}</th></tr>
                                    <tr><td>0</td><td>0</td><td>x1</td></tr>
                                    <tr><td>1</td><td>100</td><td>x1,2</td></tr>
                                    <tr><td>2</td><td>500</td><td>x1,5</td></tr>
                                    <tr><td>3</td><td>1500</td><td>x2</td></tr>
                                    <tr><td>4</td><td>3000</td><td>x2,5</td></tr>
                                    <tr><td>5</td><td>5000</td><td>x3</td></tr>
                                </tbody>
                            </table>
                        </article>
                    </div>
                </section>

                <section id="artisan-help-data" class="artisan-help-dialog__section artisan-help-dialog__note">
                    <h3><i class="fa-solid fa-floppy-disk"></i> ${l("ARTISAN.HelpDialogDataTitle")}</h3>
                    <p>${l("ARTISAN.HelpDialogDataText")}</p>
                    <ul>${list([
                        "ARTISAN.HelpBackup1",
                        "ARTISAN.HelpBackup2",
                        "ARTISAN.HelpBackup3"
                    ])}</ul>
                </section>

                <section class="artisan-help-dialog__section artisan-help-dialog__warning">
                    <h3><i class="fa-solid fa-triangle-exclamation"></i> ${l("ARTISAN.HelpTroubleshootingTitle")}</h3>
                    <ul>${list([
                        "ARTISAN.HelpTroubleshooting1",
                        "ARTISAN.HelpTroubleshooting2",
                        "ARTISAN.HelpTroubleshooting3",
                        "ARTISAN.HelpTroubleshooting4"
                    ])}</ul>
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
