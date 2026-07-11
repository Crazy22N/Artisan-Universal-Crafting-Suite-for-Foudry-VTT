# Artisan - Universal Crafting Suite

Artisan è un modulo per Foundry Virtual Tabletop v14 dedicato a creazione, raccolta, caccia, dissassemblaggio e progressione delle professioni.

## Funzioni principali

- **Creazione:** ricette con ingredienti, strumenti, requisiti di professione, XP personalizzata e output da Item del mondo o compendi.
- **Qualità degli oggetti:** qualità basata sul margine del tiro, bonus fissi, dadi extra ed effetti di cura o danno.
- **Strumenti:** strumenti obbligatori o facoltativi, bonus competenza applicato solo ai personaggi competenti e rischio di rottura configurabile per singola ricetta o lista.
- **Raccolta:** risorse casuali in quantità miste, biomi, pesi, quantità minime/massime e strumenti dedicati.
- **Caccia:** estrazione di più parti dalla stessa sorgente, rarità, rischio rovina e modalità casuale o completa.
- **Dissassemblaggio:** consumo di una risorsa sorgente per ottenere materiali casuali provenienti da Item del mondo o compendi.
- **Professioni:** XP, livelli, requisiti e moltiplicatori salvati direttamente sul personaggio.
- **Interfaccia:** barra laterale con categorie espandibili e liste organizzate senza duplicazioni.
- **Gestione dati:** importazione, esportazione, backup completo e registro attività.
- **Lingue:** italiano e inglese.

## Compatibilità

- Foundry VTT: versione 14
- Verificato: build 14.364

## Installazione tramite manifest

In Foundry VTT usa questo indirizzo nel campo **Manifest URL**:

```text
https://github.com/Crazy22N/Artisan-Universal-Crafting-Suite-for-Foudry-VTT/releases/latest/download/module.json
```

## Installazione manuale

1. Scarica `artisan-v1.1.18.zip` dalla release GitHub.
2. Estrai la cartella `artisan` dentro la cartella `Data/modules/` di Foundry VTT.
3. Riavvia Foundry VTT e abilita Artisan nel mondo di gioco.

## Sviluppo locale

```powershell
npm install
npm run build
```

La destinazione della build viene determinata da `build.config.mjs` in base al sistema operativo.

## Licenza

Distribuito con licenza MIT. Consulta il file `LICENSE`.
