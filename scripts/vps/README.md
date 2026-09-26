# Sauvegarde nutri-tracker sur le VPS (46.202.131.240)

Copie de référence, le script actif est /root/nutri-tracker-backups/pull-backup.sh.

- Cron (root) : `30 4 * * * /root/nutri-tracker-backups/pull-backup.sh` (quotidien)
  et `*/5 * * * * /root/nutri-tracker-backups/pull-backup.sh --if-requested` (bouton « Sauvegarder » de Réglages)
- Secret : /root/nutri-tracker-backups/.secret (= CRON_SECRET de Vercel, chmod 600)
- Fichiers : nutri-tracker-AAAA-MM-JJ.json.gz, photos/ (dimanche), legacy-blob/ (anciens dumps)
- Journal : /root/nutri-tracker-backups/pull.log
- Restauration : `npx tsx scripts/restore-backup.ts <fichier.json.gz>` (aperçu), puis `--apply`
