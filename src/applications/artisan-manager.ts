import { RecipeComponentCollection, RecipeDocument } from "../documents";
import { CraftingService } from "../services/crafting-service";
import {
  DisassemblyComponentCollection,
  DisassemblyService,
} from "../services/disassembly-service";
import {
  ForagingComponentCollection,
  ForagingService,
} from "../services/foraging-service";
import {
  HarvestComponentCollection,
  HarvestService,
} from "../services/harvest-service";
import { ProfessionService } from "../services/profession-service";
import { RecipeService } from "../services/recipe-service";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

type ArtisanScrollState = {
  sidebarTop: number;
  contentTop: number;
  inspectorTop: number;
  foragingTop: number;
  harvestTop: number;
  disassemblyTop: number;
  activityTop: number;
};

export class ArtisanManager extends HandlebarsApplicationMixin(ApplicationV2) {
  private selectedRecipeId: string | null = null;

  private selectedSectionId: string = "recipes";

  private selectedForagingProfileId: string | null = null;

  private selectedHarvestProfileId: string | null = null;

  private selectedDisassemblyProfileId: string | null = null;

  private expandedExplorerSectionIds = new Set<string>([
    "recipes",
  ]);

  private recipeSearchText: string = "";

  private recipeFilterProfession: string = "all";

  private recipeFilterCategory: string = "all";

  private recipeFilterLevel: string = "all";

  private pendingScrollState: ArtisanScrollState | null = null;

  static DEFAULT_OPTIONS = {
    id: "artisan-manager",
    tag: "section",
    window: {
      title: "Artisan",
      icon: "fa-solid fa-hammer",
    },
    position: {
      width: 1120,
            height: 820,
    },
    classes: ["artisan", "artisan-manager"],
  };

  static PARTS = {
    main: {
      template: "modules/artisan/templates/artisan-manager.hbs",
    },
  };

  public openSection(sectionId: string): void {
    this.selectedSectionId = sectionId;
    this.renderPreservingUiState();
  }

  public openMainSection(): void {
    if (["presets", "help", "settings"].includes(this.selectedSectionId)) {
      this.selectedSectionId = "recipes";
    }

    this.renderPreservingUiState();
  }

  async _prepareContext(_options: unknown): Promise<object> {
    const recipeService = new RecipeService();
    const foragingService = new ForagingService();
    const harvestService = new HarvestService();
    const disassemblyService = new DisassemblyService();
    const professionService = new ProfessionService();

    const allRecipes = recipeService.getExplorerRecipes() as any[];

    const selectedActor = canvas?.tokens?.controlled?.[0]?.actor ?? null;

    const recipeCategories = this.getRecipeCategoryOptions(allRecipes);

    const recipes = this.getFilteredRecipes(allRecipes, professionService);

    if (this.selectedRecipeId && !recipes.some((recipe: any) => recipe.id === this.selectedRecipeId)) {
      this.selectedRecipeId = recipes.length > 0 ? String((recipes[0] as any).id) : null;
    }

    if (!this.selectedRecipeId && recipes.length > 0) {
      const firstRecipe = recipes[0] as { id: string };
      this.selectedRecipeId = firstRecipe.id;
    }

    const foragingData = await foragingService.getManagerData(
      this.selectedForagingProfileId,
    );
    const harvestData = await harvestService.getManagerData(
      this.selectedHarvestProfileId,
    );
    const disassemblyData = await disassemblyService.getManagerData(
      this.selectedDisassemblyProfileId,
    );

    if (!this.selectedForagingProfileId && foragingData.selectedProfile) {
      this.selectedForagingProfileId = foragingData.selectedProfile.id;
    }

    if (!this.selectedHarvestProfileId && harvestData.selectedProfile) {
      this.selectedHarvestProfileId = harvestData.selectedProfile.id;
    }

    if (!this.selectedDisassemblyProfileId && disassemblyData.selectedProfile) {
      this.selectedDisassemblyProfileId = disassemblyData.selectedProfile.id;
    }

    const explorerData = [
      this.getExplorerSectionView({
        id: "recipes",
        label: game.i18n.localize("ARTISAN.Recipes"),
        icon: "fa-solid fa-book",
        count: recipes.length,
        items: (recipes as any[]).map(recipe => ({
          ...recipe,
          kind: "recipe",
          ...this.getRecipeCraftingRequirementView(recipe, professionService, selectedActor),
          selected: this.selectedSectionId === "recipes" && recipe.id === this.selectedRecipeId,
        })),
      }),
      this.getExplorerSectionView({
        id: "foraging",
        label: game.i18n.localize("ARTISAN.Foraging"),
        icon: "fa-solid fa-leaf",
        count: foragingData.profiles.length,
        items: (foragingData.profiles as any[]).map(profile => ({
          ...profile,
          kind: "foraging",
          selected: this.selectedSectionId === "foraging" && profile.id === this.selectedForagingProfileId,
        })),
      }),
      this.getExplorerSectionView({
        id: "harvest",
        label: game.i18n.localize("ARTISAN.Harvest"),
        icon: "fa-solid fa-paw",
        count: harvestData.profiles.length,
        items: (harvestData.profiles as any[]).map(profile => ({
          ...profile,
          kind: "harvest",
          selected: this.selectedSectionId === "harvest" && profile.id === this.selectedHarvestProfileId,
        })),
      }),
      this.getExplorerSectionView({
        id: "disassembly",
        label: game.i18n.localize("ARTISAN.Disassembly"),
        icon: "fa-solid fa-screwdriver-wrench",
        count: disassemblyData.profiles.length,
        items: (disassemblyData.profiles as any[]).map(profile => ({
          ...profile,
          kind: "disassembly",
          selected: this.selectedSectionId === "disassembly" && profile.id === this.selectedDisassemblyProfileId,
        })),
      }),
      this.getExplorerSectionView({
        id: "management",
        label: game.i18n.localize("ARTISAN.Management"),
        icon: "fa-solid fa-sliders",
        count: 3,
        items: [
          {
            id: "professions",
            kind: "section",
            label: game.i18n.localize("ARTISAN.ActorProfessions"),
            icon: "fa-solid fa-user-gear",
            selected: this.selectedSectionId === "professions",
          },
          {
            id: "activity",
            kind: "section",
            label: game.i18n.localize("ARTISAN.ActivityLog"),
            icon: "fa-solid fa-clock-rotate-left",
            selected: this.selectedSectionId === "activity",
          },
          {
            id: "settings",
            kind: "section",
            label: game.i18n.localize("ARTISAN.ModuleSettings"),
            icon: "fa-solid fa-gear",
            selected: this.selectedSectionId === "settings",
          },
        ],
      }),
    ];

    const selectedRecipe = this.selectedRecipeId
      ? await recipeService.getInspectorData(this.selectedRecipeId)
      : null;

    const selectedRecipeItem = this.selectedRecipeId
      ? game.items.get(this.selectedRecipeId)
      : null;

    const selectedRecipeFlag = selectedRecipeItem?.getFlag(
      "artisan",
      "recipe",
    ) as any;

    const selectedRecipeProfessionLevel = professionService.normalizeLevel(
      (selectedRecipe as any)?.professionLevel ??
        selectedRecipeFlag?.professionLevel ??
        selectedRecipeFlag?.requiredProfessionLevel ??
        0,
    );

    const selectedRecipeRequirement = selectedRecipe
      ? this.getRecipeCraftingRequirementView(selectedRecipe, professionService, selectedActor)
      : null;

    const selectedRecipeView = selectedRecipe
      ? {
          ...(selectedRecipe as any),
          ...selectedRecipeRequirement,
          professionLevel: selectedRecipeProfessionLevel,
          craftingMultiplier: professionService.getCraftingMultiplier(
            selectedRecipeProfessionLevel,
          ),
          craftingMultiplierLabel: professionService.getMultiplierLabel(
            selectedRecipeProfessionLevel,
          ),
          gatheringMultiplier: professionService.getGatheringMultiplier(
            selectedRecipeProfessionLevel,
          ),
          gatheringMultiplierLabel: professionService.getMultiplierLabel(
            selectedRecipeProfessionLevel,
          ),
        }
      : null;

    const selectedForagingActorProfession =
      selectedActor && foragingData.selectedProfile
        ? professionService.getActorProfession(
            selectedActor,
            foragingData.selectedProfile.profession,
          )
        : null;

    const selectedHarvestActorProfession =
      selectedActor && harvestData.selectedProfile
        ? professionService.getActorProfession(
            selectedActor,
            harvestData.selectedProfile.profession,
          )
        : null;

    const selectedDisassemblyActorProfession =
      selectedActor && disassemblyData.selectedProfile
        ? professionService.getActorProfession(
            selectedActor,
            disassemblyData.selectedProfile.profession,
          )
        : null;

    const selectedActorProfessions = professionService.getActorProfessions(selectedActor);
    const selectedForagingActorProfessionSummary = this.getActorProfessionInlineSummary(
      selectedActor,
      selectedForagingActorProfession,
      game.i18n.localize("ARTISAN.Gathering").toLowerCase(),
    );
    const selectedHarvestActorProfessionSummary = this.getActorProfessionInlineSummary(
      selectedActor,
      selectedHarvestActorProfession,
      game.i18n.localize("ARTISAN.Extraction").toLowerCase(),
    );
    const selectedDisassemblyActorProfessionSummary = this.getActorProfessionInlineSummary(
      selectedActor,
      selectedDisassemblyActorProfession,
      game.i18n.localize("ARTISAN.Disassembly").toLowerCase(),
    );

    return {
      title: "Artisan",
      subtitle: game.i18n.localize("ARTISAN.Subtitle"),
      explorer: explorerData,
      selectedRecipe: selectedRecipeView,
      selectedSectionId: this.selectedSectionId,
      isRecipesSection: this.selectedSectionId === "recipes",
      isForagingSection: this.selectedSectionId === "foraging",
      isHarvestSection: this.selectedSectionId === "harvest",
      isDisassemblySection: this.selectedSectionId === "disassembly",
      isProfessionsSection: this.selectedSectionId === "professions",
      isActivitySection: this.selectedSectionId === "activity",
      isPresetsSection: this.selectedSectionId === "presets",
      isHelpSection: this.selectedSectionId === "help",
      isSettingsSection: this.selectedSectionId === "settings",
      presetPackages: this.getPresetPackages(),
      activityLog: this.getActivityLogView(),
      artisanSettings: this.getArtisanSettingsView(),
      professionOptions: professionService.getOptions(),
      recipeFilters: {
        search: this.recipeSearchText,
        profession: this.recipeFilterProfession,
        category: this.recipeFilterCategory,
        level: this.recipeFilterLevel,
      },
      recipeFilterProfessionOptions: this.getRecipeProfessionFilterOptions(professionService),
      recipeFilterCategoryOptions: recipeCategories,
      recipeFilterLevelOptions: this.getRecipeLevelFilterOptions(),
      recipeCountTotal: allRecipes.length,
      recipeCountFiltered: recipes.length,
      foragingProfiles: foragingData.profiles,
      foragingProfessionOptions: professionService.getOptions(),
      selectedForagingProfile: foragingData.selectedProfile,
      selectedForagingActorName: selectedActor?.name ?? "",
      selectedForagingActorProfession,
      selectedForagingActorProfessionSummary,
      harvestProfiles: harvestData.profiles,
      harvestProfessionOptions: professionService.getOptions(),
      selectedHarvestProfile: harvestData.selectedProfile,
      selectedHarvestActorName: selectedActor?.name ?? "",
      selectedHarvestActorProfession,
      selectedHarvestActorProfessionSummary,
      disassemblyProfiles: disassemblyData.profiles,
      disassemblyProfessionOptions: professionService.getOptions(),
      selectedDisassemblyProfile: disassemblyData.selectedProfile,
      selectedDisassemblyActorName: selectedActor?.name ?? "",
      selectedDisassemblyActorProfession,
      selectedDisassemblyActorProfessionSummary,
      selectedActorName: selectedActor?.name ?? "",
      selectedActorProfessions,
      selectedActorProfessionSummary: this.getActorProfessionSummary(selectedActorProfessions),
    };
  }

  async _onRender(context: object, options: object): Promise<void> {
    await super._onRender(context, options);

    this.syncForagingBiomeSelects();
    this.syncRecipeProfessionSelects();
    this.syncRecipeQualityEffectSelects();
    this.syncToolRequirementSelects();
    this.syncForagingProfessionSelects();
    this.syncHarvestCreatureTypeSelects();
    this.syncHarvestProfessionSelects();
    this.syncHarvestOutputModeSelects();
    this.syncDisassemblyProfessionSelects();
    this.syncHarvestRaritySelects();

    this.activateRecipeEditorListeners();
    this.restorePendingScrollState();
  }

  private syncForagingBiomeSelects(): void {
    const element = this.getRootElement();

    if (!element) {
      return;
    }

    const current = element.querySelector<HTMLInputElement>(
      "[data-artisan-foraging-biome-current]",
    );

    const select = element.querySelector<HTMLSelectElement>(
      'select[data-artisan-foraging-field="biome"]',
    );

    if (!current || !select) {
      return;
    }

    select.value = current.value || "foresta";
  }

  private syncRecipeProfessionSelects(): void {
    const element = this.getRootElement();

    if (!element) {
      return;
    }

    const current = element.querySelector<HTMLInputElement>(
      "[data-artisan-recipe-profession-current]",
    );

    const select = element.querySelector<HTMLSelectElement>(
      'select[data-artisan-field="profile"]',
    );

    if (!current || !select) {
      return;
    }

    select.value = current.value
      ? current.value.trim().toLowerCase()
      : "erborista";
  }


  private syncRecipeQualityEffectSelects(): void {
    const element = this.getRootElement();

    if (!element) {
      return;
    }

    const selects = element.querySelectorAll<HTMLSelectElement>(
      "select[data-artisan-quality-effect-select]",
    );

    for (const select of Array.from(selects)) {
      select.value = select.dataset.currentEffect || "auto";
    }
  }


  private syncToolRequirementSelects(): void {
    const element = this.getRootElement();

    if (!element) {
      return;
    }

    const selects = element.querySelectorAll<HTMLSelectElement>(
      "select[data-artisan-tool-requirement-select]",
    );

    for (const select of Array.from(selects)) {
      select.value = select.dataset.currentRequirement === "required" ? "required" : "optional";
    }
  }

  private syncForagingProfessionSelects(): void {
    const element = this.getRootElement();

    if (!element) {
      return;
    }

    const current = element.querySelector<HTMLInputElement>(
      "[data-artisan-foraging-profession-current]",
    );

    const select = element.querySelector<HTMLSelectElement>(
      'select[data-artisan-foraging-field="profession"]',
    );

    if (!current || !select) {
      return;
    }

    select.value = current.value
      ? current.value.trim().toLowerCase()
      : "erborista";
  }


  private syncHarvestCreatureTypeSelects(): void {
    const element = this.getRootElement();

    if (!element) {
      return;
    }

    const current = element.querySelector<HTMLInputElement>(
      "[data-artisan-harvest-creature-type-current]",
    );

    const select = element.querySelector<HTMLSelectElement>(
      'select[data-artisan-harvest-field="creatureType"]',
    );

    if (!current || !select) {
      return;
    }

    select.value = current.value || "beast";
  }

  private syncHarvestProfessionSelects(): void {
    const element = this.getRootElement();

    if (!element) {
      return;
    }

    const current = element.querySelector<HTMLInputElement>(
      "[data-artisan-harvest-profession-current]",
    );

    const select = element.querySelector<HTMLSelectElement>(
      'select[data-artisan-harvest-field="profession"]',
    );

    if (!current || !select) {
      return;
    }

    select.value = current.value
      ? current.value.trim().toLowerCase()
      : "cacciatore";
  }



  private syncHarvestOutputModeSelects(): void {
    const element = this.getRootElement();

    if (!element) {
      return;
    }

    const current = element.querySelector<HTMLInputElement>(
      "[data-artisan-harvest-output-mode-current]",
    );

    const select = element.querySelector<HTMLSelectElement>(
      'select[data-artisan-harvest-field="harvestOutputMode"]',
    );

    if (!current || !select) {
      return;
    }

    select.value = current.value || "random";
  }

  private syncHarvestRaritySelects(): void {
    const element = this.getRootElement();

    if (!element) {
      return;
    }

    const selects = element.querySelectorAll<HTMLSelectElement>(
      "select[data-artisan-harvest-rarity-select], select[data-artisan-foraging-rarity-select], select[data-artisan-disassembly-rarity-select]",
    );

    for (const select of Array.from(selects)) {
      select.value = select.dataset.currentRarity || "common";
    }
  }


  private syncDisassemblyProfessionSelects(): void {
    const element = this.getRootElement();

    if (!element) {
      return;
    }

    const current = element.querySelector<HTMLInputElement>(
      "[data-artisan-disassembly-profession-current]",
    );

    const select = element.querySelector<HTMLSelectElement>(
      'select[data-artisan-disassembly-field="profession"]',
    );

    if (!current || !select) {
      return;
    }

    select.value = current.value
      ? current.value.trim().toLowerCase()
      : "conciatore";
  }

  private activateRecipeEditorListeners(): void {
    const element = this.getRootElement();

    if (!element) {
      console.warn("Artisan | Root element non trovato.");
      return;
    }

    if (element.dataset.artisanListenersBound === "true") {
      return;
    }

    element.dataset.artisanListenersBound = "true";

    element.addEventListener("change", (event) => {
      const target = event.target;

      if (
        !(target instanceof HTMLInputElement) &&
        !(target instanceof HTMLSelectElement)
      ) {
        return;
      }

      if (target.matches("[data-artisan-recipe-filter]")) {
        this.onRecipeFilterChanged(target);
        return;
      }

      if (target.matches("[data-artisan-field]")) {
        void this.onRecipeFieldChanged(target);
        return;
      }

      if (
        target instanceof HTMLInputElement &&
        target.matches("[data-artisan-component-row-quantity]")
      ) {
        void this.onComponentQuantityChanged(target);
        return;
      }

      if (target.matches("[data-artisan-foraging-field]")) {
        void this.onForagingFieldChanged(target);
        return;
      }

      if (target.matches("[data-artisan-foraging-component-field]")) {
        void this.onForagingComponentFieldChanged(target);
        return;
      }

      if (target.matches("[data-artisan-harvest-field]")) {
        void this.onHarvestFieldChanged(target);
        return;
      }

      if (target.matches("[data-artisan-harvest-component-field]")) {
        void this.onHarvestComponentFieldChanged(target);
        return;
      }

      if (target.matches("[data-artisan-disassembly-field]")) {
        void this.onDisassemblyFieldChanged(target);
        return;
      }

      if (target.matches("[data-artisan-disassembly-component-field]")) {
        void this.onDisassemblyComponentFieldChanged(target);
        return;
      }

      if (
        target instanceof HTMLInputElement &&
        target.matches("[data-artisan-actor-profession-field]")
      ) {
        void this.onActorProfessionFieldChanged(target);
        return;
      }

      if (target.matches("[data-artisan-setting-field]")) {
        void this.onArtisanSettingChanged(target);
        return;
      }

      if (
        target instanceof HTMLInputElement &&
        target.matches("[data-artisan-import-recipes-file]")
      ) {
        void this.onImportRecipesFileChanged(target);
        return;
      }

      if (
        target instanceof HTMLInputElement &&
        target.matches("[data-artisan-import-backup-file]")
      ) {
        void this.onImportBackupFileChanged(target);
        return;
      }

      if (
        target instanceof HTMLInputElement &&
        target.matches("[data-artisan-import-foraging-file]")
      ) {
        void this.onImportForagingFileChanged(target);
        return;
      }

      if (
        target instanceof HTMLInputElement &&
        target.matches("[data-artisan-import-harvest-file]")
      ) {
        void this.onImportHarvestFileChanged(target);
        return;
      }

      if (
        target instanceof HTMLInputElement &&
        target.matches("[data-artisan-import-disassembly-file]")
      ) {
        void this.onImportDisassemblyFileChanged(target);
        return;
      }
    });

    element.addEventListener("input", (event) => {
      const target = event.target;

      if (!(target instanceof HTMLInputElement)) {
        return;
      }

      if (target.matches("[data-artisan-recipe-filter]")) {
        this.onRecipeFilterChanged(target);
      }
    });

    element.addEventListener("click", (event) => {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      const sectionToggleButton = target.closest<HTMLElement>(
        "[data-artisan-toggle-explorer-section]",
      );
      if (sectionToggleButton) {
        event.preventDefault();
        this.onToggleExplorerSectionClicked(sectionToggleButton);
        return;
      }

      const sectionButton = target.closest<HTMLElement>(
        "[data-artisan-select-section]",
      );
      if (sectionButton) {
        event.preventDefault();
        this.onSelectSectionClicked(sectionButton);
        return;
      }

      const newRecipeButton = target.closest<HTMLElement>(
        "[data-artisan-new-recipe]",
      );
      if (newRecipeButton) {
        event.preventDefault();
        void this.onNewRecipeClicked();
        return;
      }

      const exportAllRecipesButton = target.closest<HTMLElement>(
        "[data-artisan-export-all-recipes]",
      );
      if (exportAllRecipesButton) {
        event.preventDefault();
        this.onExportAllRecipesClicked();
        return;
      }

      const importRecipesButton = target.closest<HTMLElement>(
        "[data-artisan-import-recipes]",
      );
      if (importRecipesButton) {
        event.preventDefault();
        this.onImportRecipesClicked();
        return;
      }

      const exportBackupButton = target.closest<HTMLElement>(
        "[data-artisan-export-backup]",
      );
      if (exportBackupButton) {
        event.preventDefault();
        this.onExportBackupClicked();
        return;
      }

      const importBackupButton = target.closest<HTMLElement>(
        "[data-artisan-import-backup]",
      );
      if (importBackupButton) {
        event.preventDefault();
        this.onImportBackupClicked();
        return;
      }

      const refreshActivityButton = target.closest<HTMLElement>(
        "[data-artisan-refresh-activity]",
      );
      if (refreshActivityButton) {
        event.preventDefault();
        this.renderPreservingUiState();
        return;
      }

      const exportActivityButton = target.closest<HTMLElement>(
        "[data-artisan-export-activity]",
      );
      if (exportActivityButton) {
        event.preventDefault();
        this.onExportActivityClicked();
        return;
      }

      const clearActivityButton = target.closest<HTMLElement>(
        "[data-artisan-clear-activity]",
      );
      if (clearActivityButton) {
        event.preventDefault();
        void this.onClearActivityClicked();
        return;
      }

      const resetSettingsButton = target.closest<HTMLElement>(
        "[data-artisan-reset-settings]",
      );
      if (resetSettingsButton) {
        event.preventDefault();
        void this.onResetArtisanSettingsClicked();
        return;
      }

      const installPresetPackageButton = target.closest<HTMLElement>(
        "[data-artisan-install-preset-package]",
      );
      if (installPresetPackageButton) {
        event.preventDefault();
        void this.onInstallPresetPackageClicked(installPresetPackageButton);
        return;
      }

      const installAllPresetPackagesButton = target.closest<HTMLElement>(
        "[data-artisan-install-all-preset-packages]",
      );
      if (installAllPresetPackagesButton) {
        event.preventDefault();
        void this.onInstallAllPresetPackagesClicked();
        return;
      }

      const resetRecipeFiltersButton = target.closest<HTMLElement>(
        "[data-artisan-reset-recipe-filters]",
      );
      if (resetRecipeFiltersButton) {
        event.preventDefault();
        this.onResetRecipeFiltersClicked();
        return;
      }

      const rollCraftingButton = target.closest<HTMLElement>(
        "[data-artisan-roll-crafting]",
      );
      if (rollCraftingButton) {
        event.preventDefault();
        void this.onRollCraftingClicked(rollCraftingButton);
        return;
      }

      const previewCraftingButton = target.closest<HTMLElement>(
        "[data-artisan-preview-crafting]",
      );
      if (previewCraftingButton) {
        event.preventDefault();
        void this.onPreviewCraftingClicked(previewCraftingButton);
        return;
      }

      const validateRecipeButton = target.closest<HTMLElement>(
        "[data-artisan-validate-recipe]",
      );
      if (validateRecipeButton) {
        event.preventDefault();
        void this.onValidateRecipeClicked(validateRecipeButton);
        return;
      }

      const exportRecipeButton = target.closest<HTMLElement>(
        "[data-artisan-export-recipe]",
      );
      if (exportRecipeButton) {
        event.preventDefault();
        this.onExportRecipeClicked(exportRecipeButton);
        return;
      }

      const duplicateRecipeButton = target.closest<HTMLElement>(
        "[data-artisan-duplicate-recipe]",
      );
      if (duplicateRecipeButton) {
        event.preventDefault();
        void this.onDuplicateRecipeClicked(duplicateRecipeButton);
        return;
      }

      const selectRecipeButton = target.closest<HTMLElement>(
        "[data-artisan-select-recipe]",
      );
      if (selectRecipeButton) {
        event.preventDefault();
        this.onSelectRecipeClicked(selectRecipeButton);
        return;
      }

      const addComponentButton = target.closest<HTMLElement>(
        "[data-artisan-add-component]",
      );
      if (addComponentButton) {
        event.preventDefault();
        void this.onAddComponentClicked(addComponentButton);
        return;
      }

      const openComponentButton = target.closest<HTMLElement>(
        "[data-artisan-open-component]",
      );
      if (openComponentButton) {
        event.preventDefault();
        void this.onOpenComponentClicked(openComponentButton);
        return;
      }

      const removeComponentButton = target.closest<HTMLElement>(
        "[data-artisan-remove-component]",
      );
      if (removeComponentButton) {
        event.preventDefault();
        void this.onRemoveComponentClicked(removeComponentButton);
        return;
      }

      const newForagingProfileButton = target.closest<HTMLElement>(
        "[data-artisan-new-foraging-profile]",
      );
      if (newForagingProfileButton) {
        event.preventDefault();
        void this.onNewForagingProfileClicked();
        return;
      }

      const selectForagingProfileButton = target.closest<HTMLElement>(
        "[data-artisan-select-foraging-profile]",
      );
      if (selectForagingProfileButton) {
        event.preventDefault();
        this.onSelectForagingProfileClicked(selectForagingProfileButton);
        return;
      }

      const deleteForagingProfileButton = target.closest<HTMLElement>(
        "[data-artisan-delete-foraging-profile]",
      );
      if (deleteForagingProfileButton) {
        event.preventDefault();
        void this.onDeleteForagingProfileClicked(deleteForagingProfileButton);
        return;
      }

      const addForagingComponentButton = target.closest<HTMLElement>(
        "[data-artisan-foraging-add-component]",
      );
      if (addForagingComponentButton) {
        event.preventDefault();
        void this.onAddForagingComponentClicked(addForagingComponentButton);
        return;
      }

      const removeForagingComponentButton = target.closest<HTMLElement>(
        "[data-artisan-foraging-remove-component]",
      );
      if (removeForagingComponentButton) {
        event.preventDefault();
        void this.onRemoveForagingComponentClicked(
          removeForagingComponentButton,
        );
        return;
      }

      const saveActorProfessionButton = target.closest<HTMLElement>(
        "[data-artisan-save-actor-profession]",
      );
      if (saveActorProfessionButton) {
        event.preventDefault();
        void this.onSaveActorProfessionClicked(saveActorProfessionButton);
        return;
      }

      const startForagingButton = target.closest<HTMLElement>(
        "[data-artisan-start-foraging]",
      );
      if (startForagingButton) {
        event.preventDefault();
        void this.onStartForagingClicked(startForagingButton);
        return;
      }

      const exportForagingButton = target.closest<HTMLElement>(
        "[data-artisan-export-foraging]",
      );
      if (exportForagingButton) {
        event.preventDefault();
        this.onExportForagingClicked();
        return;
      }

      const importForagingButton = target.closest<HTMLElement>(
        "[data-artisan-import-foraging]",
      );
      if (importForagingButton) {
        event.preventDefault();
        this.onImportForagingClicked();
        return;
      }

      const newHarvestProfileButton = target.closest<HTMLElement>(
        "[data-artisan-new-harvest-profile]",
      );
      if (newHarvestProfileButton) {
        event.preventDefault();
        void this.onNewHarvestProfileClicked();
        return;
      }

      const selectHarvestProfileButton = target.closest<HTMLElement>(
        "[data-artisan-select-harvest-profile]",
      );
      if (selectHarvestProfileButton) {
        event.preventDefault();
        this.onSelectHarvestProfileClicked(selectHarvestProfileButton);
        return;
      }

      const deleteHarvestProfileButton = target.closest<HTMLElement>(
        "[data-artisan-delete-harvest-profile]",
      );
      if (deleteHarvestProfileButton) {
        event.preventDefault();
        void this.onDeleteHarvestProfileClicked(deleteHarvestProfileButton);
        return;
      }

      const addHarvestComponentButton = target.closest<HTMLElement>(
        "[data-artisan-harvest-add-component]",
      );
      if (addHarvestComponentButton) {
        event.preventDefault();
        void this.onAddHarvestComponentClicked(addHarvestComponentButton);
        return;
      }

      const removeHarvestComponentButton = target.closest<HTMLElement>(
        "[data-artisan-harvest-remove-component]",
      );
      if (removeHarvestComponentButton) {
        event.preventDefault();
        void this.onRemoveHarvestComponentClicked(removeHarvestComponentButton);
        return;
      }

      const startHarvestButton = target.closest<HTMLElement>(
        "[data-artisan-start-harvest]",
      );
      if (startHarvestButton) {
        event.preventDefault();
        void this.onStartHarvestClicked(startHarvestButton);
        return;
      }

      const exportHarvestButton = target.closest<HTMLElement>(
        "[data-artisan-export-harvest]",
      );
      if (exportHarvestButton) {
        event.preventDefault();
        this.onExportHarvestClicked();
        return;
      }

      const importHarvestButton = target.closest<HTMLElement>(
        "[data-artisan-import-harvest]",
      );
      if (importHarvestButton) {
        event.preventDefault();
        this.onImportHarvestClicked();
        return;
      }


      const newDisassemblyProfileButton = target.closest<HTMLElement>(
        "[data-artisan-new-disassembly-profile]",
      );
      if (newDisassemblyProfileButton) {
        event.preventDefault();
        void this.onNewDisassemblyProfileClicked();
        return;
      }

      const selectDisassemblyProfileButton = target.closest<HTMLElement>(
        "[data-artisan-select-disassembly-profile]",
      );
      if (selectDisassemblyProfileButton) {
        event.preventDefault();
        this.onSelectDisassemblyProfileClicked(selectDisassemblyProfileButton);
        return;
      }

      const deleteDisassemblyProfileButton = target.closest<HTMLElement>(
        "[data-artisan-delete-disassembly-profile]",
      );
      if (deleteDisassemblyProfileButton) {
        event.preventDefault();
        void this.onDeleteDisassemblyProfileClicked(deleteDisassemblyProfileButton);
        return;
      }

      const addDisassemblyComponentButton = target.closest<HTMLElement>(
        "[data-artisan-disassembly-add-component]",
      );
      if (addDisassemblyComponentButton) {
        event.preventDefault();
        void this.onAddDisassemblyComponentClicked(addDisassemblyComponentButton);
        return;
      }

      const removeDisassemblyComponentButton = target.closest<HTMLElement>(
        "[data-artisan-disassembly-remove-component]",
      );
      if (removeDisassemblyComponentButton) {
        event.preventDefault();
        void this.onRemoveDisassemblyComponentClicked(removeDisassemblyComponentButton);
        return;
      }

      const startDisassemblyButton = target.closest<HTMLElement>(
        "[data-artisan-start-disassembly]",
      );
      if (startDisassemblyButton) {
        event.preventDefault();
        void this.onStartDisassemblyClicked(startDisassemblyButton);
        return;
      }

      const exportDisassemblyButton = target.closest<HTMLElement>(
        "[data-artisan-export-disassembly]",
      );
      if (exportDisassemblyButton) {
        event.preventDefault();
        this.onExportDisassemblyClicked();
        return;
      }

      const importDisassemblyButton = target.closest<HTMLElement>(
        "[data-artisan-import-disassembly]",
      );
      if (importDisassemblyButton) {
        event.preventDefault();
        this.onImportDisassemblyClicked();
        return;
      }

      const professionXpButton = target.closest<HTMLElement>(
        "[data-artisan-profession-xp-action]",
      );
      if (professionXpButton) {
        event.preventDefault();
        void this.onProfessionXpActionClicked(professionXpButton);
        return;
      }

      const refreshActorProfessionsButton = target.closest<HTMLElement>(
        "[data-artisan-refresh-actor-professions]",
      );
      if (refreshActorProfessionsButton) {
        event.preventDefault();
        this.renderPreservingUiState();
        return;
      }
    });

    element.addEventListener("dragover", (event) => {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      const dropZone = target.closest<HTMLElement>(
        "[data-artisan-drop-zone], [data-artisan-foraging-drop-zone], [data-artisan-harvest-drop-zone], [data-artisan-disassembly-drop-zone], [data-artisan-disassembly-source-drop-zone]",
      );

      if (!dropZone) {
        return;
      }

      event.preventDefault();

      dropZone.classList.add("is-drag-over");
    });

    element.addEventListener("dragleave", (event) => {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      const dropZone = target.closest<HTMLElement>(
        "[data-artisan-drop-zone], [data-artisan-foraging-drop-zone], [data-artisan-harvest-drop-zone], [data-artisan-disassembly-drop-zone], [data-artisan-disassembly-source-drop-zone]",
      );

      if (!dropZone) {
        return;
      }

      dropZone.classList.remove("is-drag-over");
    });

    element.addEventListener("drop", (event) => {
      const target = event.target;

      if (!(target instanceof HTMLElement)) {
        return;
      }

      const recipeDropZone = target.closest<HTMLElement>(
        "[data-artisan-drop-zone]",
      );
      if (recipeDropZone) {
        event.preventDefault();
        recipeDropZone.classList.remove("is-drag-over");
        void this.onComponentDropped(event as DragEvent, recipeDropZone);
        return;
      }

      const foragingDropZone = target.closest<HTMLElement>(
        "[data-artisan-foraging-drop-zone]",
      );
      if (foragingDropZone) {
        event.preventDefault();
        foragingDropZone.classList.remove("is-drag-over");
        void this.onForagingComponentDropped(
          event as DragEvent,
          foragingDropZone,
        );
        return;
      }

      const harvestDropZone = target.closest<HTMLElement>(
        "[data-artisan-harvest-drop-zone]",
      );
      if (harvestDropZone) {
        event.preventDefault();
        harvestDropZone.classList.remove("is-drag-over");
        void this.onHarvestComponentDropped(
          event as DragEvent,
          harvestDropZone,
        );
        return;
      }


      const disassemblySourceDropZone = target.closest<HTMLElement>(
        "[data-artisan-disassembly-source-drop-zone]",
      );
      if (disassemblySourceDropZone) {
        event.preventDefault();
        disassemblySourceDropZone.classList.remove("is-drag-over");
        void this.onDisassemblySourceDropped(
          event as DragEvent,
          disassemblySourceDropZone,
        );
        return;
      }

      const disassemblyDropZone = target.closest<HTMLElement>(
        "[data-artisan-disassembly-drop-zone]",
      );
      if (disassemblyDropZone) {
        event.preventDefault();
        disassemblyDropZone.classList.remove("is-drag-over");
        void this.onDisassemblyComponentDropped(
          event as DragEvent,
          disassemblyDropZone,
        );
        return;
      }
    });
  }


  private getActorProfessionInlineSummary(actor: Actor | null, profession: any, multiplierLabel: string): string {
    if (!actor || !profession) {
      return game.i18n.localize("ARTISAN.SelectActorForProfessionRead");
    }

    return game.i18n.format("ARTISAN.ActorProfessionInlineSummary", {
      actor: actor.name ?? game.i18n.localize("ARTISAN.Actor"),
      level: profession.level ?? 0,
      xp: profession.xp ?? 0,
      next: profession.xpToNextLevel ?? 0,
      multiplierLabel,
      multiplier: profession.gatheringMultiplierLabel ?? "x1"
    });
  }


  private getPresetPackages(): any[] {
    return [
      {
        id: "foraging-base",
        icon: "fa-solid fa-leaf",
        title: game.i18n.localize("ARTISAN.PresetForagingBaseTitle"),
        subtitle: game.i18n.localize("ARTISAN.PresetForagingBaseSubtitle"),
        description: game.i18n.localize("ARTISAN.PresetForagingBaseDescription"),
        entries: 6,
      },
      {
        id: "harvest-base",
        icon: "fa-solid fa-paw",
        title: game.i18n.localize("ARTISAN.PresetHarvestBaseTitle"),
        subtitle: game.i18n.localize("ARTISAN.PresetHarvestBaseSubtitle"),
        description: game.i18n.localize("ARTISAN.PresetHarvestBaseDescription"),
        entries: 5,
      },
      {
        id: "recipe-templates",
        icon: "fa-solid fa-book-open",
        title: game.i18n.localize("ARTISAN.PresetRecipeTemplatesTitle"),
        subtitle: game.i18n.localize("ARTISAN.PresetRecipeTemplatesSubtitle"),
        description: game.i18n.localize("ARTISAN.PresetRecipeTemplatesDescription"),
        entries: 6,
      },
    ];
  }

  private async onInstallAllPresetPackagesClicked(): Promise<void> {
    let imported = 0;
    let skipped = 0;

    for (const preset of this.getPresetPackages()) {
      const result = await this.installPresetPackage(String(preset.id));
      imported += result.imported;
      skipped += result.skipped;
    }

    ui.notifications.info(`${game.i18n.localize("ARTISAN.PresetInstalledAllNotice")} ${game.i18n.localize("ARTISAN.Created")}: ${imported}, ${game.i18n.localize("ARTISAN.Skipped")}: ${skipped}.`);
    await this.addActivityLogEntry(
      "import",
      game.i18n.localize("ARTISAN.PresetsInstalledTitle"),
      `${game.i18n.localize("ARTISAN.PresetsInstalledMessage")} ${game.i18n.localize("ARTISAN.Created")}: ${imported}, ${game.i18n.localize("ARTISAN.Skipped")}: ${skipped}.`,
    );
    this.renderPreservingUiState();
  }

  private async onInstallPresetPackageClicked(target: HTMLElement): Promise<void> {
    const presetId = target.dataset.presetId;

    if (!presetId) {
      return;
    }

    const result = await this.installPresetPackage(presetId);
    ui.notifications.info(`${game.i18n.localize("ARTISAN.PresetInstalledNotice")} ${game.i18n.localize("ARTISAN.Created")}: ${result.imported}, ${game.i18n.localize("ARTISAN.Skipped")}: ${result.skipped}.`);
    this.renderPreservingUiState();
  }

  private async installPresetPackage(presetId: string): Promise<{ imported: number; skipped: number }> {
    if (presetId === "foraging-base") {
      const service = new ForagingService();
      const result = await service.importProfiles({ profiles: this.getForagingPresetProfiles() });

      await this.addActivityLogEntry(
        "import",
        "Pacchetto Raccolta base",
        `Liste di raccolta create ${result.imported}, saltate ${result.skipped}.`,
      );

      return result;
    }

    if (presetId === "harvest-base") {
      const service = new HarvestService();
      const result = await service.importProfiles({ profiles: this.getHarvestPresetProfiles() });

      await this.addActivityLogEntry(
        "import",
        "Pacchetto Caccia base",
        `Liste di caccia create ${result.imported}, saltate ${result.skipped}.`,
      );

      return result;
    }

    if (presetId === "recipe-templates") {
      const result = await this.createRecipeTemplatePresets();

      await this.addActivityLogEntry(
        "import",
        "Template ricette base",
        `Ricette template create ${result.imported}, saltate ${result.skipped}.`,
      );

      return result;
    }

    ui.notifications.warn("Pacchetto Artisan non riconosciuto.");
    return { imported: 0, skipped: 0 };
  }

  private getForagingPresetProfiles(): any[] {
    return [
      { name: "Raccolta — Foresta", biome: "foresta", profession: "erborista", skill: "nature", dc: 12, time: 1, maxResources: 3, resources: [], tools: [] },
      { name: "Raccolta — Montagna", biome: "montagna", profession: "minatore", skill: "athletics", dc: 14, time: 1.5, maxResources: 3, resources: [], tools: [] },
      { name: "Raccolta — Palude", biome: "palude", profession: "erborista", skill: "nature", dc: 15, time: 1.5, maxResources: 3, resources: [], tools: [] },
      { name: "Raccolta — Costa", biome: "costa", profession: "cacciatore", skill: "survival", dc: 12, time: 1, maxResources: 3, resources: [], tools: [] },
      { name: "Raccolta — Caverna", biome: "caverna", profession: "minatore", skill: "perception", dc: 15, time: 2, maxResources: 2, resources: [], tools: [] },
      { name: "Raccolta — Deserto", biome: "deserto", profession: "cacciatore", skill: "survival", dc: 16, time: 2, maxResources: 2, resources: [], tools: [] },
    ];
  }

  private getHarvestPresetProfiles(): any[] {
    return [
      { name: "Caccia — Bestie", creatureType: "beast", profession: "cacciatore", skill: "survival", dc: 12, time: 0.5, maxResources: 3, toolRequirement: "optional", toolCriticalDamage: false, resources: [], tools: [] },
      { name: "Caccia — Draghi", creatureType: "dragon", profession: "conciatore", skill: "survival", dc: 18, time: 2, maxResources: 3, toolRequirement: "required", toolCriticalDamage: true, resources: [], tools: [] },
      { name: "Caccia — Non morti", creatureType: "undead", profession: "alchimista", skill: "arcana", dc: 15, time: 1, maxResources: 2, toolRequirement: "optional", toolCriticalDamage: false, resources: [], tools: [] },
      { name: "Caccia — Mostruosità", creatureType: "monstrosity", profession: "cacciatore", skill: "survival", dc: 16, time: 1.5, maxResources: 3, toolRequirement: "optional", toolCriticalDamage: false, resources: [], tools: [] },
      { name: "Caccia — Vegetali", creatureType: "plant", profession: "erborista", skill: "nature", dc: 13, time: 0.75, maxResources: 3, toolRequirement: "optional", toolCriticalDamage: false, resources: [], tools: [] },
    ];
  }

  private async createRecipeTemplatePresets(): Promise<{ imported: number; skipped: number }> {
    const recipeService = new RecipeService();
    const existingNames = new Set(recipeService.getRecipes().map(item => item.name.trim().toLowerCase()));
    const templates = this.getRecipePresetTemplates();

    let imported = 0;
    let skipped = 0;

    for (const template of templates) {
      const duplicateKey = String(template.name).trim().toLowerCase();

      if (existingNames.has(duplicateKey)) {
        skipped += 1;
        continue;
      }

      const item = await recipeService.createRecipe();
      await recipeService.updateRecipeName(item.id, template.name);
      await recipeService.updateRecipeData(item.id, {
        category: template.category,
        profile: template.profession,
        profession: template.profession,
        professionLevel: template.professionLevel,
        requiredProfessionLevel: template.professionLevel,
        skill: template.skill,
        dc: template.dc,
        craftingTime: template.time,
        time: template.time,
        ingredients: [],
        tools: [],
        outputs: [],
      } as any);

      existingNames.add(duplicateKey);
      imported += 1;
    }

    return { imported, skipped };
  }

  private getRecipePresetTemplates(): any[] {
    return [
      { name: "Template — Pozione alchemica", category: "Alchimia", profession: "alchimista", professionLevel: 1, skill: "arcana", dc: 12, time: 1, craftingXp: 25, qualityBonusGood: 1, qualityBonusSuperior: 2, qualityBonusExcellent: 3, qualityDiceGood: "", qualityDiceSuperior: "1d4", qualityDiceExcellent: "1d6", qualityEffectGood: "healing", qualityEffectSuperior: "healing", qualityEffectExcellent: "healing" },
      { name: "Template — Arma semplice", category: "Forgiatura", profession: "fabbro", professionLevel: 1, skill: "athletics", dc: 12, time: 2, craftingXp: 10 },
      { name: "Template — Armatura rinforzata", category: "Forgiatura", profession: "fabbro", professionLevel: 2, skill: "athletics", dc: 15, time: 4, craftingXp: 20 },
      { name: "Template — Pasto da viaggio", category: "Cucina", profession: "cuoco", professionLevel: 0, skill: "survival", dc: 10, time: 0.5, craftingXp: 3 },
      { name: "Template — Preparato erboristico", category: "Erboristeria", profession: "erborista", professionLevel: 1, skill: "nature", dc: 12, time: 0.75, craftingXp: 8 },
      { name: "Template — Pelle lavorata", category: "Conciatura", profession: "conciatore", professionLevel: 1, skill: "survival", dc: 12, time: 1.5, craftingXp: 8 },
      { name: "Template — Attrezzo semplice", category: "Artigianato", profession: "artigiano", professionLevel: 0, skill: "sleightOfHand", dc: 10, time: 1, craftingXp: 5 },
      { name: "Template — Abito rinforzato", category: "Sartoria", profession: "sarto", professionLevel: 1, skill: "sleightOfHand", dc: 12, time: 1.5, craftingXp: 8 },
    ];
  }


  private getActorProfessionSummary(professions: any[]): any {
    const entries = Array.isArray(professions) ? professions : [];
    const trained = entries.filter((profession: any) => Number(profession.level ?? 0) > 0);
    const totalXp = entries.reduce((total: number, profession: any) => {
      return total + Math.max(0, Number(profession.xp ?? 0));
    }, 0);

    const highest = entries.reduce((best: any | null, profession: any) => {
      if (!best) {
        return profession;
      }

      const currentLevel = Number(profession.level ?? 0);
      const bestLevel = Number(best.level ?? 0);

      if (currentLevel > bestLevel) {
        return profession;
      }

      if (currentLevel === bestLevel && Number(profession.xp ?? 0) > Number(best.xp ?? 0)) {
        return profession;
      }

      return best;
    }, null);

    const next = entries
      .filter((profession: any) => Number(profession.xpToNextLevel ?? 0) > 0)
      .sort((a: any, b: any) => Number(a.xpToNextLevel ?? 0) - Number(b.xpToNextLevel ?? 0))[0] ?? null;

    const maxed = entries.filter((profession: any) => Number(profession.level ?? 0) >= Number(profession.maxLevel ?? 5));

    return {
      count: entries.length,
      trainedCount: trained.length,
      maxedCount: maxed.length,
      totalXp,
      highestLabel: highest ? String(highest.label ?? "Nessuna") : "Nessuna",
      highestLevel: highest ? Number(highest.level ?? 0) : 0,
      nextLabel: next ? String(next.label ?? "Nessuna") : "Tutte al massimo",
      nextXpToLevel: next ? Number(next.xpToNextLevel ?? 0) : 0,
    };
  }

  private async onProfessionXpActionClicked(target: HTMLElement): Promise<void> {
    const actor = canvas?.tokens?.controlled?.[0]?.actor ?? null;

    if (!actor) {
      ui.notifications.warn("Seleziona un token con attore per modificare le professioni del PG.");
      return;
    }

    const professionId = target.dataset.professionId;
    const action = target.dataset.action;

    if (!professionId || !action) {
      return;
    }

    const professionService = new ProfessionService();
    const current = professionService.getActorProfession(actor, professionId);
    let nextXp = Math.max(0, Number(current.xp ?? 0));

    if (action === "add10") {
      nextXp += 10;
    } else if (action === "add50") {
      nextXp += 50;
    } else if (action === "reset") {
      nextXp = 0;
    } else if (action === "next") {
      const targetXp = Number(current.xpForNextLevel ?? 0);

      if (targetXp <= 0) {
        ui.notifications.info(game.i18n.localize("ARTISAN.ProfessionAlreadyMaxLevel"));
        return;
      }

      nextXp = Math.max(nextXp, targetXp);
    } else {
      return;
    }

    const nextLevel = professionService.getLevelFromXp(nextXp, current.maxLevel);

    await professionService.setActorProfession(actor, professionId, nextLevel, nextXp);

    this.renderPreservingUiState();
  }

  private getDefaultArtisanSettings(): Record<string, boolean> {
    return {
      enableProfessionXp: true,
      enableOutputQuality: true,
      enableToolDamage: true,
      enableToolDamageCrafting: true,
      enableToolDamageForaging: true,
      enableToolDamageHarvest: true,
      enableToolDamageDisassembly: true,
      enableActivityLog: true,
    };
  }

  private ensureArtisanSettingsSetting(): void {
    const settings = (game.settings as any).settings;

    if (settings?.has?.("artisan.moduleSettings")) {
      return;
    }

    game.settings.register("artisan", "moduleSettings", {
      name: "ARTISAN.ArtisanSettings",
      scope: "world",
      config: false,
      type: Object,
      default: this.getDefaultArtisanSettings(),
    });
  }

  private getArtisanSettings(): Record<string, boolean> {
    this.ensureArtisanSettingsSetting();

    const current = game.settings.get("artisan", "moduleSettings") as any;

    return {
      ...this.getDefaultArtisanSettings(),
      ...(current && typeof current === "object" ? current : {}),
    };
  }

  private getArtisanSettingsView(): any[] {
    const settings = this.getArtisanSettings();

    return [
      {
        key: "enableProfessionXp",
        label: game.i18n.localize("ARTISAN.ProfessionXp"),
        description: game.i18n.localize("ARTISAN.SettingProfessionXpDescription"),
        checked: settings.enableProfessionXp,
      },
      {
        key: "enableOutputQuality",
        label: game.i18n.localize("ARTISAN.CraftingOutputQuality"),
        description: game.i18n.localize("ARTISAN.SettingOutputQualityDescription"),
        checked: settings.enableOutputQuality,
      },
      {
        key: "enableToolDamageCrafting",
        label: game.i18n.localize("ARTISAN.ToolDamageCrafting"),
        description: game.i18n.localize("ARTISAN.SettingToolDamageCraftingDescription"),
        checked: settings.enableToolDamageCrafting,
      },
      {
        key: "enableToolDamageForaging",
        label: game.i18n.localize("ARTISAN.ToolDamageForaging"),
        description: game.i18n.localize("ARTISAN.SettingToolDamageForagingDescription"),
        checked: settings.enableToolDamageForaging,
      },
      {
        key: "enableToolDamageHarvest",
        label: game.i18n.localize("ARTISAN.ToolDamageHarvest"),
        description: game.i18n.localize("ARTISAN.SettingToolDamageHarvestDescription"),
        checked: settings.enableToolDamageHarvest,
      },
      {
        key: "enableToolDamageDisassembly",
        label: game.i18n.localize("ARTISAN.ToolDamageDisassembly"),
        description: game.i18n.localize("ARTISAN.SettingToolDamageDisassemblyDescription"),
        checked: settings.enableToolDamageDisassembly,
      },
      {
        key: "enableActivityLog",
        label: game.i18n.localize("ARTISAN.ActivityLog"),
        description: game.i18n.localize("ARTISAN.SettingActivityLogDescription"),
        checked: settings.enableActivityLog,
      },
    ];
  }

  private async onArtisanSettingChanged(target: HTMLInputElement | HTMLSelectElement): Promise<void> {
    const key = target.dataset.artisanSettingKey;

    if (!key) {
      return;
    }

    const current = this.getArtisanSettings();
    const value = target instanceof HTMLInputElement && target.type === "checkbox"
      ? target.checked
      : target.value === "true";

    await game.settings.set("artisan", "moduleSettings", {
      ...current,
      [key]: value,
    });

    ui.notifications.info(game.i18n.localize("ARTISAN.SettingUpdated"));
    this.renderPreservingUiState();
  }

  private async onResetArtisanSettingsClicked(): Promise<void> {
    await game.settings.set("artisan", "moduleSettings", this.getDefaultArtisanSettings());
    ui.notifications.info(game.i18n.localize("ARTISAN.SettingsReset"));
    this.renderPreservingUiState();
  }


  private getActivityLog(): any[] {
    this.ensureActivityLogSetting();

    const value = game.settings.get("artisan", "activityLog") as any;

    if (!Array.isArray(value)) {
      return [];
    }

    return value;
  }

  private getActivityLogView(): any[] {
    return this.getActivityLog().map((entry: any) => {
      const createdAt = String(entry.createdAt ?? "");
      const date = createdAt ? new Date(createdAt) : null;
      const timeLabel = date && !Number.isNaN(date.getTime())
        ? date.toLocaleString()
        : "Data non disponibile";

      return {
        ...entry,
        timeLabel,
        icon: this.getActivityIcon(String(entry.type ?? "info")),
      };
    });
  }

  private getActivityIcon(type: string): string {
    if (type === "crafting") {
      return "fa-solid fa-hammer";
    }

    if (type === "foraging") {
      return "fa-solid fa-leaf";
    }

    if (type === "harvest") {
      return "fa-solid fa-paw";
    }

    if (type === "backup") {
      return "fa-solid fa-database";
    }

    if (type === "import") {
      return "fa-solid fa-file-import";
    }

    if (type === "export") {
      return "fa-solid fa-file-export";
    }

    return "fa-solid fa-circle-info";
  }

  private async addActivityLogEntry(type: string, title: string, message: string, actorName = ""): Promise<void> {
    if (!this.getArtisanSettings().enableActivityLog) {
      return;
    }

    this.ensureActivityLogSetting();

    const current = this.getActivityLog();
    const next = [
      {
        id: foundry.utils.randomID(),
        type,
        title,
        message,
        actorName,
        createdAt: new Date().toISOString(),
      },
      ...current,
    ].slice(0, 100);

    await game.settings.set("artisan", "activityLog", next);
  }

  private ensureActivityLogSetting(): void {
    const settings = (game.settings as any).settings;

    if (settings?.has?.("artisan.activityLog")) {
      return;
    }

    game.settings.register("artisan", "activityLog", {
      name: "Registro attività Artisan",
      scope: "world",
      config: false,
      type: Array,
      default: [],
    });
  }

  private onExportActivityClicked(): void {
    const log = this.getActivityLog();

    if (!log.length) {
      ui.notifications.warn("Il registro attività è vuoto.");
      return;
    }

    const payload = {
      schema: "artisan.activity-log.export",
      version: 1,
      exportedAt: new Date().toISOString(),
      count: log.length,
      entries: log,
    };

    saveDataToFile(
      JSON.stringify(payload, null, 2),
      "application/json",
      `artisan-registro-attivita-${new Date().toISOString().slice(0, 10)}.json`,
    );

    ui.notifications.info("Registro attività esportato.");
  }

  private async onClearActivityClicked(): Promise<void> {
    const confirmed = await new Promise<boolean>((resolve) => {
      new Dialog({
        title: "Cancella registro attività",
        content: `
          <p>Vuoi cancellare definitivamente il registro attività di Artisan?</p>
          <p><em>L'operazione non può essere annullata.</em></p>
        `,
        buttons: {
          cancel: {
            label: game.i18n.localize("ARTISAN.Cancel"),
            callback: () => resolve(false),
          },
          delete: {
            label: game.i18n.localize("ARTISAN.Delete"),
            callback: () => resolve(true),
          },
        },
        default: "cancel",
        close: () => resolve(false),
      }).render(true);
    });

    if (!confirmed) {
      return;
    }

    this.ensureActivityLogSetting();
    await game.settings.set("artisan", "activityLog", []);
    ui.notifications.info("Registro attività cancellato.");
    this.renderPreservingUiState();
  }

  private getRecipeFilterData(recipe: any, professionService: ProfessionService): {
    name: string;
    category: string;
    profession: string;
    professionLevel: number;
  } {
    const item = recipe?.id ? game.items.get(String(recipe.id)) : null;
    const flag = item?.getFlag("artisan", "recipe") as any;

    return {
      name: String(recipe?.name ?? recipe?.label ?? item?.name ?? ""),
      category: String(recipe?.category ?? flag?.category ?? ""),
      profession: String(recipe?.profile ?? flag?.profile ?? flag?.profession ?? ""),
      professionLevel: professionService.normalizeLevel(
        recipe?.professionLevel ??
          flag?.professionLevel ??
          flag?.requiredProfessionLevel ??
          0,
      ),
    };
  }

  private getRecipeCraftingRequirementView(
    recipe: any,
    professionService: ProfessionService,
    actor: Actor | null | undefined,
  ): any {
    const data = this.getRecipeFilterData(recipe, professionService);
    const professionId = data.profession || "";
    const requiredLevel = professionService.normalizeLevel(data.professionLevel);
    const professionLabel = professionId
      ? professionService.getLabel(professionId)
      : "Nessuna professione";

    const actorProfession = professionId
      ? professionService.getActorProfession(actor, professionId)
      : null;

    const actorLevel = actorProfession?.level ?? 0;
    const hasActor = Boolean(actor);
    const recipeItem = recipe?.id ? game.items.get(String(recipe.id)) : null;
    const hasRecipeCopy = Boolean(actor && recipeItem && this.actorHasRecipeCopy(actor, recipeItem));
    const requirementMet = requiredLevel <= 0 || actorLevel >= requiredLevel;
    const canCraft = hasActor && hasRecipeCopy && requirementMet;

    if (!hasActor) {
      return {
        canCraft: false,
        recipeLocked: false,
        recipeStatusClass: "is-unknown",
        recipeStatusIcon: "fa-solid fa-circle-question",
        recipeStatusLabel: game.i18n.localize("ARTISAN.SelectActor"),
        recipeStatusTitle: game.i18n.localize("ARTISAN.SelectActorRecipeTitle"),
        requiredProfessionLabel: professionLabel,
        requiredProfessionLevel: requiredLevel,
        actorProfessionLevel: 0,
      };
    }

    if (!hasRecipeCopy) {
      return {
        canCraft: false,
        recipeLocked: true,
        recipeStatusClass: "is-locked",
        recipeStatusIcon: "fa-solid fa-book",
        recipeStatusLabel: game.i18n.localize("ARTISAN.RecipeCopyMissing"),
        recipeStatusTitle: `${actor?.name ?? "PG"}: ${game.i18n.localize("ARTISAN.RecipeCopyRequiredTitle")}`,
        requiredProfessionLabel: professionLabel,
        requiredProfessionLevel: requiredLevel,
        actorProfessionLevel: actorLevel,
      };
    }

    if (!requirementMet) {
      return {
        canCraft: false,
        recipeLocked: true,
        recipeStatusClass: "is-locked",
        recipeStatusIcon: "fa-solid fa-lock",
        recipeStatusLabel: `${game.i18n.localize("ARTISAN.Requires")} ${professionLabel} ${requiredLevel}`,
        recipeStatusTitle: `${actor.name}: ${professionLabel} ${game.i18n.localize("ARTISAN.Level").toLowerCase()} ${actorLevel}. ${game.i18n.localize("ARTISAN.RequiredLevel")}: ${requiredLevel}.`,
        requiredProfessionLabel: professionLabel,
        requiredProfessionLevel: requiredLevel,
        actorProfessionLevel: actorLevel,
      };
    }

    return {
      canCraft: true,
      recipeLocked: false,
      recipeStatusClass: "is-available",
      recipeStatusIcon: "fa-solid fa-circle-check",
      recipeStatusLabel: requiredLevel > 0
        ? `${professionLabel} ${actorLevel}/${requiredLevel}`
        : game.i18n.localize("ARTISAN.Available"),
      recipeStatusTitle: requiredLevel > 0
        ? `${actor.name}: ${game.i18n.localize("ARTISAN.RequirementMet")} (${professionLabel} ${game.i18n.localize("ARTISAN.Level").toLowerCase()} ${actorLevel}/${requiredLevel}).`
        : `${actor.name}: ${game.i18n.localize("ARTISAN.RecipeWithoutProfessionRequirement")}.`,
      requiredProfessionLabel: professionLabel,
      requiredProfessionLevel: requiredLevel,
      actorProfessionLevel: actorLevel,
    };
  }

  private actorHasRecipeCopy(actor: Actor, recipeItem: Item): boolean {
    if (this.isItemOwnedByActor(actor, recipeItem)) {
      return true;
    }

    const recipeKeys = this.getRecipeIdentityKeys(recipeItem);
    const recipeName = this.normalizeItemName(recipeItem.name ?? "");
    const recipeType = recipeItem.type;

    const items = Array.from(actor.items ?? []) as Item[];

    return items.some((item: Item) => {
      if (!RecipeDocument.isRecipe(item)) {
        return false;
      }

      const itemKeys = this.getRecipeIdentityKeys(item);
      const sameKnownSource = [...itemKeys].some(key => recipeKeys.has(key));

      if (sameKnownSource) {
        return true;
      }

      const sameName = this.normalizeItemName(item.name ?? "") === recipeName;
      const sameType = recipeType ? item.type === recipeType : true;

      return sameName && sameType;
    });
  }

  private isItemOwnedByActor(actor: Actor, item: Item): boolean {
    const parent = (item as any).parent ?? null;
    const itemActor = (item as any).actor ?? null;

    return parent?.id === actor.id
      || itemActor?.id === actor.id
      || parent === actor
      || itemActor === actor;
  }

  private getRecipeIdentityKeys(item: Item): Set<string> {
    const flags = ((item as any).flags ?? {}) as any;
    const stats = ((item as any)._stats ?? {}) as any;

    return new Set([
      item.uuid,
      flags?.artisan?.sourceUuid,
      flags?.core?.sourceId,
      stats?.compendiumSource,
      stats?.sourceId,
    ].filter(value => typeof value === "string" && value.trim().length > 0));
  }

  private normalizeItemName(name: string): string {
    return String(name ?? "").trim().toLowerCase();
  }

  private getFilteredRecipes(recipes: any[], professionService: ProfessionService): any[] {
    const search = this.recipeSearchText.trim().toLowerCase();
    const profession = this.recipeFilterProfession;
    const category = this.recipeFilterCategory;
    const level = this.recipeFilterLevel;

    return recipes.filter((recipe: any) => {
      const data = this.getRecipeFilterData(recipe, professionService);

      const matchesSearch = !search ||
        data.name.toLowerCase().includes(search) ||
        data.category.toLowerCase().includes(search) ||
        data.profession.toLowerCase().includes(search);

      const matchesProfession = profession === "all" || data.profession === profession;
      const matchesCategory = category === "all" || data.category === category;
      const matchesLevel = level === "all" || data.professionLevel === Number(level);

      return matchesSearch && matchesProfession && matchesCategory && matchesLevel;
    });
  }

  private getRecipeCategoryOptions(recipes: any[]): Array<{ value: string; label: string; selected: boolean }> {
    const categories = new Set<string>();

    for (const recipe of recipes) {
      const item = recipe?.id ? game.items.get(String(recipe.id)) : null;
      const flag = item?.getFlag("artisan", "recipe") as any;
      const category = String(recipe?.category ?? flag?.category ?? "").trim();

      if (category) {
        categories.add(category);
      }
    }

    return Array.from(categories)
      .sort((a, b) => a.localeCompare(b))
      .map(category => ({
        value: category,
        label: category,
        selected: category === this.recipeFilterCategory,
      }));
  }

  private getRecipeProfessionFilterOptions(professionService: ProfessionService): Array<{ value: string; label: string; selected: boolean }> {
    return professionService.getOptions().map((option: any) => ({
      value: String(option.id),
      label: String(option.label),
      selected: String(option.id) === this.recipeFilterProfession,
    }));
  }

  private getRecipeLevelFilterOptions(): Array<{ value: string; label: string; selected: boolean }> {
    return [0, 1, 2, 3, 4, 5].map(level => ({
      value: String(level),
      label: `${game.i18n.localize("ARTISAN.Level")} ${level}`,
      selected: String(level) === this.recipeFilterLevel,
    }));
  }

  private getExplorerSectionView(section: {
    id: string;
    label: string;
    icon: string;
    count: number;
    items: any[];
  }): object {
    const isSelected = section.id === this.selectedSectionId || (
      section.id === "management" &&
      ["professions", "activity", "settings"].includes(this.selectedSectionId)
    );

    const expanded = this.expandedExplorerSectionIds.has(section.id);

    return {
      ...section,
      expanded,
      collapsed: !expanded,
      hasItems: section.items.length > 0,
      selected: isSelected,
    };
  }

  private renderPreservingUiState(): void {
    this.pendingScrollState = this.captureScrollState();
    this.render(true);
  }

  private captureScrollState(): ArtisanScrollState | null {
    const element = this.getRootElement();

    if (!element) {
      return null;
    }

    const getScrollTop = (selector: string): number => {
      const scrollElement = element.querySelector<HTMLElement>(selector);
      return scrollElement?.scrollTop ?? 0;
    };

    return {
      sidebarTop: getScrollTop(".artisan-manager__sidebar"),
      contentTop: getScrollTop(".artisan-manager__content"),
      inspectorTop: getScrollTop(".artisan-inspector"),
      foragingTop: getScrollTop(".artisan-foraging-content"),
      harvestTop: getScrollTop(".artisan-harvest-content"),
      disassemblyTop: getScrollTop(".artisan-disassembly-content"),
      activityTop: getScrollTop(".artisan-activity-log"),
    };
  }

  private restorePendingScrollState(): void {
    const scrollState = this.pendingScrollState;

    if (!scrollState) {
      return;
    }

    this.pendingScrollState = null;

    window.setTimeout(() => {
      this.restoreScrollState(scrollState);
    }, 0);
  }

  private restoreScrollState(scrollState: ArtisanScrollState): void {
    const element = this.getRootElement();

    if (!element) {
      return;
    }

    const setScrollTop = (selector: string, value: number): void => {
      const scrollElement = element.querySelector<HTMLElement>(selector);

      if (!scrollElement) {
        return;
      }

      scrollElement.scrollTop = value;
    };

    setScrollTop(".artisan-manager__sidebar", scrollState.sidebarTop);
    setScrollTop(".artisan-manager__content", scrollState.contentTop);
    setScrollTop(".artisan-inspector", scrollState.inspectorTop);
    setScrollTop(".artisan-foraging-content", scrollState.foragingTop);
    setScrollTop(".artisan-harvest-content", scrollState.harvestTop);
    setScrollTop(".artisan-disassembly-content", scrollState.disassemblyTop);
    setScrollTop(".artisan-activity-log", scrollState.activityTop);
  }

  private getRootElement(): HTMLElement | null {
    return (
      document.getElementById("artisan-manager") ??
      document.querySelector(".artisan-manager")
    );
  }

  private onToggleExplorerSectionClicked(target: HTMLElement): void {
    const sectionId = target.dataset.sectionId;

    if (!sectionId) {
      return;
    }

    if (this.expandedExplorerSectionIds.has(sectionId)) {
      this.expandedExplorerSectionIds.delete(sectionId);
    } else {
      this.expandedExplorerSectionIds.add(sectionId);
    }

    this.renderPreservingUiState();
  }

  private onSelectSectionClicked(target: HTMLElement): void {
    const sectionId = target.dataset.sectionId;

    if (!sectionId) {
      return;
    }

    this.selectedSectionId = sectionId;
    this.expandedExplorerSectionIds.add(sectionId);

    this.renderPreservingUiState();
  }

  private onRecipeFilterChanged(target: HTMLInputElement | HTMLSelectElement): void {
    const filter = target.dataset.filter;

    if (!filter) {
      return;
    }

    if (filter === "search") {
      this.recipeSearchText = target.value;
    }

    if (filter === "profession") {
      this.recipeFilterProfession = target.value || "all";
    }

    if (filter === "category") {
      this.recipeFilterCategory = target.value || "all";
    }

    if (filter === "level") {
      this.recipeFilterLevel = target.value || "all";
    }

    this.renderPreservingUiState();
  }

  private onResetRecipeFiltersClicked(): void {
    this.recipeSearchText = "";
    this.recipeFilterProfession = "all";
    this.recipeFilterCategory = "all";
    this.recipeFilterLevel = "all";

    this.renderPreservingUiState();
  }

  private async onRecipeFieldChanged(
    target: HTMLInputElement | HTMLSelectElement,
  ): Promise<void> {
    const recipeId = target.dataset.recipeId;

    const field = target.dataset.artisanField;

    if (!recipeId || !field) {
      return;
    }

    const recipeService = new RecipeService();

    if (field === "name") {
      await recipeService.updateRecipeName(recipeId, target.value);

      this.renderPreservingUiState();

      return;
    }

    const value = this.parseFieldValue(target);

    if (field === "professionLevel") {
      const item = game.items.get(recipeId);

      if (item) {
        const current = item.getFlag("artisan", "recipe") as any;
        const next = {
          ...(current && typeof current === "object" ? current : {}),
          professionLevel: new ProfessionService().normalizeLevel(value),
        };

        await item.setFlag("artisan", "recipe", next);
      }

      await recipeService.updateRecipeData(recipeId, {
        professionLevel: new ProfessionService().normalizeLevel(value),
      } as any);

      this.renderPreservingUiState();

      return;
    }

    if (field === "profile") {
      const defaultSkill = new ProfessionService().getDefaultSkill(
        String(value),
      );

      await recipeService.updateRecipeData(recipeId, {
        profile: String(value),
        ...(defaultSkill ? { skill: defaultSkill } : {}),
      } as any);

      this.renderPreservingUiState();

      return;
    }

    await recipeService.updateRecipeData(recipeId, {
      [field]: value,
    } as any);

    this.renderPreservingUiState();
  }

  private async onComponentQuantityChanged(
    target: HTMLInputElement,
  ): Promise<void> {
    const recipeId = target.dataset.recipeId;

    const collection = target.dataset.collection as
      RecipeComponentCollection | undefined;

    const index = Number(target.dataset.index);

    const quantity = Math.max(1, Number(target.value || 1));

    if (!recipeId || !collection || Number.isNaN(index)) {
      ui.notifications.warn("Elemento non valido.");
      return;
    }

    const recipeService = new RecipeService();

    await recipeService.updateRecipeComponentQuantity(
      recipeId,
      collection,
      index,
      quantity,
    );

    this.renderPreservingUiState();
  }

  private parseFieldValue(target: HTMLInputElement | HTMLSelectElement): string | number | boolean {
    if (target instanceof HTMLInputElement && target.type === "checkbox") {
      return target.checked;
    }

    if (target instanceof HTMLInputElement && target.type === "number") {
      return Number(target.value || 0);
    }

    return target.value;
  }

  private async onNewRecipeClicked(): Promise<void> {
    const recipeService = new RecipeService();

    const item = await recipeService.createRecipe();

    this.selectedRecipeId = item.id ?? null;

    this.selectedSectionId = "recipes";

    ui.notifications.info("Ricetta creata.");

    this.renderPreservingUiState();
  }

  private onImportRecipesClicked(): void {
    const element = this.getRootElement();

    const input = element?.querySelector<HTMLInputElement>(
      "[data-artisan-import-recipes-file]",
    );

    if (!input) {
      ui.notifications.warn("Campo import ricette non trovato.");
      return;
    }

    input.value = "";
    input.click();
  }

  private async onImportRecipesFileChanged(target: HTMLInputElement): Promise<void> {
    const file = target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const text = await this.readTextFile(file);
      const payload = JSON.parse(text);
      const recipes = this.getRecipeImportEntries(payload);

      if (!recipes.length) {
        ui.notifications.warn("Il file non contiene ricette Artisan importabili.");
        return;
      }

      const result = await this.importRecipeEntries(recipes);

      ui.notifications.info(
        `Import ricette completato: ${result.imported} importate, ${result.skipped} saltate.`,
      );
      void this.addActivityLogEntry(
        "import",
        "Ricette importate",
        `${result.imported} ricette importate, ${result.skipped} saltate.`,
      );

      this.selectedSectionId = "recipes";
      this.renderPreservingUiState();
    } catch (error) {
      console.error("Artisan | Import ricette fallito", error);
      ui.notifications.error("Import ricette fallito. Controlla che il JSON sia valido.");
    } finally {
      target.value = "";
    }
  }

  private readTextFile(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error ?? new Error("Lettura file fallita."));

      reader.readAsText(file);
    });
  }

  private onExportBackupClicked(): void {
    const foragingService = new ForagingService();
    const harvestService = new HarvestService();
    const disassemblyService = new DisassemblyService();

    const recipes = game.items
      .filter((item: Item) => item.getFlag("artisan", "type") === "recipe")
      .map((item: Item) => this.toRecipeExportData(item));

    const actorProfessions = game.actors
      .map((actor: Actor) => {
        const professions = actor.getFlag("artisan", "professions") as any;

        if (!professions || typeof professions !== "object" || Array.isArray(professions)) {
          return null;
        }

        return {
          id: actor.id,
          uuid: actor.uuid,
          name: actor.name,
          professions: foundry.utils.deepClone(professions),
        };
      })
      .filter((entry: any) => entry !== null);

    const payload = {
      schema: "artisan.full-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      moduleVersion: game.modules.get("artisan")?.version ?? "0.0.1",
      counts: {
        recipes: recipes.length,
        foragingProfiles: foragingService.getProfiles().length,
        harvestProfiles: harvestService.getProfiles().length,
        disassemblyProfiles: disassemblyService.getProfiles().length,
        actorProfessions: actorProfessions.length,
      },
      recipes,
      foragingProfiles: foragingService.getProfiles(),
      harvestProfiles: harvestService.getProfiles(),
      disassemblyProfiles: disassemblyService.getProfiles(),
      actorProfessions,
    };

    saveDataToFile(
      JSON.stringify(payload, null, 2),
      "application/json",
      `artisan-backup-${new Date().toISOString().slice(0, 10)}.json`,
    );

    ui.notifications.info("Backup completo Artisan esportato.");
    void this.addActivityLogEntry(
      "backup",
      "Backup Artisan esportato",
      `Backup completo con ${recipes.length} ricette, ${foragingService.getProfiles().length} liste di raccolta, ${harvestService.getProfiles().length} liste di caccia, ${disassemblyService.getProfiles().length} liste Dissassemblare e ${actorProfessions.length} PG con professioni.`,
    );
  }

  private onImportBackupClicked(): void {
    const element = this.getRootElement();

    const input = element?.querySelector<HTMLInputElement>(
      "[data-artisan-import-backup-file]",
    );

    if (!input) {
      ui.notifications.warn("Campo import backup Artisan non trovato.");
      return;
    }

    input.value = "";
    input.click();
  }

  private async onImportBackupFileChanged(target: HTMLInputElement): Promise<void> {
    const file = target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const text = await this.readTextFile(file);
      const payload = JSON.parse(text);

      if (payload?.schema !== "artisan.full-backup") {
        ui.notifications.warn("Il file selezionato non è un backup completo Artisan.");
        return;
      }

      const recipeEntries = this.getRecipeImportEntries({ recipes: payload.recipes ?? [] });
      const recipeResult = await this.importRecipeEntries(recipeEntries);

      const foragingService = new ForagingService();
      const foragingResult = await foragingService.importProfiles({
        profiles: payload.foragingProfiles ?? [],
      });

      const harvestService = new HarvestService();
      const harvestResult = await harvestService.importProfiles({
        profiles: payload.harvestProfiles ?? [],
      });

      const disassemblyService = new DisassemblyService();
      const disassemblyResult = await disassemblyService.importProfiles({
        profiles: payload.disassemblyProfiles ?? [],
      });

      const actorResult = await this.importActorProfessionBackups(
        payload.actorProfessions ?? [],
      );

      ui.notifications.info(
        `Backup importato: ricette ${recipeResult.imported}/${recipeResult.skipped}, ` +
        `Raccolta ${foragingResult.imported}/${foragingResult.skipped}, ` +
        `Caccia ${harvestResult.imported}/${harvestResult.skipped}, ` +
        `Dissassemblare ${disassemblyResult.imported}/${disassemblyResult.skipped}, ` +
        `professioni PG ${actorResult.imported}/${actorResult.skipped}.`,
      );
      void this.addActivityLogEntry(
        "backup",
        "Backup Artisan importato",
        `Ricette importate ${recipeResult.imported}, Raccolta ${foragingResult.imported}, Caccia ${harvestResult.imported}, Dissassemblare ${disassemblyResult.imported}, professioni PG ${actorResult.imported}.`,
      );

      this.renderPreservingUiState();
    } catch (error) {
      console.error("Artisan | Import backup fallito", error);
      ui.notifications.error("Import backup Artisan fallito. Controlla che il JSON sia valido.");
    } finally {
      target.value = "";
    }
  }

  private async importActorProfessionBackups(entries: unknown[]): Promise<{ imported: number; skipped: number }> {
    if (!Array.isArray(entries)) {
      return { imported: 0, skipped: 0 };
    }

    let imported = 0;
    let skipped = 0;

    for (const entry of entries as any[]) {
      const professions = entry?.professions;

      if (!professions || typeof professions !== "object" || Array.isArray(professions)) {
        skipped += 1;
        continue;
      }

      const actor = this.findActorForProfessionBackup(entry);

      if (!actor) {
        skipped += 1;
        continue;
      }

      await actor.setFlag(
        "artisan",
        "professions",
        foundry.utils.deepClone(professions),
      );

      imported += 1;
    }

    return { imported, skipped };
  }

  private findActorForProfessionBackup(entry: any): Actor | null {
    if (typeof entry?.uuid === "string" && typeof (globalThis as any).fromUuidSync === "function") {
      const byUuid = (globalThis as any).fromUuidSync(entry.uuid) as Actor | null;

      if (byUuid?.documentName === "Actor") {
        return byUuid;
      }
    }

    if (typeof entry?.id === "string") {
      const byId = game.actors.get(entry.id);

      if (byId) {
        return byId;
      }
    }

    if (typeof entry?.name === "string") {
      return game.actors.find((actor: Actor) => actor.name === entry.name) ?? null;
    }

    return null;
  }

  private getRecipeImportEntries(payload: any): any[] {
    if (Array.isArray(payload)) {
      return payload;
    }

    if (Array.isArray(payload?.recipes)) {
      return payload.recipes;
    }

    if (payload?.flags?.artisan?.recipe || payload?.recipe) {
      return [payload];
    }

    return [];
  }

  private async importRecipeEntries(entries: any[]): Promise<{ imported: number; skipped: number }> {
    let imported = 0;
    let skipped = 0;

    const folder = await this.getOrCreateImportedRecipeFolder();

    for (const entry of entries) {
      const data = this.toRecipeImportData(entry, folder.id ?? null);

      if (!data) {
        skipped += 1;
        continue;
      }

      const duplicate = game.items.find((item: Item) => {
        return item.name === data.name && item.getFlag("artisan", "type") === "recipe";
      });

      if (duplicate) {
        skipped += 1;
        continue;
      }

      const item = await Item.create(data);

      if (item) {
        imported += 1;
        this.selectedRecipeId = item.id ?? this.selectedRecipeId;
      }
    }

    return { imported, skipped };
  }

  private toRecipeImportData(entry: any, folderId: string | null): any | null {
    if (!entry || typeof entry !== "object") {
      return null;
    }

    const flags = entry.flags?.artisan ?? {};
    const recipe = flags.recipe ?? entry.recipe ?? {};

    const name = String(entry.name ?? recipe.name ?? "").trim();

    if (!name) {
      return null;
    }

    const professionLevel = Number(
      recipe.professionLevel ?? recipe.requiredProfessionLevel ?? 0,
    );

    const importedRecipe = {
      category: String(recipe.category ?? ""),
      profile: String(recipe.profile ?? ""),
      professionLevel,
      requiredProfessionLevel: Number(
        recipe.requiredProfessionLevel ?? professionLevel,
      ),
      skill: String(recipe.skill ?? ""),
      dc: Number(recipe.dc ?? 10),
      craftingTime: Number(recipe.craftingTime ?? 0),
      craftingXp: Math.max(0, Math.floor(Number(recipe.craftingXp ?? recipe.xp ?? 0))),
      currencyCost: Math.max(0, Number(recipe.currencyCost ?? recipe.goldCost ?? 0)),
      currencyDenomination: this.normalizeRecipeCurrencyDenomination(recipe.currencyDenomination ?? recipe.currency ?? "gp"),
      consumeCurrencyOnFailure: Boolean(recipe.consumeCurrencyOnFailure ?? false),
      toolRequirement: String(recipe.toolRequirement ?? "optional") === "required" ? "required" : "optional",
      toolCriticalDamage: Boolean(recipe.toolCriticalDamage ?? false),
      qualityMode: this.normalizeRecipeQualityMode(recipe.qualityMode ?? "margin"),
      qualityChanceGood: this.normalizeRecipePercent(recipe.qualityChanceGood ?? 0),
      qualityChanceSuperior: this.normalizeRecipePercent(recipe.qualityChanceSuperior ?? 0),
      qualityChanceExcellent: this.normalizeRecipePercent(recipe.qualityChanceExcellent ?? 0),
      qualityFormulaPath: String(recipe.qualityFormulaPath ?? ""),
      qualityBonusGood: Math.max(0, Math.floor(Number(recipe.qualityBonusGood ?? 0))),
      qualityBonusSuperior: Math.max(0, Math.floor(Number(recipe.qualityBonusSuperior ?? 0))),
      qualityBonusExcellent: Math.max(0, Math.floor(Number(recipe.qualityBonusExcellent ?? 0))),
      qualityDiceGood: String(recipe.qualityDiceGood ?? ""),
      qualityDiceSuperior: String(recipe.qualityDiceSuperior ?? ""),
      qualityDiceExcellent: String(recipe.qualityDiceExcellent ?? ""),
      qualityEffectGood: String(recipe.qualityEffectGood ?? "auto"),
      qualityEffectSuperior: String(recipe.qualityEffectSuperior ?? "auto"),
      qualityEffectExcellent: String(recipe.qualityEffectExcellent ?? "auto"),
      ingredients: this.normalizeRecipeImportComponents(recipe.ingredients),
      tools: this.normalizeRecipeImportComponents(recipe.tools),
      outputs: this.normalizeRecipeImportComponents(recipe.outputs),
    };

    return {
      name,
      type: String(entry.type ?? "loot"),
      img: String(entry.img ?? "icons/svg/item-bag.svg"),
      folder: folderId,
      flags: {
        artisan: {
          type: "recipe",
          version: Number(flags.version ?? 1),
          recipe: importedRecipe,
        },
      },
    };
  }


  private normalizeRecipeQualityMode(value: unknown): string {
    const raw = String(value ?? "margin").trim().toLowerCase();
    return ["normal", "margin", "chance"].includes(raw) ? raw : "margin";
  }

  private normalizeRecipePercent(value: unknown): number {
    const numeric = Number(value ?? 0);

    if (!Number.isFinite(numeric)) {
      return 0;
    }

    return Math.max(0, Math.min(100, Math.floor(numeric)));
  }

  private normalizeRecipeCurrencyDenomination(value: unknown): string {
    const raw = String(value ?? "gp").trim().toLowerCase();
    const aliases: Record<string, string> = {
      cp: "cp",
      rame: "cp",
      copper: "cp",
      sp: "sp",
      argento: "sp",
      silver: "sp",
      ep: "ep",
      electrum: "ep",
      gp: "gp",
      oro: "gp",
      gold: "gp",
      mo: "gp",
      pp: "pp",
      platino: "pp",
      platinum: "pp"
    };

    return aliases[raw] ?? "gp";
  }

  private normalizeRecipeImportComponents(value: unknown): Array<{ uuid: string; quantity: number }> {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((entry: any) => entry && typeof entry.uuid === "string" && entry.uuid.trim().length > 0)
      .map((entry: any) => ({
        uuid: String(entry.uuid).trim(),
        quantity: Math.max(1, Number(entry.quantity ?? 1)),
      }));
  }

  private async getOrCreateImportedRecipeFolder(): Promise<Folder> {
    let folder = game.folders.find((candidate: Folder) => {
      return candidate.type === "Item" && candidate.name === "Artisan Recipes";
    });

    if (folder) {
      return folder;
    }

    folder = await Folder.create({
      name: "Artisan Recipes",
      type: "Item",
      color: "#d18b47",
    });

    return folder as Folder;
  }


  private async onDuplicateRecipeClicked(target: HTMLElement): Promise<void> {
    const recipeId = target.dataset.recipeId ?? this.selectedRecipeId;

    if (!recipeId) {
      ui.notifications.warn("Nessuna ricetta selezionata.");
      return;
    }

    const item = game.items.get(recipeId);

    if (!item) {
      ui.notifications.warn("Ricetta non trovata.");
      return;
    }

    if (item.getFlag("artisan", "type") !== "recipe") {
      ui.notifications.warn("L'Item selezionato non è una ricetta Artisan.");
      return;
    }

    const source = foundry.utils.deepClone(item.toObject()) as any;

    delete source._id;

    source.name = this.getUniqueDuplicatedRecipeName(item.name);
    source.folder = (item as any).folder?.id ?? source.folder ?? null;

    if (!source.flags) {
      source.flags = {};
    }

    if (!source.flags.artisan) {
      source.flags.artisan = {};
    }

    source.flags.artisan.type = "recipe";
    source.flags.artisan.version = source.flags.artisan.version ?? 1;

    const duplicated = await Item.create(source);

    if (!duplicated) {
      ui.notifications.error("Duplicazione ricetta fallita.");
      return;
    }

    this.selectedRecipeId = duplicated.id ?? this.selectedRecipeId;
    this.selectedSectionId = "recipes";

    ui.notifications.info(`Ricetta duplicata: ${duplicated.name}.`);
    void this.addActivityLogEntry(
      "crafting",
      "Ricetta duplicata",
      `${item.name} duplicata come ${duplicated.name}.`,
    );

    this.renderPreservingUiState();
  }

  private getUniqueDuplicatedRecipeName(originalName: string): string {
    const baseName = `${originalName} copia`;

    if (!this.recipeNameExists(baseName)) {
      return baseName;
    }

    let index = 2;

    while (this.recipeNameExists(`${baseName} ${index}`)) {
      index += 1;
    }

    return `${baseName} ${index}`;
  }

  private recipeNameExists(name: string): boolean {
    return game.items.some((item: Item) => {
      return item.name === name && item.getFlag("artisan", "type") === "recipe";
    });
  }

  private onExportRecipeClicked(target: HTMLElement): void {
    const recipeId = target.dataset.recipeId ?? this.selectedRecipeId;

    if (!recipeId) {
      ui.notifications.warn("Nessuna ricetta selezionata.");
      return;
    }

    const item = game.items.get(recipeId);

    if (!item) {
      ui.notifications.warn("Ricetta non trovata.");
      return;
    }

    this.exportRecipeItems([item], `artisan-ricetta-${this.toSafeFilename(item.name)}.json`);
  }

  private onExportAllRecipesClicked(): void {
    const items = game.items.filter((item: Item) => {
      return item.getFlag("artisan", "type") === "recipe";
    });

    if (!items.length) {
      ui.notifications.warn("Nessuna ricetta Artisan da esportare.");
      return;
    }

    this.exportRecipeItems(items, "artisan-ricette.json");
  }

  private exportRecipeItems(items: Item[], filename: string): void {
    const payload = {
      schema: "artisan.recipe.export",
      version: 1,
      exportedAt: new Date().toISOString(),
      count: items.length,
      recipes: items.map((item: Item) => this.toRecipeExportData(item)),
    };

    saveDataToFile(
      JSON.stringify(payload, null, 2),
      "application/json",
      filename,
    );

    ui.notifications.info(
      items.length === 1
        ? "Ricetta esportata."
        : `${items.length} ricette esportate.`,
    );
    void this.addActivityLogEntry(
      "export",
      items.length === 1 ? "Ricetta esportata" : "Ricette esportate",
      items.length === 1
        ? `Esportata la ricetta ${items[0]?.name ?? "senza nome"}.`
        : `Esportate ${items.length} ricette Artisan.`,
    );
  }

  private toRecipeExportData(item: Item): object {
    const recipe = item.getFlag("artisan", "recipe") as any;
    const data = recipe && typeof recipe === "object" ? recipe : {};

    return {
      id: item.id,
      uuid: item.uuid,
      name: item.name,
      type: item.type,
      img: item.img,
      flags: {
        artisan: {
          type: item.getFlag("artisan", "type") ?? "recipe",
          version: item.getFlag("artisan", "version") ?? 1,
          recipe: {
            category: String(data.category ?? ""),
            profile: String(data.profile ?? ""),
            professionLevel: Number(data.professionLevel ?? data.requiredProfessionLevel ?? 0),
            requiredProfessionLevel: Number(data.requiredProfessionLevel ?? data.professionLevel ?? 0),
            skill: String(data.skill ?? ""),
            dc: Number(data.dc ?? 10),
            craftingTime: Number(data.craftingTime ?? 0),
            craftingXp: Math.max(0, Math.floor(Number(data.craftingXp ?? 0))),
            currencyCost: Math.max(0, Number(data.currencyCost ?? data.goldCost ?? 0)),
            currencyDenomination: this.normalizeRecipeCurrencyDenomination(data.currencyDenomination ?? data.currency ?? "gp"),
            consumeCurrencyOnFailure: Boolean(data.consumeCurrencyOnFailure ?? false),
            toolRequirement: String(data.toolRequirement ?? "optional") === "required" ? "required" : "optional",
            toolCriticalDamage: Boolean((data as any).toolCriticalDamage ?? false),
            qualityMode: this.normalizeRecipeQualityMode(data.qualityMode ?? "margin"),
            qualityChanceGood: this.normalizeRecipePercent(data.qualityChanceGood ?? 0),
            qualityChanceSuperior: this.normalizeRecipePercent(data.qualityChanceSuperior ?? 0),
            qualityChanceExcellent: this.normalizeRecipePercent(data.qualityChanceExcellent ?? 0),
            qualityFormulaPath: String(data.qualityFormulaPath ?? ""),
            qualityBonusGood: Math.max(0, Math.floor(Number(data.qualityBonusGood ?? 0))),
            qualityBonusSuperior: Math.max(0, Math.floor(Number(data.qualityBonusSuperior ?? 0))),
            qualityBonusExcellent: Math.max(0, Math.floor(Number(data.qualityBonusExcellent ?? 0))),
            qualityDiceGood: String(data.qualityDiceGood ?? ""),
            qualityDiceSuperior: String(data.qualityDiceSuperior ?? ""),
            qualityDiceExcellent: String(data.qualityDiceExcellent ?? ""),
            qualityEffectGood: String(data.qualityEffectGood ?? "auto"),
            qualityEffectSuperior: String(data.qualityEffectSuperior ?? "auto"),
            qualityEffectExcellent: String(data.qualityEffectExcellent ?? "auto"),
            ingredients: this.normalizeRecipeExportComponents(data.ingredients),
            tools: this.normalizeRecipeExportComponents(data.tools),
            outputs: this.normalizeRecipeExportComponents(data.outputs),
          },
        },
      },
    };
  }

  private normalizeRecipeExportComponents(value: unknown): Array<object> {
    if (!Array.isArray(value)) {
      return [];
    }

    return value
      .filter((entry: any) => entry && typeof entry.uuid === "string")
      .map((entry: any) => ({
        uuid: entry.uuid,
        quantity: Math.max(1, Number(entry.quantity ?? 1)),
      }));
  }

  private toSafeFilename(value: string): string {
    const safe = value
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9\-_]+/gi, "-")
      .replace(/^-+|-+$/g, "");

    return safe || "ricetta";
  }

  private async onRollCraftingClicked(target: HTMLElement): Promise<void> {
    const recipeId = target.dataset.recipeId ?? this.selectedRecipeId;

    if (!recipeId) {
      ui.notifications.warn("Nessuna ricetta selezionata.");
      return;
    }

    const craftingService = new CraftingService();

    await craftingService.rollCrafting(recipeId);

    const item = game.items.get(recipeId);
    const actor = canvas?.tokens?.controlled?.[0]?.actor ?? null;
    void this.addActivityLogEntry(
      "crafting",
      "Crafting eseguito",
      `Eseguito crafting${item ? `: ${item.name}` : ""}.`,
      actor?.name ?? "",
    );
  }

  private async onPreviewCraftingClicked(target: HTMLElement): Promise<void> {
    const recipeId = target.dataset.recipeId ?? this.selectedRecipeId;

    if (!recipeId) {
      ui.notifications.warn("Nessuna ricetta selezionata.");
      return;
    }

    const craftingService = new CraftingService();

    await craftingService.previewCrafting(recipeId);
  }

  private async onValidateRecipeClicked(target: HTMLElement): Promise<void> {
    const recipeId = target.dataset.recipeId ?? this.selectedRecipeId;

    if (!recipeId) {
      ui.notifications.warn("Nessuna ricetta selezionata.");
      return;
    }

    const craftingService = new CraftingService();

    await craftingService.validateRecipe(recipeId);
  }

  private onSelectRecipeClicked(target: HTMLElement): void {
    const recipeId = target.dataset.recipeId;

    if (!recipeId) {
      return;
    }

    this.selectedRecipeId = recipeId;

    this.selectedSectionId = "recipes";
    this.expandedExplorerSectionIds.add("recipes");

    this.renderPreservingUiState();
  }

  private async onAddComponentClicked(target: HTMLElement): Promise<void> {
    const recipeId = target.dataset.recipeId ?? this.selectedRecipeId;

    const collection = target.dataset.collection as
      RecipeComponentCollection | undefined;

    if (!recipeId || !collection) {
      ui.notifications.warn("Ricetta o sezione non valida.");
      return;
    }

    const panel = target.closest<HTMLElement>(".artisan-component-panel");

    if (!panel) {
      ui.notifications.warn("Pannello non trovato.");
      return;
    }

    const uuidInput = panel.querySelector<HTMLInputElement>(
      "[data-artisan-component-uuid]",
    );

    const quantityInput = panel.querySelector<HTMLInputElement>(
      "[data-artisan-component-quantity]",
    );

    const uuid = uuidInput?.value.trim() ?? "";

    const quantity = Math.max(1, Number(quantityInput?.value || 1));

    if (!uuid) {
      ui.notifications.warn("Inserisci un UUID.");
      return;
    }

    await this.addComponentToRecipe(recipeId, collection, uuid, quantity);

    if (uuidInput) {
      uuidInput.value = "";
    }

    if (quantityInput) {
      quantityInput.value = "1";
    }

    this.renderPreservingUiState();
  }

  private async onComponentDropped(
    event: DragEvent,
    dropZone: HTMLElement,
  ): Promise<void> {
    const recipeId = dropZone.dataset.recipeId ?? this.selectedRecipeId;

    const collection = dropZone.dataset.collection as
      RecipeComponentCollection | undefined;

    if (!recipeId || !collection) {
      ui.notifications.warn("Ricetta o sezione non valida.");
      return;
    }

    const uuid = this.getUuidFromDragEvent(event);

    if (!uuid) {
      ui.notifications.warn(
        "Non riesco a leggere l'UUID dell'elemento trascinato.",
      );
      return;
    }

    const panel = dropZone.closest<HTMLElement>(".artisan-component-panel");

    const quantityInput = panel?.querySelector<HTMLInputElement>(
      "[data-artisan-component-quantity]",
    );

    const quantity = Math.max(1, Number(quantityInput?.value || 1));

    await this.addComponentToRecipe(recipeId, collection, uuid, quantity);

    if (quantityInput) {
      quantityInput.value = "1";
    }

    this.renderPreservingUiState();
  }

  private getUuidFromDragEvent(event: DragEvent): string | null {
    const rawData =
      event.dataTransfer?.getData("text/plain") ||
      event.dataTransfer?.getData("application/json");

    if (!rawData) {
      return null;
    }

    try {
      const data = JSON.parse(rawData);

      if (typeof data.uuid === "string" && data.uuid.length > 0) {
        return data.uuid;
      }

      const documentType = String(data.type ?? data.documentName ?? "Item");

      if (typeof data.pack === "string" && typeof data.id === "string") {
        const packDocumentType = documentType === "Actor" ? "Actor" : "Item";
        return `Compendium.${data.pack}.${packDocumentType}.${data.id}`;
      }

      if (
        (documentType === "Item" || documentType === "Actor") &&
        typeof data.id === "string"
      ) {
        return `${documentType}.${data.id}`;
      }

      return null;
    } catch (_error) {
      return null;
    }
  }

  private async addComponentToRecipe(
    recipeId: string,
    collection: RecipeComponentCollection,
    uuid: string,
    quantity: number,
  ): Promise<void> {
    const recipeService = new RecipeService();

    await recipeService.addRecipeComponent(
      recipeId,
      collection,
      uuid,
      quantity,
    );
  }

  private async onOpenComponentClicked(target: HTMLElement): Promise<void> {
    const uuid = target.dataset.uuid;

    if (!uuid) {
      ui.notifications.warn("UUID non valido.");
      return;
    }

    const recipeService = new RecipeService();

    await recipeService.openComponentDocument(uuid);
  }

  private async onRemoveComponentClicked(target: HTMLElement): Promise<void> {
    const recipeId = target.dataset.recipeId;

    const collection = target.dataset.collection as
      RecipeComponentCollection | undefined;

    const index = Number(target.dataset.index);

    if (!recipeId || !collection || Number.isNaN(index)) {
      ui.notifications.warn("Elemento non valido.");
      return;
    }

    const recipeService = new RecipeService();

    await recipeService.removeRecipeComponent(recipeId, collection, index);

    this.renderPreservingUiState();
  }

  private async onActorProfessionFieldChanged(
    target: HTMLInputElement,
  ): Promise<void> {
    const actor = canvas?.tokens?.controlled?.[0]?.actor ?? null;

    if (!actor) {
      ui.notifications.warn(
        "Seleziona un token con attore per modificare le professioni del PG.",
      );
      return;
    }

    const professionId = target.dataset.professionId;

    const field = target.dataset.actorProfessionField;

    if (!professionId || !field) {
      return;
    }

    const professionService = new ProfessionService();

    const current = professionService.getActorProfession(actor, professionId);

    const nextXp =
      field === "xp"
        ? Math.max(0, Math.floor(Number(target.value || 0)))
        : current.xp;

    const nextLevel =
      field === "xp"
        ? professionService.getLevelFromXp(nextXp, current.maxLevel)
        : professionService.normalizeLevel(target.value);

    await professionService.setActorProfession(
      actor,
      professionId,
      nextLevel,
      nextXp,
    );

    this.renderPreservingUiState();
  }

  private async onNewForagingProfileClicked(): Promise<void> {
    const service = new ForagingService();

    const profile = await service.createProfile();

    this.selectedForagingProfileId = profile.id;

    this.selectedSectionId = "foraging";
    this.expandedExplorerSectionIds.add("foraging");

    this.renderPreservingUiState();
  }

  private async onDeleteForagingProfileClicked(
    target: HTMLElement,
  ): Promise<void> {
    const profileId =
      target.dataset.profileId ?? this.selectedForagingProfileId;

    if (!profileId) {
      ui.notifications.warn("Nessuna lista di raccolta selezionata.");
      return;
    }

    const service = new ForagingService();

    const profile = service.getProfile(profileId);

    if (!profile) {
      ui.notifications.warn("Lista di raccolta non trovata.");
      return;
    }

    const confirmed = await this.confirmDeleteForagingProfile(profile.name);

    if (!confirmed) {
      return;
    }

    await service.deleteProfile(profileId);

    const profiles = service.getProfiles();

    this.selectedForagingProfileId = profiles[0]?.id ?? null;

    this.selectedSectionId = "foraging";

    this.renderPreservingUiState();
  }

  private async confirmDeleteForagingProfile(
    profileName: string,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      new Dialog({
        title: "Cancella lista di raccolta",
        content: `
                    <p>Vuoi cancellare definitivamente questa lista di raccolta?</p>
                    <p><strong>${profileName}</strong></p>
                    <p><em>L'operazione non può essere annullata.</em></p>
                `,
        buttons: {
          cancel: {
            label: game.i18n.localize("ARTISAN.Cancel"),
            callback: () => resolve(false),
          },
          delete: {
            label: game.i18n.localize("ARTISAN.Delete"),
            callback: () => resolve(true),
          },
        },
        default: "cancel",
        close: () => resolve(false),
      }).render(true);
    });
  }

  private onSelectForagingProfileClicked(target: HTMLElement): void {
    const profileId = target.dataset.profileId;

    if (!profileId) {
      return;
    }

    this.selectedForagingProfileId = profileId;

    this.selectedSectionId = "foraging";

    this.renderPreservingUiState();
  }

  private async onSaveActorProfessionClicked(
    button: HTMLElement,
  ): Promise<void> {
    const profileId =
      button.dataset.profileId ?? this.selectedForagingProfileId;

    if (!profileId) {
      ui.notifications.warn(game.i18n.localize("ARTISAN.SelectForagingList"));
      return;
    }

    const profile = new ForagingService().getProfile(profileId);

    if (!profile) {
      ui.notifications.warn("Lista di raccolta non trovata.");
      return;
    }

    const actor = canvas?.tokens?.controlled?.[0]?.actor ?? null;

    if (!actor) {
      ui.notifications.warn(
        "Seleziona un token con attore prima di salvare la professione sul PG.",
      );
      return;
    }

    const professionService = new ProfessionService();

    const current = professionService.getActorProfession(
      actor,
      profile.profession,
    );

    await professionService.setActorProfession(
      actor,
      profile.profession,
      profile.professionLevel,
      current.xp,
    );

    ui.notifications.info(
      `Professione ${professionService.getLabel(profile.profession)} salvata su ${actor.name}.`,
    );

    this.renderPreservingUiState();
  }

  private async onForagingFieldChanged(
    target: HTMLInputElement | HTMLSelectElement,
  ): Promise<void> {
    const profileId =
      target.dataset.profileId ?? this.selectedForagingProfileId;

    const field = target.dataset.artisanForagingField;

    if (!profileId || !field) {
      return;
    }

    const service = new ForagingService();
    const value = this.parseFieldValue(target);

    if (field === "profession") {
      const defaultSkill = new ProfessionService().getDefaultSkill(
        String(value),
      );

      await service.updateProfile(profileId, {
        profession: String(value),
        ...(defaultSkill ? { skill: defaultSkill } : {}),
      } as any);

      this.renderPreservingUiState();

      return;
    }

    await service.updateProfile(profileId, {
      [field]: value,
    } as any);

    this.renderPreservingUiState();
  }

  private async onForagingComponentFieldChanged(
    target: HTMLInputElement | HTMLSelectElement,
  ): Promise<void> {
    const profileId =
      target.dataset.profileId ?? this.selectedForagingProfileId;

    const collection = target.dataset.collection as
      ForagingComponentCollection | undefined;

    const index = Number(target.dataset.index);

    const field = target.dataset.artisanForagingComponentField;

    if (!profileId || !collection || Number.isNaN(index) || !field) {
      ui.notifications.warn("Elemento Raccolta non valido.");
      return;
    }

    const service = new ForagingService();

    await service.updateComponent(profileId, collection, index, {
      [field]: this.parseFieldValue(target),
    } as any);

    this.renderPreservingUiState();
  }

  private async onAddForagingComponentClicked(
    target: HTMLElement,
  ): Promise<void> {
    const profileId =
      target.dataset.profileId ?? this.selectedForagingProfileId;

    const collection = target.dataset.collection as
      ForagingComponentCollection | undefined;

    if (!profileId || !collection) {
      ui.notifications.warn("Lista Raccolta o sezione non valida.");
      return;
    }

    const panel = target.closest<HTMLElement>(".artisan-foraging-panel");

    if (!panel) {
      ui.notifications.warn("Pannello Raccolta non trovato.");
      return;
    }

    const uuidInput = panel.querySelector<HTMLInputElement>(
      "[data-artisan-foraging-component-uuid]",
    );

    const quantityInput = panel.querySelector<HTMLInputElement>(
      "[data-artisan-foraging-component-quantity]",
    );

    const weightInput = panel.querySelector<HTMLInputElement>(
      "[data-artisan-foraging-component-weight]",
    );

    const rarityInput = panel.querySelector<HTMLSelectElement>(
      "[data-artisan-foraging-component-rarity]",
    );

    const minQuantityInput = panel.querySelector<HTMLInputElement>(
      "[data-artisan-foraging-component-min-quantity]",
    );

    const maxQuantityInput = panel.querySelector<HTMLInputElement>(
      "[data-artisan-foraging-component-max-quantity]",
    );

    const uuid = uuidInput?.value.trim() ?? "";

    const quantity = Math.max(1, Number(quantityInput?.value || 1));

    const weight = weightInput?.value
      ? Math.max(0.1, Number(weightInput.value))
      : undefined;

    const rarity = rarityInput?.value || "common";

    const minQuantity = Math.max(
      1,
      Number(minQuantityInput?.value || quantity),
    );

    const maxQuantity = Math.max(
      minQuantity,
      Number(maxQuantityInput?.value || minQuantity),
    );

    if (!uuid) {
      ui.notifications.warn("Inserisci un UUID.");
      return;
    }

    const service = new ForagingService();

    await service.addComponent(profileId, collection, uuid, quantity, {
      weight,
      minQuantity,
      maxQuantity,
      rarity,
    });

    if (uuidInput) {
      uuidInput.value = "";
    }

    if (quantityInput) {
      quantityInput.value = "1";
    }

    if (weightInput) {
      weightInput.value = "";
    }

    if (rarityInput) {
      rarityInput.value = "common";
    }

    if (minQuantityInput) {
      minQuantityInput.value = "1";
    }

    if (maxQuantityInput) {
      maxQuantityInput.value = "1";
    }

    this.renderPreservingUiState();
  }

  private async onForagingComponentDropped(
    event: DragEvent,
    dropZone: HTMLElement,
  ): Promise<void> {
    const profileId =
      dropZone.dataset.profileId ?? this.selectedForagingProfileId;

    const collection = dropZone.dataset.collection as
      ForagingComponentCollection | undefined;

    if (!profileId || !collection) {
      ui.notifications.warn("Lista Raccolta o sezione non valida.");
      return;
    }

    const uuid = this.getUuidFromDragEvent(event);

    if (!uuid) {
      ui.notifications.warn(
        "Non riesco a leggere l'UUID dell'elemento trascinato.",
      );
      return;
    }

    const panel = dropZone.closest<HTMLElement>(".artisan-foraging-panel");

    const quantityInput = panel?.querySelector<HTMLInputElement>(
      "[data-artisan-foraging-component-quantity]",
    );

    const weightInput = panel?.querySelector<HTMLInputElement>(
      "[data-artisan-foraging-component-weight]",
    );

    const rarityInput = panel?.querySelector<HTMLSelectElement>(
      "[data-artisan-foraging-component-rarity]",
    );

    const minQuantityInput = panel?.querySelector<HTMLInputElement>(
      "[data-artisan-foraging-component-min-quantity]",
    );

    const maxQuantityInput = panel?.querySelector<HTMLInputElement>(
      "[data-artisan-foraging-component-max-quantity]",
    );

    const quantity = Math.max(1, Number(quantityInput?.value || 1));

    const weight = weightInput?.value
      ? Math.max(0.1, Number(weightInput.value))
      : undefined;

    const rarity = rarityInput?.value || "common";

    const minQuantity = Math.max(
      1,
      Number(minQuantityInput?.value || quantity),
    );

    const maxQuantity = Math.max(
      minQuantity,
      Number(maxQuantityInput?.value || minQuantity),
    );

    const service = new ForagingService();

    await service.addComponent(profileId, collection, uuid, quantity, {
      weight,
      minQuantity,
      maxQuantity,
      rarity,
    });

    if (quantityInput) {
      quantityInput.value = "1";
    }

    if (weightInput) {
      weightInput.value = "";
    }

    if (rarityInput) {
      rarityInput.value = "common";
    }

    if (minQuantityInput) {
      minQuantityInput.value = "1";
    }

    if (maxQuantityInput) {
      maxQuantityInput.value = "1";
    }

    this.renderPreservingUiState();
  }

  private async onRemoveForagingComponentClicked(
    target: HTMLElement,
  ): Promise<void> {
    const profileId = target.dataset.profileId;

    const collection = target.dataset.collection as
      ForagingComponentCollection | undefined;

    const index = Number(target.dataset.index);

    if (!profileId || !collection || Number.isNaN(index)) {
      ui.notifications.warn("Elemento Raccolta non valido.");
      return;
    }

    const service = new ForagingService();

    await service.removeComponent(profileId, collection, index);

    this.renderPreservingUiState();
  }

  private async onStartForagingClicked(target: HTMLElement): Promise<void> {
    const profileId =
      target.dataset.profileId ?? this.selectedForagingProfileId;

    if (!profileId) {
      ui.notifications.warn("Nessuna lista di raccolta selezionata.");
      return;
    }

    const service = new ForagingService();

    const profile = service.getProfile(profileId);
    const actor = canvas?.tokens?.controlled?.[0]?.actor ?? null;

    await service.startForaging(profileId);

    void this.addActivityLogEntry(
      "foraging",
      "Raccolta eseguita",
      `Eseguita raccolta${profile ? `: ${profile.name}` : ""}.`,
      actor?.name ?? "",
    );
  }

  private onExportForagingClicked(): void {
    const service = new ForagingService();

    service.exportProfiles();
    void this.addActivityLogEntry(
      "export",
      "Liste Raccolta esportate",
      `Esportate ${service.getProfiles().length} liste di raccolta.`,
    );
  }

  private onImportForagingClicked(): void {
    const element = this.getRootElement();

    const input = element?.querySelector<HTMLInputElement>(
      "[data-artisan-import-foraging-file]",
    );

    if (!input) {
      ui.notifications.warn("Campo import Raccolta non trovato.");
      return;
    }

    input.value = "";
    input.click();
  }

  private async onImportForagingFileChanged(target: HTMLInputElement): Promise<void> {
    const file = target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const text = await this.readTextFile(file);
      const payload = JSON.parse(text);
      const service = new ForagingService();
      const result = await service.importProfiles(payload);

      if (result.imported <= 0 && result.skipped <= 0) {
        ui.notifications.warn("Il file non contiene liste di raccolta importabili.");
        return;
      }

      ui.notifications.info(
        `Import Raccolta completato: ${result.imported} liste importate, ${result.skipped} saltate.`,
      );
      void this.addActivityLogEntry(
        "import",
        "Liste Raccolta importate",
        `${result.imported} liste importate, ${result.skipped} saltate.`,
      );

      const profiles = service.getProfiles();
      this.selectedForagingProfileId = profiles[profiles.length - 1]?.id ?? this.selectedForagingProfileId;
      this.selectedSectionId = "foraging";
      this.renderPreservingUiState();
    } catch (error) {
      console.error("Artisan | Import Raccolta fallito", error);
      ui.notifications.error("Import Raccolta fallito. Controlla che il JSON sia valido.");
    } finally {
      target.value = "";
    }
  }

  private async onNewHarvestProfileClicked(): Promise<void> {
    const service = new HarvestService();

    const profile = await service.createProfile();

    this.selectedHarvestProfileId = profile.id;

    this.selectedSectionId = "harvest";
    this.expandedExplorerSectionIds.add("harvest");

    this.renderPreservingUiState();
  }

  private async onDeleteHarvestProfileClicked(
    target: HTMLElement,
  ): Promise<void> {
    const profileId = target.dataset.profileId ?? this.selectedHarvestProfileId;

    if (!profileId) {
      ui.notifications.warn("Nessuna lista di caccia selezionata.");
      return;
    }

    const service = new HarvestService();

    const profile = service.getProfile(profileId);

    if (!profile) {
      ui.notifications.warn("Lista di caccia non trovata.");
      return;
    }

    const confirmed = await this.confirmDeleteHarvestProfile(profile.name);

    if (!confirmed) {
      return;
    }

    await service.deleteProfile(profileId);

    const profiles = service.getProfiles();

    this.selectedHarvestProfileId = profiles[0]?.id ?? null;

    this.selectedSectionId = "harvest";

    this.renderPreservingUiState();
  }

  private async confirmDeleteHarvestProfile(
    profileName: string,
  ): Promise<boolean> {
    return new Promise((resolve) => {
      new Dialog({
        title: "Cancella lista di caccia",
        content: `
                    <p>Vuoi cancellare definitivamente questa lista di caccia?</p>
                    <p><strong>${profileName}</strong></p>
                    <p><em>L'operazione non può essere annullata.</em></p>
                `,
        buttons: {
          cancel: {
            label: game.i18n.localize("ARTISAN.Cancel"),
            callback: () => resolve(false),
          },
          delete: {
            label: game.i18n.localize("ARTISAN.Delete"),
            callback: () => resolve(true),
          },
        },
        default: "cancel",
        close: () => resolve(false),
      }).render(true);
    });
  }

  private onSelectHarvestProfileClicked(target: HTMLElement): void {
    const profileId = target.dataset.profileId;

    if (!profileId) {
      return;
    }

    this.selectedHarvestProfileId = profileId;

    this.selectedSectionId = "harvest";

    this.renderPreservingUiState();
  }

  private async onHarvestFieldChanged(
    target: HTMLInputElement | HTMLSelectElement,
  ): Promise<void> {
    const profileId = target.dataset.profileId ?? this.selectedHarvestProfileId;

    const field = target.dataset.artisanHarvestField;

    if (!profileId || !field) {
      return;
    }

    const service = new HarvestService();
    const value = this.parseFieldValue(target);

    if (field === "profession") {
      const defaultSkill = new ProfessionService().getDefaultSkill(
        String(value),
      );

      await service.updateProfile(profileId, {
        profession: String(value),
        ...(defaultSkill ? { skill: defaultSkill } : {}),
      } as any);

      this.renderPreservingUiState();

      return;
    }

    await service.updateProfile(profileId, {
      [field]: value,
    } as any);

    this.renderPreservingUiState();
  }

  private async onHarvestComponentFieldChanged(
    target: HTMLInputElement | HTMLSelectElement,
  ): Promise<void> {
    const profileId = target.dataset.profileId ?? this.selectedHarvestProfileId;

    const collection = target.dataset.collection as
      HarvestComponentCollection | undefined;

    const index = Number(target.dataset.index);

    const field = target.dataset.artisanHarvestComponentField;

    if (!profileId || !collection || Number.isNaN(index) || !field) {
      ui.notifications.warn("Elemento Caccia non valido.");
      return;
    }

    const service = new HarvestService();

    await service.updateComponent(profileId, collection, index, {
      [field]: this.parseFieldValue(target),
    } as any);

    this.renderPreservingUiState();
  }

  private async onAddHarvestComponentClicked(
    target: HTMLElement,
  ): Promise<void> {
    const profileId = target.dataset.profileId ?? this.selectedHarvestProfileId;

    const collection = target.dataset.collection as
      HarvestComponentCollection | undefined;

    if (!profileId || !collection) {
      ui.notifications.warn("Lista Caccia o sezione non valida.");
      return;
    }

    const panel = target.closest<HTMLElement>(".artisan-harvest-panel");

    if (!panel) {
      ui.notifications.warn("Pannello Caccia non trovato.");
      return;
    }

    const uuidInput = panel.querySelector<HTMLInputElement>(
      "[data-artisan-harvest-component-uuid]",
    );

    const quantityInput = panel.querySelector<HTMLInputElement>(
      "[data-artisan-harvest-component-quantity]",
    );

    const weightInput = panel.querySelector<HTMLInputElement>(
      "[data-artisan-harvest-component-weight]",
    );

    const minQuantityInput = panel.querySelector<HTMLInputElement>(
      "[data-artisan-harvest-component-min-quantity]",
    );

    const maxQuantityInput = panel.querySelector<HTMLInputElement>(
      "[data-artisan-harvest-component-max-quantity]",
    );

    const rarityInput = panel.querySelector<HTMLSelectElement>(
      "[data-artisan-harvest-component-rarity]",
    );

    const requiredToolInput = panel.querySelector<HTMLInputElement>(
      "[data-artisan-harvest-component-required-tool-uuid]",
    );

    const uuid = uuidInput?.value.trim() ?? "";

    const quantity = Math.max(1, Number(quantityInput?.value || 1));

    const weight = weightInput?.value
      ? Math.max(0.1, Number(weightInput.value))
      : undefined;

    const minQuantity = Math.max(
      1,
      Number(minQuantityInput?.value || quantity),
    );

    const maxQuantity = Math.max(
      minQuantity,
      Number(maxQuantityInput?.value || minQuantity),
    );

    const rarity = rarityInput?.value || "common";

    const requiredToolUuid = requiredToolInput?.value.trim() || undefined;

    if (!uuid) {
      ui.notifications.warn("Inserisci un UUID.");
      return;
    }

    const service = new HarvestService();

    await service.addComponent(profileId, collection, uuid, quantity, {
      weight,
      minQuantity,
      maxQuantity,
      rarity,
      requiredToolUuid,
    });

    if (uuidInput) {
      uuidInput.value = "";
    }

    if (quantityInput) {
      quantityInput.value = "1";
    }

    if (weightInput) {
      weightInput.value = "";
    }

    if (minQuantityInput) {
      minQuantityInput.value = "1";
    }

    if (maxQuantityInput) {
      maxQuantityInput.value = "1";
    }

    if (rarityInput) {
      rarityInput.value = "common";
    }

    if (requiredToolInput) {
      requiredToolInput.value = "";
    }

    this.renderPreservingUiState();
  }

  private async onHarvestComponentDropped(
    event: DragEvent,
    dropZone: HTMLElement,
  ): Promise<void> {
    const profileId =
      dropZone.dataset.profileId ?? this.selectedHarvestProfileId;

    const collection = dropZone.dataset.collection as
      HarvestComponentCollection | undefined;

    if (!profileId || !collection) {
      ui.notifications.warn("Lista Caccia o sezione non valida.");
      return;
    }

    const uuid = this.getUuidFromDragEvent(event);

    if (!uuid) {
      ui.notifications.warn(
        "Non riesco a leggere l'UUID dell'elemento trascinato.",
      );
      return;
    }

    const panel = dropZone.closest<HTMLElement>(".artisan-harvest-panel");

    const quantityInput = panel?.querySelector<HTMLInputElement>(
      "[data-artisan-harvest-component-quantity]",
    );

    const weightInput = panel?.querySelector<HTMLInputElement>(
      "[data-artisan-harvest-component-weight]",
    );

    const minQuantityInput = panel?.querySelector<HTMLInputElement>(
      "[data-artisan-harvest-component-min-quantity]",
    );

    const maxQuantityInput = panel?.querySelector<HTMLInputElement>(
      "[data-artisan-harvest-component-max-quantity]",
    );

    const rarityInput = panel?.querySelector<HTMLSelectElement>(
      "[data-artisan-harvest-component-rarity]",
    );

    const requiredToolInput = panel?.querySelector<HTMLInputElement>(
      "[data-artisan-harvest-component-required-tool-uuid]",
    );

    const quantity = Math.max(1, Number(quantityInput?.value || 1));

    const weight = weightInput?.value
      ? Math.max(0.1, Number(weightInput.value))
      : undefined;

    const minQuantity = Math.max(
      1,
      Number(minQuantityInput?.value || quantity),
    );

    const maxQuantity = Math.max(
      minQuantity,
      Number(maxQuantityInput?.value || minQuantity),
    );

    const rarity = rarityInput?.value || "common";

    const requiredToolUuid = requiredToolInput?.value.trim() || undefined;

    const service = new HarvestService();

    await service.addComponent(profileId, collection, uuid, quantity, {
      weight,
      minQuantity,
      maxQuantity,
      rarity,
      requiredToolUuid,
    });

    if (quantityInput) {
      quantityInput.value = "1";
    }

    if (weightInput) {
      weightInput.value = "";
    }

    if (minQuantityInput) {
      minQuantityInput.value = "1";
    }

    if (maxQuantityInput) {
      maxQuantityInput.value = "1";
    }

    if (rarityInput) {
      rarityInput.value = "common";
    }

    if (requiredToolInput) {
      requiredToolInput.value = "";
    }

    this.renderPreservingUiState();
  }

  private async onRemoveHarvestComponentClicked(
    target: HTMLElement,
  ): Promise<void> {
    const profileId = target.dataset.profileId;

    const collection = target.dataset.collection as
      HarvestComponentCollection | undefined;

    const index = Number(target.dataset.index);

    if (!profileId || !collection || Number.isNaN(index)) {
      ui.notifications.warn("Elemento Caccia non valido.");
      return;
    }

    const service = new HarvestService();

    await service.removeComponent(profileId, collection, index);

    this.renderPreservingUiState();
  }

  private async onStartHarvestClicked(target: HTMLElement): Promise<void> {
    const profileId = target.dataset.profileId ?? this.selectedHarvestProfileId;

    if (!profileId) {
      ui.notifications.warn("Nessuna lista di caccia selezionata.");
      return;
    }

    const service = new HarvestService();

    const profile = service.getProfile(profileId);
    const actor = canvas?.tokens?.controlled?.[0]?.actor ?? null;

    await service.startHarvest(profileId);

    void this.addActivityLogEntry(
      "harvest",
      "Caccia eseguita",
      `Eseguita Caccia${profile ? `: ${profile.name}` : ""}.`,
      actor?.name ?? "",
    );
  }

  private onExportHarvestClicked(): void {
    const service = new HarvestService();

    service.exportProfiles();
    void this.addActivityLogEntry(
      "export",
      "Liste Caccia esportate",
      `Esportate ${service.getProfiles().length} liste di caccia.`,
    );
  }

  private onImportHarvestClicked(): void {
    const element = this.getRootElement();

    const input = element?.querySelector<HTMLInputElement>(
      "[data-artisan-import-harvest-file]",
    );

    if (!input) {
      ui.notifications.warn("Campo import Caccia non trovato.");
      return;
    }

    input.value = "";
    input.click();
  }

  private async onImportHarvestFileChanged(target: HTMLInputElement): Promise<void> {
    const file = target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const text = await this.readTextFile(file);
      const payload = JSON.parse(text);
      const service = new HarvestService();
      const result = await service.importProfiles(payload);

      if (result.imported <= 0 && result.skipped <= 0) {
        ui.notifications.warn("Il file non contiene liste di caccia importabili.");
        return;
      }

      ui.notifications.info(
        `Import Caccia completato: ${result.imported} liste importate, ${result.skipped} saltate.`,
      );
      void this.addActivityLogEntry(
        "import",
        "Liste Caccia importate",
        `${result.imported} liste importate, ${result.skipped} saltate.`,
      );

      const profiles = service.getProfiles();
      this.selectedHarvestProfileId = profiles[profiles.length - 1]?.id ?? this.selectedHarvestProfileId;
      this.selectedSectionId = "harvest";
      this.renderPreservingUiState();
    } catch (error) {
      console.error("Artisan | Import Caccia fallito", error);
      ui.notifications.error("Import Caccia fallito. Controlla che il JSON sia valido.");
    } finally {
      target.value = "";
    }
  }

  private async onNewDisassemblyProfileClicked(): Promise<void> {
    const service = new DisassemblyService();
    const profile = await service.createProfile();
    this.selectedDisassemblyProfileId = profile.id;
    this.selectedSectionId = "disassembly";
    this.expandedExplorerSectionIds.add("disassembly");
    this.renderPreservingUiState();
  }

  private async onDeleteDisassemblyProfileClicked(target: HTMLElement): Promise<void> {
    const profileId = target.dataset.profileId ?? this.selectedDisassemblyProfileId;

    if (!profileId) {
      ui.notifications.warn("Nessuna lista Dissassemblare selezionata.");
      return;
    }

    const service = new DisassemblyService();
    const profile = service.getProfile(profileId);

    if (!profile) {
      ui.notifications.warn("Lista Dissassemblare non trovata.");
      return;
    }

    const confirmed = await this.confirmDeleteDisassemblyProfile(profile.name);

    if (!confirmed) {
      return;
    }

    await service.deleteProfile(profileId);
    const profiles = service.getProfiles();
    this.selectedDisassemblyProfileId = profiles[0]?.id ?? null;
    this.selectedSectionId = "disassembly";
    this.renderPreservingUiState();
  }

  private async confirmDeleteDisassemblyProfile(profileName: string): Promise<boolean> {
    return new Promise((resolve) => {
      new Dialog({
        title: "Cancella lista Dissassemblare",
        content: `
          <p>Vuoi cancellare definitivamente questa lista Dissassemblare?</p>
          <p><strong>${profileName}</strong></p>
          <p><em>L'operazione non può essere annullata.</em></p>
        `,
        buttons: {
          cancel: {
            label: game.i18n.localize("ARTISAN.Cancel"),
            callback: () => resolve(false),
          },
          delete: {
            label: game.i18n.localize("ARTISAN.Delete"),
            callback: () => resolve(true),
          },
        },
        default: "cancel",
        close: () => resolve(false),
      }).render(true);
    });
  }

  private onSelectDisassemblyProfileClicked(target: HTMLElement): void {
    const profileId = target.dataset.profileId;

    if (!profileId) {
      return;
    }

    this.selectedDisassemblyProfileId = profileId;
    this.selectedSectionId = "disassembly";
    this.renderPreservingUiState();
  }

  private async onDisassemblyFieldChanged(target: HTMLInputElement | HTMLSelectElement): Promise<void> {
    const profileId = target.dataset.profileId ?? this.selectedDisassemblyProfileId;
    const field = target.dataset.artisanDisassemblyField;

    if (!profileId || !field) {
      return;
    }

    const service = new DisassemblyService();
    const value = this.parseFieldValue(target);

    if (field === "profession") {
      const defaultSkill = new ProfessionService().getDefaultSkill(String(value));
      await service.updateProfile(profileId, {
        profession: String(value),
        ...(defaultSkill ? { skill: defaultSkill } : {}),
      } as any);
      this.renderPreservingUiState();
      return;
    }

    await service.updateProfile(profileId, { [field]: value } as any);
    this.renderPreservingUiState();
  }

  private async onDisassemblyComponentFieldChanged(target: HTMLInputElement | HTMLSelectElement): Promise<void> {
    const profileId = target.dataset.profileId ?? this.selectedDisassemblyProfileId;
    const collection = target.dataset.collection as DisassemblyComponentCollection | undefined;
    const index = Number(target.dataset.index);
    const field = target.dataset.artisanDisassemblyComponentField;

    if (!profileId || !collection || Number.isNaN(index) || !field) {
      ui.notifications.warn("Elemento Dissassemblare non valido.");
      return;
    }

    const service = new DisassemblyService();
    await service.updateComponent(profileId, collection, index, { [field]: this.parseFieldValue(target) } as any);
    this.renderPreservingUiState();
  }

  private async onAddDisassemblyComponentClicked(target: HTMLElement): Promise<void> {
    const profileId = target.dataset.profileId ?? this.selectedDisassemblyProfileId;
    const collection = target.dataset.collection as DisassemblyComponentCollection | undefined;

    if (!profileId || !collection) {
      ui.notifications.warn("Lista Dissassemblare o sezione non valida.");
      return;
    }

    const panel = target.closest<HTMLElement>(".artisan-disassembly-panel");

    if (!panel) {
      ui.notifications.warn("Pannello Dissassemblare non trovato.");
      return;
    }

    const uuidInput = panel.querySelector<HTMLInputElement>("[data-artisan-disassembly-component-uuid]");
    const quantityInput = panel.querySelector<HTMLInputElement>("[data-artisan-disassembly-component-quantity]");
    const weightInput = panel.querySelector<HTMLInputElement>("[data-artisan-disassembly-component-weight]");
    const rarityInput = panel.querySelector<HTMLSelectElement>("[data-artisan-disassembly-component-rarity]");
    const minQuantityInput = panel.querySelector<HTMLInputElement>("[data-artisan-disassembly-component-min-quantity]");
    const maxQuantityInput = panel.querySelector<HTMLInputElement>("[data-artisan-disassembly-component-max-quantity]");
    const uuid = uuidInput?.value.trim() ?? "";
    const quantity = Math.max(1, Number(quantityInput?.value || 1));
    const weight = weightInput?.value ? Math.max(0.1, Number(weightInput.value)) : undefined;
    const rarity = rarityInput?.value || "common";
    const minQuantity = Math.max(1, Number(minQuantityInput?.value || quantity));
    const maxQuantity = Math.max(minQuantity, Number(maxQuantityInput?.value || minQuantity));

    if (!uuid) {
      ui.notifications.warn("Inserisci un UUID.");
      return;
    }

    const service = new DisassemblyService();
    await service.addComponent(profileId, collection, uuid, quantity, { weight, minQuantity, maxQuantity, rarity });

    if (uuidInput) uuidInput.value = "";
    if (quantityInput) quantityInput.value = "1";
    if (weightInput) weightInput.value = "";
    if (rarityInput) rarityInput.value = "common";
    if (minQuantityInput) minQuantityInput.value = "1";
    if (maxQuantityInput) maxQuantityInput.value = "1";
    this.renderPreservingUiState();
  }

  private async onDisassemblySourceDropped(event: DragEvent, dropZone: HTMLElement): Promise<void> {
    const profileId = dropZone.dataset.profileId ?? this.selectedDisassemblyProfileId;

    if (!profileId) {
      ui.notifications.warn("Lista Dissassemblare non valida.");
      return;
    }

    const uuid = this.getUuidFromDragEvent(event);

    if (!uuid) {
      ui.notifications.warn("Non riesco a leggere l'UUID della risorsa sorgente trascinata.");
      return;
    }

    const service = new DisassemblyService();
    await service.updateProfile(profileId, { sourceUuid: uuid } as any);
    this.renderPreservingUiState();
  }

  private async onDisassemblyComponentDropped(event: DragEvent, dropZone: HTMLElement): Promise<void> {
    const profileId = dropZone.dataset.profileId ?? this.selectedDisassemblyProfileId;
    const collection = dropZone.dataset.collection as DisassemblyComponentCollection | undefined;

    if (!profileId || !collection) {
      ui.notifications.warn("Lista Dissassemblare o sezione non valida.");
      return;
    }

    const uuid = this.getUuidFromDragEvent(event);

    if (!uuid) {
      ui.notifications.warn("Non riesco a leggere l'UUID dell'elemento trascinato.");
      return;
    }

    const panel = dropZone.closest<HTMLElement>(".artisan-disassembly-panel");
    const quantityInput = panel?.querySelector<HTMLInputElement>("[data-artisan-disassembly-component-quantity]");
    const weightInput = panel?.querySelector<HTMLInputElement>("[data-artisan-disassembly-component-weight]");
    const rarityInput = panel?.querySelector<HTMLSelectElement>("[data-artisan-disassembly-component-rarity]");
    const minQuantityInput = panel?.querySelector<HTMLInputElement>("[data-artisan-disassembly-component-min-quantity]");
    const maxQuantityInput = panel?.querySelector<HTMLInputElement>("[data-artisan-disassembly-component-max-quantity]");
    const quantity = Math.max(1, Number(quantityInput?.value || 1));
    const weight = weightInput?.value ? Math.max(0.1, Number(weightInput.value)) : undefined;
    const rarity = rarityInput?.value || "common";
    const minQuantity = Math.max(1, Number(minQuantityInput?.value || quantity));
    const maxQuantity = Math.max(minQuantity, Number(maxQuantityInput?.value || minQuantity));

    const service = new DisassemblyService();
    await service.addComponent(profileId, collection, uuid, quantity, { weight, minQuantity, maxQuantity, rarity });

    if (quantityInput) quantityInput.value = "1";
    if (weightInput) weightInput.value = "";
    if (rarityInput) rarityInput.value = "common";
    if (minQuantityInput) minQuantityInput.value = "1";
    if (maxQuantityInput) maxQuantityInput.value = "1";
    this.renderPreservingUiState();
  }

  private async onRemoveDisassemblyComponentClicked(target: HTMLElement): Promise<void> {
    const profileId = target.dataset.profileId;
    const collection = target.dataset.collection as DisassemblyComponentCollection | undefined;
    const index = Number(target.dataset.index);

    if (!profileId || !collection || Number.isNaN(index)) {
      ui.notifications.warn("Elemento Dissassemblare non valido.");
      return;
    }

    const service = new DisassemblyService();
    await service.removeComponent(profileId, collection, index);
    this.renderPreservingUiState();
  }

  private async onStartDisassemblyClicked(target: HTMLElement): Promise<void> {
    const profileId = target.dataset.profileId ?? this.selectedDisassemblyProfileId;

    if (!profileId) {
      ui.notifications.warn("Nessuna lista Dissassemblare selezionata.");
      return;
    }

    const service = new DisassemblyService();
    const profile = service.getProfile(profileId);
    const actor = canvas?.tokens?.controlled?.[0]?.actor ?? null;
    await service.startDisassembly(profileId);
    void this.addActivityLogEntry(
      "disassembly",
      "Dissassemblare eseguito",
      `Eseguito Dissassemblare${profile ? `: ${profile.name}` : ""}.`,
      actor?.name ?? "",
    );
  }

  private onExportDisassemblyClicked(): void {
    const service = new DisassemblyService();
    service.exportProfiles();
    void this.addActivityLogEntry(
      "export",
      "Liste Dissassemblare esportate",
      `Esportate ${service.getProfiles().length} liste Dissassemblare.`,
    );
  }

  private onImportDisassemblyClicked(): void {
    const element = this.getRootElement();
    const input = element?.querySelector<HTMLInputElement>("[data-artisan-import-disassembly-file]");

    if (!input) {
      ui.notifications.warn("Campo import Dissassemblare non trovato.");
      return;
    }

    input.value = "";
    input.click();
  }

  private async onImportDisassemblyFileChanged(target: HTMLInputElement): Promise<void> {
    const file = target.files?.[0];

    if (!file) {
      return;
    }

    try {
      const text = await this.readTextFile(file);
      const payload = JSON.parse(text);
      const service = new DisassemblyService();
      const result = await service.importProfiles(payload);

      if (result.imported <= 0 && result.skipped <= 0) {
        ui.notifications.warn("Il file non contiene liste Dissassemblare importabili.");
        return;
      }

      ui.notifications.info(`Import Dissassemblare completato: ${result.imported} liste importate, ${result.skipped} saltate.`);
      void this.addActivityLogEntry(
        "import",
        "Liste Dissassemblare importate",
        `${result.imported} liste importate, ${result.skipped} saltate.`,
      );

      const profiles = service.getProfiles();
      this.selectedDisassemblyProfileId = profiles[profiles.length - 1]?.id ?? this.selectedDisassemblyProfileId;
      this.selectedSectionId = "disassembly";
      this.renderPreservingUiState();
    } catch (error) {
      console.error("Artisan | Import Dissassemblare fallito", error);
      ui.notifications.error("Import Dissassemblare fallito. Controlla che il JSON sia valido.");
    } finally {
      target.value = "";
    }
  }

}
