# Changelog

Tutte le modifiche rilevanti di Artisan sono documentate in questo file.

## [1.1.18] - 2026-07-11

### Aggiunto

- Nuova categoria **Dissassemblare**, con consumo di una risorsa sorgente e ottenimento casuale di materiali da Item del mondo o compendi.
- XP configurabile per ogni ricetta di creazione.
- Migliorie qualità con bonus fisso, dado extra e tipo di effetto: cura, acido, fuoco, veleno, freddo, fulmine, tuono, necrotico, radioso, psichico, forza, contundente, perforante e tagliente.
- Possibilità di rendere gli strumenti obbligatori o facoltativi per singola ricetta o lista.
- Possibilità di attivare la rottura dello strumento su 1 naturale per singola ricetta o lista.
- Modalità Caccia con estrazione casuale oppure ottenimento di tutte le parti disponibili dalla stessa sorgente.
- Barra laterale con categorie espandibili per Creazione, Raccolta, Caccia, Dissassemblare e Gestione.

### Modificato

- Le diciture visibili **Foraging** e **Harvest** sono state rinominate rispettivamente **Raccolta** e **Caccia**.
- Il bonus competenza dello strumento viene aggiunto solo quando il personaggio è competente nello strumento.
- Le finestre sono state rese più pulite, leggibili e compatte.
- La sezione delle migliorie qualità è stata riorganizzata in una tabella compatta.
- Le liste di Raccolta, Caccia e Dissassemblare sono mostrate solo nella barra laterale, senza duplicazioni nella sezione centrale.
- I menu laterali ora si espandono e si riducono correttamente senza cambiare sezione.

### Corretto

- Risolto il conflitto delle chiavi di localizzazione `ARTISAN.Profession` nei file italiano e inglese.
- Corretta la modalità Caccia “Tutte le parti disponibili”, che ora non esclude le parti con peso pari a zero.
- Corretto il controllo degli strumenti per evitare che una competenza assente blocchi impropriamente la creazione.

## [1.1.0] - 2026-07-09

- Aggiunta localizzazione inglese.
- Aggiunte finestre Pacchetti, Guida e Impostazioni.
- Migliorata la leggibilità generale dell’interfaccia.
- Aggiunto il bonus competenza strumenti alle prove di creazione.

## [1.0.0]

- Prima release ufficiale.
- Creazione, Raccolta, Caccia, professioni, XP, backup, registro attività e pacchetti predefiniti.
