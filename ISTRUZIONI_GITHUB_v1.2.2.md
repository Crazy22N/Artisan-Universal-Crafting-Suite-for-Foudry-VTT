# Istruzioni GitHub — Artisan v1.2.2

## 1. Aggiornare la pagina principale del repository

Estrai `artisan-source-v1.2.2-github.zip` sopra la cartella del progetto:

```text
C:\Sviluppo\artisan
```

La struttura finale deve essere:

```text
C:\Sviluppo\artisan\module.json
C:\Sviluppo\artisan\src
C:\Sviluppo\artisan\lang
C:\Sviluppo\artisan\styles
C:\Sviluppo\artisan\templates
```

Poi esegui:

```powershell
cd C:\Sviluppo\artisan
git status
git add -A
git commit -m "Release Artisan v1.2.2"
git push origin main
```

Se GitHub rifiuta il push perché il ramo remoto contiene file diversi, usa solo se sei sicuro di voler sostituire la pagina principale con questa versione:

```powershell
git fetch origin main
git push --force-with-lease origin main
```

## 2. Creare la Release GitHub

Crea una nuova release con:

```text
Tag: v1.2.2
Titolo: Artisan v1.2.2
```

Nella descrizione incolla il contenuto di:

```text
RELEASE_NOTES_v1.2.2.md
```

Allega solo questi file:

```text
module.json
artisan-v1.2.2.zip
```

Spunta:

```text
Set as latest release
```

## 3. Manifest Foundry

Il manifest da usare in Foundry è:

```text
https://github.com/Crazy22N/Artisan-Universal-Crafting-Suite-for-Foudry-VTT/releases/latest/download/module.json
```
