# Artisan — Crafting, Gathering & Professions for Foundry VTT

**Versione / Version:** 1.2.2  
**Foundry VTT:** v14, verificato su / verified on build 14.365  
**Lingue / Languages:** Italiano, English

---

## Italiano

**Artisan** è un modulo per Foundry Virtual Tabletop pensato per gestire creazione, raccolta, caccia, dissassemblaggio, professioni e ricompense materiali in modo ordinato e personalizzabile.

Il modulo permette al GM di creare ricette, liste di raccolta, liste di caccia e schede di dissassemblaggio usando oggetti del mondo o oggetti provenienti dai compendi. Le risorse possono avere quantità casuali, rarità individuale, strumenti richiesti, requisiti di professione e risultati diversi in base alla configurazione scelta.

### Funzioni principali

- **Creazione / Crafting**
  - Ricette salvate come Item Artisan.
  - Ingredienti trascinabili da mondo o compendio tramite UUID.
  - Requisito opzionale: il PG deve possedere una copia della ricetta nell'inventario.
  - XP personalizzabile per singola ricetta.
  - Costo monetario per ricetta, con scelta se consumare il costo anche in caso di fallimento.
  - Strumenti obbligatori o facoltativi.
  - Bonus competenza strumenti applicato solo se il PG è competente nello strumento.
  - Rottura strumenti configurabile per singola ricetta su fallimento critico.
  - Tempo espresso in ore, anche con valori decimali.

- **Qualità degli oggetti creati**
  - Qualità migliorata in base al risultato della prova.
  - Bonus fisso, dado extra e tipo di effetto configurabili.
  - Supporto a effetti come cura, fuoco, acido, veleno, freddo, fulmine, tuono, necrotico, radioso, psichico, forza, contundente, perforante e tagliente.

- **Raccolta**
  - Liste di risorse configurabili.
  - Quantità minime e massime per ogni risorsa.
  - Rarità/probabilità individuale per ogni risorsa.
  - Strumenti opzionali o obbligatori.
  - Progressione tramite professioni.

- **Caccia**
  - Risultati multipli dalla stessa sorgente, per esempio carne, pelle, ossa o trofei.
  - Modalità casuale o ottenimento di tutte le parti disponibili.
  - Rarità/probabilità per ogni ricompensa.
  - Nessun rischio rovina separato: la rarità gestisce già la probabilità di ottenere la risorsa.

- **Dissassemblare**
  - Consumo di una risorsa sorgente per ottenere materiali casuali.
  - Utile per carcasse, oggetti rotti, equipaggiamento recuperato, minerali grezzi o componenti.
  - Materiali configurabili da mondo o compendio.

- **Professioni**
  - Professioni ufficiali: Erborista, Alchimista, Fabbro, Cacciatore, Conciatore, Cuoco, Minatore, Boscaiolo, Artigiano e Sarto.
  - XP e livelli salvati sul personaggio.
  - Requisiti professione/livello per ricette e attività.

- **Interfaccia**
  - Barra laterale con categorie espandibili.
  - Liste ordinate senza duplicazioni nelle sezioni centrali.
  - Scroll e posizione della finestra preservati dopo clic, salvataggi e aggiornamenti.
  - Registro attività, import/export e backup dei dati.

### Compatibilità sistemi di gioco

Artisan non è vincolato tecnicamente a un singolo sistema nel `module.json`, ma alcune funzioni avanzate sono ottimizzate per D&D 5e o sistemi con struttura dati simile. In particolare: competenza strumenti, monete, quantità inventario e modifiche automatiche a formule di danno/cura possono richiedere adattamenti su sistemi diversi.

---

## English

**Artisan** is a Foundry Virtual Tabletop module designed to manage crafting, gathering, hunting, disassembly, professions and material rewards in a structured and customizable way.

The module lets the GM create recipes, gathering lists, hunting lists and disassembly entries using world Items or Items from compendia. Resources can have random quantities, individual rarity, required tools, profession requirements and different outputs depending on the chosen configuration.

### Main features

- **Crafting**
  - Recipes saved as Artisan Items.
  - Ingredients can be dragged from world Items or compendia through UUIDs.
  - Optional requirement: the character must own a copy of the recipe in their inventory.
  - Custom XP per recipe.
  - Monetary cost per recipe, with an option to consume the cost even on failure.
  - Required or optional tools.
  - Tool proficiency bonus is applied only if the character is proficient with that tool.
  - Tool breakage on critical failure can be configured per recipe.
  - Time expressed in hours, including decimal values.

- **Crafted item quality**
  - Improved item quality based on the check result.
  - Configurable flat bonus, extra die and effect type.
  - Supports healing, acid, fire, poison, cold, lightning, thunder, necrotic, radiant, psychic, force, bludgeoning, piercing and slashing effects.

- **Gathering**
  - Configurable resource lists.
  - Minimum and maximum quantity per resource.
  - Individual rarity/probability for each resource.
  - Optional or required tools.
  - Profession-based progression.

- **Hunting**
  - Multiple results from the same source, such as meat, hide, bones or trophies.
  - Random mode or “all available parts” mode.
  - Rarity/probability for each reward.
  - No separate spoilage mechanic: rarity already controls how likely a reward is to appear.

- **Disassembly**
  - Consume a source resource to obtain random materials.
  - Useful for carcasses, broken items, recovered equipment, raw ore or components.
  - Outputs can come from world Items or compendia.

- **Professions**
  - Official profession list: Herbalist, Alchemist, Blacksmith, Hunter, Tanner, Cook, Miner, Woodcutter, Artisan and Tailor.
  - XP and levels are stored on the character.
  - Profession and level requirements for recipes and activities.

- **Interface**
  - Expandable category sidebar.
  - Organized lists without duplicate entries in the main sections.
  - Scroll position is preserved after clicks, saves and updates.
  - Activity log, import/export and data backup.

### Game system compatibility

Artisan is not technically locked to one game system in `module.json`, but some advanced features are optimized for D&D 5e or systems with a similar data structure. Tool proficiency, currency, inventory quantity and automatic damage/healing formula changes may require adaptation on other systems.

---

## Installazione tramite manifest / Manifest installation

Use this URL in Foundry VTT's **Manifest URL** field:

```text
https://github.com/Crazy22N/Artisan-Universal-Crafting-Suite-for-Foudry-VTT/releases/latest/download/module.json
```

## Installazione manuale / Manual installation

1. Download `artisan-v1.2.2.zip` from the GitHub release.
2. Extract the `artisan` folder into Foundry VTT's `Data/modules/` folder.
3. Restart Foundry VTT and enable Artisan in your world.

## Sviluppo locale / Local development

```powershell
npm install
npm run build
```

The build destination is configured in `build.config.mjs` according to the operating system.

## Licenza / License

Released under the MIT License. See `LICENSE`.
