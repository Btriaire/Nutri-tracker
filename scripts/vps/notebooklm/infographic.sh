#!/bin/sh
# Ammanda : infographie Nutri-Tracker (semaine ou mois) via NotebookLM. Lance dans le conteneur.
set -eu

PERIOD="${1:-7d}"
case "$PERIOD" in
  7d)  LABEL="semaine"; SPAN="de la semaine écoulée" ;;
  30d) LABEL="mois";    SPAN="du mois écoulé" ;;
  *)   echo "Période inconnue: $PERIOD (attendu: 7d|30d)" >&2; exit 1 ;;
esac

echo "[$(date +%Y-%m-%d)] Génération de l'infographie Nutri-Tracker ($LABEL)..."

REPORT_JSON=$(curl -s -X POST "${NUTRI_TRACKER_URL}/api/report/generate?period=${PERIOD}" \
  -H "Authorization: Bearer ${REPORT_CRON_SECRET}")
PDF_URL=$(echo "$REPORT_JSON" | jq -r '.url // empty')
FROM=$(echo "$REPORT_JSON" | jq -r '.from // empty')
TO=$(echo "$REPORT_JSON" | jq -r '.to // empty')
if [ -z "$PDF_URL" ]; then
  echo "Erreur: pas d'URL de rapport reçue. Réponse: $REPORT_JSON" >&2
  exit 1
fi
echo "Rapport prêt: $PDF_URL ($FROM -> $TO)"

notebooklm -p nutri create "Nutri-Tracker — infographie ${LABEL} du ${TO}" --use --json
notebooklm -p nutri source add "$PDF_URL" --title "Rapport Nutri-Tracker ${FROM} au ${TO}" --json

DESCRIPTION="Crée une infographie personnelle et privée en français, à partir du rapport fourni, sur mes données ${SPAN}. TITRE : le titre principal, en haut, doit être exactement « Rapport NutriTracker PaLaMA », avec en sous-titre la période couverte. Un seul coup d'oeil doit suffire : le verdict de la période en une phrase courte ; les chiffres clés (calories moyennes par rapport à mon objectif, protéines, évolution du poids, activité, sommeil) avec de grands nombres lisibles et de petits graphiques ; mes 3 meilleurs progrès ; 1 point à améliorer ; UNE action concrète pour la période suivante. MISE EN PAGE : aucun texte ne doit dépasser de son cadre ni chevaucher un autre élément (texte, graphique, icône, bord) ; garde des marges généreuses à l'intérieur de chaque cadre et entre les cadres ; textes courts (une à deux lignes par cadre). Ton bienveillant, précis et honnête, sans jargon. N'ajoute aucun logo ni signature en bas de page, ne cite ni NotebookLM ni Google, ne mentionne pas l'observance des compléments alimentaires comme un point clé."

notebooklm -p nutri generate infographic "$DESCRIPTION" \
  --orientation portrait --detail standard --style bento-grid --language fr \
  --wait --timeout 900 --json

OUT="/output/nutri-infographie-${LABEL}-${TO}.png"
notebooklm -p nutri download infographic "$OUT" --json
echo "Infographie prête: $OUT"
echo "Terminé."
