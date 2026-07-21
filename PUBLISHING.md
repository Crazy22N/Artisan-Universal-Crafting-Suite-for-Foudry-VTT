# Pubblicare Artisan v1.2.3 su GitHub

## 1. Preparare e verificare i file

Da PowerShell, nella cartella del progetto:

```powershell
cd C:\Sviluppo\artisan
npm install
npm run release
```

La cartella `release` conterrà:

```text
module.json
artisan-v1.2.3.zip
artisan-source-v1.2.3.zip
SHA256SUMS.txt
```

## 2. Aggiornare il repository

Prima integra gli eventuali aggiornamenti remoti:

```powershell
git pull --rebase origin main
git status
git add -A
git commit -m "Release Artisan v1.2.3"
git push origin main
```

Non usare un push forzato per una normale pubblicazione.

## 3. Creare la release

- Tag: `v1.2.3`
- Titolo: `Artisan v1.2.3`
- Descrizione: contenuto di `RELEASE_NOTES.md`
- Allegati: `release/module.json`, `release/artisan-v1.2.3.zip`, `release/artisan-source-v1.2.3.zip` e `release/SHA256SUMS.txt`
- Seleziona **Set as latest release**.

Il manifest da inserire in Foundry rimane:

```text
https://github.com/Crazy22N/Artisan-Universal-Crafting-Suite-for-Foudry-VTT/releases/latest/download/module.json
```
