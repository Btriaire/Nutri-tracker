# Sauvegarde nutri-tracker sur le VPS (46.202.131.240)

Copie de référence, le script actif est /root/nutri-tracker-backups/pull-backup.sh.

- Cron (root) : `30 4 * * * /root/nutri-tracker-backups/pull-backup.sh` (quotidien)
  et `*/5 * * * * /root/nutri-tracker-backups/pull-backup.sh --if-requested` (bouton « Sauvegarder » de Réglages)
- Secret : /root/nutri-tracker-backups/.secret (= CRON_SECRET de Vercel, chmod 600)
- Fichiers : nutri-tracker-AAAA-MM-JJ.json.gz, photos/ (dimanche), legacy-blob/ (anciens dumps)
- Journal : /root/nutri-tracker-backups/pull.log
- Restauration : `npx tsx scripts/restore-backup.ts <fichier.json.gz>` (aperçu), puis `--apply`

## Infographies hebdo / mensuelles (Ammanda, NotebookLM)

Copie de référence dans `scripts/vps/notebooklm/` ; actifs dans `/opt/notebooklm-nutri/`.

- Cron (root) : `0 1 * * 0 .../run-infographic.sh 7d` (dimanche 01:00 UTC) et `30 2 1 * * .../run-infographic.sh 30d` (le 1er, 02:30 UTC)
- Chaîne : rapport PDF (`/api/report/generate`) -> notebook NotebookLM -> `generate infographic` (portrait, bento-grid, fr) -> PNG -> JPEG < 650 Ko -> `POST /api/infographic/upload` (secret `REPORT_CRON_SECRET`)
- Stockage : Firestore `users/owner/infographics/{semaine|mois}-AAAA-MM-JJ` (privé), visible dans Rapports > Historique
- Un seul job NotebookLM à la fois (`flock /tmp/notebooklm-nutri.lock`) ; journaux : `infographic-cron.log`, `infographic-last*.log`
- Manuel : `/opt/notebooklm-nutri/run-infographic.sh 7d|30d`
