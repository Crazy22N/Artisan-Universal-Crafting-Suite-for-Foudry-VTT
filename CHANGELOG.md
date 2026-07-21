# Changelog

Tutte le modifiche rilevanti di Artisan sono documentate in questo file.  
All notable changes to Artisan are documented in this file.

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
