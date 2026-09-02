# Changelog

Tutte le modifiche rilevanti di Artisan sono documentate in questo file.  
All notable changes to Artisan are documented in this file.

## [1.3.3] - 2026-09-02

### Italiano

- Aggiunto il selettore “Personaggio attivo” nella finestra principale di Artisan.
- Il personaggio scelto viene usato da Ricette, Raccolta, Caccia, Dissassemblare e gestione Professioni anche senza un token sulla scena.
- L'opzione automatica continua a utilizzare il token selezionato e mantiene il comportamento delle versioni precedenti.
- L'elenco privilegia i personaggi giocanti e gli Actor con proprietari giocatori, con compatibilità di ripiego per sistemi diversi da D&D 5e.

### English

- Added an “Active character” selector to the main Artisan window.
- The chosen character is used by Recipes, Gathering, Hunting, Disassembly and Profession management even without a token on the scene.
- Automatic mode continues to use the selected token and preserves the behavior of previous versions.
- The list prioritizes player characters and Actors with player owners, with a compatibility fallback for systems other than D&D 5e.

## [1.3.2] - 2026-09-02

### Italiano

- Corretto il posizionamento della finestra Artisan: l'apertura non sposta più la colonna laterale di Foundry al centro dello schermo.
- Ripristinato il modello semplice delle ricette: per creare, il PG selezionato deve possedere una copia dell'Item ricetta nel proprio inventario.
- Rimosse dall'interfaccia le modalità ricetta pubblica/appresa e le azioni Impara, Concedi e Revoca.
- Il filtro “Creabile adesso” verifica nuovamente la presenza effettiva della copia nell'inventario.

### English

- Fixed Artisan window positioning so opening it no longer moves Foundry's sidebar toward the center of the screen.
- Restored the simple recipe model: the selected character must own a copy of the recipe Item in their inventory to craft.
- Removed public/learned recipe modes and Learn, Grant and Revoke actions from the interface.
- The “Craftable now” filter once again checks for the actual inventory copy.

## [1.3.1] - 2026-09-02

### Italiano

- Aggiunto il controllo globale GM per verificare Ricette, Raccolta, Caccia e Dissassemblare in un unico riepilogo, senza pubblicare messaggi in chat.
- Il controllo segnala output e sorgenti mancanti, strumenti obbligatori non configurati, riferimenti UUID non validi, probabilità qualità oltre il 100% e nomi duplicati.
- Aggiunto il filtro “Creabile adesso”, calcolato sul PG selezionato in base alla ricetta posseduta, professione, ingredienti, strumenti e monete disponibili.
- Il numero massimo di produzioni considera correttamente gli ingredienti alternativi dello stesso gruppo.
- Importazione ed esportazione ricette preservano correttamente i gruppi di ingredienti alternativi.
- Nessuna migrazione richiesta: le ricette continuano a richiedere una copia nell'inventario.

### English

- Added a GM global audit for Recipes, Gathering, Hunting and Disassembly in one report without posting chat messages.
- The audit reports missing outputs and sources, unconfigured required tools, invalid UUID references, quality chances above 100%, and duplicate names.
- Added a “Craftable now” filter calculated for the selected character from recipe ownership, profession, ingredients, tools and available currency.
- Maximum crafting lots now correctly account for alternative ingredients in the same group.
- Recipe import and export correctly preserve alternative ingredient groups.
- No migration is required: recipes continue to require an inventory copy.

## [1.3.0] - 2026-08-29

### Italiano

- Nuova interfaccia completa in stile pergamena e bronzo, con sidebar, toolbar, schede e scrollbar più leggibili.
- Ricette organizzabili in vere cartelle e sottocartelle, con ricerca e filtri preservati.
- Editor Ricette riorganizzato come workflow numerato: dati, prova e costi, ingredienti, strumenti, output e qualità.
- Aggiunti selettori visuali per Item e PNG del mondo o dei compendi; gli UUID tecnici restano nascosti durante l'uso normale.
- Il pulsante Verifica controlla la ricetta e pubblica un riepilogo in chat senza consumare ingredienti né creare oggetti.
- Rimossa dalla sezione Ricette la scheda permanente "Stato configurazione".
- Messaggi chat di Ricette, Raccolta, Caccia e Disassemblaggio resi più compatti; esperienza mostrata in una sola riga.
- Raccolta: aggiunto "Ore per questo tiro" per coprire più ore con una singola prova; quantità e XP aumentano in proporzione.
- Caccia: mantenuto il calcolo XP per singola unità effettivamente raccolta, inclusi moltiplicatori e successo critico.
- Disassemblaggio: la risorsa sorgente viene sempre consumata dopo un tentativo effettuato, anche in caso di fallimento.
- Corretto il pulsante Riduci/Ripristina usando le azioni native di `ApplicationV2`; la finestra può collassare alla sola barra del titolo.
- Formato dati e ricette esistenti invariati; nessuna migrazione richiesta.
- Compatibilità verificata con Foundry VTT 14.367; funzioni avanzate ottimizzate per D&D 5e 5.3.3.

### English

- Complete parchment-and-bronze interface refresh with clearer sidebar, toolbar, cards and scrollbars.
- Recipes can be organized in real folders and subfolders while preserving search and filters.
- Recipe editor reorganized as a numbered workflow: details, checks and costs, ingredients, tools, output and quality.
- Added visual selectors for world/compendium Items and NPCs; technical UUIDs stay hidden during normal use.
- The Verify button checks a recipe and posts a chat summary without consuming ingredients or creating Items.
- Removed the permanent "Configuration status" panel from the Recipes section.
- More compact chat messages for Crafting, Gathering, Hunting and Disassembly; profession XP is displayed on one line.
- Gathering: added "Hours for this check" to cover multiple hours with one roll; quantities and XP scale proportionally.
- Hunting keeps XP per actual gathered unit, including profession multipliers and critical success.
- Disassembly always consumes the source resource after an attempted roll, including failure.
- Fixed Minimize/Restore through native `ApplicationV2` actions; the window can collapse to its title bar.
- Existing data and recipe formats are unchanged; no migration is required.
- Verified with Foundry VTT 14.367; advanced features are optimized for D&D 5e 5.3.3.

## [1.2.4]

- Ricette: ingredienti alternativi tramite gruppi (stesso gruppo = OR; gruppi diversi = AND).
- Ricette: selezione automatica dell'alternativa disponibile e consumo solo dell'ingrediente utilizzato.
- Caccia: XP configurabile per ogni unità di risorsa raccolta.
- Caccia: XP calcolata sulla quantità finale effettivamente raccolta, inclusi moltiplicatori di professione e successo critico.

## [1.2.3] - 2026-07-21

### Italiano

- Corretto il backup completo: ora esporta e importa anche le liste Dissassemblare.
- Corretto un errore che interrompeva l'esportazione del backup completo.
- Aggiunto un controllo TypeScript reale per il codice usato dal modulo.
- Rimossi prototipi non collegati e copie duplicate di template e fogli di stile.
- Il bonus competenza strumenti non si somma più quando sono configurati più strumenti.
- Build resa ripetibile in `dist/artisan`, senza scrivere automaticamente nella cartella dati di Foundry.
- Aggiunti validazione automatica, ZIP installabile, ZIP sorgente e checksum SHA-256.
- Allineati manifest, documentazione e traduzioni.

### English

- Fixed full backup export/import to include Disassembly lists.
- Fixed an error that interrupted full backup export.
- Added effective TypeScript validation for the code used by the module.
- Removed disconnected prototypes and duplicate template/style sources.
- Tool proficiency no longer stacks when several tools are configured.
- Builds are now reproducible in `dist/artisan` and no longer write automatically to Foundry's data folder.
- Added automatic validation, installable/source archives and SHA-256 checksums.
- Aligned the manifest, documentation and translations.

## [1.2.2] - 2026-07-21

### Italiano

- Aggiornato il manifest per Foundry VTT v14.365.
- Il tempo di Creazione, Raccolta, Caccia e Dissassemblare è ora espresso in ore invece che in minuti.
- I campi tempo supportano valori decimali, per esempio 0.5 per mezz'ora e 1.5 per un'ora e mezza.
- Aggiunta alla ricetta la modalità **Qualità risultato**.
- Ogni ricetta può produrre: sempre qualità Normale, qualità basata sul margine del tiro, oppure qualità tramite probabilità personalizzate.
- Aggiunte percentuali per Buona, Superiore ed Eccellente.
- Le ricette esistenti mantengono il comportamento precedente basato sul margine del tiro.
- Esportazione/importazione ricette aggiornata con i nuovi campi qualità.

### English

- Updated the manifest for Foundry VTT v14.365.
- Crafting, Gathering, Hunting and Disassembly time is now expressed in hours instead of minutes.
- Time fields support decimal values, for example 0.5 for half an hour and 1.5 for one and a half hours.
- Added a per-recipe **Result quality** mode.
- Each recipe can now produce: always Normal quality, roll-margin-based quality, or custom chance-based quality.
- Added percentage fields for Good, Superior and Excellent quality.
- Existing recipes keep the previous roll-margin behavior.
- Recipe import/export updated with the new quality fields.

## [1.1.29] - 2026-07-15

- La finestra principale conserva la posizione di scroll dopo clic, salvataggi, filtri e aggiornamenti.
- I menu laterali e le sottofinestre non tornano più automaticamente all'inizio dopo ogni render.

## [1.1.28] - 2026-07-15

- Ripristinata la stabilità di Raccolta, Caccia e Dissassemblare dopo la regressione introdotta dalla barra globale di ricerca.
- Mantenuto il costo monetario delle ricette senza riapplicare il filtro globale problematico.

## [1.1.25] - 2026-07-15

- Rimosso il rischio rovina dalla Caccia.
- La rarità delle ricompense di Caccia gestisce solo probabilità/peso di ritrovamento.

## [1.1.24] - 2026-07-15

- Lista professioni ufficiale aggiornata a: Erborista, Alchimista, Fabbro, Cacciatore, Conciatore, Cuoco, Minatore, Boscaiolo, Artigiano e Sarto.
- I vecchi dati Pescatore vengono reindirizzati a Cacciatore per non perdere progressi già salvati.

## [1.1.22] - 2026-07-15

- Aggiunta rarità/probabilità individuale per ogni risorsa in Raccolta, Caccia e Dissassemblare.
- La Creazione richiede che il PG selezionato possieda una copia della ricetta nell'inventario.

## [1.1.18] - 2026-07-11

- Nuova categoria Dissassemblare.
- XP configurabile per ogni ricetta.
- Migliorie qualità con bonus fisso, dado extra e tipo effetto.
- Strumenti obbligatori o facoltativi per singola ricetta o lista.
- Rottura strumento su 1 naturale configurabile per singola ricetta o lista.
- Sidebar con categorie espandibili.
- Risolto il conflitto delle chiavi di localizzazione `ARTISAN.Profession`.

## [1.1.0] - 2026-07-09

- Aggiunta localizzazione inglese.
- Aggiunte finestre Pacchetti, Guida e Impostazioni.
- Migliorata la leggibilità generale dell'interfaccia.
- Aggiunto il bonus competenza strumenti alle prove di creazione.

## [1.0.0]

- Prima release ufficiale.
- Creazione, Raccolta, Caccia, professioni, XP, backup, registro attività e pacchetti predefiniti.
