/** Serie en cours avec UN jour de repos protege par fenetre de 7 jours.
 *  `logged[i]` = une saisie existe il y a i jours (0 = aujourd'hui). Aujourd'hui vide ne compte
 *  pas (journee non finie) ; un jour vide isole ne casse pas la serie mais ne l'allonge pas. */
export function computeCurrentStreak(logged: boolean[]): { currentStreak: number; restDaysUsed: number } {
  let currentStreak = 0;
  let restDaysUsed = 0;
  let lastRestIdx = -99;
  let pendingRest = false;
  const todayEmpty = !logged[0];
  for (let i = 0; i < logged.length; i++) {
    if (i === 0 && todayEmpty) continue;
    if (logged[i]) {
      currentStreak++;
      if (pendingRest) { restDaysUsed++; pendingRest = false; }
    } else if (i - lastRestIdx >= 7 && !(i === 1 && todayEmpty)) {
      lastRestIdx = i;
      pendingRest = true;
    } else {
      break;
    }
  }
  return { currentStreak, restDaysUsed };
}
