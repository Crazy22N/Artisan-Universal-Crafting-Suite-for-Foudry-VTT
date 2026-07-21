# Artisan v1.2.2

## Italiano

Questa release aggiorna Artisan alla versione **1.2.2** e imposta la compatibilità verificata con **Foundry VTT 14.365**.

### Novità principali

- Manifest aggiornato con `verified: 14.365`.
- Il tempo delle attività è ora espresso in **ore** invece che in minuti.
- Supporto a valori decimali per il tempo, per esempio `0.5` ore o `1.5` ore.
- Nuova modalità **Qualità risultato** per singola ricetta:
  - in base al margine del tiro;
  - sempre normale;
  - probabilità personalizzata.
- Percentuali configurabili per qualità Buona, Superiore ed Eccellente.
- Mantenute le funzioni della v1.2.0 stabile: costo in monete, ricetta posseduta nell'inventario, bonus qualità, professioni, raccolta, caccia, dissassemblare, rarità e scroll preservato.

### Nota compatibilità

Artisan resta installabile come modulo generico Foundry, ma alcune funzioni avanzate sono ottimizzate per D&D 5e o sistemi con struttura dati simile.

## English

This release updates Artisan to **v1.2.2** and marks compatibility as verified for **Foundry VTT 14.365**.

### Main changes

- Manifest updated with `verified: 14.365`.
- Activity time is now expressed in **hours** instead of minutes.
- Decimal time values are supported, such as `0.5` hours or `1.5` hours.
- New per-recipe **Result quality** mode:
  - based on roll margin;
  - always normal;
  - custom probability.
- Configurable percentages for Good, Superior and Excellent quality.
- Keeps the stable v1.2.0 feature set: currency cost, recipe ownership requirement, quality bonuses, professions, gathering, hunting, disassembly, rarity and preserved scroll position.

### Compatibility note

Artisan can still be installed as a generic Foundry module, but some advanced features are optimized for D&D 5e or systems with a similar data structure.
