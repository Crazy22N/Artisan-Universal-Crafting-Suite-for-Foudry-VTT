// src/documents/recipe-document.ts
var RecipeDocument = class {
  static FLAG_SCOPE = "artisan";
  static FLAG_TYPE = "type";
  static FLAG_RECIPE = "recipe";
  static TYPE = "recipe";
  static isRecipe(item) {
    return item.getFlag(this.FLAG_SCOPE, this.FLAG_TYPE) === this.TYPE;
  }
  static getDefaultData() {
    return {
      category: "",
      profile: "",
      difficulty: 0,
      craftingTime: 0,
      skill: "",
      dc: 10,
      ingredients: [],
      tools: [],
      outputs: []
    };
  }
  static getData(item) {
    const data = item.getFlag(
      this.FLAG_SCOPE,
      this.FLAG_RECIPE
    );
    const merged = {
      ...this.getDefaultData(),
      ...data ?? {}
    };
    return {
      category: String(merged.category ?? ""),
      profile: String(merged.profile ?? ""),
      difficulty: Number(merged.difficulty ?? 0),
      craftingTime: Number(merged.craftingTime ?? 0),
      skill: String(merged.skill ?? ""),
      dc: Number(merged.dc ?? 10),
      ingredients: this.normalizeComponents(merged.ingredients),
      tools: this.normalizeComponents(merged.tools),
      outputs: this.normalizeComponents(merged.outputs)
    };
  }
  static async create() {
    const item = await Item.create({
      name: "Nuova Ricetta",
      type: "loot",
      img: "icons/svg/book.svg",
      flags: {
        artisan: {
          type: "recipe",
          version: 1,
          recipe: this.getDefaultData()
        }
      }
    });
    return item;
  }
  static async setRecipeData(item, data) {
    const current = this.getData(item);
    await item.setFlag(
      this.FLAG_SCOPE,
      this.FLAG_RECIPE,
      {
        ...current,
        ...data
      }
    );
  }
  static async addComponent(item, collection, component) {
    const current = this.getData(item);
    const nextComponent = this.normalizeComponent(component);
    const nextCollection = [...current[collection]];
    const existingIndex = nextCollection.findIndex((entry) => {
      return entry.uuid === nextComponent.uuid;
    });
    if (existingIndex >= 0) {
      const existing = nextCollection[existingIndex];
      nextCollection[existingIndex] = {
        ...existing,
        quantity: Math.max(
          1,
          Number(existing.quantity ?? 1) + nextComponent.quantity
        )
      };
    } else {
      nextCollection.push(nextComponent);
    }
    await this.setRecipeData(
      item,
      {
        [collection]: nextCollection
      }
    );
  }
  static async updateComponentQuantity(item, collection, index, quantity) {
    const current = this.getData(item);
    const nextCollection = [...current[collection]];
    if (!nextCollection[index]) {
      return;
    }
    nextCollection[index] = {
      ...nextCollection[index],
      quantity: Math.max(1, Number(quantity || 1))
    };
    await this.setRecipeData(
      item,
      {
        [collection]: nextCollection
      }
    );
  }
  static async removeComponent(item, collection, index) {
    const current = this.getData(item);
    const nextCollection = current[collection].filter((_entry, entryIndex) => {
      return entryIndex !== index;
    });
    await this.setRecipeData(
      item,
      {
        [collection]: nextCollection
      }
    );
  }
  static toExplorerItem(item) {
    return {
      id: item.id ?? "",
      label: item.name ?? "Senza nome",
      icon: "fa-solid fa-scroll"
    };
  }
  static async toInspectorData(item) {
    const recipe = this.getData(item);
    const ingredients = await this.toComponentViews(
      item,
      "ingredients",
      recipe.ingredients
    );
    const tools = await this.toComponentViews(
      item,
      "tools",
      recipe.tools
    );
    const outputs = await this.toComponentViews(
      item,
      "outputs",
      recipe.outputs
    );
    return {
      id: item.id,
      uuid: item.uuid,
      name: item.name,
      img: item.img,
      type: item.type,
      category: recipe.category,
      profile: recipe.profile,
      difficulty: recipe.difficulty,
      craftingTime: recipe.craftingTime,
      skill: recipe.skill,
      dc: recipe.dc,
      ingredients,
      tools,
      outputs,
      ingredientCount: ingredients.length,
      toolCount: tools.length,
      outputCount: outputs.length
    };
  }
  static normalizeComponents(components) {
    if (!Array.isArray(components)) {
      return [];
    }
    return components.map((component) => {
      return this.normalizeComponent(component);
    });
  }
  static normalizeComponent(component) {
    return {
      uuid: String(component.uuid ?? "").trim(),
      quantity: Math.max(1, Number(component.quantity ?? 1))
    };
  }
  static async toComponentViews(item, collection, components) {
    const views = components.map(async (component, index) => {
      return this.toComponentView(
        item,
        collection,
        component,
        index
      );
    });
    return Promise.all(views);
  }
  static async toComponentView(item, collection, component, index) {
    const fallback = {
      index,
      recipeId: item.id ?? "",
      collection,
      uuid: component.uuid,
      quantity: component.quantity,
      name: component.uuid,
      img: "icons/svg/item-bag.svg",
      documentType: "",
      found: false
    };
    try {
      const document2 = await fromUuid(component.uuid);
      if (!document2) {
        return fallback;
      }
      return {
        ...fallback,
        name: document2.name ?? component.uuid,
        img: document2.img ?? "icons/svg/item-bag.svg",
        documentType: document2.documentName ?? "",
        found: true
      };
    } catch (_error) {
      return fallback;
    }
  }
};

// src/repositories/recipe-repository.ts
var RecipeRepository = class {
  getRecipes() {
    return game.items.filter((item) => {
      return RecipeDocument.isRecipe(item);
    });
  }
  getRecipe(id) {
    const item = game.items.get(id);
    if (!item) {
      return void 0;
    }
    if (!RecipeDocument.isRecipe(item)) {
      return void 0;
    }
    return item;
  }
};

// src/services/profession-service.ts
var ProfessionService = class {
  professions = [
    {
      id: "erborista",
      label: "Erborista",
      skill: "nature",
      description: "Raccoglie erbe, funghi, reagenti naturali e piante medicinali.",
      maxLevel: 5
    },
    {
      id: "cacciatore",
      label: "Cacciatore",
      skill: "survival",
      description: "Segue tracce, recupera pelli, carne, ossa e materiali animali.",
      maxLevel: 5
    },
    {
      id: "minatore",
      label: "Minatore",
      skill: "athletics",
      description: "Estrae minerali, pietre, gemme grezze e materiali rocciosi.",
      maxLevel: 5
    },
    {
      id: "boscaiolo",
      label: "Boscaiolo",
      skill: "survival",
      description: "Raccoglie legname, resine, cortecce e materiali forestali.",
      maxLevel: 5
    },
    {
      id: "pescatore",
      label: "Pescatore",
      skill: "survival",
      description: "Raccoglie pesci, conchiglie, alghe e risorse d'acqua dolce o salata.",
      maxLevel: 5
    },
    {
      id: "alchimista",
      label: "Alchimista",
      skill: "arcana",
      description: "Individua reagenti rari, cristalli, essenze e materiali instabili.",
      maxLevel: 5
    },
    {
      id: "cuoco",
      label: "Cuoco",
      skill: "survival",
      description: "Cerca ingredienti commestibili, spezie, frutti e risorse alimentari.",
      maxLevel: 5
    },
    {
      id: "conciatore",
      label: "Conciatore",
      skill: "survival",
      description: "Recupera pelli, cuoio grezzo, tendini e materiali organici lavorabili.",
      maxLevel: 5
    },
    {
      id: "fabbro",
      label: "Fabbro",
      skill: "athletics",
      description: "Lavora metalli, armi, armature, chiodi, utensili e componenti da forgia.",
      maxLevel: 5
    }
  ];
  levelXpThresholds = {
    0: 0,
    1: 100,
    2: 500,
    3: 1500,
    4: 3e3,
    5: 5e3
  };
  getProfessions() {
    return [...this.professions];
  }
  getOptions() {
    return this.professions.map((profession) => ({
      id: profession.id,
      label: this.getLocalizedLabel(profession),
      skill: profession.skill,
      description: this.getLocalizedDescription(profession),
      maxLevel: profession.maxLevel
    }));
  }
  getProfession(id) {
    const clean = this.normalizeId(id);
    return this.professions.find((profession) => profession.id === clean) ?? null;
  }
  getLabel(id) {
    if (!id) {
      return "Non impostata";
    }
    const profession = this.getProfession(id);
    return profession ? this.getLocalizedLabel(profession) : id;
  }
  getDefaultSkill(id) {
    return this.getProfession(id)?.skill ?? null;
  }
  getMaxLevel(id) {
    return this.getProfession(id)?.maxLevel ?? 5;
  }
  normalizeLevel(value) {
    const level = Math.floor(Number(value ?? 1));
    if (!Number.isFinite(level)) {
      return 1;
    }
    return Math.min(5, Math.max(0, level));
  }
  getLevelLabel(value) {
    return `${game.i18n.localize("ARTISAN.Level")} ${this.normalizeLevel(value)}`;
  }
  getActorProfessions(actor) {
    return this.getProfessions().map((profession) => {
      return this.getActorProfession(actor, profession.id);
    });
  }
  getActorProfession(actor, professionId) {
    const profession = this.getProfession(professionId);
    const id = profession ? profession.id : this.normalizeId(professionId || "sconosciuta");
    const label = profession ? this.getLocalizedLabel(profession) : professionId || game.i18n.localize("ARTISAN.Unknown");
    const maxLevel = profession?.maxLevel ?? 5;
    const stored = this.getActorProfessionFlagData(actor)[id];
    const hasActorValue = !!stored;
    const level = hasActorValue ? this.normalizeLevel(stored.level ?? 0) : 0;
    const xp = Math.max(0, Math.floor(Number(stored?.xp ?? 0)));
    const progression = this.getProgressionInfo(level, xp, maxLevel);
    return {
      id,
      label,
      level,
      xp,
      maxLevel,
      xpForCurrentLevel: progression.xpForCurrentLevel,
      xpForNextLevel: progression.xpForNextLevel,
      xpToNextLevel: progression.xpToNextLevel,
      progressPercent: progression.progressPercent,
      gatheringMultiplier: this.getGatheringMultiplier(level),
      gatheringMultiplierLabel: this.getMultiplierLabel(level),
      craftingMultiplier: this.getCraftingMultiplier(level),
      craftingMultiplierLabel: this.getMultiplierLabel(level),
      hasActorValue
    };
  }
  getActorProfessionLevel(actor, professionId) {
    return this.getActorProfession(actor, professionId).level;
  }
  async setActorProfession(actor, professionId, level, xp) {
    const id = this.getProfession(professionId) ? this.normalizeId(professionId) : this.normalizeId(professionId || "sconosciuta");
    const current = this.getActorProfession(actor, id);
    const nextLevel = this.normalizeLevel(level ?? current.level);
    const nextXp = Math.max(0, Math.floor(Number(xp ?? current.xp ?? 0)));
    const all = this.getActorProfessionFlagData(actor);
    all[id] = {
      level: nextLevel,
      xp: nextXp
    };
    await actor.setFlag("artisan", "professions", all);
  }
  async addActorProfessionXp(actor, professionId, xpToAdd) {
    const current = this.getActorProfession(actor, professionId);
    const amount = Math.max(0, Math.floor(Number(xpToAdd ?? 0)));
    const nextXp = current.xp + amount;
    const levelFromXp = this.getLevelFromXp(nextXp, current.maxLevel);
    const nextLevel = Math.max(current.level, levelFromXp);
    await this.setActorProfession(
      actor,
      current.id,
      nextLevel,
      nextXp
    );
    return this.getActorProfession(actor, current.id);
  }
  getLevelFromXp(xp, maxLevel = 5) {
    const totalXp = Math.max(0, Math.floor(Number(xp ?? 0)));
    const maximum = this.normalizeLevel(maxLevel);
    let level = 0;
    for (let candidate = 0; candidate <= maximum; candidate += 1) {
      const threshold = this.getXpThresholdForLevel(candidate);
      if (totalXp >= threshold) {
        level = candidate;
      }
    }
    return Math.min(maximum, level);
  }
  getXpThresholdForLevel(level) {
    const normalized = this.normalizeLevel(level);
    return this.levelXpThresholds[normalized] ?? 0;
  }
  getNextLevelXp(level, maxLevel = 5) {
    const currentLevel = this.normalizeLevel(level);
    const maximum = this.normalizeLevel(maxLevel);
    if (currentLevel >= maximum) {
      return null;
    }
    return this.getXpThresholdForLevel(currentLevel + 1);
  }
  getProgressionInfo(level, xp, maxLevel = 5) {
    const currentLevel = this.normalizeLevel(level);
    const totalXp = Math.max(0, Math.floor(Number(xp ?? 0)));
    const currentThreshold = this.getXpThresholdForLevel(currentLevel);
    const nextThreshold = this.getNextLevelXp(currentLevel, maxLevel);
    if (nextThreshold === null) {
      return {
        xpForCurrentLevel: currentThreshold,
        xpForNextLevel: null,
        xpToNextLevel: 0,
        progressPercent: 100
      };
    }
    const span = Math.max(1, nextThreshold - currentThreshold);
    const progress = Math.min(
      span,
      Math.max(0, totalXp - currentThreshold)
    );
    return {
      xpForCurrentLevel: currentThreshold,
      xpForNextLevel: nextThreshold,
      xpToNextLevel: Math.max(0, nextThreshold - totalXp),
      progressPercent: Math.round(progress / span * 100)
    };
  }
  getActorProfessionFlagData(actor) {
    if (!actor) {
      return {};
    }
    const value = actor.getFlag("artisan", "professions");
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return {};
    }
    const data = foundry.utils.deepClone(value);
    if (data.archeologo && !data.fabbro) {
      data.fabbro = foundry.utils.deepClone(data.archeologo);
    }
    return data;
  }
  getGatheringMultiplier(value) {
    return this.getLevelMultiplier(value);
  }
  getCraftingMultiplier(value) {
    return this.getLevelMultiplier(value);
  }
  getMultiplierLabel(value) {
    return `x${this.formatMultiplier(this.getLevelMultiplier(value))}`;
  }
  getLevelMultiplier(value) {
    const multipliers = {
      0: 1,
      1: 1.2,
      2: 1.5,
      3: 2,
      4: 2.5,
      5: 3
    };
    return multipliers[this.normalizeLevel(value)] ?? 1;
  }
  formatMultiplier(value) {
    return String(value).replace(".", ",");
  }
  getLocalizedLabel(profession) {
    const key = `ARTISAN.Profession.${profession.id}.Label`;
    const localized = game.i18n.localize(key);
    return localized === key ? profession.label : localized;
  }
  getLocalizedDescription(profession) {
    const key = `ARTISAN.Profession.${profession.id}.Description`;
    const localized = game.i18n.localize(key);
    return localized === key ? profession.description : localized;
  }
  normalizeId(id) {
    const normalized = String(id ?? "").trim().toLowerCase();
    if (normalized === "archeologo") {
      return "fabbro";
    }
    return normalized;
  }
};

// src/services/crafting-service.ts
var CraftingService = class {
  repository = new RecipeRepository();
  async validateRecipe(recipeId) {
    const recipeItem = this.repository.getRecipe(recipeId);
    if (!recipeItem) {
      ui.notifications.warn("Ricetta non trovata.");
      return;
    }
    const result = await this.buildValidationResult(recipeItem);
    await this.sendValidationResultToChat(result);
    if (result.valid) {
      ui.notifications.info("Ricetta valida.");
    } else {
      ui.notifications.warn("La ricetta contiene problemi.");
    }
  }
  async previewCrafting(recipeId) {
    const recipeItem = this.repository.getRecipe(recipeId);
    if (!recipeItem) {
      ui.notifications.warn("Ricetta non trovata.");
      return;
    }
    const result = await this.buildValidationResult(recipeItem);
    await this.sendCraftingPreviewToChat(result);
    if (result.valid) {
      ui.notifications.info("Anteprima crafting generata.");
    } else {
      ui.notifications.warn("Anteprima generata, ma la ricetta contiene problemi.");
    }
  }
  async rollCrafting(recipeId) {
    const recipeItem = this.repository.getRecipe(recipeId);
    if (!recipeItem) {
      ui.notifications.warn("Ricetta non trovata.");
      return;
    }
    const actor = this.getSelectedActor();
    if (!actor) {
      ui.notifications.warn("Seleziona un token con attore prima di eseguire il crafting.");
      return;
    }
    const validation = await this.buildValidationResult(recipeItem);
    if (!validation.valid) {
      await this.sendCraftingBlockedToChat(
        actor,
        recipeItem,
        validation,
        []
      );
      ui.notifications.warn("Crafting non eseguibile: la ricetta contiene errori.");
      return;
    }
    const professionRequirement = this.getCraftingProfessionRequirement(
      actor,
      recipeItem,
      validation.recipeData
    );
    if (!professionRequirement.allowed) {
      await this.sendCraftingProfessionBlockedToChat(
        actor,
        recipeItem,
        validation,
        professionRequirement
      );
      ui.notifications.warn("Crafting non eseguibile: livello professione insufficiente.");
      return;
    }
    const maxLots = this.calculateMaxLots(actor, validation);
    if (maxLots <= 0) {
      const context2 = this.buildExecutionContext(
        actor,
        recipeItem,
        validation,
        1,
        maxLots
      );
      await this.sendCraftingBlockedToChat(
        actor,
        recipeItem,
        validation,
        [
          ...context2.ingredients.filter((match) => !match.sufficient),
          ...context2.tools.filter((match) => !match.sufficient)
        ]
      );
      ui.notifications.warn("Crafting non eseguibile: ingredienti o strumenti insufficienti.");
      return;
    }
    const requestedLots = await this.askLots(maxLots);
    if (!requestedLots) {
      return;
    }
    const lots = Math.max(
      1,
      Math.min(
        requestedLots,
        maxLots
      )
    );
    const context = this.buildExecutionContext(
      actor,
      recipeItem,
      validation,
      lots,
      maxLots
    );
    const missing = [
      ...context.ingredients.filter((match) => !match.sufficient),
      ...context.tools.filter((match) => !match.sufficient)
    ];
    if (missing.length > 0) {
      await this.sendCraftingBlockedToChat(
        actor,
        recipeItem,
        validation,
        missing
      );
      ui.notifications.warn("Crafting non eseguibile: risorse insufficienti.");
      return;
    }
    const confirmed = await this.confirmCrafting(context);
    if (!confirmed) {
      ui.notifications.info("Crafting annullato.");
      return;
    }
    const roll = await this.rollSkillCheck(
      actor,
      validation.recipeData,
      context.tools
    );
    await this.consumeIngredients(context);
    if (roll.criticalFailure) {
      await this.destroyTools(context);
    }
    const outputQuality = this.getCraftingOutputQuality(roll);
    if (roll.success) {
      await this.createOutputs(
        context,
        roll.criticalSuccess ? 2 : 1,
        outputQuality
      );
    }
    const professionXp = roll.success ? await this.awardCraftingProfessionXp(context, roll) : {
      gained: 0,
      beforeXp: context.professionRequirement.actorXp,
      afterXp: context.professionRequirement.actorXp,
      beforeLevel: context.professionRequirement.actorLevel,
      afterLevel: context.professionRequirement.actorLevel,
      xpToNextLevel: new ProfessionService().getActorProfession(context.actor, context.professionRequirement.professionId).xpToNextLevel,
      xpForNextLevel: new ProfessionService().getActorProfession(context.actor, context.professionRequirement.professionId).xpForNextLevel,
      progressPercent: new ProfessionService().getActorProfession(context.actor, context.professionRequirement.professionId).progressPercent
    };
    await this.sendCraftingResultToChat(
      context,
      roll,
      professionXp,
      outputQuality
    );
    if (roll.criticalSuccess) {
      ui.notifications.info("Successo critico: output raddoppiato.");
      return;
    }
    if (roll.criticalFailure) {
      ui.notifications.error("Fallimento critico: strumenti distrutti.");
      return;
    }
    if (roll.success) {
      ui.notifications.info("Crafting riuscito.");
    } else {
      ui.notifications.warn("Crafting fallito: ingredienti consumati.");
    }
  }
  async buildValidationResult(recipeItem) {
    const recipe = RecipeDocument.getData(recipeItem);
    const entries = [];
    entries.push(
      ...await this.validateCollection(
        "ingredients",
        recipe.ingredients
      )
    );
    entries.push(
      ...await this.validateCollection(
        "tools",
        recipe.tools
      )
    );
    entries.push(
      ...await this.validateCollection(
        "outputs",
        recipe.outputs
      )
    );
    const errors = [];
    const warnings = [];
    if (recipe.outputs.length === 0) {
      errors.push("La ricetta non ha nessun output.");
    }
    if (recipe.ingredients.length === 0) {
      warnings.push("La ricetta non ha ingredienti.");
    }
    if (recipe.tools.length === 0) {
      warnings.push("La ricetta non richiede strumenti.");
    }
    for (const entry of entries) {
      if (!entry.found) {
        errors.push(`${entry.collectionLabel}: UUID non trovato \u2192 ${entry.uuid}`);
        continue;
      }
      if (!entry.isItem) {
        errors.push(`${entry.collectionLabel}: il documento non \xE8 un Item \u2192 ${entry.uuid}`);
      }
    }
    return {
      recipeName: recipeItem.name ?? "Ricetta senza nome",
      recipeUuid: recipeItem.uuid,
      recipeData: recipe,
      valid: errors.length === 0,
      entries,
      errors,
      warnings
    };
  }
  async validateCollection(collection, components) {
    const entries = components.map((component) => {
      return this.validateComponent(
        collection,
        component
      );
    });
    return Promise.all(entries);
  }
  async validateComponent(collection, component) {
    const collectionLabel = this.getCollectionLabel(collection);
    const fallback = {
      collection,
      collectionLabel,
      uuid: component.uuid,
      quantity: component.quantity,
      name: component.uuid,
      found: false,
      isItem: false,
      message: "Documento non trovato"
    };
    if (!component.uuid || !component.uuid.trim()) {
      return {
        ...fallback,
        message: "UUID vuoto"
      };
    }
    try {
      const document2 = await fromUuid(component.uuid);
      if (!document2) {
        return fallback;
      }
      const isItem = document2.documentName === "Item";
      return {
        collection,
        collectionLabel,
        uuid: component.uuid,
        quantity: component.quantity,
        name: document2.name ?? component.uuid,
        found: true,
        isItem,
        document: isItem ? document2 : void 0,
        message: isItem ? "OK" : "Il documento non \xE8 un Item"
      };
    } catch (_error) {
      return {
        ...fallback,
        message: "UUID non leggibile"
      };
    }
  }
  getSelectedActor() {
    const controlled = canvas?.tokens?.controlled ?? [];
    if (controlled.length !== 1) {
      return null;
    }
    return controlled[0]?.actor ?? null;
  }
  getCraftingProfessionRequirement(actor, recipeItem, recipe) {
    const professionService = new ProfessionService();
    const rawRecipeFlag = recipeItem.getFlag("artisan", "recipe");
    const professionId = String(
      recipe.profile ?? rawRecipeFlag?.profile ?? ""
    ).trim();
    const rawRequiredLevel = recipe.professionLevel ?? rawRecipeFlag?.professionLevel ?? rawRecipeFlag?.requiredProfessionLevel ?? 0;
    const requiredLevel = professionService.normalizeLevel(rawRequiredLevel);
    const actorProfession = professionService.getActorProfession(actor, professionId);
    return {
      professionId: actorProfession.id,
      professionLabel: actorProfession.label,
      requiredLevel,
      actorLevel: actorProfession.level,
      actorXp: actorProfession.xp,
      allowed: requiredLevel <= 0 || actorProfession.level >= requiredLevel,
      source: actorProfession.hasActorValue ? "PG" : "Default livello 0"
    };
  }
  buildExecutionContext(actor, recipeItem, validation, lots, maxLots) {
    const ingredients = validation.entries.filter((entry) => entry.collection === "ingredients").map((entry) => this.buildActorInventoryMatch(actor, entry, lots));
    const tools = validation.entries.filter((entry) => entry.collection === "tools").map((entry) => this.buildActorInventoryMatch(actor, entry, 1));
    const outputs = validation.entries.filter((entry) => entry.collection === "outputs");
    return {
      actor,
      recipeItem,
      validation,
      professionRequirement: this.getCraftingProfessionRequirement(actor, recipeItem, validation.recipeData),
      lots,
      maxLots,
      ingredients,
      tools,
      outputs
    };
  }
  buildActorInventoryMatch(actor, entry, multiplier) {
    const actorItem = this.findMatchingActorItem(actor, entry);
    const requiredQuantity = Math.max(
      1,
      Number(entry.quantity || 1)
    ) * Math.max(1, multiplier);
    const availableQuantity = actorItem ? this.getItemQuantity(actorItem) : 0;
    const sufficient = availableQuantity >= requiredQuantity;
    return {
      recipeEntry: entry,
      actorItem,
      requiredQuantity,
      availableQuantity,
      beforeQuantity: availableQuantity,
      afterQuantity: sufficient ? availableQuantity - requiredQuantity : availableQuantity,
      sufficient,
      status: sufficient ? "Disponibile" : "Insufficiente"
    };
  }
  calculateMaxLots(actor, validation) {
    const ingredientEntries = validation.entries.filter((entry) => entry.collection === "ingredients");
    const toolEntries = validation.entries.filter((entry) => entry.collection === "tools");
    for (const tool of toolEntries) {
      const match = this.buildActorInventoryMatch(actor, tool, 1);
      if (!match.sufficient) {
        return 0;
      }
    }
    if (ingredientEntries.length === 0) {
      return 99;
    }
    const availableLots = ingredientEntries.map((entry) => {
      const actorItem = this.findMatchingActorItem(actor, entry);
      if (!actorItem) {
        return 0;
      }
      const available = this.getItemQuantity(actorItem);
      const required = Math.max(1, Number(entry.quantity || 1));
      return Math.floor(available / required);
    });
    return Math.max(
      0,
      Math.min(...availableLots)
    );
  }
  findMatchingActorItem(actor, entry) {
    const items = Array.from(actor.items ?? []);
    const sourceItem = entry.document;
    const sourceName = String(entry.name ?? "").trim().toLowerCase();
    const sourceType = sourceItem?.type;
    const sourceSystemIdentifier = sourceItem?.system?.identifier;
    const byUuid = items.find((item) => {
      const flags = item.flags ?? {};
      return flags?.artisan?.sourceUuid === entry.uuid;
    });
    if (byUuid) {
      return byUuid;
    }
    const byIdentifier = sourceSystemIdentifier ? items.find((item) => {
      return item.system?.identifier === sourceSystemIdentifier;
    }) : null;
    if (byIdentifier) {
      return byIdentifier;
    }
    const byNameAndType = items.find((item) => {
      const sameName = String(item.name ?? "").trim().toLowerCase() === sourceName;
      const sameType = sourceType ? item.type === sourceType : true;
      return sameName && sameType;
    });
    if (byNameAndType) {
      return byNameAndType;
    }
    return null;
  }
  findMatchingActorOutputItem(actor, entry, quality) {
    const items = Array.from(actor.items ?? []);
    const sourceItem = entry.document;
    const sourceName = String(entry.name ?? "").trim().toLowerCase();
    const sourceType = sourceItem?.type;
    const sourceSystemIdentifier = sourceItem?.system?.identifier;
    const matchingItems = items.filter((item) => {
      const flags = item.flags ?? {};
      if (flags?.artisan?.sourceUuid === entry.uuid) {
        return true;
      }
      if (sourceSystemIdentifier && item.system?.identifier === sourceSystemIdentifier) {
        return true;
      }
      const cleanItemName = String(item.name ?? "").replace(/\s*\((Normale|Buona|Superiore|Eccellente)\)\s*$/i, "").trim().toLowerCase();
      const sameName = cleanItemName === sourceName;
      const sameType = sourceType ? item.type === sourceType : true;
      return sameName && sameType;
    });
    return matchingItems.find((item) => {
      const flags = item.flags ?? {};
      const itemQuality = String(flags?.artisan?.craftingQuality ?? "normal");
      return itemQuality === quality.key;
    }) ?? null;
  }
  getItemQuantity(item) {
    const system = item.system ?? {};
    const quantity = system.quantity ?? system.qty ?? system.uses?.value ?? 1;
    return Math.max(
      0,
      Number(quantity || 0)
    );
  }
  async setItemQuantity(item, quantity) {
    const safeQuantity = Math.max(
      0,
      Number(quantity || 0)
    );
    if (safeQuantity <= 0) {
      await item.delete();
      return;
    }
    const system = item.system ?? {};
    if (Object.prototype.hasOwnProperty.call(system, "quantity")) {
      await item.update({ "system.quantity": safeQuantity });
      return;
    }
    if (Object.prototype.hasOwnProperty.call(system, "qty")) {
      await item.update({ "system.qty": safeQuantity });
      return;
    }
    await item.update({ "system.quantity": safeQuantity });
  }
  async consumeIngredients(context) {
    for (const match of context.ingredients) {
      if (!match.actorItem || !match.sufficient) {
        continue;
      }
      await this.setItemQuantity(
        match.actorItem,
        match.afterQuantity
      );
    }
  }
  async destroyTools(context) {
    for (const match of context.tools) {
      if (!match.actorItem || !match.sufficient) {
        continue;
      }
      await this.setItemQuantity(
        match.actorItem,
        Math.max(
          0,
          match.beforeQuantity - match.requiredQuantity
        )
      );
    }
  }
  async createOutputs(context, outputMultiplier, quality) {
    for (const output of context.outputs) {
      const source = output.document;
      if (!source) {
        continue;
      }
      const quantity = Math.max(
        1,
        Number(output.quantity || 1)
      ) * context.lots * outputMultiplier;
      const existing = this.findMatchingActorOutputItem(
        context.actor,
        output,
        quality
      );
      if (existing) {
        await this.setItemQuantity(
          existing,
          this.getItemQuantity(existing) + quantity
        );
        continue;
      }
      const data = source.toObject ? source.toObject() : foundry.utils.deepClone(source);
      delete data._id;
      data.system = data.system ?? {};
      data.system.quantity = quantity;
      if (quality.key !== "normal") {
        data.name = `${data.name ?? output.name} (${quality.label})`;
      }
      data.flags = data.flags ?? {};
      data.flags.artisan = {
        ...data.flags.artisan ?? {},
        sourceUuid: output.uuid,
        craftingQuality: quality.key,
        craftingQualityLabel: quality.label,
        craftingQualityMargin: quality.margin
      };
      await context.actor.createEmbeddedDocuments(
        "Item",
        [data]
      );
    }
  }
  async rollSkillCheck(actor, recipe, tools = []) {
    const skillModifier = this.getActorSkillModifier(
      actor,
      recipe.skill
    );
    const toolProficiency = this.getCraftingToolProficiencyBonus(
      actor,
      tools
    );
    const toolProficiencyBonus = toolProficiency.totalBonus;
    const modifier = skillModifier + toolProficiencyBonus;
    const formula = modifier === 0 ? "1d20" : `1d20 ${modifier >= 0 ? "+" : "-"} ${Math.abs(modifier)}`;
    const roll = await new Roll(formula).evaluate();
    const firstDie = roll.dice?.[0];
    const natural = Number(firstDie?.results?.[0]?.result ?? roll.total ?? 0);
    const total = Number(roll.total ?? 0);
    const dc = Number(recipe.dc ?? 10);
    const criticalSuccess = natural === 20;
    const criticalFailure = natural === 1;
    const success = criticalSuccess || !criticalFailure && total >= dc;
    let outcomeLabel = "Fallimento";
    if (criticalSuccess) {
      outcomeLabel = "Successo critico";
    } else if (criticalFailure) {
      outcomeLabel = "Fallimento critico";
    } else if (success) {
      outcomeLabel = "Successo";
    }
    return {
      natural,
      modifier,
      skillModifier,
      toolProficiencyBonus,
      toolProficiencyDetails: toolProficiency.details,
      total,
      formula,
      dc,
      success,
      criticalSuccess,
      criticalFailure,
      outcomeLabel
    };
  }
  getCraftingOutputQuality(roll) {
    if (!roll.success) {
      return {
        key: "none",
        label: "Nessuna",
        margin: roll.total - roll.dc,
        description: "Nessun output creato."
      };
    }
    const margin = Math.max(
      0,
      Number(roll.total ?? 0) - Number(roll.dc ?? 0)
    );
    if (roll.criticalSuccess) {
      return {
        key: "excellent",
        label: "Eccellente",
        margin,
        description: "20 naturale: qualit\xE0 eccellente."
      };
    }
    if (margin >= 10) {
      return {
        key: "superior",
        label: "Superiore",
        margin,
        description: "Margine 10 o superiore."
      };
    }
    if (margin >= 5) {
      return {
        key: "good",
        label: "Buona",
        margin,
        description: "Margine 5 o superiore."
      };
    }
    return {
      key: "normal",
      label: "Normale",
      margin,
      description: "Successo normale."
    };
  }
  getCraftingToolProficiencyBonus(actor, tools) {
    const proficiencyBonus = this.getActorProficiencyBonus(actor);
    let totalBonus = 0;
    const details = [];
    for (const tool of tools) {
      const actorItem = tool.actorItem;
      const sourceItem = tool.recipeEntry.document;
      const possessed = !!actorItem && tool.sufficient;
      const proficient = possessed ? this.actorIsProficientWithTool(
        actor,
        actorItem,
        sourceItem
      ) : false;
      const bonus = possessed && proficient ? Math.max(0, proficiencyBonus) : 0;
      const applied = bonus > 0;
      if (applied) {
        totalBonus += bonus;
      }
      details.push({
        name: tool.recipeEntry.name,
        possessed,
        proficient,
        bonus,
        applied
      });
    }
    return {
      totalBonus,
      details
    };
  }
  getActorProficiencyBonus(actor) {
    const candidates = [
      foundry.utils.getProperty(actor, "system.attributes.prof"),
      foundry.utils.getProperty(actor, "system.attributes.prof.value"),
      foundry.utils.getProperty(actor, "system.attributes.proficiency"),
      foundry.utils.getProperty(actor, "system.attributes.proficiency.value"),
      foundry.utils.getProperty(actor, "system.prof"),
      foundry.utils.getProperty(actor, "system.prof.value"),
      foundry.utils.getProperty(actor, "system.details.proficiencyBonus"),
      foundry.utils.getProperty(actor, "system.details.prof")
    ];
    for (const value of candidates) {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric > 0) {
        return Math.floor(numeric);
      }
    }
    return 0;
  }
  actorIsProficientWithTool(actor, actorItem, sourceItem) {
    if (!actorItem) {
      return false;
    }
    if (this.readItemProficiency(actorItem)) {
      return true;
    }
    const identifierCandidates = this.getToolIdentifierCandidates(
      actorItem,
      sourceItem
    );
    const actorTools = foundry.utils.getProperty(actor, "system.tools");
    if (!actorTools || typeof actorTools !== "object") {
      return false;
    }
    for (const key of identifierCandidates) {
      const toolData = actorTools[key];
      if (this.readToolDataProficiency(toolData)) {
        return true;
      }
    }
    for (const toolData of Object.values(actorTools)) {
      const label = String(
        toolData?.label ?? toolData?.name ?? toolData?.id ?? ""
      ).trim().toLowerCase();
      if (!label) {
        continue;
      }
      if (identifierCandidates.includes(label) && this.readToolDataProficiency(toolData)) {
        return true;
      }
    }
    return false;
  }
  readItemProficiency(item) {
    const candidates = [
      foundry.utils.getProperty(item, "system.proficient"),
      foundry.utils.getProperty(item, "system.proficiency"),
      foundry.utils.getProperty(item, "system.prof"),
      foundry.utils.getProperty(item, "system.prof.hasProficiency"),
      foundry.utils.getProperty(item, "system.proficiencies.value")
    ];
    return candidates.some((value) => {
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "number") {
        return value > 0;
      }
      if (typeof value === "string") {
        const clean = value.trim().toLowerCase();
        return clean === "true" || clean === "proficient" || clean === "prof" || Number(clean) > 0;
      }
      return false;
    });
  }
  readToolDataProficiency(toolData) {
    if (!toolData) {
      return false;
    }
    const candidates = [
      toolData.value,
      toolData.prof,
      toolData.proficient,
      toolData.proficiency,
      toolData.hasProficiency
    ];
    return candidates.some((value) => {
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "number") {
        return value > 0;
      }
      if (typeof value === "string") {
        const clean = value.trim().toLowerCase();
        return clean === "true" || clean === "proficient" || clean === "prof" || Number(clean) > 0;
      }
      return false;
    });
  }
  getToolIdentifierCandidates(actorItem, sourceItem) {
    const values = [
      actorItem?.system?.identifier,
      actorItem?.system?.type?.value,
      actorItem?.system?.type,
      actorItem?.slug,
      actorItem?.name,
      sourceItem?.system?.identifier,
      sourceItem?.system?.type?.value,
      sourceItem?.system?.type,
      sourceItem?.slug,
      sourceItem?.name
    ];
    return Array.from(new Set(
      values.map((value) => String(value ?? "").trim().toLowerCase()).filter((value) => value.length > 0)
    ));
  }
  getActorSkillModifier(actor, skill) {
    const key = this.normalizeSkillKey(skill);
    if (!key) {
      return 0;
    }
    const system = actor.system ?? {};
    const skills = system.skills ?? {};
    const direct = skills[key];
    if (direct) {
      return Number(
        direct.total ?? direct.mod ?? direct.value ?? 0
      );
    }
    return 0;
  }
  normalizeSkillKey(skill) {
    const clean = String(skill ?? "").trim().toLowerCase();
    const map = {
      survival: "sur",
      sopravvivenza: "sur",
      sur: "sur",
      arcana: "arc",
      arc: "arc",
      nature: "nat",
      natura: "nat",
      nat: "nat",
      athletics: "ath",
      atletica: "ath",
      ath: "ath",
      stealth: "ste",
      furtivit\u00E0: "ste",
      furtivita: "ste",
      ste: "ste",
      perception: "prc",
      percezione: "prc",
      prc: "prc",
      investigation: "inv",
      investigare: "inv",
      inv: "inv",
      history: "his",
      storia: "his",
      his: "his",
      medicine: "med",
      medicina: "med",
      med: "med",
      religion: "rel",
      religione: "rel",
      rel: "rel",
      acrobatics: "acr",
      acrobazia: "acr",
      acr: "acr",
      persuasion: "per",
      persuasione: "per",
      per: "per",
      deception: "dec",
      inganno: "dec",
      dec: "dec",
      intimidation: "itm",
      intimidire: "itm",
      itm: "itm",
      performance: "prf",
      intrattenere: "prf",
      prf: "prf",
      insight: "ins",
      intuizione: "ins",
      ins: "ins",
      animal: "ani",
      animalhandling: "ani",
      addestrareanimali: "ani",
      ani: "ani",
      sleightofhand: "slt",
      rapiditadimano: "slt",
      slt: "slt"
    };
    return map[clean] ?? clean;
  }
  async askLots(maxLots) {
    const safeMax = Math.max(1, Number(maxLots || 1));
    const content = `
            <form>
                <p><strong>Massimo disponibile:</strong> ${safeMax}</p>
                <div class="form-group">
                    <label>Lotti da craftare</label>
                    <input type="number" name="lots" value="1" min="1" max="${safeMax}" step="1">
                </div>
            </form>
        `;
    return this.promptNumberDialog(
      "Quanti lotti vuoi craftare?",
      content,
      "lots",
      1,
      safeMax
    );
  }
  async promptNumberDialog(title, content, fieldName, min, max) {
    return new Promise((resolve) => {
      new Dialog({
        title,
        content,
        buttons: {
          confirm: {
            label: "Continua",
            callback: (html) => {
              const raw = html.find(`[name="${fieldName}"]`).val();
              const value = Math.max(
                min,
                Math.min(
                  max,
                  Number(raw || min)
                )
              );
              resolve(value);
            }
          },
          cancel: {
            label: "Annulla",
            callback: () => resolve(null)
          }
        },
        default: "confirm",
        close: () => resolve(null)
      }).render(true);
    });
  }
  async confirmCrafting(context) {
    const content = `
            <div class="artisan-confirm-dialog">
                <p><strong>Ricetta:</strong> ${this.escapeHtml(context.validation.recipeName)}</p>
                <p><strong>Attore:</strong> ${this.escapeHtml(context.actor.name ?? "Attore")}</p>
                <p><strong>Lotti:</strong> ${context.lots} / ${context.maxLots}</p>
                <p><strong>Professione richiesta:</strong> ${this.escapeHtml(context.professionRequirement.professionLabel)} livello ${context.professionRequirement.requiredLevel}</p>
                <p><strong>Professione PG:</strong> livello ${context.professionRequirement.actorLevel}, XP ${context.professionRequirement.actorXp}</p>
                <p><strong>Abilit\xE0:</strong> ${this.escapeHtml(context.validation.recipeData.skill || "Non impostata")}</p>
                <p><strong>CD:</strong> ${context.validation.recipeData.dc}</p>
                ${this.buildInventoryConfirmSection("Ingredienti da consumare", context.ingredients)}
                ${this.buildInventoryConfirmSection("Strumenti richiesti", context.tools)}
                ${this.buildToolProficiencyConfirmSection(context.actor, context.tools)}
                ${this.buildOutputConfirmSection(context.outputs, context.lots)}
            </div>
        `;
    return new Promise((resolve) => {
      new Dialog({
        title: "Conferma crafting",
        content,
        buttons: {
          confirm: {
            label: "Esegui Crafting",
            callback: () => resolve(true)
          },
          cancel: {
            label: "Annulla",
            callback: () => resolve(false)
          }
        },
        default: "confirm",
        close: () => resolve(false)
      }).render(true);
    });
  }
  buildInventoryConfirmSection(title, matches) {
    if (matches.length === 0) {
      return `<h4>${this.escapeHtml(title)}</h4><p><em>Nessuno.</em></p>`;
    }
    const rows = matches.map((match) => {
      const icon = match.sufficient ? "\u2705" : "\u274C";
      return `
                <tr>
                    <td>${icon}</td>
                    <td>${this.escapeHtml(match.recipeEntry.name)}</td>
                    <td>${match.requiredQuantity}</td>
                    <td>${match.availableQuantity}</td>
                </tr>
            `;
    }).join("");
    return `
            <h4>${this.escapeHtml(title)}</h4>
            <table>
                <thead>
                    <tr>
                        <th></th>
                        <th>Oggetto</th>
                        <th>Richiesto</th>
                        <th>Disponibile</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
  }
  buildToolProficiencyConfirmSection(actor, tools) {
    if (tools.length === 0) {
      return "";
    }
    const result = this.getCraftingToolProficiencyBonus(
      actor,
      tools
    );
    const rows = result.details.map((detail) => {
      const icon = detail.applied ? "\u2705" : "\u2796";
      const status = detail.applied ? `Bonus +${detail.bonus}` : detail.possessed ? detail.proficient ? "Bonus non disponibile" : "Posseduto, non competente" : "Non posseduto";
      return `
                <tr>
                    <td>${icon}</td>
                    <td>${this.escapeHtml(detail.name)}</td>
                    <td>${detail.possessed ? "S\xEC" : "No"}</td>
                    <td>${detail.proficient ? "S\xEC" : "No"}</td>
                    <td>${this.escapeHtml(status)}</td>
                </tr>
            `;
    }).join("");
    return `
            <h4>Bonus strumenti competenti</h4>
            <p><strong>Bonus totale al tiro:</strong> +${result.totalBonus}</p>
            <table>
                <thead>
                    <tr>
                        <th></th>
                        <th>Strumento</th>
                        <th>Posseduto</th>
                        <th>Competente</th>
                        <th>Bonus</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
  }
  buildOutputConfirmSection(outputs, lots) {
    if (outputs.length === 0) {
      return `<h4>Output previsto</h4><p><em>Nessun output.</em></p>`;
    }
    const rows = outputs.map((output) => {
      return `
                <tr>
                    <td>${this.escapeHtml(output.name)}</td>
                    <td>${Math.max(1, Number(output.quantity || 1)) * lots}</td>
                </tr>
            `;
    }).join("");
    return `
            <h4>Output previsto</h4>
            <table>
                <thead>
                    <tr>
                        <th>Oggetto</th>
                        <th>Quantit\xE0</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
  }
  async sendCraftingProfessionBlockedToChat(actor, recipeItem, validation, requirement) {
    const content = `
            <div class="artisan-chat-card">
                <h2>\u26D4 Requisito professione non soddisfatto</h2>
                <p>
                    <strong>${this.escapeHtml(recipeItem.name ?? "Ricetta")}</strong><br>
                    Attore: ${this.escapeHtml(actor.name ?? "Attore")}
                </p>
                <table>
                    <tbody>
                        <tr><td><strong>Professione richiesta</strong></td><td>${this.escapeHtml(requirement.professionLabel)}</td></tr>
                        <tr><td><strong>Livello richiesto</strong></td><td>${requirement.requiredLevel}</td></tr>
                        <tr><td><strong>Livello PG</strong></td><td>${requirement.actorLevel}</td></tr>
                        <tr><td><strong>XP PG</strong></td><td>${requirement.actorXp}</td></tr>
                        <tr><td><strong>Sorgente</strong></td><td>${this.escapeHtml(requirement.source)}</td></tr>
                    </tbody>
                </table>
                ${this.buildMessagesHtml("Errori ricetta", validation.errors)}
                ${this.buildMessagesHtml("Avvisi ricetta", validation.warnings)}
                <p><strong>La ricetta richiede un livello professione pi\xF9 alto.</strong></p>
            </div>
        `;
    await ChatMessage.create({
      content,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }
  async sendCraftingBlockedToChat(actor, recipeItem, validation, missing) {
    const missingHtml = missing.length > 0 ? this.buildInventoryResultSection(
      "Risorse mancanti",
      missing,
      "\u274C",
      "Insufficienti"
    ) : "";
    const content = `
            <div class="artisan-chat-card">
                <h2>\u274C Crafting bloccato</h2>
                <p>
                    <strong>${this.escapeHtml(recipeItem.name ?? "Ricetta")}</strong><br>
                    Attore: ${this.escapeHtml(actor.name ?? "Attore")}
                </p>
                ${this.buildMessagesHtml("Errori", validation.errors)}
                ${this.buildMessagesHtml("Avvisi", validation.warnings)}
                ${missingHtml}
            </div>
        `;
    await ChatMessage.create({
      content,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }
  async awardCraftingProfessionXp(context, roll) {
    const professionService = new ProfessionService();
    const professionId = context.professionRequirement.professionId;
    const beforeXp = context.professionRequirement.actorXp;
    const gained = this.calculateCraftingXp(context, roll);
    if (gained <= 0) {
      return {
        gained: 0,
        beforeXp,
        afterXp: beforeXp,
        beforeLevel: context.professionRequirement.actorLevel,
        afterLevel: context.professionRequirement.actorLevel,
        xpToNextLevel: professionService.getActorProfession(context.actor, professionId).xpToNextLevel,
        xpForNextLevel: professionService.getActorProfession(context.actor, professionId).xpForNextLevel,
        progressPercent: professionService.getActorProfession(context.actor, professionId).progressPercent
      };
    }
    const updated = await professionService.addActorProfessionXp(
      context.actor,
      professionId,
      gained
    );
    return {
      gained,
      beforeXp,
      afterXp: updated.xp,
      beforeLevel: context.professionRequirement.actorLevel,
      afterLevel: updated.level,
      xpToNextLevel: updated.xpToNextLevel,
      xpForNextLevel: updated.xpForNextLevel,
      progressPercent: updated.progressPercent
    };
  }
  calculateCraftingXp(context, roll) {
    const requiredLevel = Math.max(
      0,
      Math.floor(Number(context.professionRequirement.requiredLevel ?? 0))
    );
    const lotMultiplier = Math.max(1, Math.floor(Number(context.lots ?? 1)));
    const baseXp = Math.max(1, requiredLevel + 1) * lotMultiplier;
    return roll.criticalSuccess ? baseXp * 2 : baseXp;
  }
  async sendCraftingResultToChat(context, roll, professionXp, outputQuality) {
    const outputIcon = roll.success ? "\u2705" : "\u2796";
    const outputStatus = roll.success ? roll.criticalSuccess ? "Creato, quantit\xE0 raddoppiata" : "Creato" : "Non creato";
    const content = `
            <div class="artisan-chat-card">
                <h2>${this.getOutcomeIcon(roll)} ${this.escapeHtml(roll.outcomeLabel)}</h2>
                <p>
                    <strong>${this.escapeHtml(context.validation.recipeName)}</strong><br>
                    Attore: ${this.escapeHtml(context.actor.name ?? "Attore")}<br>
                    Lotti: ${context.lots}<br>
                    Professione richiesta: ${this.escapeHtml(context.professionRequirement.professionLabel)} livello ${context.professionRequirement.requiredLevel}<br>
                    Professione PG: livello ${professionXp.beforeLevel} \u2192 ${professionXp.afterLevel}${professionXp.afterLevel > professionXp.beforeLevel ? " \u2B50 Avanzamento" : ""}<br>
                    XP professione: ${professionXp.beforeXp} \u2192 ${professionXp.afterXp}<br>
                    XP professione guadagnata: +${professionXp.gained}<br>
                    Prossimo livello: ${professionXp.xpForNextLevel === null ? "Livello massimo" : `${professionXp.xpToNextLevel} XP mancanti (${professionXp.progressPercent}%)`}
                </p>
                <table>
                    <tbody>
                        <tr><td><strong>Formula</strong></td><td>${this.escapeHtml(roll.formula)}</td></tr>
                        <tr><td><strong>Tiro naturale</strong></td><td>${roll.natural}</td></tr>
                        <tr><td><strong>Modificatore abilit\xE0</strong></td><td>${roll.skillModifier >= 0 ? "+" : ""}${roll.skillModifier}</td></tr>
                        <tr><td><strong>Bonus strumenti competenti</strong></td><td>+${roll.toolProficiencyBonus}</td></tr>
                        <tr><td><strong>Modificatore totale</strong></td><td>${roll.modifier >= 0 ? "+" : ""}${roll.modifier}</td></tr>
                        <tr><td><strong>Totale</strong></td><td>${roll.total}</td></tr>
                        <tr><td><strong>CD</strong></td><td>${roll.dc}</td></tr>
                        <tr><td><strong>Margine</strong></td><td>${roll.success ? outputQuality.margin : "\u2014"}</td></tr>
                        <tr><td><strong>Qualit\xE0 output</strong></td><td>${roll.success ? `${this.escapeHtml(outputQuality.label)} \u2014 ${this.escapeHtml(outputQuality.description)}` : "Nessuna"}</td></tr>
                    </tbody>
                </table>
                ${this.buildToolProficiencyResultSection(roll.toolProficiencyDetails)}
                ${this.buildInventoryResultSection("Ingredienti", context.ingredients, "\u{1F525}", "Consumati")}
                ${this.buildInventoryResultSection(
      "Strumenti",
      context.tools,
      roll.criticalFailure ? "\u{1F4A5}" : "\u{1F6E0}\uFE0F",
      roll.criticalFailure ? "Distrutti" : "Non consumati"
    )}
                ${this.buildOutputResultSection(context.outputs, context.lots, roll.success ? roll.criticalSuccess ? 2 : 1 : 0, outputIcon, outputStatus, outputQuality)}
            </div>
        `;
    await ChatMessage.create({
      content,
      speaker: ChatMessage.getSpeaker({ actor: context.actor })
    });
  }
  getOutcomeIcon(roll) {
    if (roll.criticalSuccess) {
      return "\u{1F31F}";
    }
    if (roll.criticalFailure) {
      return "\u{1F4A5}";
    }
    return roll.success ? "\u2705" : "\u274C";
  }
  buildToolProficiencyResultSection(details) {
    if (details.length === 0) {
      return "";
    }
    const rows = details.map((detail) => {
      const icon = detail.applied ? "\u2705" : "\u2796";
      const status = detail.applied ? `Applicato +${detail.bonus}` : detail.possessed ? detail.proficient ? "Nessun bonus" : "Non competente" : "Non posseduto";
      return `
                <tr>
                    <td>${icon}</td>
                    <td>${this.escapeHtml(detail.name)}</td>
                    <td>${detail.possessed ? "S\xEC" : "No"}</td>
                    <td>${detail.proficient ? "S\xEC" : "No"}</td>
                    <td>${this.escapeHtml(status)}</td>
                </tr>
            `;
    }).join("");
    return `
            <h4>Bonus strumenti alla prova</h4>
            <table>
                <thead>
                    <tr>
                        <th></th>
                        <th>Strumento</th>
                        <th>Posseduto</th>
                        <th>Competente</th>
                        <th>Stato</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
  }
  buildInventoryResultSection(title, matches, icon, status) {
    if (matches.length === 0) {
      return `<h4>${this.escapeHtml(title)}</h4><p><em>Nessuno.</em></p>`;
    }
    const rows = matches.map((match) => {
      return `
                <tr>
                    <td>${icon}</td>
                    <td>${this.escapeHtml(match.recipeEntry.name)}</td>
                    <td>${match.requiredQuantity}</td>
                    <td>${match.beforeQuantity}</td>
                    <td>${match.afterQuantity}</td>
                    <td>${this.escapeHtml(status)}</td>
                </tr>
            `;
    }).join("");
    return `
            <h4>${this.escapeHtml(title)}</h4>
            <table>
                <thead>
                    <tr>
                        <th></th>
                        <th>Oggetto</th>
                        <th>Richiesto</th>
                        <th>Prima</th>
                        <th>Dopo</th>
                        <th>Stato</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
  }
  buildOutputResultSection(outputs, lots, multiplier, icon, status, quality) {
    if (outputs.length === 0) {
      return `<h4>Output</h4><p><em>Nessun output.</em></p>`;
    }
    const rows = outputs.map((output) => {
      const quantity = multiplier > 0 ? Math.max(1, Number(output.quantity || 1)) * lots * multiplier : 0;
      return `
                <tr>
                    <td>${icon}</td>
                    <td>${this.escapeHtml(output.name)}</td>
                    <td>${quantity}</td>
                    <td>${multiplier > 0 ? this.escapeHtml(quality.label) : "\u2014"}</td>
                    <td>${this.escapeHtml(status)}</td>
                </tr>
            `;
    }).join("");
    return `
            <h4>Output</h4>
            <table>
                <thead>
                    <tr>
                        <th></th>
                        <th>Oggetto</th>
                        <th>Quantit\xE0</th>
                        <th>Qualit\xE0</th>
                        <th>Stato</th>
                    </tr>
                </thead>
                <tbody>${rows}</tbody>
            </table>
        `;
  }
  async sendValidationResultToChat(result) {
    const status = result.valid ? "\u2705 Ricetta valida" : "\u274C Ricetta non valida";
    const rows = result.entries.length > 0 ? result.entries.map((entry) => {
      const icon = entry.found && entry.isItem ? "\u2705" : "\u274C";
      return `
                    <tr>
                        <td>${icon}</td>
                        <td>${this.escapeHtml(entry.collectionLabel)}</td>
                        <td>${this.escapeHtml(entry.name)}</td>
                        <td>${entry.quantity}</td>
                        <td><code>${this.escapeHtml(entry.uuid)}</code></td>
                        <td>${this.escapeHtml(entry.message)}</td>
                    </tr>
                `;
    }).join("") : `<tr><td colspan="6"><em>Nessun componente inserito.</em></td></tr>`;
    const content = `
            <div class="artisan-chat-card">
                <h2>${status}</h2>
                <p><strong>${this.escapeHtml(result.recipeName)}</strong><br><code>${this.escapeHtml(result.recipeUuid)}</code></p>
                ${this.buildMessagesHtml("Errori", result.errors)}
                ${this.buildMessagesHtml("Avvisi", result.warnings)}
                <h4>Componenti</h4>
                <table>
                    <thead>
                        <tr><th></th><th>Sezione</th><th>Nome</th><th>Q.t\xE0</th><th>UUID</th><th>Stato</th></tr>
                    </thead>
                    <tbody>${rows}</tbody>
                </table>
            </div>
        `;
    await ChatMessage.create({
      content,
      speaker: ChatMessage.getSpeaker()
    });
  }
  async sendCraftingPreviewToChat(result) {
    const status = result.valid ? "\u{1F9EA} Anteprima Crafting" : "\u26A0\uFE0F Anteprima Crafting con problemi";
    const recipe = result.recipeData;
    const content = `
            <div class="artisan-chat-card">
                <h2>${status}</h2>
                <p><strong>${this.escapeHtml(result.recipeName)}</strong><br><code>${this.escapeHtml(result.recipeUuid)}</code></p>
                <table>
                    <tbody>
                        <tr><td><strong>Categoria</strong></td><td>${this.escapeHtml(recipe.category || "Non impostata")}</td></tr>
                        <tr><td><strong>Profilo / Professione</strong></td><td>${this.escapeHtml(new ProfessionService().getLabel(recipe.profile || ""))}</td></tr>
                        <tr><td><strong>Livello professione richiesto</strong></td><td>${new ProfessionService().normalizeLevel(recipe.professionLevel ?? 0)}</td></tr>
                        <tr><td><strong>Abilit\xE0</strong></td><td>${this.escapeHtml(recipe.skill || "Non impostata")}</td></tr>
                        <tr><td><strong>CD</strong></td><td>${recipe.dc}</td></tr>
                        <tr><td><strong>Tempo</strong></td><td>${recipe.craftingTime} minuti</td></tr>
                    </tbody>
                </table>
                ${this.buildMessagesHtml("Errori", result.errors)}
                ${this.buildMessagesHtml("Avvisi", result.warnings)}
                ${this.buildPreviewSection("Ingredienti richiesti", result.entries.filter((entry) => entry.collection === "ingredients"), "Nessun ingrediente richiesto.")}
                ${this.buildPreviewSection("Strumenti richiesti", result.entries.filter((entry) => entry.collection === "tools"), "Nessuno strumento richiesto.")}
                ${this.buildPreviewSection("Output prodotto", result.entries.filter((entry) => entry.collection === "outputs"), "Nessun output impostato.")}
                <p><em>Questa \xE8 solo un\u2019anteprima: nessun oggetto \xE8 stato consumato o creato.</em></p>
            </div>
        `;
    await ChatMessage.create({
      content,
      speaker: ChatMessage.getSpeaker()
    });
  }
  buildPreviewSection(title, entries, emptyMessage) {
    if (entries.length === 0) {
      return `<h4>${this.escapeHtml(title)}</h4><p><em>${this.escapeHtml(emptyMessage)}</em></p>`;
    }
    const rows = entries.map((entry) => {
      const icon = entry.found && entry.isItem ? "\u2705" : "\u274C";
      return `
                <tr>
                    <td>${icon}</td>
                    <td>${this.escapeHtml(entry.name)}</td>
                    <td>${entry.quantity}</td>
                    <td>${this.escapeHtml(entry.message)}</td>
                </tr>
            `;
    }).join("");
    return `
            <h4>${this.escapeHtml(title)}</h4>
            <table>
                <thead><tr><th></th><th>Oggetto</th><th>Q.t\xE0</th><th>Stato</th></tr></thead>
                <tbody>${rows}</tbody>
            </table>
        `;
  }
  buildMessagesHtml(title, messages) {
    if (messages.length === 0) {
      return "";
    }
    return `
            <h4>${this.escapeHtml(title)}</h4>
            <ul>${messages.map((message) => `<li>${this.escapeHtml(message)}</li>`).join("")}</ul>
        `;
  }
  getCollectionLabel(collection) {
    switch (collection) {
      case "ingredients":
        return "Ingredienti";
      case "tools":
        return "Strumenti";
      case "outputs":
        return "Output";
      default:
        return collection;
    }
  }
  escapeHtml(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
};

// src/services/foraging-service.ts
var ForagingService = class _ForagingService {
  static SETTING_SCOPE = "artisan";
  static SETTING_KEY = "foragingProfiles";
  async getManagerData(selectedProfileId) {
    const profiles = this.getProfiles();
    let selected = selectedProfileId ? this.getProfile(selectedProfileId) : null;
    if (!selected && profiles.length > 0) {
      selected = profiles[0];
    }
    return {
      profiles: profiles.map((profile) => ({
        id: profile.id,
        label: profile.name,
        icon: "fa-solid fa-leaf",
        selected: selected?.id === profile.id
      })),
      selectedProfile: selected ? await this.toProfileView(selected) : null
    };
  }
  getProfiles() {
    this.ensureSettingsRegistered();
    const value = game.settings.get(
      _ForagingService.SETTING_SCOPE,
      _ForagingService.SETTING_KEY
    );
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((profile) => this.normalizeProfile(profile));
  }
  getProfile(id) {
    return this.getProfiles().find((profile) => profile.id === id) ?? null;
  }
  async createProfile() {
    const profile = {
      id: foundry.utils.randomID(),
      name: "Nuova lista Foraging",
      biome: "foresta",
      profession: "erborista",
      professionLevel: 1,
      skill: "nature",
      dc: 10,
      time: 1,
      maxResources: 3,
      resources: [],
      tools: []
    };
    const profiles = this.getProfiles();
    await this.saveProfiles([
      ...profiles,
      profile
    ]);
    return profile;
  }
  async updateProfile(id, data) {
    const profiles = this.getProfiles();
    const nextProfiles = profiles.map((profile) => {
      if (profile.id !== id) {
        return profile;
      }
      return this.normalizeProfile({
        ...profile,
        ...data
      });
    });
    await this.saveProfiles(nextProfiles);
  }
  async addComponent(profileId, collection, uuid, quantity, options = {}) {
    const cleanUuid = uuid.trim();
    if (!cleanUuid) {
      ui.notifications.warn("Inserisci un UUID valido.");
      return;
    }
    let document2 = null;
    try {
      document2 = await fromUuid(cleanUuid);
    } catch (_error) {
      ui.notifications.warn(`UUID non leggibile: ${cleanUuid}`);
      return;
    }
    if (!document2) {
      ui.notifications.warn(`Nessun documento trovato: ${cleanUuid}`);
      return;
    }
    if (document2.documentName !== "Item") {
      ui.notifications.warn("Puoi aggiungere solo Item dal mondo o dai compendi.");
      return;
    }
    const importedWeight = this.getItemWeight(document2);
    const profiles = this.getProfiles();
    const nextProfiles = profiles.map((profile) => {
      if (profile.id !== profileId) {
        return profile;
      }
      const component = this.normalizeComponent({
        uuid: cleanUuid,
        quantity,
        weight: collection === "resources" ? this.resolveResourceWeight(options.weight, importedWeight) : options.weight,
        minQuantity: options.minQuantity,
        maxQuantity: options.maxQuantity
      });
      const nextCollection = [...profile[collection]];
      const existingIndex = nextCollection.findIndex((entry) => entry.uuid === component.uuid);
      if (existingIndex >= 0) {
        const existing = nextCollection[existingIndex];
        if (collection === "resources") {
          nextCollection[existingIndex] = this.normalizeComponent({
            ...existing,
            weight: component.weight,
            minQuantity: component.minQuantity,
            maxQuantity: component.maxQuantity,
            quantity: component.maxQuantity
          });
        } else {
          nextCollection[existingIndex] = this.normalizeComponent({
            ...existing,
            quantity: Math.max(1, Number(existing.quantity ?? 1) + component.quantity)
          });
        }
      } else {
        nextCollection.push(component);
      }
      return {
        ...profile,
        [collection]: nextCollection
      };
    });
    await this.saveProfiles(nextProfiles);
    ui.notifications.info(`${document2.name} aggiunto alla lista Foraging.`);
  }
  async removeComponent(profileId, collection, index) {
    const profiles = this.getProfiles();
    const nextProfiles = profiles.map((profile) => {
      if (profile.id !== profileId) {
        return profile;
      }
      return {
        ...profile,
        [collection]: profile[collection].filter((_entry, entryIndex) => entryIndex !== index)
      };
    });
    await this.saveProfiles(nextProfiles);
  }
  async updateComponent(profileId, collection, index, data) {
    const profiles = this.getProfiles();
    const nextProfiles = profiles.map((profile) => {
      if (profile.id !== profileId) {
        return profile;
      }
      const nextCollection = [...profile[collection]];
      const current = nextCollection[index];
      if (!current) {
        return profile;
      }
      nextCollection[index] = this.normalizeComponent({
        ...current,
        ...data
      });
      return {
        ...profile,
        [collection]: nextCollection
      };
    });
    await this.saveProfiles(nextProfiles);
  }
  async deleteProfile(id) {
    const profiles = this.getProfiles();
    const target = profiles.find((profile) => profile.id === id);
    if (!target) {
      ui.notifications.warn("Lista Foraging non trovata.");
      return;
    }
    const nextProfiles = profiles.filter((profile) => profile.id !== id);
    await this.saveProfiles(nextProfiles);
    ui.notifications.info(`Lista Foraging eliminata: ${target.name}`);
  }
  exportProfiles() {
    const data = JSON.stringify(
      {
        type: "artisan-foraging-profiles",
        version: 4,
        exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
        profiles: this.getProfiles()
      },
      null,
      4
    );
    saveDataToFile(
      data,
      "application/json",
      "artisan-foraging-liste.json"
    );
  }
  async importProfiles(payload) {
    const entries = this.getImportEntries(payload);
    if (!entries.length) {
      return { imported: 0, skipped: 0 };
    }
    const existingProfiles = this.getProfiles();
    const existingNames = new Set(existingProfiles.map((profile) => profile.name.trim().toLowerCase()));
    const nextProfiles = [...existingProfiles];
    let imported = 0;
    let skipped = 0;
    for (const entry of entries) {
      const profile = this.normalizeImportedProfile(entry);
      if (!profile) {
        skipped += 1;
        continue;
      }
      const duplicateKey = profile.name.trim().toLowerCase();
      if (existingNames.has(duplicateKey)) {
        skipped += 1;
        continue;
      }
      existingNames.add(duplicateKey);
      nextProfiles.push(profile);
      imported += 1;
    }
    if (imported > 0) {
      await this.saveProfiles(nextProfiles);
    }
    return { imported, skipped };
  }
  getImportEntries(payload) {
    if (Array.isArray(payload)) {
      return payload;
    }
    if (!payload || typeof payload !== "object") {
      return [];
    }
    const data = payload;
    if (Array.isArray(data.profiles)) {
      return data.profiles;
    }
    if (data.type === "artisan-foraging-profiles" && Array.isArray(data.foragingProfiles)) {
      return data.foragingProfiles;
    }
    if (data.name && (Array.isArray(data.resources) || Array.isArray(data.tools))) {
      return [data];
    }
    return [];
  }
  normalizeImportedProfile(entry) {
    if (!entry || typeof entry !== "object") {
      return null;
    }
    const raw = entry;
    const name = String(raw.name ?? "").trim();
    if (!name) {
      return null;
    }
    return this.normalizeProfile({
      ...raw,
      id: foundry.utils.randomID(),
      name
    });
  }
  async startForaging(profileId) {
    const profile = this.getProfile(profileId);
    if (!profile) {
      ui.notifications.warn("Lista Foraging non trovata.");
      return;
    }
    const actor = this.getSelectedActor();
    if (!actor) {
      ui.notifications.warn("Seleziona un token con attore prima di usare Foraging.");
      return;
    }
    if (profile.resources.length === 0) {
      ui.notifications.warn("La lista Foraging non contiene risorse.");
      return;
    }
    const confirmation = await this.confirmForaging(profile, actor);
    if (!confirmation) {
      return;
    }
    const skillModifier = this.getSkillModifier(actor, profile.skill);
    const toolBonusResult = await this.getToolQuantityBonus(actor, profile);
    const toolBonus = toolBonusResult.totalBonus;
    const totalModifier = skillModifier + toolBonus;
    const formula = totalModifier === 0 ? "1d20" : `1d20 ${totalModifier >= 0 ? "+" : "-"} ${Math.abs(totalModifier)}`;
    const roll = await new Roll(formula).evaluate();
    const total = Number(roll.total ?? 0);
    const natural = this.getNaturalD20(roll);
    const criticalSuccess = natural === 20;
    const criticalFailure = natural === 1;
    const success = !criticalFailure && (criticalSuccess || total >= profile.dc);
    const selectedResources = success ? await this.getMixedResolvedResources(profile) : [];
    const professionService = new ProfessionService();
    const actorProfession = professionService.getActorProfession(actor, profile.profession);
    const effectiveProfessionLevel = actorProfession.level;
    const gatheringMultiplier = actorProfession.gatheringMultiplier;
    const collectedResources = selectedResources.map((resource) => {
      const rolledQuantity = Math.max(0, Number(resource.rolledQuantity ?? 0));
      const normalQuantity = Math.max(
        1,
        rolledQuantity
      );
      const multipliedQuantity = this.applyProfessionMultiplier(normalQuantity, gatheringMultiplier);
      const finalQuantity = criticalSuccess ? multipliedQuantity * 2 : multipliedQuantity;
      return {
        ...resource,
        normalQuantity,
        multipliedQuantity,
        finalQuantity
      };
    });
    for (const resource of collectedResources) {
      if (resource.finalQuantity <= 0) {
        continue;
      }
      await this.addItemToActor(
        actor,
        resource.uuid,
        resource.finalQuantity
      );
    }
    const criticalFailureToolDamage = criticalFailure ? await this.damageForagingTool(actor, profile) : null;
    const professionXpGained = success ? this.calculateForagingXp(profile, collectedResources.length, criticalSuccess) : 0;
    const actorProfessionAfterXp = professionXpGained > 0 ? await professionService.addActorProfessionXp(actor, profile.profession, professionXpGained) : actorProfession;
    await this.sendForagingResultToChat({
      actor,
      profile,
      rollFormula: formula,
      natural,
      total,
      skillModifier,
      success,
      criticalSuccess,
      criticalFailure,
      collectedResources,
      toolBonus,
      toolBonusDetails: toolBonusResult.details,
      gatheringMultiplier,
      gatheringMultiplierLabel: actorProfession.gatheringMultiplierLabel,
      actorProfessionLevel: effectiveProfessionLevel,
      actorProfessionLevelAfter: actorProfessionAfterXp.level,
      actorProfessionXp: actorProfession.xp,
      actorProfessionSource: actorProfession.hasActorValue ? "PG" : "Default livello 0",
      xpGained: professionXpGained,
      actorProfessionXpAfter: actorProfessionAfterXp.xp,
      xpToNextLevel: actorProfessionAfterXp.xpToNextLevel,
      xpForNextLevel: actorProfessionAfterXp.xpForNextLevel,
      progressPercent: actorProfessionAfterXp.progressPercent,
      criticalFailureToolDamage
    });
    if (criticalSuccess) {
      ui.notifications.info("Foraging riuscito con successo critico.");
    } else if (success) {
      ui.notifications.info("Foraging riuscito.");
    } else if (criticalFailure) {
      ui.notifications.error("Foraging fallito criticamente.");
    } else {
      ui.notifications.warn("Foraging fallito.");
    }
  }
  async confirmForaging(profile, actor) {
    const resources = await this.toComponentViews(
      profile,
      "resources",
      profile.resources
    );
    const tools = await this.toComponentViews(
      profile,
      "tools",
      profile.tools
    );
    const resourceRows = resources.length > 0 ? resources.map((resource) => {
      return `<li>${this.escapeHtml(resource.name)} \u2014 peso ${resource.weight}, quantit\xE0 ${this.escapeHtml(resource.quantityLabel)}</li>`;
    }).join("") : "<li><em>Nessuna risorsa configurata.</em></li>";
    const toolBonusPreview = await this.getToolQuantityBonus(actor, profile);
    const toolRows = toolBonusPreview.details.length > 0 ? toolBonusPreview.details.map((tool) => {
      const status = tool.applied ? "bonus alla prova applicato" : tool.possessed ? "posseduto ma non competente" : "non posseduto";
      return `<li>${this.escapeHtml(tool.name)}: +${tool.quantity} alla prova \u2014 ${this.escapeHtml(status)}</li>`;
    }).join("") : "<li><em>Nessuno strumento bonus configurato.</em></li>";
    const actorProfession = new ProfessionService().getActorProfession(actor, profile.profession);
    const content = `
            <form>
                <p><strong>Attore:</strong> ${this.escapeHtml(actor.name ?? "Attore")}</p>
                <p><strong>Lista:</strong> ${this.escapeHtml(profile.name)}</p>
                <p><strong>Bioma:</strong> ${this.escapeHtml(this.getBiomeLabel(profile.biome))}</p>
                <p><strong>Professione:</strong> ${this.escapeHtml(this.getProfessionLabel(profile.profession))}</p>
                <p><strong>Livello professione PG:</strong> ${actorProfession.level}</p>
                <p><strong>XP professione PG:</strong> ${actorProfession.xp}</p>
                <p><strong>Moltiplicatore raccolta PG:</strong> ${this.escapeHtml(actorProfession.gatheringMultiplierLabel)}</p>
                <p><strong>Abilit\xE0:</strong> ${this.escapeHtml(profile.skill || "Non impostata")}</p>
                <p><strong>CD:</strong> ${profile.dc}</p>
                <p><strong>Tempo:</strong> ${this.formatMinutes(profile.time)}</p>
                <p><strong>Massimo risorse diverse:</strong> ${profile.maxResources}</p>

                <h4>Risorse possibili</h4>
                <ul>${resourceRows}</ul>

                <h4>Strumenti bonus</h4>
                <ul>${toolRows}</ul>
            </form>
        `;
    return new Promise((resolve) => {
      new Dialog({
        title: "Avvia Foraging",
        content,
        buttons: {
          cancel: {
            label: "Annulla",
            callback: () => resolve(false)
          },
          confirm: {
            label: "Tira Foraging",
            callback: () => resolve(true)
          }
        },
        default: "confirm",
        close: () => resolve(false)
      }).render(true);
    });
  }
  async getMixedResolvedResources(profile) {
    const resources = await this.toComponentViews(
      profile,
      "resources",
      profile.resources
    );
    const availableResources = resources.filter((resource) => resource.found && resource.weight > 0);
    if (availableResources.length === 0) {
      return [];
    }
    const maxResources = Math.max(
      1,
      Math.min(
        availableResources.length,
        Math.floor(Number(profile.maxResources ?? 1))
      )
    );
    const targetCount = 1 + Math.floor(Math.random() * maxResources);
    const remaining = [...availableResources];
    const selected = [];
    while (selected.length < targetCount && remaining.length > 0) {
      const totalWeight = remaining.reduce((total, resource2) => {
        return total + Math.max(0, Number(resource2.weight ?? 0));
      }, 0);
      if (totalWeight <= 0) {
        break;
      }
      let roll = Math.random() * totalWeight;
      let selectedIndex = 0;
      for (let index = 0; index < remaining.length; index += 1) {
        roll -= Math.max(0, Number(remaining[index].weight ?? 0));
        if (roll <= 0) {
          selectedIndex = index;
          break;
        }
      }
      const [resource] = remaining.splice(selectedIndex, 1);
      selected.push({
        ...resource,
        rolledQuantity: this.rollQuantityRange(
          resource.minQuantity,
          resource.maxQuantity
        )
      });
    }
    return selected;
  }
  async getWeightedResolvedResource(profile) {
    const resources = await this.toComponentViews(
      profile,
      "resources",
      profile.resources
    );
    const validResources = resources.filter((resource) => resource.found && resource.weight > 0);
    if (validResources.length === 0) {
      return null;
    }
    const totalWeight = validResources.reduce((total, resource) => {
      return total + Math.max(0, Number(resource.weight ?? 0));
    }, 0);
    let roll = Math.random() * totalWeight;
    let selected = validResources[0];
    for (const resource of validResources) {
      roll -= Math.max(0, Number(resource.weight ?? 0));
      if (roll <= 0) {
        selected = resource;
        break;
      }
    }
    return {
      ...selected,
      rolledQuantity: this.rollQuantityRange(
        selected.minQuantity,
        selected.maxQuantity
      )
    };
  }
  rollQuantityRange(minQuantity, maxQuantity) {
    const min = Math.max(1, Math.floor(Number(minQuantity || 1)));
    const max = Math.max(min, Math.floor(Number(maxQuantity || min)));
    return min + Math.floor(Math.random() * (max - min + 1));
  }
  async getToolQuantityBonus(actor, profile) {
    let totalBonus = 0;
    const details = [];
    for (const tool of profile.tools) {
      const document2 = await this.safeFromUuid(tool.uuid);
      const name = document2?.name ?? tool.uuid;
      const actorItem = document2 ? this.findActorItemBySource(actor, tool.uuid, document2.name ?? "") : null;
      const possessed = !!actorItem;
      const proficient = possessed ? this.actorIsProficientWithTool(actor, actorItem, document2) : false;
      const proficiencyBonus = this.getActorProficiencyBonus(actor);
      const quantity = Math.max(0, proficiencyBonus);
      const applied = possessed && proficient && quantity > 0;
      if (applied) {
        totalBonus += quantity;
      }
      details.push({
        name,
        quantity,
        possessed,
        proficient,
        applied
      });
    }
    return {
      totalBonus,
      details
    };
  }
  async damageForagingTool(actor, profile) {
    if (profile.tools.length === 0) {
      return "Nessuno strumento configurato nella lista Foraging.";
    }
    for (const tool of profile.tools) {
      const document2 = await this.safeFromUuid(tool.uuid);
      if (!document2) {
        continue;
      }
      const actorItem = this.findActorItemBySource(actor, tool.uuid, document2.name ?? "");
      if (!actorItem) {
        continue;
      }
      if (!this.actorIsProficientWithTool(actor, actorItem, document2)) {
        continue;
      }
      const itemName = actorItem.name ?? document2.name ?? "Strumento";
      const currentQuantity = Math.max(
        1,
        Number(foundry.utils.getProperty(actorItem, "system.quantity") ?? 1)
      );
      if (currentQuantity > 1) {
        await actorItem.update({
          "system.quantity": currentQuantity - 1
        });
        return `${itemName} danneggiato: quantit\xE0 ${currentQuantity} \u2192 ${currentQuantity - 1}.`;
      }
      await actorItem.delete();
      return `${itemName} distrutto.`;
    }
    return "Nessuno strumento posseduto e competente da danneggiare.";
  }
  getActorProficiencyBonus(actor) {
    const candidates = [
      foundry.utils.getProperty(actor, "system.attributes.prof"),
      foundry.utils.getProperty(actor, "system.attributes.prof.value"),
      foundry.utils.getProperty(actor, "system.attributes.proficiency"),
      foundry.utils.getProperty(actor, "system.attributes.proficiency.value"),
      foundry.utils.getProperty(actor, "system.prof"),
      foundry.utils.getProperty(actor, "system.prof.value"),
      foundry.utils.getProperty(actor, "system.details.proficiencyBonus"),
      foundry.utils.getProperty(actor, "system.details.prof")
    ];
    for (const value of candidates) {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric > 0) {
        return Math.floor(numeric);
      }
    }
    return 0;
  }
  actorIsProficientWithTool(actor, actorItem, sourceItem) {
    if (!actorItem) {
      return false;
    }
    if (this.readItemProficiency(actorItem)) {
      return true;
    }
    const identifierCandidates = this.getToolIdentifierCandidates(actorItem, sourceItem);
    const actorTools = foundry.utils.getProperty(actor, "system.tools");
    if (!actorTools || typeof actorTools !== "object") {
      return false;
    }
    for (const key of identifierCandidates) {
      const toolData = actorTools[key];
      if (this.readToolDataProficiency(toolData)) {
        return true;
      }
    }
    for (const toolData of Object.values(actorTools)) {
      const label = String(
        toolData?.label ?? toolData?.name ?? toolData?.id ?? ""
      ).trim().toLowerCase();
      if (!label) {
        continue;
      }
      if (identifierCandidates.includes(label) && this.readToolDataProficiency(toolData)) {
        return true;
      }
    }
    return false;
  }
  readItemProficiency(item) {
    const candidates = [
      foundry.utils.getProperty(item, "system.proficient"),
      foundry.utils.getProperty(item, "system.proficiency"),
      foundry.utils.getProperty(item, "system.prof"),
      foundry.utils.getProperty(item, "system.prof.hasProficiency"),
      foundry.utils.getProperty(item, "system.proficiencies.value")
    ];
    return candidates.some((value) => {
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "number") {
        return value > 0;
      }
      if (typeof value === "string") {
        const clean = value.trim().toLowerCase();
        return clean === "true" || clean === "proficient" || clean === "prof" || Number(clean) > 0;
      }
      return false;
    });
  }
  readToolDataProficiency(toolData) {
    if (!toolData) {
      return false;
    }
    const candidates = [
      toolData.value,
      toolData.prof,
      toolData.proficient,
      toolData.proficiency,
      toolData.hasProficiency
    ];
    return candidates.some((value) => {
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "number") {
        return value > 0;
      }
      if (typeof value === "string") {
        const clean = value.trim().toLowerCase();
        return clean === "true" || clean === "proficient" || clean === "prof" || Number(clean) > 0;
      }
      return false;
    });
  }
  getToolIdentifierCandidates(actorItem, sourceItem) {
    const values = [
      actorItem?.system?.identifier,
      actorItem?.system?.type?.value,
      actorItem?.system?.type,
      actorItem?.slug,
      actorItem?.name,
      sourceItem?.system?.identifier,
      sourceItem?.system?.type?.value,
      sourceItem?.system?.type,
      sourceItem?.slug,
      sourceItem?.name
    ];
    return Array.from(new Set(
      values.map((value) => String(value ?? "").trim().toLowerCase()).filter((value) => value.length > 0)
    ));
  }
  async addItemToActor(actor, uuid, quantity) {
    const source = await this.safeFromUuid(uuid);
    if (!source || source.documentName !== "Item") {
      ui.notifications.warn(`Output Foraging non valido: ${uuid}`);
      return;
    }
    const existing = this.findActorItemBySource(actor, uuid, source.name ?? "");
    if (existing) {
      const currentQuantity = Number(foundry.utils.getProperty(existing, "system.quantity") ?? 1);
      await existing.update({
        "system.quantity": currentQuantity + quantity
      });
      return;
    }
    const itemData = source.toObject();
    foundry.utils.setProperty(
      itemData,
      "system.quantity",
      quantity
    );
    foundry.utils.setProperty(
      itemData,
      "flags.artisan.sourceUuid",
      uuid
    );
    await actor.createEmbeddedDocuments(
      "Item",
      [itemData]
    );
  }
  findActorItemBySource(actor, sourceUuid, sourceName) {
    return actor.items.find((item) => {
      const flagUuid = item.getFlag("artisan", "sourceUuid");
      if (flagUuid === sourceUuid) {
        return true;
      }
      return item.name === sourceName;
    }) ?? null;
  }
  getSelectedActor() {
    const token = canvas.tokens?.controlled?.[0];
    return token?.actor ?? null;
  }
  getSkillModifier(actor, skill) {
    const key = this.resolveSkillKey(skill);
    if (!key) {
      return 0;
    }
    const skillData = foundry.utils.getProperty(actor, `system.skills.${key}`);
    return Number(skillData?.total ?? skillData?.mod ?? 0);
  }
  resolveSkillKey(skill) {
    const clean = skill.trim().toLowerCase();
    const map = {
      acrobatics: "acr",
      acrobazia: "acr",
      animalhandling: "ani",
      "animal handling": "ani",
      addestrareanimali: "ani",
      "addestrare animali": "ani",
      arcana: "arc",
      athletics: "ath",
      atletica: "ath",
      deception: "dec",
      inganno: "dec",
      history: "his",
      storia: "his",
      insight: "ins",
      intuizione: "ins",
      intimidation: "itm",
      intimidire: "itm",
      investigation: "inv",
      indagare: "inv",
      medicine: "med",
      medicina: "med",
      nature: "nat",
      natura: "nat",
      perception: "prc",
      percezione: "prc",
      performance: "prf",
      intrattenere: "prf",
      persuasion: "per",
      persuasione: "per",
      religion: "rel",
      religione: "rel",
      sleightofhand: "slt",
      "sleight of hand": "slt",
      rapiditadimano: "slt",
      "rapidit\xE0 di mano": "slt",
      stealth: "ste",
      furtivita: "ste",
      furtivit\u00E0: "ste",
      survival: "sur",
      sopravvivenza: "sur"
    };
    return map[clean] ?? clean;
  }
  getNaturalD20(roll) {
    const firstTerm = roll.terms.find((term) => {
      return Array.isArray(term.results);
    });
    const result = firstTerm?.results?.[0]?.result;
    return typeof result === "number" ? result : null;
  }
  calculateForagingXp(profile, collectedResourceCount, criticalSuccess) {
    const resourceBonus = Math.max(1, Math.floor(Number(collectedResourceCount ?? 0)));
    const baseXp = resourceBonus;
    return criticalSuccess ? baseXp * 2 : baseXp;
  }
  async sendForagingResultToChat(data) {
    const title = data.criticalSuccess ? "\u{1F31F} Successo critico Foraging" : data.criticalFailure ? "\u{1F4A5} Fallimento critico Foraging" : data.success ? "\u2705 Foraging riuscito" : "\u274C Foraging fallito";
    const specialResultText = data.criticalSuccess ? "Successo critico: quantit\xE0 dopo moltiplicatore raddoppiata." : data.criticalFailure ? `Fallimento critico: prova fallita automaticamente, nessuna risorsa raccolta. ${data.criticalFailureToolDamage ?? ""}`.trim() : "-";
    const resourceRows = data.collectedResources.length > 0 ? data.collectedResources.map((resource) => `
                <tr>
                    <td>${this.escapeHtml(resource.name)}</td>
                    <td>${resource.weight}</td>
                    <td>${this.escapeHtml(resource.quantityLabel)}</td>
                    <td>${resource.rolledQuantity}</td>
                    <td>${resource.normalQuantity}</td>
                    <td>${resource.multipliedQuantity}</td>
                    <td>${resource.finalQuantity}</td>
                </tr>
            `).join("") : `
                <tr>
                    <td colspan="7">Nessuna risorsa raccolta.</td>
                </tr>
            `;
    const resultText = data.success && data.collectedResources.length > 0 ? `${data.collectedResources.length} risorse diverse aggiunte all'attore.` : "Nessuna risorsa raccolta.";
    const toolDetailsText = data.toolBonusDetails.length > 0 ? data.toolBonusDetails.map((tool) => {
      const status = tool.applied ? "applicato" : tool.possessed ? "non competente" : "non posseduto";
      return `${this.escapeHtml(tool.name)} +${tool.quantity} alla prova: ${this.escapeHtml(status)}`;
    }).join("<br>") : "Nessuno";
    const content = `
            <div class="artisan-chat-card">
                <h2>${title}</h2>

                <p>
                    <strong>${this.escapeHtml(data.profile.name)}</strong><br>
                    Attore: ${this.escapeHtml(data.actor.name ?? "Attore")}
                </p>

                <table>
                    <tbody>
                        <tr>
                            <td><strong>Bioma</strong></td>
                            <td>${this.escapeHtml(this.getBiomeLabel(data.profile.biome))}</td>
                        </tr>
                        <tr>
                            <td><strong>Professione</strong></td>
                            <td>${this.escapeHtml(this.getProfessionLabel(data.profile.profession))}</td>
                        </tr>
                        <tr>
                            <td><strong>Livello professione PG</strong></td>
                            <td>${data.actorProfessionLevel} \u2192 ${data.actorProfessionLevelAfter}${data.actorProfessionLevelAfter > data.actorProfessionLevel ? " \u2B50 Avanzamento" : ""}</td>
                        </tr>
                        <tr>
                            <td><strong>XP professione PG</strong></td>
                            <td>${data.actorProfessionXp} \u2192 ${data.actorProfessionXpAfter}</td>
                        </tr>
                        <tr>
                            <td><strong>XP guadagnata</strong></td>
                            <td>+${data.xpGained}</td>
                        </tr>
                        <tr>
                            <td><strong>Prossimo livello</strong></td>
                            <td>${data.xpForNextLevel === null ? "Livello massimo" : `${data.xpToNextLevel} XP mancanti (${data.progressPercent}%)`}</td>
                        </tr>
                        <tr>
                            <td><strong>Sorgente professione</strong></td>
                            <td>${this.escapeHtml(data.actorProfessionSource)}</td>
                        </tr>
                        <tr>
                            <td><strong>Moltiplicatore raccolta PG</strong></td>
                            <td>${this.escapeHtml(data.gatheringMultiplierLabel)}</td>
                        </tr>
                        <tr>
                            <td><strong>Abilit\xE0</strong></td>
                            <td>${this.escapeHtml(data.profile.skill || "Non impostata")}</td>
                        </tr>
                        <tr>
                            <td><strong>Formula</strong></td>
                            <td>${this.escapeHtml(data.rollFormula)}</td>
                        </tr>
                        <tr>
                            <td><strong>Naturale</strong></td>
                            <td>${data.natural ?? "-"}</td>
                        </tr>
                        <tr>
                            <td><strong>Modificatore</strong></td>
                            <td>${data.skillModifier}</td>
                        </tr>
                        <tr>
                            <td><strong>Totale</strong></td>
                            <td>${data.total}</td>
                        </tr>
                        <tr>
                            <td><strong>CD</strong></td>
                            <td>${data.profile.dc}</td>
                        </tr>
                        <tr>
                            <td><strong>Esito speciale</strong></td>
                            <td>${this.escapeHtml(specialResultText)}</td>
                        </tr>
                        <tr>
                            <td><strong>Danno strumento</strong></td>
                            <td>${data.criticalFailure ? this.escapeHtml(data.criticalFailureToolDamage ?? "Nessuno") : "-"}</td>
                        </tr>
                        <tr>
                            <td><strong>Tempo</strong></td>
                            <td>${this.formatMinutes(data.profile.time)}</td>
                        </tr>
                        <tr>
                            <td><strong>Massimo risorse diverse</strong></td>
                            <td>${data.profile.maxResources}</td>
                        </tr>
                        <tr>
                            <td><strong>Risorse diverse raccolte</strong></td>
                            <td>${data.collectedResources.length}</td>
                        </tr>
                        <tr>
                            <td><strong>Bonus strumenti competenti alla prova</strong></td>
                            <td>+${data.toolBonus}</td>
                        </tr>
                        <tr>
                            <td><strong>Dettaglio strumenti</strong></td>
                            <td>${toolDetailsText}</td>
                        </tr>
                    </tbody>
                </table>

                <h3>Risorse raccolte</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Risorsa</th>
                            <th>Peso</th>
                            <th>Range</th>
                            <th>Base</th>
                            <th>Prima mult.</th>
                            <th>Dopo mult.</th>
                            <th>Finale</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${resourceRows}
                    </tbody>
                </table>

                <p><strong>${resultText}</strong></p>
            </div>
        `;
    await ChatMessage.create({
      content,
      speaker: ChatMessage.getSpeaker({ actor: data.actor })
    });
  }
  async saveProfiles(profiles) {
    this.ensureSettingsRegistered();
    await game.settings.set(
      _ForagingService.SETTING_SCOPE,
      _ForagingService.SETTING_KEY,
      profiles.map((profile) => this.normalizeProfile(profile))
    );
  }
  ensureSettingsRegistered() {
    const key = `${_ForagingService.SETTING_SCOPE}.${_ForagingService.SETTING_KEY}`;
    if (game.settings.settings.has(key)) {
      return;
    }
    game.settings.register(
      _ForagingService.SETTING_SCOPE,
      _ForagingService.SETTING_KEY,
      {
        name: "Artisan Foraging Profiles",
        scope: "world",
        config: false,
        type: Array,
        default: []
      }
    );
  }
  applyProfessionMultiplier(quantity, multiplier) {
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      return 0;
    }
    const baseQuantity = Math.max(0, Number(quantity ?? 0));
    if (baseQuantity <= 0) {
      return 0;
    }
    return Math.max(1, Math.floor(baseQuantity * multiplier));
  }
  formatMinutes(value) {
    const minutes = Math.max(0, Number(value ?? 0));
    if (minutes === 1) {
      return "1 minuto";
    }
    return `${minutes} minuti`;
  }
  normalizeProfile(profile) {
    const professionService = new ProfessionService();
    const rawProfession = String(profile.profession || "erborista");
    const profession = professionService.getProfession(rawProfession) ? professionService.normalizeId(rawProfession) : rawProfession;
    return {
      id: String(profile.id || foundry.utils.randomID()),
      name: String(profile.name || "Lista Foraging"),
      biome: String(profile.biome || "foresta"),
      profession,
      professionLevel: professionService.normalizeLevel(profile.professionLevel ?? 1),
      skill: String(profile.skill || professionService.getDefaultSkill(profession) || "survival"),
      dc: Number(profile.dc ?? 10),
      time: Number(profile.time ?? 1),
      maxResources: Math.max(1, Math.floor(Number(profile.maxResources ?? 1))),
      resources: this.normalizeComponents(profile.resources),
      tools: this.normalizeComponents(profile.tools)
    };
  }
  normalizeComponents(components) {
    if (!Array.isArray(components)) {
      return [];
    }
    return components.map((component) => this.normalizeComponent(component));
  }
  normalizeComponent(component) {
    const legacyQuantity = Math.max(1, Number(component.quantity ?? 1));
    const minQuantity = Math.max(1, Number(component.minQuantity ?? legacyQuantity));
    const maxQuantity = Math.max(minQuantity, Number(component.maxQuantity ?? legacyQuantity));
    return {
      uuid: String(component.uuid ?? "").trim(),
      quantity: legacyQuantity,
      weight: Math.max(0.1, Number(component.weight ?? 0.1)),
      minQuantity,
      maxQuantity
    };
  }
  async toProfileView(profile) {
    const resources = await this.toComponentViews(
      profile,
      "resources",
      profile.resources
    );
    const tools = await this.toComponentViews(
      profile,
      "tools",
      profile.tools
    );
    return {
      ...profile,
      resources,
      tools,
      resourceCount: resources.length,
      toolCount: tools.length,
      totalResourceWeight: resources.reduce((total, resource) => total + resource.weight, 0),
      gatheringMultiplier: new ProfessionService().getGatheringMultiplier(profile.professionLevel),
      gatheringMultiplierLabel: new ProfessionService().getMultiplierLabel(profile.professionLevel),
      craftingMultiplier: new ProfessionService().getCraftingMultiplier(profile.professionLevel),
      craftingMultiplierLabel: new ProfessionService().getMultiplierLabel(profile.professionLevel)
    };
  }
  async toComponentViews(profile, collection, components) {
    const views = components.map(async (component, index) => {
      return this.toComponentView(
        profile,
        collection,
        component,
        index
      );
    });
    return Promise.all(views);
  }
  async toComponentView(profile, collection, component, index) {
    const normalized = this.normalizeComponent(component);
    const fallback = {
      index,
      collection,
      profileId: profile.id,
      uuid: normalized.uuid,
      quantity: normalized.quantity,
      weight: normalized.weight,
      minQuantity: normalized.minQuantity,
      maxQuantity: normalized.maxQuantity,
      quantityLabel: collection === "resources" ? this.getQuantityLabel(normalized) : "Bonus competenza PG alla prova",
      name: normalized.uuid,
      img: "icons/svg/item-bag.svg",
      found: false,
      documentType: ""
    };
    const document2 = await this.safeFromUuid(normalized.uuid);
    if (!document2) {
      return fallback;
    }
    return {
      ...fallback,
      name: document2.name ?? normalized.uuid,
      img: document2.img ?? "icons/svg/item-bag.svg",
      found: document2.documentName === "Item",
      documentType: document2.documentName ?? ""
    };
  }
  getProfessionLabel(profession) {
    return new ProfessionService().getLabel(profession);
  }
  getBiomeLabel(biome) {
    const labels = {
      foresta: "Foresta",
      montagna: "Montagna",
      palude: "Palude",
      costa: "Costa",
      caverna: "Caverna",
      deserto: "Deserto",
      artico: "Artico",
      urbano: "Urbano",
      pianura: "Pianura",
      collina: "Collina",
      fiume: "Fiume / Lago"
    };
    return labels[biome] ?? biome ?? "Non impostato";
  }
  getQuantityLabel(component) {
    if (component.minQuantity === component.maxQuantity) {
      return String(component.minQuantity);
    }
    return `${component.minQuantity}-${component.maxQuantity}`;
  }
  resolveResourceWeight(configuredWeight, importedWeight) {
    if (typeof configuredWeight === "number" && Number.isFinite(configuredWeight) && configuredWeight > 0) {
      return configuredWeight;
    }
    if (typeof importedWeight === "number" && Number.isFinite(importedWeight) && importedWeight > 0) {
      return importedWeight;
    }
    return 0.1;
  }
  getItemWeight(document2) {
    const candidates = [
      foundry.utils.getProperty(document2, "system.weight"),
      foundry.utils.getProperty(document2, "system.properties.weight"),
      foundry.utils.getProperty(document2, "system.bulk"),
      foundry.utils.getProperty(document2, "system.quantity.weight")
    ];
    for (const candidate of candidates) {
      const value = Number(candidate);
      if (Number.isFinite(value) && value > 0) {
        return value;
      }
    }
    return null;
  }
  async safeFromUuid(uuid) {
    try {
      return await fromUuid(uuid);
    } catch (_error) {
      return null;
    }
  }
  escapeHtml(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
};

// src/services/harvest-service.ts
var HarvestService = class _HarvestService {
  static SETTING_SCOPE = "artisan";
  static SETTING_KEY = "harvestProfiles";
  async getManagerData(selectedProfileId) {
    const profiles = this.getProfiles();
    let selected = selectedProfileId ? this.getProfile(selectedProfileId) : null;
    if (!selected && profiles.length > 0) {
      selected = profiles[0];
    }
    return {
      profiles: profiles.map((profile) => ({
        id: profile.id,
        label: profile.name,
        icon: "fa-solid fa-leaf",
        selected: selected?.id === profile.id
      })),
      selectedProfile: selected ? await this.toProfileView(selected) : null
    };
  }
  getProfiles() {
    this.ensureSettingsRegistered();
    const value = game.settings.get(
      _HarvestService.SETTING_SCOPE,
      _HarvestService.SETTING_KEY
    );
    if (!Array.isArray(value)) {
      return [];
    }
    return value.map((profile) => this.normalizeProfile(profile));
  }
  getProfile(id) {
    return this.getProfiles().find((profile) => profile.id === id) ?? null;
  }
  async createProfile() {
    const profile = {
      id: foundry.utils.randomID(),
      name: "Nuova lista Harvest",
      biome: "creatura",
      creatureType: "beast",
      profession: "erborista",
      professionLevel: 1,
      skill: "nature",
      dc: 10,
      time: 1,
      maxResources: 3,
      toolRequirement: "optional",
      consumeRequiredTools: false,
      resources: [],
      tools: []
    };
    const profiles = this.getProfiles();
    await this.saveProfiles([
      ...profiles,
      profile
    ]);
    return profile;
  }
  async updateProfile(id, data) {
    const profiles = this.getProfiles();
    const nextProfiles = profiles.map((profile) => {
      if (profile.id !== id) {
        return profile;
      }
      return this.normalizeProfile({
        ...profile,
        ...data
      });
    });
    await this.saveProfiles(nextProfiles);
  }
  async addComponent(profileId, collection, uuid, quantity, options = {}) {
    const cleanUuid = uuid.trim();
    if (!cleanUuid) {
      ui.notifications.warn("Inserisci un UUID valido.");
      return;
    }
    let document2 = null;
    try {
      document2 = await fromUuid(cleanUuid);
    } catch (_error) {
      ui.notifications.warn(`UUID non leggibile: ${cleanUuid}`);
      return;
    }
    if (!document2) {
      ui.notifications.warn(`Nessun documento trovato: ${cleanUuid}`);
      return;
    }
    if (document2.documentName !== "Item") {
      ui.notifications.warn("Puoi aggiungere solo Item dal mondo o dai compendi.");
      return;
    }
    const importedWeight = this.getItemWeight(document2);
    const profiles = this.getProfiles();
    const nextProfiles = profiles.map((profile) => {
      if (profile.id !== profileId) {
        return profile;
      }
      const component = this.normalizeComponent({
        uuid: cleanUuid,
        quantity,
        weight: collection === "resources" ? this.resolveResourceWeight(options.weight, importedWeight) : options.weight,
        minQuantity: options.minQuantity,
        maxQuantity: options.maxQuantity,
        rarity: options.rarity,
        requiredToolUuid: options.requiredToolUuid
      });
      const nextCollection = [...profile[collection]];
      const existingIndex = nextCollection.findIndex((entry) => entry.uuid === component.uuid);
      if (existingIndex >= 0) {
        const existing = nextCollection[existingIndex];
        if (collection === "resources") {
          nextCollection[existingIndex] = this.normalizeComponent({
            ...existing,
            weight: component.weight,
            minQuantity: component.minQuantity,
            maxQuantity: component.maxQuantity,
            quantity: component.maxQuantity,
            rarity: component.rarity,
            requiredToolUuid: component.requiredToolUuid
          });
        } else {
          nextCollection[existingIndex] = this.normalizeComponent({
            ...existing,
            quantity: Math.max(1, Number(existing.quantity ?? 1) + component.quantity)
          });
        }
      } else {
        nextCollection.push(component);
      }
      return {
        ...profile,
        [collection]: nextCollection
      };
    });
    await this.saveProfiles(nextProfiles);
    ui.notifications.info(`${document2.name} aggiunto alla lista Harvest.`);
  }
  async removeComponent(profileId, collection, index) {
    const profiles = this.getProfiles();
    const nextProfiles = profiles.map((profile) => {
      if (profile.id !== profileId) {
        return profile;
      }
      return {
        ...profile,
        [collection]: profile[collection].filter((_entry, entryIndex) => entryIndex !== index)
      };
    });
    await this.saveProfiles(nextProfiles);
  }
  async updateComponent(profileId, collection, index, data) {
    const profiles = this.getProfiles();
    const nextProfiles = profiles.map((profile) => {
      if (profile.id !== profileId) {
        return profile;
      }
      const nextCollection = [...profile[collection]];
      const current = nextCollection[index];
      if (!current) {
        return profile;
      }
      nextCollection[index] = this.normalizeComponent({
        ...current,
        ...data
      });
      return {
        ...profile,
        [collection]: nextCollection
      };
    });
    await this.saveProfiles(nextProfiles);
  }
  async deleteProfile(id) {
    const profiles = this.getProfiles();
    const target = profiles.find((profile) => profile.id === id);
    if (!target) {
      ui.notifications.warn("Lista Harvest non trovata.");
      return;
    }
    const nextProfiles = profiles.filter((profile) => profile.id !== id);
    await this.saveProfiles(nextProfiles);
    ui.notifications.info(`Lista Harvest eliminata: ${target.name}`);
  }
  exportProfiles() {
    const data = JSON.stringify(
      {
        type: "artisan-harvest-profiles",
        version: 6,
        exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
        profiles: this.getProfiles()
      },
      null,
      4
    );
    saveDataToFile(
      data,
      "application/json",
      "artisan-harvest-liste.json"
    );
  }
  async importProfiles(payload) {
    const entries = this.getImportEntries(payload);
    if (!entries.length) {
      return { imported: 0, skipped: 0 };
    }
    const existingProfiles = this.getProfiles();
    const existingNames = new Set(existingProfiles.map((profile) => profile.name.trim().toLowerCase()));
    const nextProfiles = [...existingProfiles];
    let imported = 0;
    let skipped = 0;
    for (const entry of entries) {
      const profile = this.normalizeImportedProfile(entry);
      if (!profile) {
        skipped += 1;
        continue;
      }
      const duplicateKey = profile.name.trim().toLowerCase();
      if (existingNames.has(duplicateKey)) {
        skipped += 1;
        continue;
      }
      existingNames.add(duplicateKey);
      nextProfiles.push(profile);
      imported += 1;
    }
    if (imported > 0) {
      await this.saveProfiles(nextProfiles);
    }
    return { imported, skipped };
  }
  getImportEntries(payload) {
    if (Array.isArray(payload)) {
      return payload;
    }
    if (!payload || typeof payload !== "object") {
      return [];
    }
    const data = payload;
    if (Array.isArray(data.profiles)) {
      return data.profiles;
    }
    if (data.type === "artisan-harvest-profiles" && Array.isArray(data.harvestProfiles)) {
      return data.harvestProfiles;
    }
    if (data.name && (Array.isArray(data.resources) || Array.isArray(data.tools))) {
      return [data];
    }
    return [];
  }
  normalizeImportedProfile(entry) {
    if (!entry || typeof entry !== "object") {
      return null;
    }
    const raw = entry;
    const name = String(raw.name ?? "").trim();
    if (!name) {
      return null;
    }
    return this.normalizeProfile({
      ...raw,
      id: foundry.utils.randomID(),
      name
    });
  }
  async startHarvest(profileId) {
    const profile = this.getProfile(profileId);
    if (!profile) {
      ui.notifications.warn("Lista Harvest non trovata.");
      return;
    }
    const actor = this.getSelectedActor();
    if (!actor) {
      ui.notifications.warn("Seleziona un token con attore prima di usare Harvest.");
      return;
    }
    if (profile.resources.length === 0) {
      ui.notifications.warn("La lista Harvest non contiene parti.");
      return;
    }
    const toolRequirementResult = await this.checkHarvestToolRequirement(actor, profile);
    if (!toolRequirementResult.allowed) {
      await this.sendHarvestBlockedByToolRequirementToChat(actor, profile, toolRequirementResult.details);
      ui.notifications.warn("Harvest bloccato: manca uno strumento richiesto.");
      return;
    }
    const confirmation = await this.confirmHarvest(profile, actor);
    if (!confirmation) {
      return;
    }
    const skillModifier = this.getSkillModifier(actor, profile.skill);
    const toolBonusResult = await this.getToolQuantityBonus(actor, profile);
    const toolBonus = toolBonusResult.totalBonus;
    const totalModifier = skillModifier + toolBonus;
    const formula = totalModifier === 0 ? "1d20" : `1d20 ${totalModifier >= 0 ? "+" : "-"} ${Math.abs(totalModifier)}`;
    const roll = await new Roll(formula).evaluate();
    const total = Number(roll.total ?? 0);
    const natural = this.getNaturalD20(roll);
    const criticalSuccess = natural === 20;
    const criticalFailure = natural === 1;
    const success = !criticalFailure && (criticalSuccess || total >= profile.dc);
    const selectedResourcesBeforeRisk = success ? await this.getMixedResolvedResources(profile, actor) : [];
    const rarityRiskResult = success ? this.applyRarityFailureRisk(selectedResourcesBeforeRisk) : { collected: [], failed: [] };
    const selectedResources = rarityRiskResult.collected;
    const failedResources = rarityRiskResult.failed;
    const professionService = new ProfessionService();
    const actorProfession = professionService.getActorProfession(actor, profile.profession);
    const effectiveProfessionLevel = actorProfession.level;
    const gatheringMultiplier = actorProfession.gatheringMultiplier;
    const collectedResources = selectedResources.map((resource) => {
      const rolledQuantity = Math.max(0, Number(resource.rolledQuantity ?? 0));
      const normalQuantity = Math.max(
        1,
        rolledQuantity
      );
      const multipliedQuantity = this.applyProfessionMultiplier(normalQuantity, gatheringMultiplier);
      const finalQuantity = criticalSuccess ? multipliedQuantity * 2 : multipliedQuantity;
      return {
        ...resource,
        normalQuantity,
        multipliedQuantity,
        finalQuantity
      };
    });
    for (const resource of collectedResources) {
      if (resource.finalQuantity <= 0) {
        continue;
      }
      await this.addItemToActor(
        actor,
        resource.uuid,
        resource.finalQuantity
      );
    }
    const consumedRequiredTools = success ? await this.consumeRequiredHarvestTools(actor, profile, collectedResources) : [];
    const criticalFailureToolDamage = criticalFailure ? await this.damageHarvestTool(actor, profile) : null;
    const professionXpGained = success ? this.calculateHarvestXp(profile, collectedResources.length, criticalSuccess) : 0;
    const actorProfessionAfterXp = professionXpGained > 0 ? await professionService.addActorProfessionXp(actor, profile.profession, professionXpGained) : actorProfession;
    await this.sendHarvestResultToChat({
      actor,
      profile,
      rollFormula: formula,
      natural,
      total,
      skillModifier,
      success,
      criticalSuccess,
      criticalFailure,
      collectedResources,
      failedResources,
      toolBonus,
      toolBonusDetails: toolBonusResult.details,
      gatheringMultiplier,
      gatheringMultiplierLabel: actorProfession.gatheringMultiplierLabel,
      actorProfessionLevel: effectiveProfessionLevel,
      actorProfessionLevelAfter: actorProfessionAfterXp.level,
      actorProfessionXp: actorProfession.xp,
      actorProfessionSource: actorProfession.hasActorValue ? "PG" : "Default livello 0",
      xpGained: professionXpGained,
      actorProfessionXpAfter: actorProfessionAfterXp.xp,
      xpToNextLevel: actorProfessionAfterXp.xpToNextLevel,
      xpForNextLevel: actorProfessionAfterXp.xpForNextLevel,
      progressPercent: actorProfessionAfterXp.progressPercent,
      criticalFailureToolDamage,
      consumedRequiredTools
    });
    if (criticalSuccess) {
      ui.notifications.info("Harvest riuscito con successo critico.");
    } else if (success) {
      ui.notifications.info("Harvest riuscito.");
    } else if (criticalFailure) {
      ui.notifications.error("Harvest fallito criticamente.");
    } else {
      ui.notifications.warn("Harvest fallito.");
    }
  }
  async confirmHarvest(profile, actor) {
    const resources = await this.toComponentViews(
      profile,
      "resources",
      profile.resources
    );
    const tools = await this.toComponentViews(
      profile,
      "tools",
      profile.tools
    );
    const resourceRows = resources.length > 0 ? resources.map((resource) => {
      const requiredTool = resource.requiredToolUuid ? `, strumento richiesto: ${this.escapeHtml(resource.requiredToolName)}` : "";
      return `<li>${this.escapeHtml(resource.name)} \u2014 rarit\xE0 ${this.escapeHtml(resource.rarityLabel)}, rischio rovina ${this.getRarityFailureChance(resource.rarity)}%, peso ${resource.weight}, quantit\xE0 ${this.escapeHtml(resource.quantityLabel)}${requiredTool}</li>`;
    }).join("") : "<li><em>Nessuna parte configurata.</em></li>";
    const toolBonusPreview = await this.getToolQuantityBonus(actor, profile);
    const toolRows = toolBonusPreview.details.length > 0 ? toolBonusPreview.details.map((tool) => {
      const status = tool.applied ? "bonus alla prova applicato" : tool.possessed ? "posseduto ma non competente" : "non posseduto";
      return `<li>${this.escapeHtml(tool.name)}: +${tool.quantity} alla prova \u2014 ${this.escapeHtml(status)}</li>`;
    }).join("") : "<li><em>Nessuno strumento bonus configurato.</em></li>";
    const actorProfession = new ProfessionService().getActorProfession(actor, profile.profession);
    const content = `
            <form>
                <p><strong>Attore:</strong> ${this.escapeHtml(actor.name ?? "Attore")}</p>
                <p><strong>Lista:</strong> ${this.escapeHtml(profile.name)}</p>
                <p><strong>Tipo creatura:</strong> ${this.escapeHtml(this.getCreatureTypeLabel(profile.creatureType))}</p>
                <p><strong>Professione:</strong> ${this.escapeHtml(this.getProfessionLabel(profile.profession))}</p>
                <p><strong>Livello professione PG:</strong> ${actorProfession.level}</p>
                <p><strong>XP professione PG:</strong> ${actorProfession.xp}</p>
                <p><strong>Moltiplicatore harvest PG:</strong> ${this.escapeHtml(actorProfession.gatheringMultiplierLabel)}</p>
                <p><strong>Abilit\xE0:</strong> ${this.escapeHtml(profile.skill || "Non impostata")}</p>
                <p><strong>CD:</strong> ${profile.dc}</p>
                <p><strong>Tempo:</strong> ${this.formatMinutes(profile.time)}</p>
                <p><strong>Massimo parti diverse:</strong> ${profile.maxResources}</p>
                <p><strong>Strumenti:</strong> ${this.escapeHtml(this.getToolRequirementLabel(profile.toolRequirement))}</p>
                <p><strong>Consuma strumenti richiesti:</strong> ${profile.consumeRequiredTools ? "S\xEC" : "No"}</p>

                <h4>Parti possibili</h4>
                <ul>${resourceRows}</ul>

                <h4>Strumenti bonus</h4>
                <ul>${toolRows}</ul>
            </form>
        `;
    return new Promise((resolve) => {
      new Dialog({
        title: "Avvia Harvest",
        content,
        buttons: {
          cancel: {
            label: "Annulla",
            callback: () => resolve(false)
          },
          confirm: {
            label: "Tira Harvest",
            callback: () => resolve(true)
          }
        },
        default: "confirm",
        close: () => resolve(false)
      }).render(true);
    });
  }
  applyRarityFailureRisk(resources) {
    const collected = [];
    const failed = [];
    for (const resource of resources) {
      const riskPercent = this.getRarityFailureChance(resource.rarity);
      if (riskPercent <= 0) {
        collected.push(resource);
        continue;
      }
      const roll = Math.floor(Math.random() * 100) + 1;
      if (roll <= riskPercent) {
        failed.push({
          ...resource,
          rarityRiskPercent: riskPercent,
          rarityRiskRoll: roll,
          failureReason: `Parte ${resource.rarityLabel.toLowerCase()} rovinata durante l'estrazione.`
        });
        continue;
      }
      collected.push(resource);
    }
    return { collected, failed };
  }
  getRarityFailureChance(rarity) {
    switch (rarity) {
      case "common":
        return 0;
      case "uncommon":
        return 10;
      case "rare":
        return 25;
      case "veryRare":
        return 40;
      case "legendary":
        return 60;
      default:
        return 0;
    }
  }
  async getMixedResolvedResources(profile, actor) {
    const resources = await this.toComponentViews(
      profile,
      "resources",
      profile.resources
    );
    const availableResources = resources.filter((resource) => {
      if (!resource.found || resource.weight <= 0) {
        return false;
      }
      if (!actor) {
        return true;
      }
      return this.actorHasRequiredToolForResource(actor, resource);
    });
    if (availableResources.length === 0) {
      return [];
    }
    const maxResources = Math.max(
      1,
      Math.min(
        availableResources.length,
        Math.floor(Number(profile.maxResources ?? 1))
      )
    );
    const targetCount = 1 + Math.floor(Math.random() * maxResources);
    const remaining = [...availableResources];
    const selected = [];
    while (selected.length < targetCount && remaining.length > 0) {
      const totalWeight = remaining.reduce((total, resource2) => {
        return total + Math.max(0, Number(resource2.weight ?? 0));
      }, 0);
      if (totalWeight <= 0) {
        break;
      }
      let roll = Math.random() * totalWeight;
      let selectedIndex = 0;
      for (let index = 0; index < remaining.length; index += 1) {
        roll -= Math.max(0, Number(remaining[index].weight ?? 0));
        if (roll <= 0) {
          selectedIndex = index;
          break;
        }
      }
      const [resource] = remaining.splice(selectedIndex, 1);
      selected.push({
        ...resource,
        rolledQuantity: this.rollQuantityRange(
          resource.minQuantity,
          resource.maxQuantity
        )
      });
    }
    return selected;
  }
  async getWeightedResolvedResource(profile, actor) {
    const resources = await this.toComponentViews(
      profile,
      "resources",
      profile.resources
    );
    const validResources = resources.filter((resource) => {
      if (!resource.found || resource.weight <= 0) {
        return false;
      }
      if (!actor) {
        return true;
      }
      return this.actorHasRequiredToolForResource(actor, resource);
    });
    if (validResources.length === 0) {
      return null;
    }
    const totalWeight = validResources.reduce((total, resource) => {
      return total + Math.max(0, Number(resource.weight ?? 0));
    }, 0);
    let roll = Math.random() * totalWeight;
    let selected = validResources[0];
    for (const resource of validResources) {
      roll -= Math.max(0, Number(resource.weight ?? 0));
      if (roll <= 0) {
        selected = resource;
        break;
      }
    }
    return {
      ...selected,
      rolledQuantity: this.rollQuantityRange(
        selected.minQuantity,
        selected.maxQuantity
      )
    };
  }
  rollQuantityRange(minQuantity, maxQuantity) {
    const min = Math.max(1, Math.floor(Number(minQuantity || 1)));
    const max = Math.max(min, Math.floor(Number(maxQuantity || min)));
    return min + Math.floor(Math.random() * (max - min + 1));
  }
  async checkHarvestToolRequirement(actor, profile) {
    const preview = await this.getToolQuantityBonus(actor, profile);
    if (profile.toolRequirement !== "required") {
      return {
        allowed: true,
        details: preview.details
      };
    }
    if (profile.tools.length === 0) {
      return {
        allowed: true,
        details: preview.details
      };
    }
    const hasAnyPossessedTool = preview.details.some((detail) => detail.possessed);
    return {
      allowed: hasAnyPossessedTool,
      details: preview.details
    };
  }
  async sendHarvestBlockedByToolRequirementToChat(actor, profile, details) {
    const toolRows = details.length > 0 ? details.map((detail) => {
      const status = detail.possessed ? detail.proficient ? "posseduto e competente" : "posseduto ma non competente" : "non posseduto";
      return `<li>${this.escapeHtml(detail.name)} \u2014 ${this.escapeHtml(status)}</li>`;
    }).join("") : "<li><em>Nessuno strumento configurato.</em></li>";
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
                <div class="artisan-chat-card artisan-chat-card--blocked">
                    <h2>Harvest bloccato</h2>
                    <p><strong>Attore:</strong> ${this.escapeHtml(actor.name ?? "Attore")}</p>
                    <p><strong>Lista:</strong> ${this.escapeHtml(profile.name)}</p>
                    <p>Questa lista richiede almeno uno degli strumenti configurati.</p>
                    <h3>Strumenti richiesti</h3>
                    <ul>${toolRows}</ul>
                </div>
            `
    });
  }
  getToolRequirementLabel(value) {
    return value === "required" ? "richiede almeno uno strumento posseduto" : "facoltativi, usati solo come bonus alla prova";
  }
  actorHasRequiredToolForResource(actor, resource) {
    const requiredToolUuid = String(resource.requiredToolUuid ?? "").trim();
    if (!requiredToolUuid) {
      return true;
    }
    const requiredToolName = resource.requiredToolName === requiredToolUuid ? "" : resource.requiredToolName;
    return !!this.findActorItemBySource(actor, requiredToolUuid, requiredToolName);
  }
  async getToolQuantityBonus(actor, profile) {
    let totalBonus = 0;
    const details = [];
    for (const tool of profile.tools) {
      const document2 = await this.safeFromUuid(tool.uuid);
      const name = document2?.name ?? tool.uuid;
      const actorItem = document2 ? this.findActorItemBySource(actor, tool.uuid, document2.name ?? "") : null;
      const possessed = !!actorItem;
      const proficient = possessed ? this.actorIsProficientWithTool(actor, actorItem, document2) : false;
      const proficiencyBonus = this.getActorProficiencyBonus(actor);
      const quantity = Math.max(0, proficiencyBonus);
      const applied = possessed && proficient && quantity > 0;
      if (applied) {
        totalBonus += quantity;
      }
      details.push({
        name,
        quantity,
        possessed,
        proficient,
        applied
      });
    }
    return {
      totalBonus,
      details
    };
  }
  async consumeRequiredHarvestTools(actor, profile, collectedResources) {
    if (!profile.consumeRequiredTools) {
      return [];
    }
    const details = [];
    for (const resource of collectedResources) {
      const requiredToolUuid = String(resource.requiredToolUuid ?? "").trim();
      if (!requiredToolUuid) {
        continue;
      }
      const requiredToolName = resource.requiredToolName === requiredToolUuid ? "" : resource.requiredToolName;
      const actorItem = this.findActorItemBySource(
        actor,
        requiredToolUuid,
        requiredToolName
      );
      if (!actorItem) {
        details.push({
          name: requiredToolName || requiredToolUuid,
          beforeQuantity: 0,
          afterQuantity: 0,
          consumed: false,
          removed: false,
          reason: `Strumento richiesto per ${resource.name} non trovato al momento del consumo.`
        });
        continue;
      }
      const itemName = actorItem.name ?? requiredToolName ?? "Strumento";
      const beforeQuantity = Math.max(
        1,
        Number(foundry.utils.getProperty(actorItem, "system.quantity") ?? 1)
      );
      if (beforeQuantity > 1) {
        await actorItem.update({
          "system.quantity": beforeQuantity - 1
        });
        details.push({
          name: itemName,
          beforeQuantity,
          afterQuantity: beforeQuantity - 1,
          consumed: true,
          removed: false,
          reason: `Consumata 1 unit\xE0 per estrarre ${resource.name}.`
        });
        continue;
      }
      await actorItem.delete();
      details.push({
        name: itemName,
        beforeQuantity,
        afterQuantity: 0,
        consumed: true,
        removed: true,
        reason: `Strumento consumato completamente per estrarre ${resource.name}.`
      });
    }
    return details;
  }
  async damageHarvestTool(actor, profile) {
    if (profile.tools.length === 0) {
      return "Nessuno strumento configurato nella lista Harvest.";
    }
    for (const tool of profile.tools) {
      const document2 = await this.safeFromUuid(tool.uuid);
      if (!document2) {
        continue;
      }
      const actorItem = this.findActorItemBySource(actor, tool.uuid, document2.name ?? "");
      if (!actorItem) {
        continue;
      }
      if (!this.actorIsProficientWithTool(actor, actorItem, document2)) {
        continue;
      }
      const itemName = actorItem.name ?? document2.name ?? "Strumento";
      const currentQuantity = Math.max(
        1,
        Number(foundry.utils.getProperty(actorItem, "system.quantity") ?? 1)
      );
      if (currentQuantity > 1) {
        await actorItem.update({
          "system.quantity": currentQuantity - 1
        });
        return `${itemName} danneggiato: quantit\xE0 ${currentQuantity} \u2192 ${currentQuantity - 1}.`;
      }
      await actorItem.delete();
      return `${itemName} distrutto.`;
    }
    return "Nessuno strumento posseduto e competente da danneggiare.";
  }
  getActorProficiencyBonus(actor) {
    const candidates = [
      foundry.utils.getProperty(actor, "system.attributes.prof"),
      foundry.utils.getProperty(actor, "system.attributes.prof.value"),
      foundry.utils.getProperty(actor, "system.attributes.proficiency"),
      foundry.utils.getProperty(actor, "system.attributes.proficiency.value"),
      foundry.utils.getProperty(actor, "system.prof"),
      foundry.utils.getProperty(actor, "system.prof.value"),
      foundry.utils.getProperty(actor, "system.details.proficiencyBonus"),
      foundry.utils.getProperty(actor, "system.details.prof")
    ];
    for (const value of candidates) {
      const numeric = Number(value);
      if (Number.isFinite(numeric) && numeric > 0) {
        return Math.floor(numeric);
      }
    }
    return 0;
  }
  actorIsProficientWithTool(actor, actorItem, sourceItem) {
    if (!actorItem) {
      return false;
    }
    if (this.readItemProficiency(actorItem)) {
      return true;
    }
    const identifierCandidates = this.getToolIdentifierCandidates(actorItem, sourceItem);
    const actorTools = foundry.utils.getProperty(actor, "system.tools");
    if (!actorTools || typeof actorTools !== "object") {
      return false;
    }
    for (const key of identifierCandidates) {
      const toolData = actorTools[key];
      if (this.readToolDataProficiency(toolData)) {
        return true;
      }
    }
    for (const toolData of Object.values(actorTools)) {
      const label = String(
        toolData?.label ?? toolData?.name ?? toolData?.id ?? ""
      ).trim().toLowerCase();
      if (!label) {
        continue;
      }
      if (identifierCandidates.includes(label) && this.readToolDataProficiency(toolData)) {
        return true;
      }
    }
    return false;
  }
  readItemProficiency(item) {
    const candidates = [
      foundry.utils.getProperty(item, "system.proficient"),
      foundry.utils.getProperty(item, "system.proficiency"),
      foundry.utils.getProperty(item, "system.prof"),
      foundry.utils.getProperty(item, "system.prof.hasProficiency"),
      foundry.utils.getProperty(item, "system.proficiencies.value")
    ];
    return candidates.some((value) => {
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "number") {
        return value > 0;
      }
      if (typeof value === "string") {
        const clean = value.trim().toLowerCase();
        return clean === "true" || clean === "proficient" || clean === "prof" || Number(clean) > 0;
      }
      return false;
    });
  }
  readToolDataProficiency(toolData) {
    if (!toolData) {
      return false;
    }
    const candidates = [
      toolData.value,
      toolData.prof,
      toolData.proficient,
      toolData.proficiency,
      toolData.hasProficiency
    ];
    return candidates.some((value) => {
      if (typeof value === "boolean") {
        return value;
      }
      if (typeof value === "number") {
        return value > 0;
      }
      if (typeof value === "string") {
        const clean = value.trim().toLowerCase();
        return clean === "true" || clean === "proficient" || clean === "prof" || Number(clean) > 0;
      }
      return false;
    });
  }
  getToolIdentifierCandidates(actorItem, sourceItem) {
    const values = [
      actorItem?.system?.identifier,
      actorItem?.system?.type?.value,
      actorItem?.system?.type,
      actorItem?.slug,
      actorItem?.name,
      sourceItem?.system?.identifier,
      sourceItem?.system?.type?.value,
      sourceItem?.system?.type,
      sourceItem?.slug,
      sourceItem?.name
    ];
    return Array.from(new Set(
      values.map((value) => String(value ?? "").trim().toLowerCase()).filter((value) => value.length > 0)
    ));
  }
  async addItemToActor(actor, uuid, quantity) {
    const source = await this.safeFromUuid(uuid);
    if (!source || source.documentName !== "Item") {
      ui.notifications.warn(`Output Harvest non valido: ${uuid}`);
      return;
    }
    const existing = this.findActorItemBySource(actor, uuid, source.name ?? "");
    if (existing) {
      const currentQuantity = Number(foundry.utils.getProperty(existing, "system.quantity") ?? 1);
      await existing.update({
        "system.quantity": currentQuantity + quantity
      });
      return;
    }
    const itemData = source.toObject();
    foundry.utils.setProperty(
      itemData,
      "system.quantity",
      quantity
    );
    foundry.utils.setProperty(
      itemData,
      "flags.artisan.sourceUuid",
      uuid
    );
    await actor.createEmbeddedDocuments(
      "Item",
      [itemData]
    );
  }
  findActorItemBySource(actor, sourceUuid, sourceName) {
    return actor.items.find((item) => {
      const flagUuid = item.getFlag("artisan", "sourceUuid");
      if (flagUuid === sourceUuid) {
        return true;
      }
      return item.name === sourceName;
    }) ?? null;
  }
  getSelectedActor() {
    const token = canvas.tokens?.controlled?.[0];
    return token?.actor ?? null;
  }
  getSkillModifier(actor, skill) {
    const key = this.resolveSkillKey(skill);
    if (!key) {
      return 0;
    }
    const skillData = foundry.utils.getProperty(actor, `system.skills.${key}`);
    return Number(skillData?.total ?? skillData?.mod ?? 0);
  }
  resolveSkillKey(skill) {
    const clean = skill.trim().toLowerCase();
    const map = {
      acrobatics: "acr",
      acrobazia: "acr",
      animalhandling: "ani",
      "animal handling": "ani",
      addestrareanimali: "ani",
      "addestrare animali": "ani",
      arcana: "arc",
      athletics: "ath",
      atletica: "ath",
      deception: "dec",
      inganno: "dec",
      history: "his",
      storia: "his",
      insight: "ins",
      intuizione: "ins",
      intimidation: "itm",
      intimidire: "itm",
      investigation: "inv",
      indagare: "inv",
      medicine: "med",
      medicina: "med",
      nature: "nat",
      natura: "nat",
      perception: "prc",
      percezione: "prc",
      performance: "prf",
      intrattenere: "prf",
      persuasion: "per",
      persuasione: "per",
      religion: "rel",
      religione: "rel",
      sleightofhand: "slt",
      "sleight of hand": "slt",
      rapiditadimano: "slt",
      "rapidit\xE0 di mano": "slt",
      stealth: "ste",
      furtivita: "ste",
      furtivit\u00E0: "ste",
      survival: "sur",
      sopravvivenza: "sur"
    };
    return map[clean] ?? clean;
  }
  getNaturalD20(roll) {
    const firstTerm = roll.terms.find((term) => {
      return Array.isArray(term.results);
    });
    const result = firstTerm?.results?.[0]?.result;
    return typeof result === "number" ? result : null;
  }
  calculateHarvestXp(profile, collectedResourceCount, criticalSuccess) {
    const resourceBonus = Math.max(1, Math.floor(Number(collectedResourceCount ?? 0)));
    const baseXp = resourceBonus;
    return criticalSuccess ? baseXp * 2 : baseXp;
  }
  async sendHarvestResultToChat(data) {
    const title = data.criticalSuccess ? "\u{1F31F} Successo critico Harvest" : data.criticalFailure ? "\u{1F4A5} Fallimento critico Harvest" : data.success ? "\u2705 Harvest riuscito" : "\u274C Harvest fallito";
    const specialResultText = data.criticalSuccess ? "Successo critico: quantit\xE0 dopo moltiplicatore raddoppiata." : data.criticalFailure ? `Fallimento critico: prova fallita automaticamente, nessuna parte harvest. ${data.criticalFailureToolDamage ?? ""}`.trim() : "-";
    const resourceRows = data.collectedResources.length > 0 ? data.collectedResources.map((resource) => `
                <tr>
                    <td>${this.escapeHtml(resource.name)}</td>
                    <td>${this.escapeHtml(resource.rarityLabel)}</td>
                    <td>${resource.weight}</td>
                    <td>${this.escapeHtml(resource.quantityLabel)}</td>
                    <td>${resource.rolledQuantity}</td>
                    <td>${resource.normalQuantity}</td>
                    <td>${resource.multipliedQuantity}</td>
                    <td>${resource.finalQuantity}</td>
                </tr>
            `).join("") : `
                <tr>
                    <td colspan="8">Nessuna parte harvest.</td>
                </tr>
            `;
    const failedResourceRows = data.failedResources.length > 0 ? data.failedResources.map((resource) => `
                <tr>
                    <td>${this.escapeHtml(resource.name)}</td>
                    <td>${this.escapeHtml(resource.rarityLabel)}</td>
                    <td>${resource.rarityRiskPercent}%</td>
                    <td>${resource.rarityRiskRoll}</td>
                    <td>${this.escapeHtml(resource.failureReason)}</td>
                </tr>
            `).join("") : `
                <tr>
                    <td colspan="5">Nessuna parte rovinata dalla rarit\xE0.</td>
                </tr>
            `;
    const resultText = data.success && data.collectedResources.length > 0 ? `${data.collectedResources.length} parti diverse aggiunte all'attore.` : data.success && data.failedResources.length > 0 ? "Harvest riuscito, ma tutte le parti selezionate sono state rovinate dalla rarit\xE0." : "Nessuna parte harvest.";
    const consumedRequiredToolsText = data.consumedRequiredTools.length > 0 ? data.consumedRequiredTools.map((tool) => {
      const quantityText = tool.consumed ? `${tool.beforeQuantity} \u2192 ${tool.afterQuantity}` : "non consumato";
      return `${this.escapeHtml(tool.name)}: ${quantityText} \u2014 ${this.escapeHtml(tool.reason)}`;
    }).join("<br>") : data.profile.consumeRequiredTools ? "Nessuno strumento richiesto consumato." : "Opzione non attiva.";
    const toolDetailsText = data.toolBonusDetails.length > 0 ? data.toolBonusDetails.map((tool) => {
      const status = tool.applied ? "applicato" : tool.possessed ? "non competente" : "non posseduto";
      return `${this.escapeHtml(tool.name)} +${tool.quantity} alla prova: ${this.escapeHtml(status)}`;
    }).join("<br>") : "Nessuno";
    const content = `
            <div class="artisan-chat-card">
                <h2>${title}</h2>

                <p>
                    <strong>${this.escapeHtml(data.profile.name)}</strong><br>
                    Attore: ${this.escapeHtml(data.actor.name ?? "Attore")}
                </p>

                <table>
                    <tbody>
                        <tr>
                            <td><strong>Tipo creatura</strong></td>
                            <td>${this.escapeHtml(this.getCreatureTypeLabel(data.profile.creatureType))}</td>
                        </tr>
                        <tr>
                            <td><strong>Professione</strong></td>
                            <td>${this.escapeHtml(this.getProfessionLabel(data.profile.profession))}</td>
                        </tr>
                        <tr>
                            <td><strong>Livello professione PG</strong></td>
                            <td>${data.actorProfessionLevel} \u2192 ${data.actorProfessionLevelAfter}${data.actorProfessionLevelAfter > data.actorProfessionLevel ? " \u2B50 Avanzamento" : ""}</td>
                        </tr>
                        <tr>
                            <td><strong>XP professione PG</strong></td>
                            <td>${data.actorProfessionXp} \u2192 ${data.actorProfessionXpAfter}</td>
                        </tr>
                        <tr>
                            <td><strong>XP guadagnata</strong></td>
                            <td>+${data.xpGained}</td>
                        </tr>
                        <tr>
                            <td><strong>Prossimo livello</strong></td>
                            <td>${data.xpForNextLevel === null ? "Livello massimo" : `${data.xpToNextLevel} XP mancanti (${data.progressPercent}%)`}</td>
                        </tr>
                        <tr>
                            <td><strong>Sorgente professione</strong></td>
                            <td>${this.escapeHtml(data.actorProfessionSource)}</td>
                        </tr>
                        <tr>
                            <td><strong>Moltiplicatore harvest PG</strong></td>
                            <td>${this.escapeHtml(data.gatheringMultiplierLabel)}</td>
                        </tr>
                        <tr>
                            <td><strong>Abilit\xE0</strong></td>
                            <td>${this.escapeHtml(data.profile.skill || "Non impostata")}</td>
                        </tr>
                        <tr>
                            <td><strong>Formula</strong></td>
                            <td>${this.escapeHtml(data.rollFormula)}</td>
                        </tr>
                        <tr>
                            <td><strong>Naturale</strong></td>
                            <td>${data.natural ?? "-"}</td>
                        </tr>
                        <tr>
                            <td><strong>Modificatore</strong></td>
                            <td>${data.skillModifier}</td>
                        </tr>
                        <tr>
                            <td><strong>Totale</strong></td>
                            <td>${data.total}</td>
                        </tr>
                        <tr>
                            <td><strong>CD</strong></td>
                            <td>${data.profile.dc}</td>
                        </tr>
                        <tr>
                            <td><strong>Esito speciale</strong></td>
                            <td>${this.escapeHtml(specialResultText)}</td>
                        </tr>
                        <tr>
                            <td><strong>Danno strumento</strong></td>
                            <td>${data.criticalFailure ? this.escapeHtml(data.criticalFailureToolDamage ?? "Nessuno") : "-"}</td>
                        </tr>
                        <tr>
                            <td><strong>Tempo</strong></td>
                            <td>${this.formatMinutes(data.profile.time)}</td>
                        </tr>
                        <tr>
                            <td><strong>Massimo parti diverse</strong></td>
                            <td>${data.profile.maxResources}</td>
                        </tr>
                        <tr>
                            <td><strong>Parti diverse raccolte</strong></td>
                            <td>${data.collectedResources.length}</td>
                        </tr>
                        <tr>
                            <td><strong>Parti rovinate dalla rarit\xE0</strong></td>
                            <td>${data.failedResources.length}</td>
                        </tr>
                        <tr>
                            <td><strong>Bonus strumenti competenti alla prova</strong></td>
                            <td>+${data.toolBonus}</td>
                        </tr>
                        <tr>
                            <td><strong>Dettaglio strumenti</strong></td>
                            <td>${toolDetailsText}</td>
                        </tr>
                        <tr>
                            <td><strong>Strumenti richiesti consumati</strong></td>
                            <td>${consumedRequiredToolsText}</td>
                        </tr>
                    </tbody>
                </table>

                <h3>Parti raccolte</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Parte</th>
                            <th>Rarit\xE0</th>
                            <th>Peso</th>
                            <th>Range</th>
                            <th>Base</th>
                            <th>Prima mult.</th>
                            <th>Dopo mult.</th>
                            <th>Finale</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${resourceRows}
                    </tbody>
                </table>

                <h3>Parti rovinate dalla rarit\xE0</h3>
                <table>
                    <thead>
                        <tr>
                            <th>Parte</th>
                            <th>Rarit\xE0</th>
                            <th>Rischio</th>
                            <th>Tiro %</th>
                            <th>Esito</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${failedResourceRows}
                    </tbody>
                </table>

                <p><strong>${resultText}</strong></p>
            </div>
        `;
    await ChatMessage.create({
      content,
      speaker: ChatMessage.getSpeaker({ actor: data.actor })
    });
  }
  async saveProfiles(profiles) {
    this.ensureSettingsRegistered();
    await game.settings.set(
      _HarvestService.SETTING_SCOPE,
      _HarvestService.SETTING_KEY,
      profiles.map((profile) => this.normalizeProfile(profile))
    );
  }
  ensureSettingsRegistered() {
    const key = `${_HarvestService.SETTING_SCOPE}.${_HarvestService.SETTING_KEY}`;
    if (game.settings.settings.has(key)) {
      return;
    }
    game.settings.register(
      _HarvestService.SETTING_SCOPE,
      _HarvestService.SETTING_KEY,
      {
        name: "Artisan Harvest Profiles",
        scope: "world",
        config: false,
        type: Array,
        default: []
      }
    );
  }
  applyProfessionMultiplier(quantity, multiplier) {
    if (!Number.isFinite(multiplier) || multiplier <= 0) {
      return 0;
    }
    const baseQuantity = Math.max(0, Number(quantity ?? 0));
    if (baseQuantity <= 0) {
      return 0;
    }
    return Math.max(1, Math.floor(baseQuantity * multiplier));
  }
  formatMinutes(value) {
    const minutes = Math.max(0, Number(value ?? 0));
    if (minutes === 1) {
      return "1 minuto";
    }
    return `${minutes} minuti`;
  }
  normalizeProfile(profile) {
    const professionService = new ProfessionService();
    const rawProfession = String(profile.profession || "erborista");
    const profession = professionService.getProfession(rawProfession) ? professionService.normalizeId(rawProfession) : rawProfession;
    return {
      id: String(profile.id || foundry.utils.randomID()),
      name: String(profile.name || "Lista Harvest"),
      biome: String(profile.biome || "creatura"),
      creatureType: this.normalizeCreatureType(profile.creatureType ?? profile.biome ?? "beast"),
      profession,
      professionLevel: professionService.normalizeLevel(profile.professionLevel ?? 1),
      skill: String(profile.skill || professionService.getDefaultSkill(profession) || "survival"),
      dc: Number(profile.dc ?? 10),
      time: Number(profile.time ?? 1),
      maxResources: Math.max(1, Math.floor(Number(profile.maxResources ?? 1))),
      toolRequirement: String(profile.toolRequirement || "optional") === "required" ? "required" : "optional",
      consumeRequiredTools: Boolean(profile.consumeRequiredTools ?? false),
      resources: this.normalizeComponents(profile.resources),
      tools: this.normalizeComponents(profile.tools)
    };
  }
  normalizeComponents(components) {
    if (!Array.isArray(components)) {
      return [];
    }
    return components.map((component) => this.normalizeComponent(component));
  }
  normalizeComponent(component) {
    const legacyQuantity = Math.max(1, Number(component.quantity ?? 1));
    const minQuantity = Math.max(1, Number(component.minQuantity ?? legacyQuantity));
    const maxQuantity = Math.max(minQuantity, Number(component.maxQuantity ?? legacyQuantity));
    return {
      uuid: String(component.uuid ?? "").trim(),
      quantity: legacyQuantity,
      weight: Math.max(0.1, Number(component.weight ?? 0.1)),
      minQuantity,
      maxQuantity,
      rarity: this.normalizeRarity(component.rarity),
      requiredToolUuid: String(component.requiredToolUuid ?? "").trim()
    };
  }
  async toProfileView(profile) {
    const resources = await this.toComponentViews(
      profile,
      "resources",
      profile.resources
    );
    const tools = await this.toComponentViews(
      profile,
      "tools",
      profile.tools
    );
    return {
      ...profile,
      resources,
      tools,
      resourceCount: resources.length,
      toolCount: tools.length,
      totalResourceWeight: resources.reduce((total, resource) => total + resource.weight, 0),
      gatheringMultiplier: new ProfessionService().getGatheringMultiplier(profile.professionLevel),
      gatheringMultiplierLabel: new ProfessionService().getMultiplierLabel(profile.professionLevel),
      craftingMultiplier: new ProfessionService().getCraftingMultiplier(profile.professionLevel),
      craftingMultiplierLabel: new ProfessionService().getMultiplierLabel(profile.professionLevel)
    };
  }
  async toComponentViews(profile, collection, components) {
    const views = components.map(async (component, index) => {
      return this.toComponentView(
        profile,
        collection,
        component,
        index
      );
    });
    return Promise.all(views);
  }
  async toComponentView(profile, collection, component, index) {
    const normalized = this.normalizeComponent(component);
    const fallback = {
      index,
      collection,
      profileId: profile.id,
      uuid: normalized.uuid,
      quantity: normalized.quantity,
      weight: normalized.weight,
      minQuantity: normalized.minQuantity,
      maxQuantity: normalized.maxQuantity,
      rarity: normalized.rarity,
      requiredToolUuid: normalized.requiredToolUuid,
      requiredToolName: normalized.requiredToolUuid || "Nessuno",
      requiredToolFound: !normalized.requiredToolUuid,
      rarityLabel: collection === "resources" ? this.getRarityLabel(normalized.rarity) : "-",
      quantityLabel: collection === "resources" ? this.getQuantityLabel(normalized) : "Bonus competenza PG alla prova",
      name: normalized.uuid,
      img: "icons/svg/item-bag.svg",
      found: false,
      documentType: ""
    };
    const document2 = await this.safeFromUuid(normalized.uuid);
    const requiredToolDocument = normalized.requiredToolUuid ? await this.safeFromUuid(normalized.requiredToolUuid) : null;
    const requiredToolName = normalized.requiredToolUuid ? requiredToolDocument?.name ?? normalized.requiredToolUuid : "Nessuno";
    if (!document2) {
      return {
        ...fallback,
        requiredToolName,
        requiredToolFound: !normalized.requiredToolUuid || !!requiredToolDocument
      };
    }
    return {
      ...fallback,
      name: document2.name ?? normalized.uuid,
      img: document2.img ?? "icons/svg/item-bag.svg",
      found: document2.documentName === "Item",
      documentType: document2.documentName ?? "",
      requiredToolName,
      requiredToolFound: !normalized.requiredToolUuid || !!requiredToolDocument
    };
  }
  getProfessionLabel(profession) {
    return new ProfessionService().getLabel(profession);
  }
  normalizeCreatureType(value) {
    const key = String(value ?? "beast").trim().toLowerCase();
    const aliases = {
      creatura: "beast",
      bestia: "beast",
      beast: "beast",
      umanoide: "humanoid",
      humanoid: "humanoid",
      mostro: "monstrosity",
      mostruosita: "monstrosity",
      monstrosity: "monstrosity",
      drago: "dragon",
      dragon: "dragon",
      nonmorto: "undead",
      "non-morto": "undead",
      undead: "undead",
      vegetale: "plant",
      plant: "plant",
      costrutto: "construct",
      construct: "construct",
      elementale: "elemental",
      elemental: "elemental",
      folletto: "fey",
      fey: "fey",
      immondo: "fiend",
      fiend: "fiend",
      celestiale: "celestial",
      celestial: "celestial",
      gigante: "giant",
      giant: "giant",
      melma: "ooze",
      ooze: "ooze",
      aberrazione: "aberration",
      aberration: "aberration"
    };
    return aliases[key] ?? key ?? "beast";
  }
  getCreatureTypeLabel(creatureType) {
    const labels = {
      beast: "Bestia",
      humanoid: "Umanoide",
      monstrosity: "Mostruosit\xE0",
      dragon: "Drago",
      undead: "Non morto",
      plant: "Vegetale",
      construct: "Costrutto",
      elemental: "Elementale",
      fey: "Folletto",
      fiend: "Immondo",
      celestial: "Celestiale",
      giant: "Gigante",
      ooze: "Melma",
      aberration: "Aberrazione"
    };
    return labels[creatureType] ?? creatureType ?? "Bestia";
  }
  getBiomeLabel(biome) {
    const labels = {
      creatura: "Creatura",
      montagna: "Montagna",
      palude: "Palude",
      costa: "Costa",
      caverna: "Caverna",
      deserto: "Deserto",
      artico: "Artico",
      urbano: "Urbano",
      pianura: "Pianura",
      collina: "Collina",
      fiume: "Fiume / Lago"
    };
    return labels[biome] ?? biome ?? "Non impostato";
  }
  normalizeRarity(value) {
    const clean = String(value ?? "common").trim().toLowerCase();
    const aliases = {
      common: "common",
      comune: "common",
      uncommon: "uncommon",
      noncomune: "uncommon",
      "non comune": "uncommon",
      rare: "rare",
      rara: "rare",
      veryrare: "veryRare",
      "very rare": "veryRare",
      moltorara: "veryRare",
      "molto rara": "veryRare",
      legendary: "legendary",
      leggendaria: "legendary"
    };
    return aliases[clean] ?? "common";
  }
  getRarityLabel(rarity) {
    const labels = {
      common: "Comune",
      uncommon: "Non comune",
      rare: "Rara",
      veryRare: "Molto rara",
      legendary: "Leggendaria"
    };
    return labels[rarity] ?? "Comune";
  }
  getQuantityLabel(component) {
    if (component.minQuantity === component.maxQuantity) {
      return String(component.minQuantity);
    }
    return `${component.minQuantity}-${component.maxQuantity}`;
  }
  resolveResourceWeight(configuredWeight, importedWeight) {
    if (typeof configuredWeight === "number" && Number.isFinite(configuredWeight) && configuredWeight > 0) {
      return configuredWeight;
    }
    if (typeof importedWeight === "number" && Number.isFinite(importedWeight) && importedWeight > 0) {
      return importedWeight;
    }
    return 0.1;
  }
  getItemWeight(document2) {
    const candidates = [
      foundry.utils.getProperty(document2, "system.weight"),
      foundry.utils.getProperty(document2, "system.properties.weight"),
      foundry.utils.getProperty(document2, "system.bulk"),
      foundry.utils.getProperty(document2, "system.quantity.weight")
    ];
    for (const candidate of candidates) {
      const value = Number(candidate);
      if (Number.isFinite(value) && value > 0) {
        return value;
      }
    }
    return null;
  }
  async safeFromUuid(uuid) {
    try {
      return await fromUuid(uuid);
    } catch (_error) {
      return null;
    }
  }
  escapeHtml(value) {
    return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }
};

// src/services/item-service.ts
var ItemService = class {
  async getOrCreateRecipeFolder() {
    let folder = game.folders.find(
      (folder2) => folder2.type === "Item" && folder2.name === "Artisan Recipes"
    );
    if (folder) {
      return folder;
    }
    folder = await Folder.create({
      name: "Artisan Recipes",
      type: "Item",
      color: "#d18b47"
    });
    return folder;
  }
};

// src/services/recipe-service.ts
var RecipeService = class {
  repository = new RecipeRepository();
  itemService = new ItemService();
  getRecipes() {
    return this.repository.getRecipes();
  }
  getRecipe(id) {
    return this.repository.getRecipe(id);
  }
  async createRecipe() {
    const folder = await this.itemService.getOrCreateRecipeFolder();
    const item = await RecipeDocument.create();
    await item.update({
      folder: folder.id
    });
    return item;
  }
  async updateRecipeName(id, name) {
    const item = this.getRecipe(id);
    if (!item) {
      ui.notifications.warn("Ricetta non trovata.");
      return;
    }
    await item.update({
      name: name || "Nuova Ricetta"
    });
  }
  async updateRecipeData(id, data) {
    const item = this.getRecipe(id);
    if (!item) {
      ui.notifications.warn("Ricetta non trovata.");
      return;
    }
    await RecipeDocument.setRecipeData(item, data);
  }
  async addRecipeComponent(id, collection, uuid, quantity) {
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
    let document2 = null;
    try {
      document2 = await fromUuid(cleanUuid);
    } catch (_error) {
      ui.notifications.warn(`UUID non leggibile: ${cleanUuid}`);
      return;
    }
    if (!document2) {
      ui.notifications.warn(`Nessun documento trovato con questo UUID: ${cleanUuid}`);
      return;
    }
    if (document2.documentName !== "Item") {
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
    ui.notifications.info(`${document2.name} aggiunto alla ricetta.`);
  }
  async updateRecipeComponentQuantity(id, collection, index, quantity) {
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
  async removeRecipeComponent(id, collection, index) {
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
  async openComponentDocument(uuid) {
    const cleanUuid = uuid.trim();
    if (!cleanUuid) {
      ui.notifications.warn("UUID non valido.");
      return;
    }
    let document2 = null;
    try {
      document2 = await fromUuid(cleanUuid);
    } catch (_error) {
      ui.notifications.warn(`Impossibile aprire UUID: ${cleanUuid}`);
      return;
    }
    if (!document2) {
      ui.notifications.warn(`Documento non trovato: ${cleanUuid}`);
      return;
    }
    if (document2.sheet) {
      document2.sheet.render(true);
      return;
    }
    ui.notifications.warn("Il documento esiste ma non ha una scheda apribile.");
  }
  getExplorerRecipes() {
    return this.getRecipes().map((item) => {
      return RecipeDocument.toExplorerItem(item);
    });
  }
  async getInspectorData(id) {
    const item = this.getRecipe(id);
    if (!item) {
      return null;
    }
    return RecipeDocument.toInspectorData(item);
  }
};

// src/applications/artisan-manager.ts
var { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
var ArtisanManager = class extends HandlebarsApplicationMixin(ApplicationV2) {
  selectedRecipeId = null;
  selectedSectionId = "recipes";
  selectedForagingProfileId = null;
  selectedHarvestProfileId = null;
  recipeSearchText = "";
  recipeFilterProfession = "all";
  recipeFilterCategory = "all";
  recipeFilterLevel = "all";
  static DEFAULT_OPTIONS = {
    id: "artisan-manager",
    tag: "section",
    window: {
      title: "Artisan",
      icon: "fa-solid fa-hammer"
    },
    position: {
      width: 980,
      height: 760
    },
    classes: ["artisan", "artisan-manager"]
  };
  static PARTS = {
    main: {
      template: "modules/artisan/templates/artisan-manager.hbs"
    }
  };
  openSection(sectionId) {
    this.selectedSectionId = sectionId;
    this.render(true);
  }
  openMainSection() {
    if (["presets", "help", "settings"].includes(this.selectedSectionId)) {
      this.selectedSectionId = "recipes";
    }
    this.render(true);
  }
  async _prepareContext(_options) {
    const recipeService = new RecipeService();
    const foragingService = new ForagingService();
    const harvestService = new HarvestService();
    const professionService = new ProfessionService();
    const allRecipes = recipeService.getExplorerRecipes();
    const selectedActor = canvas?.tokens?.controlled?.[0]?.actor ?? null;
    const recipeCategories = this.getRecipeCategoryOptions(allRecipes);
    const recipes = this.getFilteredRecipes(allRecipes, professionService);
    if (this.selectedRecipeId && !recipes.some((recipe) => recipe.id === this.selectedRecipeId)) {
      this.selectedRecipeId = recipes.length > 0 ? String(recipes[0].id) : null;
    }
    if (!this.selectedRecipeId && recipes.length > 0) {
      const firstRecipe = recipes[0];
      this.selectedRecipeId = firstRecipe.id;
    }
    const foragingData = await foragingService.getManagerData(
      this.selectedForagingProfileId
    );
    const harvestData = await harvestService.getManagerData(
      this.selectedHarvestProfileId
    );
    if (!this.selectedForagingProfileId && foragingData.selectedProfile) {
      this.selectedForagingProfileId = foragingData.selectedProfile.id;
    }
    if (!this.selectedHarvestProfileId && harvestData.selectedProfile) {
      this.selectedHarvestProfileId = harvestData.selectedProfile.id;
    }
    const explorerData = [
      {
        id: "recipes",
        label: game.i18n.localize("ARTISAN.Recipes"),
        icon: "fa-solid fa-book",
        count: recipes.length,
        items: recipes.map((recipe) => ({
          ...recipe,
          ...this.getRecipeCraftingRequirementView(recipe, professionService, selectedActor),
          selected: recipe.id === this.selectedRecipeId
        }))
      },
      {
        id: "foraging",
        label: game.i18n.localize("ARTISAN.Foraging"),
        icon: "fa-solid fa-leaf",
        count: foragingData.profiles.length,
        items: []
      },
      {
        id: "harvest",
        label: game.i18n.localize("ARTISAN.Harvest"),
        icon: "fa-solid fa-paw",
        count: harvestData.profiles.length,
        items: []
      },
      {
        id: "professions",
        label: game.i18n.localize("ARTISAN.ActorProfessions"),
        icon: "fa-solid fa-user-gear",
        count: selectedActor ? 1 : 0,
        items: []
      },
      {
        id: "activity",
        label: game.i18n.localize("ARTISAN.ActivityLog"),
        icon: "fa-solid fa-clock-rotate-left",
        count: this.getActivityLog().length,
        items: []
      }
    ];
    const selectedRecipe = this.selectedRecipeId ? await recipeService.getInspectorData(this.selectedRecipeId) : null;
    const selectedRecipeItem = this.selectedRecipeId ? game.items.get(this.selectedRecipeId) : null;
    const selectedRecipeFlag = selectedRecipeItem?.getFlag(
      "artisan",
      "recipe"
    );
    const selectedRecipeProfessionLevel = professionService.normalizeLevel(
      selectedRecipe?.professionLevel ?? selectedRecipeFlag?.professionLevel ?? selectedRecipeFlag?.requiredProfessionLevel ?? 0
    );
    const selectedRecipeRequirement = selectedRecipe ? this.getRecipeCraftingRequirementView(selectedRecipe, professionService, selectedActor) : null;
    const selectedRecipeView = selectedRecipe ? {
      ...selectedRecipe,
      ...selectedRecipeRequirement,
      professionLevel: selectedRecipeProfessionLevel,
      craftingMultiplier: professionService.getCraftingMultiplier(
        selectedRecipeProfessionLevel
      ),
      craftingMultiplierLabel: professionService.getMultiplierLabel(
        selectedRecipeProfessionLevel
      ),
      gatheringMultiplier: professionService.getGatheringMultiplier(
        selectedRecipeProfessionLevel
      ),
      gatheringMultiplierLabel: professionService.getMultiplierLabel(
        selectedRecipeProfessionLevel
      )
    } : null;
    const selectedForagingActorProfession = selectedActor && foragingData.selectedProfile ? professionService.getActorProfession(
      selectedActor,
      foragingData.selectedProfile.profession
    ) : null;
    const selectedHarvestActorProfession = selectedActor && harvestData.selectedProfile ? professionService.getActorProfession(
      selectedActor,
      harvestData.selectedProfile.profession
    ) : null;
    const selectedActorProfessions = professionService.getActorProfessions(selectedActor);
    return {
      title: "Artisan",
      subtitle: "Universal Crafting System",
      explorer: explorerData,
      selectedRecipe: selectedRecipeView,
      selectedSectionId: this.selectedSectionId,
      isRecipesSection: this.selectedSectionId === "recipes",
      isForagingSection: this.selectedSectionId === "foraging",
      isHarvestSection: this.selectedSectionId === "harvest",
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
        level: this.recipeFilterLevel
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
      harvestProfiles: harvestData.profiles,
      harvestProfessionOptions: professionService.getOptions(),
      selectedHarvestProfile: harvestData.selectedProfile,
      selectedHarvestActorName: selectedActor?.name ?? "",
      selectedHarvestActorProfession,
      selectedActorName: selectedActor?.name ?? "",
      selectedActorProfessions,
      selectedActorProfessionSummary: this.getActorProfessionSummary(selectedActorProfessions)
    };
  }
  async _onRender(context, options) {
    await super._onRender(context, options);
    this.syncForagingBiomeSelects();
    this.syncRecipeProfessionSelects();
    this.syncForagingProfessionSelects();
    this.syncHarvestCreatureTypeSelects();
    this.syncHarvestProfessionSelects();
    this.syncHarvestRaritySelects();
    this.activateRecipeEditorListeners();
  }
  syncForagingBiomeSelects() {
    const element = this.getRootElement();
    if (!element) {
      return;
    }
    const current = element.querySelector(
      "[data-artisan-foraging-biome-current]"
    );
    const select = element.querySelector(
      'select[data-artisan-foraging-field="biome"]'
    );
    if (!current || !select) {
      return;
    }
    select.value = current.value || "foresta";
  }
  syncRecipeProfessionSelects() {
    const element = this.getRootElement();
    if (!element) {
      return;
    }
    const current = element.querySelector(
      "[data-artisan-recipe-profession-current]"
    );
    const select = element.querySelector(
      'select[data-artisan-field="profile"]'
    );
    if (!current || !select) {
      return;
    }
    select.value = current.value ? current.value.trim().toLowerCase() : "erborista";
  }
  syncForagingProfessionSelects() {
    const element = this.getRootElement();
    if (!element) {
      return;
    }
    const current = element.querySelector(
      "[data-artisan-foraging-profession-current]"
    );
    const select = element.querySelector(
      'select[data-artisan-foraging-field="profession"]'
    );
    if (!current || !select) {
      return;
    }
    select.value = current.value ? current.value.trim().toLowerCase() : "erborista";
  }
  syncHarvestCreatureTypeSelects() {
    const element = this.getRootElement();
    if (!element) {
      return;
    }
    const current = element.querySelector(
      "[data-artisan-harvest-creature-type-current]"
    );
    const select = element.querySelector(
      'select[data-artisan-harvest-field="creatureType"]'
    );
    if (!current || !select) {
      return;
    }
    select.value = current.value || "beast";
  }
  syncHarvestProfessionSelects() {
    const element = this.getRootElement();
    if (!element) {
      return;
    }
    const current = element.querySelector(
      "[data-artisan-harvest-profession-current]"
    );
    const select = element.querySelector(
      'select[data-artisan-harvest-field="profession"]'
    );
    if (!current || !select) {
      return;
    }
    select.value = current.value ? current.value.trim().toLowerCase() : "cacciatore";
  }
  syncHarvestRaritySelects() {
    const element = this.getRootElement();
    if (!element) {
      return;
    }
    const selects = element.querySelectorAll(
      "select[data-artisan-harvest-rarity-select]"
    );
    for (const select of Array.from(selects)) {
      select.value = select.dataset.currentRarity || "common";
    }
  }
  activateRecipeEditorListeners() {
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
      if (!(target instanceof HTMLInputElement) && !(target instanceof HTMLSelectElement)) {
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
      if (target.matches("[data-artisan-component-row-quantity]")) {
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
      if (target.matches("[data-artisan-actor-profession-field]")) {
        void this.onActorProfessionFieldChanged(target);
        return;
      }
      if (target.matches("[data-artisan-setting-field]")) {
        void this.onArtisanSettingChanged(target);
        return;
      }
      if (target instanceof HTMLInputElement && target.matches("[data-artisan-import-recipes-file]")) {
        void this.onImportRecipesFileChanged(target);
        return;
      }
      if (target instanceof HTMLInputElement && target.matches("[data-artisan-import-backup-file]")) {
        void this.onImportBackupFileChanged(target);
        return;
      }
      if (target instanceof HTMLInputElement && target.matches("[data-artisan-import-foraging-file]")) {
        void this.onImportForagingFileChanged(target);
        return;
      }
      if (target instanceof HTMLInputElement && target.matches("[data-artisan-import-harvest-file]")) {
        void this.onImportHarvestFileChanged(target);
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
      const sectionButton = target.closest(
        "[data-artisan-select-section]"
      );
      if (sectionButton) {
        event.preventDefault();
        this.onSelectSectionClicked(sectionButton);
        return;
      }
      const newRecipeButton = target.closest(
        "[data-artisan-new-recipe]"
      );
      if (newRecipeButton) {
        event.preventDefault();
        void this.onNewRecipeClicked();
        return;
      }
      const exportAllRecipesButton = target.closest(
        "[data-artisan-export-all-recipes]"
      );
      if (exportAllRecipesButton) {
        event.preventDefault();
        this.onExportAllRecipesClicked();
        return;
      }
      const importRecipesButton = target.closest(
        "[data-artisan-import-recipes]"
      );
      if (importRecipesButton) {
        event.preventDefault();
        this.onImportRecipesClicked();
        return;
      }
      const exportBackupButton = target.closest(
        "[data-artisan-export-backup]"
      );
      if (exportBackupButton) {
        event.preventDefault();
        this.onExportBackupClicked();
        return;
      }
      const importBackupButton = target.closest(
        "[data-artisan-import-backup]"
      );
      if (importBackupButton) {
        event.preventDefault();
        this.onImportBackupClicked();
        return;
      }
      const refreshActivityButton = target.closest(
        "[data-artisan-refresh-activity]"
      );
      if (refreshActivityButton) {
        event.preventDefault();
        this.render(true);
        return;
      }
      const exportActivityButton = target.closest(
        "[data-artisan-export-activity]"
      );
      if (exportActivityButton) {
        event.preventDefault();
        this.onExportActivityClicked();
        return;
      }
      const clearActivityButton = target.closest(
        "[data-artisan-clear-activity]"
      );
      if (clearActivityButton) {
        event.preventDefault();
        void this.onClearActivityClicked();
        return;
      }
      const resetSettingsButton = target.closest(
        "[data-artisan-reset-settings]"
      );
      if (resetSettingsButton) {
        event.preventDefault();
        void this.onResetArtisanSettingsClicked();
        return;
      }
      const installPresetPackageButton = target.closest(
        "[data-artisan-install-preset-package]"
      );
      if (installPresetPackageButton) {
        event.preventDefault();
        void this.onInstallPresetPackageClicked(installPresetPackageButton);
        return;
      }
      const installAllPresetPackagesButton = target.closest(
        "[data-artisan-install-all-preset-packages]"
      );
      if (installAllPresetPackagesButton) {
        event.preventDefault();
        void this.onInstallAllPresetPackagesClicked();
        return;
      }
      const resetRecipeFiltersButton = target.closest(
        "[data-artisan-reset-recipe-filters]"
      );
      if (resetRecipeFiltersButton) {
        event.preventDefault();
        this.onResetRecipeFiltersClicked();
        return;
      }
      const rollCraftingButton = target.closest(
        "[data-artisan-roll-crafting]"
      );
      if (rollCraftingButton) {
        event.preventDefault();
        void this.onRollCraftingClicked(rollCraftingButton);
        return;
      }
      const previewCraftingButton = target.closest(
        "[data-artisan-preview-crafting]"
      );
      if (previewCraftingButton) {
        event.preventDefault();
        void this.onPreviewCraftingClicked(previewCraftingButton);
        return;
      }
      const validateRecipeButton = target.closest(
        "[data-artisan-validate-recipe]"
      );
      if (validateRecipeButton) {
        event.preventDefault();
        void this.onValidateRecipeClicked(validateRecipeButton);
        return;
      }
      const exportRecipeButton = target.closest(
        "[data-artisan-export-recipe]"
      );
      if (exportRecipeButton) {
        event.preventDefault();
        this.onExportRecipeClicked(exportRecipeButton);
        return;
      }
      const duplicateRecipeButton = target.closest(
        "[data-artisan-duplicate-recipe]"
      );
      if (duplicateRecipeButton) {
        event.preventDefault();
        void this.onDuplicateRecipeClicked(duplicateRecipeButton);
        return;
      }
      const selectRecipeButton = target.closest(
        "[data-artisan-select-recipe]"
      );
      if (selectRecipeButton) {
        event.preventDefault();
        this.onSelectRecipeClicked(selectRecipeButton);
        return;
      }
      const addComponentButton = target.closest(
        "[data-artisan-add-component]"
      );
      if (addComponentButton) {
        event.preventDefault();
        void this.onAddComponentClicked(addComponentButton);
        return;
      }
      const openComponentButton = target.closest(
        "[data-artisan-open-component]"
      );
      if (openComponentButton) {
        event.preventDefault();
        void this.onOpenComponentClicked(openComponentButton);
        return;
      }
      const removeComponentButton = target.closest(
        "[data-artisan-remove-component]"
      );
      if (removeComponentButton) {
        event.preventDefault();
        void this.onRemoveComponentClicked(removeComponentButton);
        return;
      }
      const newForagingProfileButton = target.closest(
        "[data-artisan-new-foraging-profile]"
      );
      if (newForagingProfileButton) {
        event.preventDefault();
        void this.onNewForagingProfileClicked();
        return;
      }
      const selectForagingProfileButton = target.closest(
        "[data-artisan-select-foraging-profile]"
      );
      if (selectForagingProfileButton) {
        event.preventDefault();
        this.onSelectForagingProfileClicked(selectForagingProfileButton);
        return;
      }
      const deleteForagingProfileButton = target.closest(
        "[data-artisan-delete-foraging-profile]"
      );
      if (deleteForagingProfileButton) {
        event.preventDefault();
        void this.onDeleteForagingProfileClicked(deleteForagingProfileButton);
        return;
      }
      const addForagingComponentButton = target.closest(
        "[data-artisan-foraging-add-component]"
      );
      if (addForagingComponentButton) {
        event.preventDefault();
        void this.onAddForagingComponentClicked(addForagingComponentButton);
        return;
      }
      const removeForagingComponentButton = target.closest(
        "[data-artisan-foraging-remove-component]"
      );
      if (removeForagingComponentButton) {
        event.preventDefault();
        void this.onRemoveForagingComponentClicked(
          removeForagingComponentButton
        );
        return;
      }
      const saveActorProfessionButton = target.closest(
        "[data-artisan-save-actor-profession]"
      );
      if (saveActorProfessionButton) {
        event.preventDefault();
        void this.onSaveActorProfessionClicked(saveActorProfessionButton);
        return;
      }
      const startForagingButton = target.closest(
        "[data-artisan-start-foraging]"
      );
      if (startForagingButton) {
        event.preventDefault();
        void this.onStartForagingClicked(startForagingButton);
        return;
      }
      const exportForagingButton = target.closest(
        "[data-artisan-export-foraging]"
      );
      if (exportForagingButton) {
        event.preventDefault();
        this.onExportForagingClicked();
        return;
      }
      const importForagingButton = target.closest(
        "[data-artisan-import-foraging]"
      );
      if (importForagingButton) {
        event.preventDefault();
        this.onImportForagingClicked();
        return;
      }
      const newHarvestProfileButton = target.closest(
        "[data-artisan-new-harvest-profile]"
      );
      if (newHarvestProfileButton) {
        event.preventDefault();
        void this.onNewHarvestProfileClicked();
        return;
      }
      const selectHarvestProfileButton = target.closest(
        "[data-artisan-select-harvest-profile]"
      );
      if (selectHarvestProfileButton) {
        event.preventDefault();
        this.onSelectHarvestProfileClicked(selectHarvestProfileButton);
        return;
      }
      const deleteHarvestProfileButton = target.closest(
        "[data-artisan-delete-harvest-profile]"
      );
      if (deleteHarvestProfileButton) {
        event.preventDefault();
        void this.onDeleteHarvestProfileClicked(deleteHarvestProfileButton);
        return;
      }
      const addHarvestComponentButton = target.closest(
        "[data-artisan-harvest-add-component]"
      );
      if (addHarvestComponentButton) {
        event.preventDefault();
        void this.onAddHarvestComponentClicked(addHarvestComponentButton);
        return;
      }
      const removeHarvestComponentButton = target.closest(
        "[data-artisan-harvest-remove-component]"
      );
      if (removeHarvestComponentButton) {
        event.preventDefault();
        void this.onRemoveHarvestComponentClicked(removeHarvestComponentButton);
        return;
      }
      const startHarvestButton = target.closest(
        "[data-artisan-start-harvest]"
      );
      if (startHarvestButton) {
        event.preventDefault();
        void this.onStartHarvestClicked(startHarvestButton);
        return;
      }
      const exportHarvestButton = target.closest(
        "[data-artisan-export-harvest]"
      );
      if (exportHarvestButton) {
        event.preventDefault();
        this.onExportHarvestClicked();
        return;
      }
      const importHarvestButton = target.closest(
        "[data-artisan-import-harvest]"
      );
      if (importHarvestButton) {
        event.preventDefault();
        this.onImportHarvestClicked();
        return;
      }
      const professionXpButton = target.closest(
        "[data-artisan-profession-xp-action]"
      );
      if (professionXpButton) {
        event.preventDefault();
        void this.onProfessionXpActionClicked(professionXpButton);
        return;
      }
      const refreshActorProfessionsButton = target.closest(
        "[data-artisan-refresh-actor-professions]"
      );
      if (refreshActorProfessionsButton) {
        event.preventDefault();
        this.render(true);
        return;
      }
    });
    element.addEventListener("dragover", (event) => {
      const target = event.target;
      if (!(target instanceof HTMLElement)) {
        return;
      }
      const dropZone = target.closest(
        "[data-artisan-drop-zone], [data-artisan-foraging-drop-zone], [data-artisan-harvest-drop-zone]"
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
      const dropZone = target.closest(
        "[data-artisan-drop-zone], [data-artisan-foraging-drop-zone], [data-artisan-harvest-drop-zone]"
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
      const recipeDropZone = target.closest(
        "[data-artisan-drop-zone]"
      );
      if (recipeDropZone) {
        event.preventDefault();
        recipeDropZone.classList.remove("is-drag-over");
        void this.onComponentDropped(event, recipeDropZone);
        return;
      }
      const foragingDropZone = target.closest(
        "[data-artisan-foraging-drop-zone]"
      );
      if (foragingDropZone) {
        event.preventDefault();
        foragingDropZone.classList.remove("is-drag-over");
        void this.onForagingComponentDropped(
          event,
          foragingDropZone
        );
        return;
      }
      const harvestDropZone = target.closest(
        "[data-artisan-harvest-drop-zone]"
      );
      if (harvestDropZone) {
        event.preventDefault();
        harvestDropZone.classList.remove("is-drag-over");
        void this.onHarvestComponentDropped(
          event,
          harvestDropZone
        );
        return;
      }
    });
  }
  getPresetPackages() {
    return [
      {
        id: "foraging-base",
        icon: "fa-solid fa-leaf",
        title: "Foraging base",
        subtitle: "Biomi pronti da riempire con risorse dei tuoi compendi.",
        description: "Crea liste per Foresta, Montagna, Palude, Costa, Caverna e Deserto con CD, tempo, professione e massimo risorse gi\xE0 impostati.",
        entries: 6
      },
      {
        id: "harvest-base",
        icon: "fa-solid fa-paw",
        title: "Harvest base",
        subtitle: "Tabelle Harvest pronte per tipi creatura comuni.",
        description: "Crea liste per Bestie, Draghi, Non morti, Mostruosit\xE0 e Vegetali. Le parti restano da collegare ai tuoi Item/compendi.",
        entries: 5
      },
      {
        id: "recipe-templates",
        icon: "fa-solid fa-book-open",
        title: "Template ricette",
        subtitle: "Ricette vuote gi\xE0 divise per professione.",
        description: "Crea modelli base per Alchimista, Fabbro, Cuoco, Erborista, Conciatore e Boscaiolo, pronti per ingredienti e output.",
        entries: 6
      }
    ];
  }
  async onInstallAllPresetPackagesClicked() {
    let imported = 0;
    let skipped = 0;
    for (const preset of this.getPresetPackages()) {
      const result = await this.installPresetPackage(String(preset.id));
      imported += result.imported;
      skipped += result.skipped;
    }
    ui.notifications.info(`Pacchetti Artisan installati. Creati: ${imported}, saltati: ${skipped}.`);
    await this.addActivityLogEntry(
      "import",
      "Pacchetti Artisan installati",
      `Installazione completa pacchetti predefiniti. Creati ${imported}, saltati ${skipped}.`
    );
    this.render(true);
  }
  async onInstallPresetPackageClicked(target) {
    const presetId = target.dataset.presetId;
    if (!presetId) {
      return;
    }
    const result = await this.installPresetPackage(presetId);
    ui.notifications.info(`Pacchetto installato. Creati: ${result.imported}, saltati: ${result.skipped}.`);
    this.render(true);
  }
  async installPresetPackage(presetId) {
    if (presetId === "foraging-base") {
      const service = new ForagingService();
      const result = await service.importProfiles({ profiles: this.getForagingPresetProfiles() });
      await this.addActivityLogEntry(
        "import",
        "Pacchetto Foraging base",
        `Liste Foraging create ${result.imported}, saltate ${result.skipped}.`
      );
      return result;
    }
    if (presetId === "harvest-base") {
      const service = new HarvestService();
      const result = await service.importProfiles({ profiles: this.getHarvestPresetProfiles() });
      await this.addActivityLogEntry(
        "import",
        "Pacchetto Harvest base",
        `Liste Harvest create ${result.imported}, saltate ${result.skipped}.`
      );
      return result;
    }
    if (presetId === "recipe-templates") {
      const result = await this.createRecipeTemplatePresets();
      await this.addActivityLogEntry(
        "import",
        "Template ricette base",
        `Ricette template create ${result.imported}, saltate ${result.skipped}.`
      );
      return result;
    }
    ui.notifications.warn("Pacchetto Artisan non riconosciuto.");
    return { imported: 0, skipped: 0 };
  }
  getForagingPresetProfiles() {
    return [
      { name: "Foraging \u2014 Foresta", biome: "foresta", profession: "erborista", skill: "nature", dc: 12, time: 60, maxResources: 3, resources: [], tools: [] },
      { name: "Foraging \u2014 Montagna", biome: "montagna", profession: "minatore", skill: "athletics", dc: 14, time: 90, maxResources: 3, resources: [], tools: [] },
      { name: "Foraging \u2014 Palude", biome: "palude", profession: "erborista", skill: "nature", dc: 15, time: 90, maxResources: 3, resources: [], tools: [] },
      { name: "Foraging \u2014 Costa", biome: "costa", profession: "pescatore", skill: "survival", dc: 12, time: 60, maxResources: 3, resources: [], tools: [] },
      { name: "Foraging \u2014 Caverna", biome: "caverna", profession: "minatore", skill: "perception", dc: 15, time: 120, maxResources: 2, resources: [], tools: [] },
      { name: "Foraging \u2014 Deserto", biome: "deserto", profession: "cacciatore", skill: "survival", dc: 16, time: 120, maxResources: 2, resources: [], tools: [] }
    ];
  }
  getHarvestPresetProfiles() {
    return [
      { name: "Harvest \u2014 Bestie", creatureType: "beast", profession: "cacciatore", skill: "survival", dc: 12, time: 30, maxResources: 3, toolRequirement: "optional", resources: [], tools: [] },
      { name: "Harvest \u2014 Draghi", creatureType: "dragon", profession: "conciatore", skill: "survival", dc: 18, time: 120, maxResources: 3, toolRequirement: "required", resources: [], tools: [] },
      { name: "Harvest \u2014 Non morti", creatureType: "undead", profession: "alchimista", skill: "arcana", dc: 15, time: 60, maxResources: 2, toolRequirement: "optional", resources: [], tools: [] },
      { name: "Harvest \u2014 Mostruosit\xE0", creatureType: "monstrosity", profession: "cacciatore", skill: "survival", dc: 16, time: 90, maxResources: 3, toolRequirement: "optional", resources: [], tools: [] },
      { name: "Harvest \u2014 Vegetali", creatureType: "plant", profession: "erborista", skill: "nature", dc: 13, time: 45, maxResources: 3, toolRequirement: "optional", resources: [], tools: [] }
    ];
  }
  async createRecipeTemplatePresets() {
    const recipeService = new RecipeService();
    const existingNames = new Set(recipeService.getRecipes().map((item) => item.name.trim().toLowerCase()));
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
        outputs: []
      });
      existingNames.add(duplicateKey);
      imported += 1;
    }
    return { imported, skipped };
  }
  getRecipePresetTemplates() {
    return [
      { name: "Template \u2014 Pozione alchemica", category: "Alchimia", profession: "alchimista", professionLevel: 1, skill: "arcana", dc: 12, time: 60 },
      { name: "Template \u2014 Arma semplice", category: "Forgiatura", profession: "fabbro", professionLevel: 1, skill: "athletics", dc: 12, time: 120 },
      { name: "Template \u2014 Armatura rinforzata", category: "Forgiatura", profession: "fabbro", professionLevel: 2, skill: "athletics", dc: 15, time: 240 },
      { name: "Template \u2014 Pasto da viaggio", category: "Cucina", profession: "cuoco", professionLevel: 0, skill: "survival", dc: 10, time: 30 },
      { name: "Template \u2014 Preparato erboristico", category: "Erboristeria", profession: "erborista", professionLevel: 1, skill: "nature", dc: 12, time: 45 },
      { name: "Template \u2014 Pelle lavorata", category: "Conciatura", profession: "conciatore", professionLevel: 1, skill: "survival", dc: 12, time: 90 }
    ];
  }
  getActorProfessionSummary(professions) {
    const entries = Array.isArray(professions) ? professions : [];
    const trained = entries.filter((profession) => Number(profession.level ?? 0) > 0);
    const totalXp = entries.reduce((total, profession) => {
      return total + Math.max(0, Number(profession.xp ?? 0));
    }, 0);
    const highest = entries.reduce((best, profession) => {
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
    const next = entries.filter((profession) => Number(profession.xpToNextLevel ?? 0) > 0).sort((a, b) => Number(a.xpToNextLevel ?? 0) - Number(b.xpToNextLevel ?? 0))[0] ?? null;
    const maxed = entries.filter((profession) => Number(profession.level ?? 0) >= Number(profession.maxLevel ?? 5));
    return {
      count: entries.length,
      trainedCount: trained.length,
      maxedCount: maxed.length,
      totalXp,
      highestLabel: highest ? String(highest.label ?? "Nessuna") : "Nessuna",
      highestLevel: highest ? Number(highest.level ?? 0) : 0,
      nextLabel: next ? String(next.label ?? "Nessuna") : "Tutte al massimo",
      nextXpToLevel: next ? Number(next.xpToNextLevel ?? 0) : 0
    };
  }
  async onProfessionXpActionClicked(target) {
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
        ui.notifications.info("Questa professione \xE8 gi\xE0 al livello massimo.");
        return;
      }
      nextXp = Math.max(nextXp, targetXp);
    } else {
      return;
    }
    const nextLevel = professionService.getLevelFromXp(nextXp, current.maxLevel);
    await professionService.setActorProfession(actor, professionId, nextLevel, nextXp);
    this.render(true);
  }
  getDefaultArtisanSettings() {
    return {
      enableProfessionXp: true,
      enableOutputQuality: true,
      enableToolDamage: true,
      enableHarvestRuinRisk: true,
      enableActivityLog: true
    };
  }
  ensureArtisanSettingsSetting() {
    const settings = game.settings.settings;
    if (settings?.has?.("artisan.moduleSettings")) {
      return;
    }
    game.settings.register("artisan", "moduleSettings", {
      name: "Impostazioni Artisan",
      scope: "world",
      config: false,
      type: Object,
      default: this.getDefaultArtisanSettings()
    });
  }
  getArtisanSettings() {
    this.ensureArtisanSettingsSetting();
    const current = game.settings.get("artisan", "moduleSettings");
    return {
      ...this.getDefaultArtisanSettings(),
      ...current && typeof current === "object" ? current : {}
    };
  }
  getArtisanSettingsView() {
    const settings = this.getArtisanSettings();
    return [
      {
        key: "enableProfessionXp",
        label: game.i18n.localize("ARTISAN.ProfessionXp"),
        description: "Permette ad Artisan di assegnare XP professione durante Crafting, Foraging e Harvest.",
        checked: settings.enableProfessionXp
      },
      {
        key: "enableOutputQuality",
        label: game.i18n.localize("ARTISAN.CraftingOutputQuality"),
        description: "Permette di applicare qualit\xE0 agli oggetti creati in base al margine del tiro.",
        checked: settings.enableOutputQuality
      },
      {
        key: "enableToolDamage",
        label: game.i18n.localize("ARTISAN.ToolDamageOnCriticalFailure"),
        description: "Permette a Foraging e Harvest di danneggiare o distruggere strumenti su 1 naturale.",
        checked: settings.enableToolDamage
      },
      {
        key: "enableHarvestRuinRisk",
        label: game.i18n.localize("ARTISAN.HarvestRuinRisk"),
        description: "Permette alle parti rare Harvest di rovinarsi in base alla rarit\xE0.",
        checked: settings.enableHarvestRuinRisk
      },
      {
        key: "enableActivityLog",
        label: game.i18n.localize("ARTISAN.ActivityLog"),
        description: "Registra le attivit\xE0 Artisan nella sezione Registro attivit\xE0.",
        checked: settings.enableActivityLog
      }
    ];
  }
  async onArtisanSettingChanged(target) {
    const key = target.dataset.artisanSettingKey;
    if (!key) {
      return;
    }
    const current = this.getArtisanSettings();
    const value = target instanceof HTMLInputElement && target.type === "checkbox" ? target.checked : target.value === "true";
    await game.settings.set("artisan", "moduleSettings", {
      ...current,
      [key]: value
    });
    ui.notifications.info("Impostazione Artisan aggiornata.");
    this.render(true);
  }
  async onResetArtisanSettingsClicked() {
    await game.settings.set("artisan", "moduleSettings", this.getDefaultArtisanSettings());
    ui.notifications.info("Impostazioni Artisan ripristinate.");
    this.render(true);
  }
  getActivityLog() {
    this.ensureActivityLogSetting();
    const value = game.settings.get("artisan", "activityLog");
    if (!Array.isArray(value)) {
      return [];
    }
    return value;
  }
  getActivityLogView() {
    return this.getActivityLog().map((entry) => {
      const createdAt = String(entry.createdAt ?? "");
      const date = createdAt ? new Date(createdAt) : null;
      const timeLabel = date && !Number.isNaN(date.getTime()) ? date.toLocaleString() : "Data non disponibile";
      return {
        ...entry,
        timeLabel,
        icon: this.getActivityIcon(String(entry.type ?? "info"))
      };
    });
  }
  getActivityIcon(type) {
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
  async addActivityLogEntry(type, title, message, actorName = "") {
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
        createdAt: (/* @__PURE__ */ new Date()).toISOString()
      },
      ...current
    ].slice(0, 100);
    await game.settings.set("artisan", "activityLog", next);
  }
  ensureActivityLogSetting() {
    const settings = game.settings.settings;
    if (settings?.has?.("artisan.activityLog")) {
      return;
    }
    game.settings.register("artisan", "activityLog", {
      name: "Registro attivit\xE0 Artisan",
      scope: "world",
      config: false,
      type: Array,
      default: []
    });
  }
  onExportActivityClicked() {
    const log = this.getActivityLog();
    if (!log.length) {
      ui.notifications.warn("Il registro attivit\xE0 \xE8 vuoto.");
      return;
    }
    const payload = {
      schema: "artisan.activity-log.export",
      version: 1,
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      count: log.length,
      entries: log
    };
    saveDataToFile(
      JSON.stringify(payload, null, 2),
      "application/json",
      `artisan-registro-attivita-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`
    );
    ui.notifications.info("Registro attivit\xE0 esportato.");
  }
  async onClearActivityClicked() {
    const confirmed = await new Promise((resolve) => {
      new Dialog({
        title: "Cancella registro attivit\xE0",
        content: `
          <p>Vuoi cancellare definitivamente il registro attivit\xE0 di Artisan?</p>
          <p><em>L'operazione non pu\xF2 essere annullata.</em></p>
        `,
        buttons: {
          cancel: {
            label: game.i18n.localize("ARTISAN.Cancel"),
            callback: () => resolve(false)
          },
          delete: {
            label: game.i18n.localize("ARTISAN.Delete"),
            callback: () => resolve(true)
          }
        },
        default: "cancel",
        close: () => resolve(false)
      }).render(true);
    });
    if (!confirmed) {
      return;
    }
    this.ensureActivityLogSetting();
    await game.settings.set("artisan", "activityLog", []);
    ui.notifications.info("Registro attivit\xE0 cancellato.");
    this.render(true);
  }
  getRecipeFilterData(recipe, professionService) {
    const item = recipe?.id ? game.items.get(String(recipe.id)) : null;
    const flag = item?.getFlag("artisan", "recipe");
    return {
      name: String(recipe?.name ?? recipe?.label ?? item?.name ?? ""),
      category: String(recipe?.category ?? flag?.category ?? ""),
      profession: String(recipe?.profile ?? flag?.profile ?? flag?.profession ?? ""),
      professionLevel: professionService.normalizeLevel(
        recipe?.professionLevel ?? flag?.professionLevel ?? flag?.requiredProfessionLevel ?? 0
      )
    };
  }
  getRecipeCraftingRequirementView(recipe, professionService, actor) {
    const data = this.getRecipeFilterData(recipe, professionService);
    const professionId = data.profession || "";
    const requiredLevel = professionService.normalizeLevel(data.professionLevel);
    const professionLabel = professionId ? professionService.getLabel(professionId) : "Nessuna professione";
    const actorProfession = professionId ? professionService.getActorProfession(actor, professionId) : null;
    const actorLevel = actorProfession?.level ?? 0;
    const hasActor = Boolean(actor);
    const requirementMet = requiredLevel <= 0 || actorLevel >= requiredLevel;
    const canCraft = hasActor && requirementMet;
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
        actorProfessionLevel: 0
      };
    }
    if (!requirementMet) {
      return {
        canCraft: false,
        recipeLocked: true,
        recipeStatusClass: "is-locked",
        recipeStatusIcon: "fa-solid fa-lock",
        recipeStatusLabel: `${game.i18n.localize("ARTISAN.Requires")} ${professionLabel} ${requiredLevel}`,
        recipeStatusTitle: `${actor.name}: ${professionLabel} livello ${actorLevel}. Richiesto livello ${requiredLevel}.`,
        requiredProfessionLabel: professionLabel,
        requiredProfessionLevel: requiredLevel,
        actorProfessionLevel: actorLevel
      };
    }
    return {
      canCraft: true,
      recipeLocked: false,
      recipeStatusClass: "is-available",
      recipeStatusIcon: "fa-solid fa-circle-check",
      recipeStatusLabel: requiredLevel > 0 ? `${professionLabel} ${actorLevel}/${requiredLevel}` : game.i18n.localize("ARTISAN.Available"),
      recipeStatusTitle: requiredLevel > 0 ? `${actor.name}: requisito soddisfatto (${professionLabel} livello ${actorLevel}/${requiredLevel}).` : `${actor.name}: ricetta senza requisito professione.`,
      requiredProfessionLabel: professionLabel,
      requiredProfessionLevel: requiredLevel,
      actorProfessionLevel: actorLevel
    };
  }
  getFilteredRecipes(recipes, professionService) {
    const search = this.recipeSearchText.trim().toLowerCase();
    const profession = this.recipeFilterProfession;
    const category = this.recipeFilterCategory;
    const level = this.recipeFilterLevel;
    return recipes.filter((recipe) => {
      const data = this.getRecipeFilterData(recipe, professionService);
      const matchesSearch = !search || data.name.toLowerCase().includes(search) || data.category.toLowerCase().includes(search) || data.profession.toLowerCase().includes(search);
      const matchesProfession = profession === "all" || data.profession === profession;
      const matchesCategory = category === "all" || data.category === category;
      const matchesLevel = level === "all" || data.professionLevel === Number(level);
      return matchesSearch && matchesProfession && matchesCategory && matchesLevel;
    });
  }
  getRecipeCategoryOptions(recipes) {
    const categories = /* @__PURE__ */ new Set();
    for (const recipe of recipes) {
      const item = recipe?.id ? game.items.get(String(recipe.id)) : null;
      const flag = item?.getFlag("artisan", "recipe");
      const category = String(recipe?.category ?? flag?.category ?? "").trim();
      if (category) {
        categories.add(category);
      }
    }
    return Array.from(categories).sort((a, b) => a.localeCompare(b)).map((category) => ({
      value: category,
      label: category,
      selected: category === this.recipeFilterCategory
    }));
  }
  getRecipeProfessionFilterOptions(professionService) {
    return professionService.getOptions().map((option) => ({
      value: String(option.id),
      label: String(option.label),
      selected: String(option.id) === this.recipeFilterProfession
    }));
  }
  getRecipeLevelFilterOptions() {
    return [0, 1, 2, 3, 4, 5].map((level) => ({
      value: String(level),
      label: `${game.i18n.localize("ARTISAN.Level")} ${level}`,
      selected: String(level) === this.recipeFilterLevel
    }));
  }
  getRootElement() {
    return document.getElementById("artisan-manager") ?? document.querySelector(".artisan-manager");
  }
  onSelectSectionClicked(target) {
    const sectionId = target.dataset.sectionId;
    if (!sectionId) {
      return;
    }
    this.selectedSectionId = sectionId;
    this.render(true);
  }
  onRecipeFilterChanged(target) {
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
    this.render(true);
  }
  onResetRecipeFiltersClicked() {
    this.recipeSearchText = "";
    this.recipeFilterProfession = "all";
    this.recipeFilterCategory = "all";
    this.recipeFilterLevel = "all";
    this.render(true);
  }
  async onRecipeFieldChanged(target) {
    const recipeId = target.dataset.recipeId;
    const field = target.dataset.artisanField;
    if (!recipeId || !field) {
      return;
    }
    const recipeService = new RecipeService();
    if (field === "name") {
      await recipeService.updateRecipeName(recipeId, target.value);
      this.render(true);
      return;
    }
    const value = this.parseFieldValue(target);
    if (field === "professionLevel") {
      const item = game.items.get(recipeId);
      if (item) {
        const current = item.getFlag("artisan", "recipe");
        const next = {
          ...current && typeof current === "object" ? current : {},
          professionLevel: new ProfessionService().normalizeLevel(value)
        };
        await item.setFlag("artisan", "recipe", next);
      }
      await recipeService.updateRecipeData(recipeId, {
        professionLevel: new ProfessionService().normalizeLevel(value)
      });
      this.render(true);
      return;
    }
    if (field === "profile") {
      const defaultSkill = new ProfessionService().getDefaultSkill(
        String(value)
      );
      await recipeService.updateRecipeData(recipeId, {
        profile: String(value),
        ...defaultSkill ? { skill: defaultSkill } : {}
      });
      this.render(true);
      return;
    }
    await recipeService.updateRecipeData(recipeId, {
      [field]: value
    });
    this.render(true);
  }
  async onComponentQuantityChanged(target) {
    const recipeId = target.dataset.recipeId;
    const collection = target.dataset.collection;
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
      quantity
    );
    this.render(true);
  }
  parseFieldValue(target) {
    if (target instanceof HTMLInputElement && target.type === "checkbox") {
      return target.checked;
    }
    if (target instanceof HTMLInputElement && target.type === "number") {
      return Number(target.value || 0);
    }
    return target.value;
  }
  async onNewRecipeClicked() {
    const recipeService = new RecipeService();
    const item = await recipeService.createRecipe();
    this.selectedRecipeId = item.id ?? null;
    this.selectedSectionId = "recipes";
    ui.notifications.info("Ricetta creata.");
    this.render(true);
  }
  onImportRecipesClicked() {
    const element = this.getRootElement();
    const input = element?.querySelector(
      "[data-artisan-import-recipes-file]"
    );
    if (!input) {
      ui.notifications.warn("Campo import ricette non trovato.");
      return;
    }
    input.value = "";
    input.click();
  }
  async onImportRecipesFileChanged(target) {
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
        `Import ricette completato: ${result.imported} importate, ${result.skipped} saltate.`
      );
      void this.addActivityLogEntry(
        "import",
        "Ricette importate",
        `${result.imported} ricette importate, ${result.skipped} saltate.`
      );
      this.selectedSectionId = "recipes";
      this.render(true);
    } catch (error) {
      console.error("Artisan | Import ricette fallito", error);
      ui.notifications.error("Import ricette fallito. Controlla che il JSON sia valido.");
    } finally {
      target.value = "";
    }
  }
  readTextFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result ?? ""));
      reader.onerror = () => reject(reader.error ?? new Error("Lettura file fallita."));
      reader.readAsText(file);
    });
  }
  onExportBackupClicked() {
    const foragingService = new ForagingService();
    const harvestService = new HarvestService();
    const recipes = game.items.filter((item) => item.getFlag("artisan", "type") === "recipe").map((item) => this.toRecipeExportData(item));
    const actorProfessions = game.actors.map((actor) => {
      const professions = actor.getFlag("artisan", "professions");
      if (!professions || typeof professions !== "object" || Array.isArray(professions)) {
        return null;
      }
      return {
        id: actor.id,
        uuid: actor.uuid,
        name: actor.name,
        professions: foundry.utils.deepClone(professions)
      };
    }).filter((entry) => entry !== null);
    const payload = {
      schema: "artisan.full-backup",
      version: 1,
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      moduleVersion: game.modules.get("artisan")?.version ?? "0.0.1",
      counts: {
        recipes: recipes.length,
        foragingProfiles: foragingService.getProfiles().length,
        harvestProfiles: harvestService.getProfiles().length,
        actorProfessions: actorProfessions.length
      },
      recipes,
      foragingProfiles: foragingService.getProfiles(),
      harvestProfiles: harvestService.getProfiles(),
      actorProfessions
    };
    saveDataToFile(
      JSON.stringify(payload, null, 2),
      "application/json",
      `artisan-backup-${(/* @__PURE__ */ new Date()).toISOString().slice(0, 10)}.json`
    );
    ui.notifications.info("Backup completo Artisan esportato.");
    void this.addActivityLogEntry(
      "backup",
      "Backup Artisan esportato",
      `Backup completo con ${recipes.length} ricette, ${foragingService.getProfiles().length} liste Foraging, ${harvestService.getProfiles().length} liste Harvest e ${actorProfessions.length} PG con professioni.`
    );
  }
  onImportBackupClicked() {
    const element = this.getRootElement();
    const input = element?.querySelector(
      "[data-artisan-import-backup-file]"
    );
    if (!input) {
      ui.notifications.warn("Campo import backup Artisan non trovato.");
      return;
    }
    input.value = "";
    input.click();
  }
  async onImportBackupFileChanged(target) {
    const file = target.files?.[0];
    if (!file) {
      return;
    }
    try {
      const text = await this.readTextFile(file);
      const payload = JSON.parse(text);
      if (payload?.schema !== "artisan.full-backup") {
        ui.notifications.warn("Il file selezionato non \xE8 un backup completo Artisan.");
        return;
      }
      const recipeEntries = this.getRecipeImportEntries({ recipes: payload.recipes ?? [] });
      const recipeResult = await this.importRecipeEntries(recipeEntries);
      const foragingService = new ForagingService();
      const foragingResult = await foragingService.importProfiles({
        profiles: payload.foragingProfiles ?? []
      });
      const harvestService = new HarvestService();
      const harvestResult = await harvestService.importProfiles({
        profiles: payload.harvestProfiles ?? []
      });
      const actorResult = await this.importActorProfessionBackups(
        payload.actorProfessions ?? []
      );
      ui.notifications.info(
        `Backup importato: ricette ${recipeResult.imported}/${recipeResult.skipped}, Foraging ${foragingResult.imported}/${foragingResult.skipped}, Harvest ${harvestResult.imported}/${harvestResult.skipped}, professioni PG ${actorResult.imported}/${actorResult.skipped}.`
      );
      void this.addActivityLogEntry(
        "backup",
        "Backup Artisan importato",
        `Ricette importate ${recipeResult.imported}, Foraging ${foragingResult.imported}, Harvest ${harvestResult.imported}, professioni PG ${actorResult.imported}.`
      );
      this.render(true);
    } catch (error) {
      console.error("Artisan | Import backup fallito", error);
      ui.notifications.error("Import backup Artisan fallito. Controlla che il JSON sia valido.");
    } finally {
      target.value = "";
    }
  }
  async importActorProfessionBackups(entries) {
    if (!Array.isArray(entries)) {
      return { imported: 0, skipped: 0 };
    }
    let imported = 0;
    let skipped = 0;
    for (const entry of entries) {
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
        foundry.utils.deepClone(professions)
      );
      imported += 1;
    }
    return { imported, skipped };
  }
  findActorForProfessionBackup(entry) {
    if (typeof entry?.uuid === "string" && typeof globalThis.fromUuidSync === "function") {
      const byUuid = globalThis.fromUuidSync(entry.uuid);
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
      return game.actors.find((actor) => actor.name === entry.name) ?? null;
    }
    return null;
  }
  getRecipeImportEntries(payload) {
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
  async importRecipeEntries(entries) {
    let imported = 0;
    let skipped = 0;
    const folder = await this.getOrCreateImportedRecipeFolder();
    for (const entry of entries) {
      const data = this.toRecipeImportData(entry, folder.id ?? null);
      if (!data) {
        skipped += 1;
        continue;
      }
      const duplicate = game.items.find((item2) => {
        return item2.name === data.name && item2.getFlag("artisan", "type") === "recipe";
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
  toRecipeImportData(entry, folderId) {
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
      recipe.professionLevel ?? recipe.requiredProfessionLevel ?? 0
    );
    const importedRecipe = {
      category: String(recipe.category ?? ""),
      profile: String(recipe.profile ?? ""),
      professionLevel,
      requiredProfessionLevel: Number(
        recipe.requiredProfessionLevel ?? professionLevel
      ),
      skill: String(recipe.skill ?? ""),
      dc: Number(recipe.dc ?? 10),
      craftingTime: Number(recipe.craftingTime ?? 0),
      ingredients: this.normalizeRecipeImportComponents(recipe.ingredients),
      tools: this.normalizeRecipeImportComponents(recipe.tools),
      outputs: this.normalizeRecipeImportComponents(recipe.outputs)
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
          recipe: importedRecipe
        }
      }
    };
  }
  normalizeRecipeImportComponents(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((entry) => entry && typeof entry.uuid === "string" && entry.uuid.trim().length > 0).map((entry) => ({
      uuid: String(entry.uuid).trim(),
      quantity: Math.max(1, Number(entry.quantity ?? 1))
    }));
  }
  async getOrCreateImportedRecipeFolder() {
    let folder = game.folders.find((candidate) => {
      return candidate.type === "Item" && candidate.name === "Artisan Recipes";
    });
    if (folder) {
      return folder;
    }
    folder = await Folder.create({
      name: "Artisan Recipes",
      type: "Item",
      color: "#d18b47"
    });
    return folder;
  }
  async onDuplicateRecipeClicked(target) {
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
      ui.notifications.warn("L'Item selezionato non \xE8 una ricetta Artisan.");
      return;
    }
    const source = foundry.utils.deepClone(item.toObject());
    delete source._id;
    source.name = this.getUniqueDuplicatedRecipeName(item.name);
    source.folder = item.folder?.id ?? source.folder ?? null;
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
      `${item.name} duplicata come ${duplicated.name}.`
    );
    this.render(true);
  }
  getUniqueDuplicatedRecipeName(originalName) {
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
  recipeNameExists(name) {
    return game.items.some((item) => {
      return item.name === name && item.getFlag("artisan", "type") === "recipe";
    });
  }
  onExportRecipeClicked(target) {
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
  onExportAllRecipesClicked() {
    const items = game.items.filter((item) => {
      return item.getFlag("artisan", "type") === "recipe";
    });
    if (!items.length) {
      ui.notifications.warn("Nessuna ricetta Artisan da esportare.");
      return;
    }
    this.exportRecipeItems(items, "artisan-ricette.json");
  }
  exportRecipeItems(items, filename) {
    const payload = {
      schema: "artisan.recipe.export",
      version: 1,
      exportedAt: (/* @__PURE__ */ new Date()).toISOString(),
      count: items.length,
      recipes: items.map((item) => this.toRecipeExportData(item))
    };
    saveDataToFile(
      JSON.stringify(payload, null, 2),
      "application/json",
      filename
    );
    ui.notifications.info(
      items.length === 1 ? "Ricetta esportata." : `${items.length} ricette esportate.`
    );
    void this.addActivityLogEntry(
      "export",
      items.length === 1 ? "Ricetta esportata" : "Ricette esportate",
      items.length === 1 ? `Esportata la ricetta ${items[0]?.name ?? "senza nome"}.` : `Esportate ${items.length} ricette Artisan.`
    );
  }
  toRecipeExportData(item) {
    const recipe = item.getFlag("artisan", "recipe");
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
            ingredients: this.normalizeRecipeExportComponents(data.ingredients),
            tools: this.normalizeRecipeExportComponents(data.tools),
            outputs: this.normalizeRecipeExportComponents(data.outputs)
          }
        }
      }
    };
  }
  normalizeRecipeExportComponents(value) {
    if (!Array.isArray(value)) {
      return [];
    }
    return value.filter((entry) => entry && typeof entry.uuid === "string").map((entry) => ({
      uuid: entry.uuid,
      quantity: Math.max(1, Number(entry.quantity ?? 1))
    }));
  }
  toSafeFilename(value) {
    const safe = value.trim().toLowerCase().replace(/[^a-z0-9\-_]+/gi, "-").replace(/^-+|-+$/g, "");
    return safe || "ricetta";
  }
  async onRollCraftingClicked(target) {
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
      actor?.name ?? ""
    );
  }
  async onPreviewCraftingClicked(target) {
    const recipeId = target.dataset.recipeId ?? this.selectedRecipeId;
    if (!recipeId) {
      ui.notifications.warn("Nessuna ricetta selezionata.");
      return;
    }
    const craftingService = new CraftingService();
    await craftingService.previewCrafting(recipeId);
  }
  async onValidateRecipeClicked(target) {
    const recipeId = target.dataset.recipeId ?? this.selectedRecipeId;
    if (!recipeId) {
      ui.notifications.warn("Nessuna ricetta selezionata.");
      return;
    }
    const craftingService = new CraftingService();
    await craftingService.validateRecipe(recipeId);
  }
  onSelectRecipeClicked(target) {
    const recipeId = target.dataset.recipeId;
    if (!recipeId) {
      return;
    }
    this.selectedRecipeId = recipeId;
    this.selectedSectionId = "recipes";
    this.render(true);
  }
  async onAddComponentClicked(target) {
    const recipeId = target.dataset.recipeId ?? this.selectedRecipeId;
    const collection = target.dataset.collection;
    if (!recipeId || !collection) {
      ui.notifications.warn("Ricetta o sezione non valida.");
      return;
    }
    const panel = target.closest(".artisan-component-panel");
    if (!panel) {
      ui.notifications.warn("Pannello non trovato.");
      return;
    }
    const uuidInput = panel.querySelector(
      "[data-artisan-component-uuid]"
    );
    const quantityInput = panel.querySelector(
      "[data-artisan-component-quantity]"
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
    this.render(true);
  }
  async onComponentDropped(event, dropZone) {
    const recipeId = dropZone.dataset.recipeId ?? this.selectedRecipeId;
    const collection = dropZone.dataset.collection;
    if (!recipeId || !collection) {
      ui.notifications.warn("Ricetta o sezione non valida.");
      return;
    }
    const uuid = this.getUuidFromDragEvent(event);
    if (!uuid) {
      ui.notifications.warn(
        "Non riesco a leggere l'UUID dell'elemento trascinato."
      );
      return;
    }
    const panel = dropZone.closest(".artisan-component-panel");
    const quantityInput = panel?.querySelector(
      "[data-artisan-component-quantity]"
    );
    const quantity = Math.max(1, Number(quantityInput?.value || 1));
    await this.addComponentToRecipe(recipeId, collection, uuid, quantity);
    if (quantityInput) {
      quantityInput.value = "1";
    }
    this.render(true);
  }
  getUuidFromDragEvent(event) {
    const rawData = event.dataTransfer?.getData("text/plain") || event.dataTransfer?.getData("application/json");
    if (!rawData) {
      return null;
    }
    try {
      const data = JSON.parse(rawData);
      if (typeof data.uuid === "string" && data.uuid.length > 0) {
        return data.uuid;
      }
      if (typeof data.pack === "string" && typeof data.id === "string") {
        return `Compendium.${data.pack}.Item.${data.id}`;
      }
      if ((data.type === "Item" || data.documentName === "Item") && typeof data.id === "string") {
        return `Item.${data.id}`;
      }
      return null;
    } catch (_error) {
      return null;
    }
  }
  async addComponentToRecipe(recipeId, collection, uuid, quantity) {
    const recipeService = new RecipeService();
    await recipeService.addRecipeComponent(
      recipeId,
      collection,
      uuid,
      quantity
    );
  }
  async onOpenComponentClicked(target) {
    const uuid = target.dataset.uuid;
    if (!uuid) {
      ui.notifications.warn("UUID non valido.");
      return;
    }
    const recipeService = new RecipeService();
    await recipeService.openComponentDocument(uuid);
  }
  async onRemoveComponentClicked(target) {
    const recipeId = target.dataset.recipeId;
    const collection = target.dataset.collection;
    const index = Number(target.dataset.index);
    if (!recipeId || !collection || Number.isNaN(index)) {
      ui.notifications.warn("Elemento non valido.");
      return;
    }
    const recipeService = new RecipeService();
    await recipeService.removeRecipeComponent(recipeId, collection, index);
    this.render(true);
  }
  async onActorProfessionFieldChanged(target) {
    const actor = canvas?.tokens?.controlled?.[0]?.actor ?? null;
    if (!actor) {
      ui.notifications.warn(
        "Seleziona un token con attore per modificare le professioni del PG."
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
    const nextXp = field === "xp" ? Math.max(0, Math.floor(Number(target.value || 0))) : current.xp;
    const nextLevel = field === "xp" ? professionService.getLevelFromXp(nextXp, current.maxLevel) : professionService.normalizeLevel(target.value);
    await professionService.setActorProfession(
      actor,
      professionId,
      nextLevel,
      nextXp
    );
    this.render(true);
  }
  async onNewForagingProfileClicked() {
    const service = new ForagingService();
    const profile = await service.createProfile();
    this.selectedForagingProfileId = profile.id;
    this.selectedSectionId = "foraging";
    this.render(true);
  }
  async onDeleteForagingProfileClicked(target) {
    const profileId = target.dataset.profileId ?? this.selectedForagingProfileId;
    if (!profileId) {
      ui.notifications.warn("Nessuna lista Foraging selezionata.");
      return;
    }
    const service = new ForagingService();
    const profile = service.getProfile(profileId);
    if (!profile) {
      ui.notifications.warn("Lista Foraging non trovata.");
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
    this.render(true);
  }
  async confirmDeleteForagingProfile(profileName) {
    return new Promise((resolve) => {
      new Dialog({
        title: "Cancella lista Foraging",
        content: `
                    <p>Vuoi cancellare definitivamente questa lista Foraging?</p>
                    <p><strong>${profileName}</strong></p>
                    <p><em>L'operazione non pu\xF2 essere annullata.</em></p>
                `,
        buttons: {
          cancel: {
            label: game.i18n.localize("ARTISAN.Cancel"),
            callback: () => resolve(false)
          },
          delete: {
            label: game.i18n.localize("ARTISAN.Delete"),
            callback: () => resolve(true)
          }
        },
        default: "cancel",
        close: () => resolve(false)
      }).render(true);
    });
  }
  onSelectForagingProfileClicked(target) {
    const profileId = target.dataset.profileId;
    if (!profileId) {
      return;
    }
    this.selectedForagingProfileId = profileId;
    this.selectedSectionId = "foraging";
    this.render(true);
  }
  async onSaveActorProfessionClicked(button) {
    const profileId = button.dataset.profileId ?? this.selectedForagingProfileId;
    if (!profileId) {
      ui.notifications.warn(game.i18n.localize("ARTISAN.SelectForagingList"));
      return;
    }
    const profile = new ForagingService().getProfile(profileId);
    if (!profile) {
      ui.notifications.warn("Lista Foraging non trovata.");
      return;
    }
    const actor = canvas?.tokens?.controlled?.[0]?.actor ?? null;
    if (!actor) {
      ui.notifications.warn(
        "Seleziona un token con attore prima di salvare la professione sul PG."
      );
      return;
    }
    const professionService = new ProfessionService();
    const current = professionService.getActorProfession(
      actor,
      profile.profession
    );
    await professionService.setActorProfession(
      actor,
      profile.profession,
      profile.professionLevel,
      current.xp
    );
    ui.notifications.info(
      `Professione ${professionService.getLabel(profile.profession)} salvata su ${actor.name}.`
    );
    this.render(true);
  }
  async onForagingFieldChanged(target) {
    const profileId = target.dataset.profileId ?? this.selectedForagingProfileId;
    const field = target.dataset.artisanForagingField;
    if (!profileId || !field) {
      return;
    }
    const service = new ForagingService();
    const value = this.parseFieldValue(target);
    if (field === "profession") {
      const defaultSkill = new ProfessionService().getDefaultSkill(
        String(value)
      );
      await service.updateProfile(profileId, {
        profession: String(value),
        ...defaultSkill ? { skill: defaultSkill } : {}
      });
      this.render(true);
      return;
    }
    await service.updateProfile(profileId, {
      [field]: value
    });
    this.render(true);
  }
  async onForagingComponentFieldChanged(target) {
    const profileId = target.dataset.profileId ?? this.selectedForagingProfileId;
    const collection = target.dataset.collection;
    const index = Number(target.dataset.index);
    const field = target.dataset.artisanForagingComponentField;
    if (!profileId || !collection || Number.isNaN(index) || !field) {
      ui.notifications.warn("Elemento Foraging non valido.");
      return;
    }
    const service = new ForagingService();
    await service.updateComponent(profileId, collection, index, {
      [field]: this.parseFieldValue(target)
    });
    this.render(true);
  }
  async onAddForagingComponentClicked(target) {
    const profileId = target.dataset.profileId ?? this.selectedForagingProfileId;
    const collection = target.dataset.collection;
    if (!profileId || !collection) {
      ui.notifications.warn("Lista Foraging o sezione non valida.");
      return;
    }
    const panel = target.closest(".artisan-foraging-panel");
    if (!panel) {
      ui.notifications.warn("Pannello Foraging non trovato.");
      return;
    }
    const uuidInput = panel.querySelector(
      "[data-artisan-foraging-component-uuid]"
    );
    const quantityInput = panel.querySelector(
      "[data-artisan-foraging-component-quantity]"
    );
    const weightInput = panel.querySelector(
      "[data-artisan-foraging-component-weight]"
    );
    const minQuantityInput = panel.querySelector(
      "[data-artisan-foraging-component-min-quantity]"
    );
    const maxQuantityInput = panel.querySelector(
      "[data-artisan-foraging-component-max-quantity]"
    );
    const uuid = uuidInput?.value.trim() ?? "";
    const quantity = Math.max(1, Number(quantityInput?.value || 1));
    const weight = weightInput?.value ? Math.max(0.1, Number(weightInput.value)) : void 0;
    const minQuantity = Math.max(
      1,
      Number(minQuantityInput?.value || quantity)
    );
    const maxQuantity = Math.max(
      minQuantity,
      Number(maxQuantityInput?.value || minQuantity)
    );
    if (!uuid) {
      ui.notifications.warn("Inserisci un UUID.");
      return;
    }
    const service = new ForagingService();
    await service.addComponent(profileId, collection, uuid, quantity, {
      weight,
      minQuantity,
      maxQuantity
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
    this.render(true);
  }
  async onForagingComponentDropped(event, dropZone) {
    const profileId = dropZone.dataset.profileId ?? this.selectedForagingProfileId;
    const collection = dropZone.dataset.collection;
    if (!profileId || !collection) {
      ui.notifications.warn("Lista Foraging o sezione non valida.");
      return;
    }
    const uuid = this.getUuidFromDragEvent(event);
    if (!uuid) {
      ui.notifications.warn(
        "Non riesco a leggere l'UUID dell'elemento trascinato."
      );
      return;
    }
    const panel = dropZone.closest(".artisan-foraging-panel");
    const quantityInput = panel?.querySelector(
      "[data-artisan-foraging-component-quantity]"
    );
    const weightInput = panel?.querySelector(
      "[data-artisan-foraging-component-weight]"
    );
    const minQuantityInput = panel?.querySelector(
      "[data-artisan-foraging-component-min-quantity]"
    );
    const maxQuantityInput = panel?.querySelector(
      "[data-artisan-foraging-component-max-quantity]"
    );
    const quantity = Math.max(1, Number(quantityInput?.value || 1));
    const weight = weightInput?.value ? Math.max(0.1, Number(weightInput.value)) : void 0;
    const minQuantity = Math.max(
      1,
      Number(minQuantityInput?.value || quantity)
    );
    const maxQuantity = Math.max(
      minQuantity,
      Number(maxQuantityInput?.value || minQuantity)
    );
    const service = new ForagingService();
    await service.addComponent(profileId, collection, uuid, quantity, {
      weight,
      minQuantity,
      maxQuantity
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
    this.render(true);
  }
  async onRemoveForagingComponentClicked(target) {
    const profileId = target.dataset.profileId;
    const collection = target.dataset.collection;
    const index = Number(target.dataset.index);
    if (!profileId || !collection || Number.isNaN(index)) {
      ui.notifications.warn("Elemento Foraging non valido.");
      return;
    }
    const service = new ForagingService();
    await service.removeComponent(profileId, collection, index);
    this.render(true);
  }
  async onStartForagingClicked(target) {
    const profileId = target.dataset.profileId ?? this.selectedForagingProfileId;
    if (!profileId) {
      ui.notifications.warn("Nessuna lista Foraging selezionata.");
      return;
    }
    const service = new ForagingService();
    const profile = service.getProfile(profileId);
    const actor = canvas?.tokens?.controlled?.[0]?.actor ?? null;
    await service.startForaging(profileId);
    void this.addActivityLogEntry(
      "foraging",
      "Foraging eseguito",
      `Eseguita raccolta${profile ? `: ${profile.name}` : ""}.`,
      actor?.name ?? ""
    );
  }
  onExportForagingClicked() {
    const service = new ForagingService();
    service.exportProfiles();
    void this.addActivityLogEntry(
      "export",
      "Liste Foraging esportate",
      `Esportate ${service.getProfiles().length} liste Foraging.`
    );
  }
  onImportForagingClicked() {
    const element = this.getRootElement();
    const input = element?.querySelector(
      "[data-artisan-import-foraging-file]"
    );
    if (!input) {
      ui.notifications.warn("Campo import Foraging non trovato.");
      return;
    }
    input.value = "";
    input.click();
  }
  async onImportForagingFileChanged(target) {
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
        ui.notifications.warn("Il file non contiene liste Foraging importabili.");
        return;
      }
      ui.notifications.info(
        `Import Foraging completato: ${result.imported} liste importate, ${result.skipped} saltate.`
      );
      void this.addActivityLogEntry(
        "import",
        "Liste Foraging importate",
        `${result.imported} liste importate, ${result.skipped} saltate.`
      );
      const profiles = service.getProfiles();
      this.selectedForagingProfileId = profiles[profiles.length - 1]?.id ?? this.selectedForagingProfileId;
      this.selectedSectionId = "foraging";
      this.render(true);
    } catch (error) {
      console.error("Artisan | Import Foraging fallito", error);
      ui.notifications.error("Import Foraging fallito. Controlla che il JSON sia valido.");
    } finally {
      target.value = "";
    }
  }
  async onNewHarvestProfileClicked() {
    const service = new HarvestService();
    const profile = await service.createProfile();
    this.selectedHarvestProfileId = profile.id;
    this.selectedSectionId = "harvest";
    this.render(true);
  }
  async onDeleteHarvestProfileClicked(target) {
    const profileId = target.dataset.profileId ?? this.selectedHarvestProfileId;
    if (!profileId) {
      ui.notifications.warn("Nessuna lista Harvest selezionata.");
      return;
    }
    const service = new HarvestService();
    const profile = service.getProfile(profileId);
    if (!profile) {
      ui.notifications.warn("Lista Harvest non trovata.");
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
    this.render(true);
  }
  async confirmDeleteHarvestProfile(profileName) {
    return new Promise((resolve) => {
      new Dialog({
        title: "Cancella lista Harvest",
        content: `
                    <p>Vuoi cancellare definitivamente questa lista Harvest?</p>
                    <p><strong>${profileName}</strong></p>
                    <p><em>L'operazione non pu\xF2 essere annullata.</em></p>
                `,
        buttons: {
          cancel: {
            label: game.i18n.localize("ARTISAN.Cancel"),
            callback: () => resolve(false)
          },
          delete: {
            label: game.i18n.localize("ARTISAN.Delete"),
            callback: () => resolve(true)
          }
        },
        default: "cancel",
        close: () => resolve(false)
      }).render(true);
    });
  }
  onSelectHarvestProfileClicked(target) {
    const profileId = target.dataset.profileId;
    if (!profileId) {
      return;
    }
    this.selectedHarvestProfileId = profileId;
    this.selectedSectionId = "harvest";
    this.render(true);
  }
  async onHarvestFieldChanged(target) {
    const profileId = target.dataset.profileId ?? this.selectedHarvestProfileId;
    const field = target.dataset.artisanHarvestField;
    if (!profileId || !field) {
      return;
    }
    const service = new HarvestService();
    const value = this.parseFieldValue(target);
    if (field === "profession") {
      const defaultSkill = new ProfessionService().getDefaultSkill(
        String(value)
      );
      await service.updateProfile(profileId, {
        profession: String(value),
        ...defaultSkill ? { skill: defaultSkill } : {}
      });
      this.render(true);
      return;
    }
    await service.updateProfile(profileId, {
      [field]: value
    });
    this.render(true);
  }
  async onHarvestComponentFieldChanged(target) {
    const profileId = target.dataset.profileId ?? this.selectedHarvestProfileId;
    const collection = target.dataset.collection;
    const index = Number(target.dataset.index);
    const field = target.dataset.artisanHarvestComponentField;
    if (!profileId || !collection || Number.isNaN(index) || !field) {
      ui.notifications.warn("Elemento Harvest non valido.");
      return;
    }
    const service = new HarvestService();
    await service.updateComponent(profileId, collection, index, {
      [field]: this.parseFieldValue(target)
    });
    this.render(true);
  }
  async onAddHarvestComponentClicked(target) {
    const profileId = target.dataset.profileId ?? this.selectedHarvestProfileId;
    const collection = target.dataset.collection;
    if (!profileId || !collection) {
      ui.notifications.warn("Lista Harvest o sezione non valida.");
      return;
    }
    const panel = target.closest(".artisan-harvest-panel");
    if (!panel) {
      ui.notifications.warn("Pannello Harvest non trovato.");
      return;
    }
    const uuidInput = panel.querySelector(
      "[data-artisan-harvest-component-uuid]"
    );
    const quantityInput = panel.querySelector(
      "[data-artisan-harvest-component-quantity]"
    );
    const weightInput = panel.querySelector(
      "[data-artisan-harvest-component-weight]"
    );
    const minQuantityInput = panel.querySelector(
      "[data-artisan-harvest-component-min-quantity]"
    );
    const maxQuantityInput = panel.querySelector(
      "[data-artisan-harvest-component-max-quantity]"
    );
    const rarityInput = panel.querySelector(
      "[data-artisan-harvest-component-rarity]"
    );
    const requiredToolInput = panel.querySelector(
      "[data-artisan-harvest-component-required-tool-uuid]"
    );
    const uuid = uuidInput?.value.trim() ?? "";
    const quantity = Math.max(1, Number(quantityInput?.value || 1));
    const weight = weightInput?.value ? Math.max(0.1, Number(weightInput.value)) : void 0;
    const minQuantity = Math.max(
      1,
      Number(minQuantityInput?.value || quantity)
    );
    const maxQuantity = Math.max(
      minQuantity,
      Number(maxQuantityInput?.value || minQuantity)
    );
    const rarity = rarityInput?.value || "common";
    const requiredToolUuid = requiredToolInput?.value.trim() || void 0;
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
      requiredToolUuid
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
    this.render(true);
  }
  async onHarvestComponentDropped(event, dropZone) {
    const profileId = dropZone.dataset.profileId ?? this.selectedHarvestProfileId;
    const collection = dropZone.dataset.collection;
    if (!profileId || !collection) {
      ui.notifications.warn("Lista Harvest o sezione non valida.");
      return;
    }
    const uuid = this.getUuidFromDragEvent(event);
    if (!uuid) {
      ui.notifications.warn(
        "Non riesco a leggere l'UUID dell'elemento trascinato."
      );
      return;
    }
    const panel = dropZone.closest(".artisan-harvest-panel");
    const quantityInput = panel?.querySelector(
      "[data-artisan-harvest-component-quantity]"
    );
    const weightInput = panel?.querySelector(
      "[data-artisan-harvest-component-weight]"
    );
    const minQuantityInput = panel?.querySelector(
      "[data-artisan-harvest-component-min-quantity]"
    );
    const maxQuantityInput = panel?.querySelector(
      "[data-artisan-harvest-component-max-quantity]"
    );
    const rarityInput = panel?.querySelector(
      "[data-artisan-harvest-component-rarity]"
    );
    const requiredToolInput = panel?.querySelector(
      "[data-artisan-harvest-component-required-tool-uuid]"
    );
    const quantity = Math.max(1, Number(quantityInput?.value || 1));
    const weight = weightInput?.value ? Math.max(0.1, Number(weightInput.value)) : void 0;
    const minQuantity = Math.max(
      1,
      Number(minQuantityInput?.value || quantity)
    );
    const maxQuantity = Math.max(
      minQuantity,
      Number(maxQuantityInput?.value || minQuantity)
    );
    const rarity = rarityInput?.value || "common";
    const requiredToolUuid = requiredToolInput?.value.trim() || void 0;
    const service = new HarvestService();
    await service.addComponent(profileId, collection, uuid, quantity, {
      weight,
      minQuantity,
      maxQuantity,
      rarity,
      requiredToolUuid
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
    this.render(true);
  }
  async onRemoveHarvestComponentClicked(target) {
    const profileId = target.dataset.profileId;
    const collection = target.dataset.collection;
    const index = Number(target.dataset.index);
    if (!profileId || !collection || Number.isNaN(index)) {
      ui.notifications.warn("Elemento Harvest non valido.");
      return;
    }
    const service = new HarvestService();
    await service.removeComponent(profileId, collection, index);
    this.render(true);
  }
  async onStartHarvestClicked(target) {
    const profileId = target.dataset.profileId ?? this.selectedHarvestProfileId;
    if (!profileId) {
      ui.notifications.warn("Nessuna lista Harvest selezionata.");
      return;
    }
    const service = new HarvestService();
    const profile = service.getProfile(profileId);
    const actor = canvas?.tokens?.controlled?.[0]?.actor ?? null;
    await service.startHarvest(profileId);
    void this.addActivityLogEntry(
      "harvest",
      "Harvest eseguito",
      `Eseguito Harvest${profile ? `: ${profile.name}` : ""}.`,
      actor?.name ?? ""
    );
  }
  onExportHarvestClicked() {
    const service = new HarvestService();
    service.exportProfiles();
    void this.addActivityLogEntry(
      "export",
      "Liste Harvest esportate",
      `Esportate ${service.getProfiles().length} liste Harvest.`
    );
  }
  onImportHarvestClicked() {
    const element = this.getRootElement();
    const input = element?.querySelector(
      "[data-artisan-import-harvest-file]"
    );
    if (!input) {
      ui.notifications.warn("Campo import Harvest non trovato.");
      return;
    }
    input.value = "";
    input.click();
  }
  async onImportHarvestFileChanged(target) {
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
        ui.notifications.warn("Il file non contiene liste Harvest importabili.");
        return;
      }
      ui.notifications.info(
        `Import Harvest completato: ${result.imported} liste importate, ${result.skipped} saltate.`
      );
      void this.addActivityLogEntry(
        "import",
        "Liste Harvest importate",
        `${result.imported} liste importate, ${result.skipped} saltate.`
      );
      const profiles = service.getProfiles();
      this.selectedHarvestProfileId = profiles[profiles.length - 1]?.id ?? this.selectedHarvestProfileId;
      this.selectedSectionId = "harvest";
      this.render(true);
    } catch (error) {
      console.error("Artisan | Import Harvest fallito", error);
      ui.notifications.error("Import Harvest fallito. Controlla che il JSON sia valido.");
    } finally {
      target.value = "";
    }
  }
};

// src/core/artisan.ts
var ArtisanSettingsMenuBase = globalThis.FormApplication ?? foundry.applications.api.ApplicationV2;
var ArtisanSettingsMenuBridge = class extends ArtisanSettingsMenuBase {
  static sectionId = "settings";
  render(_force, _options) {
    const sectionId = this.constructor.sectionId ?? "settings";
    Artisan.openSection(sectionId);
    return this;
  }
};
var ArtisanPackagesSettingsMenu = class extends ArtisanSettingsMenuBridge {
  static sectionId = "presets";
};
var ArtisanHelpSettingsMenu = class extends ArtisanSettingsMenuBridge {
  static sectionId = "help";
  render(_force, _options) {
    Artisan.openHelpDialog();
    return this;
  }
};
var ArtisanModuleSettingsMenu = class extends ArtisanSettingsMenuBridge {
  static sectionId = "settings";
};
var Artisan = class _Artisan {
  static manager = null;
  static originalLocalize = null;
  static languageDictionaries = {};
  static initialize() {
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
  static open() {
    if (!this.manager) {
      this.manager = new ArtisanManager();
    }
    this.manager.openMainSection();
  }
  static openSection(sectionId) {
    if (!this.manager) {
      this.manager = new ArtisanManager();
    }
    this.manager.openSection(sectionId);
  }
  static openHelpDialog() {
    const title = _Artisan.localize("ARTISAN.HelpDialogTitle");
    const content = _Artisan.buildHelpDialogContent();
    const DialogClass = globalThis.Dialog;
    if (DialogClass) {
      new DialogClass({
        title,
        content,
        buttons: {
          close: {
            icon: '<i class="fa-solid fa-check"></i>',
            label: _Artisan.localize("ARTISAN.Close")
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
  static localize(key) {
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
  static buildHelpDialogContent() {
    const l = (key) => _Artisan.localize(key);
    const list = (keys) => {
      return keys.map((key) => `<li>${l(key)}</li>`).join("");
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
  static exposeApi() {
    game.artisan = {
      open: () => _Artisan.open(),
      openSection: (sectionId) => _Artisan.openSection(sectionId),
      openHelp: () => _Artisan.openHelpDialog(),
      localize: (key) => _Artisan.localize(key)
    };
  }
  static registerLanguageSetting() {
    const settings = game.settings.settings;
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
        ui.notifications.info(_Artisan.localize("ARTISAN.LanguageReloadHint"));
      }
    });
  }
  static registerUtilityMenus() {
    const menus = game.settings.menus;
    if (!menus?.has?.("artisan.packagesMenu")) {
      game.settings.registerMenu("artisan", "packagesMenu", {
        name: "ARTISAN.SettingsMenuPackagesName",
        label: "ARTISAN.Open",
        hint: "ARTISAN.SettingsMenuPackagesHint",
        icon: "fas fa-box-open",
        type: ArtisanPackagesSettingsMenu,
        restricted: true
      });
    }
    if (!menus?.has?.("artisan.helpMenu")) {
      game.settings.registerMenu("artisan", "helpMenu", {
        name: "ARTISAN.SettingsMenuHelpName",
        label: "ARTISAN.Open",
        hint: "ARTISAN.SettingsMenuHelpHint",
        icon: "fas fa-circle-question",
        type: ArtisanHelpSettingsMenu,
        restricted: false
      });
    }
    if (!menus?.has?.("artisan.moduleSettingsMenu")) {
      game.settings.registerMenu("artisan", "moduleSettingsMenu", {
        name: "ARTISAN.SettingsMenuModuleSettingsName",
        label: "ARTISAN.Open",
        hint: "ARTISAN.SettingsMenuModuleSettingsHint",
        icon: "fas fa-gear",
        type: ArtisanModuleSettingsMenu,
        restricted: true
      });
    }
  }
  static patchLocalization() {
    if (this.originalLocalize) {
      return;
    }
    this.originalLocalize = game.i18n.localize.bind(game.i18n);
    game.i18n.localize = (key) => {
      return _Artisan.localize(key);
    };
  }
  static async loadLanguageDictionaries() {
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
  static getSelectedLanguage() {
    try {
      const value = game.settings.get("artisan", "interfaceLanguage");
      if (["system", "it", "en"].includes(value)) {
        return value;
      }
    } catch (_error) {
      return "system";
    }
    return "system";
  }
  static createLauncherButton() {
    this.removeOldLaunchers();
    const launcher = document.createElement("div");
    launcher.id = "artisan-launcher";
    launcher.classList.add("artisan-launcher");
    const artisanButton = document.createElement("button");
    artisanButton.type = "button";
    artisanButton.classList.add("artisan-launcher__button");
    artisanButton.innerHTML = `<i class="fa-solid fa-hammer"></i><span>Artisan</span>`;
    artisanButton.title = _Artisan.localize("ARTISAN.OpenArtisan");
    artisanButton.addEventListener("click", (event) => {
      event.preventDefault();
      _Artisan.open();
    });
    launcher.appendChild(artisanButton);
    document.body.appendChild(launcher);
  }
  static removeOldLaunchers() {
    const oldLaunchers = document.querySelectorAll(
      "#artisan-launcher, .artisan-launcher, #artisan-foraging-launcher, .artisan-foraging-launcher"
    );
    oldLaunchers.forEach((launcher) => {
      launcher.remove();
    });
  }
};

// src/module.ts
Hooks.once("init", () => {
  Artisan.initialize();
});
//# sourceMappingURL=module.js.map
