# Changelog

Tutte le modifiche rilevanti di Artisan sono documentate in questo file.  
All notable changes to Artisan are documented in this file.

## [1.2.0] - 2026-07-15

### Italiano

- Promossa la versione stabile dalla serie 1.1.x a **1.2.0**.
- Mantenute le funzioni stabili di Creazione, Raccolta, Caccia e Dissassemblare.
- Aggiunto costo monetario nelle ricette con scelta per singola ricetta se consumarlo anche in caso di fallimento.
- Confermato il requisito opzionale della copia della ricetta nell'inventario del PG per poter creare.
- Confermata la lista ufficiale professioni: Erborista, Alchimista, Fabbro, Cacciatore, Conciatore, Cuoco, Minatore, Boscaiolo, Artigiano e Sarto.
- Rimossa la meccanica separata di rischio rovina dalla Caccia: la rarità delle ricompense gestisce la probabilità di ottenimento.
- Conservata la posizione di scroll della finestra dopo clic, salvataggi e aggiornamenti.
- Migliorata e riscritta la documentazione bilingue italiana/inglese.
- Ripulita la cronologia delle note locali e dei riferimenti di test.

### English

- Promoted the stable build from the 1.1.x series to **1.2.0**.
- Preserved stable Crafting, Gathering, Hunting and Disassembly features.
- Added recipe monetary cost with a per-recipe option to consume the cost on failure.
- Confirmed the optional requirement that the character must own a copy of the recipe to craft it.
- Confirmed the official profession list: Herbalist, Alchemist, Blacksmith, Hunter, Tanner, Cook, Miner, Woodcutter, Artisan and Tailor.
- Removed the separate Hunting spoilage mechanic: reward rarity now controls obtainment probability.
- Preserved window scroll position after clicks, saves and updates.
- Improved and rewrote bilingual Italian/English documentation.
- Cleaned local-test notes and outdated references.

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
