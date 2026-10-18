import type { EngineResult, SourceRef } from '@fisc/schemas';

export class ClientOutputError extends Error {}

function everySource(result: EngineResult): SourceRef[] {
  return result.levers.flatMap((l) => l.sources);
}

/**
 * R1, R2, T7 : une sortie client ne contient que des règles REAL au statut CONFIRMED,
 * et chaque montant calculé porte au moins une source complète.
 * Appelé par le moteur avant de rendre un résultat CLIENT ; testable seul.
 */
export function assertClientSafe(result: EngineResult): void {
  if (result.mode !== 'CLIENT') return;
  for (const s of everySource(result)) {
    if (s.kind !== 'REAL' || s.status !== 'CONFIRMED') {
      throw new ClientOutputError(`Règle ${s.ruleId} interdite en sortie client`);
    }
  }
  if (result.assumptions.length > 0) {
    throw new ClientOutputError('Hypothèse interdite en sortie client');
  }
  for (const lever of result.levers) {
    const hasAmount = lever.gross !== null && lever.gross !== 0n;
    if (hasAmount && lever.sources.length === 0) {
      throw new ClientOutputError(`Montant sans source : ${lever.id}`);
    }
    if (lever.state === 'NOT_COMPUTABLE' && (lever.gross !== null || lever.net !== null)) {
      throw new ClientOutputError(`Levier non calculable avec montant : ${lever.id}`);
    }
  }
}
