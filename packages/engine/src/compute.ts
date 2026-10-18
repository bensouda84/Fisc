import type {
  Aggregate,
  Assumption,
  BlockedRule,
  Commission,
  CommercialParams,
  EngineInput,
  EngineResult,
  LeverId,
  LeverResult,
  Mode,
  Reason,
  RegistrySnapshot,
  SourceRef,
  Warning,
} from '@fisc/schemas';
import { assertClientSafe } from './guard.ts';
import { max0, min, mulRate } from './fraction.ts';
import { CONCEPT_TITLE_FR } from './labels.ts';
import { resolveRule } from './rules.ts';

type AnyResolution =
  | { ok: true; source: SourceRef }
  | { ok: false; reason: Reason; blocked: BlockedRule };

export const DISCLAIMER =
  'Simulation établie à la date indiquée, à partir des textes identifiés ci-dessus. ' +
  'Elle ne garantit aucun résultat et ne remplace pas l’avis d’un professionnel.';

export interface SimulationOptions {
  mode: Mode;
  /** Date du calcul (AAAA-MM-JJ), fournie par l'appelant : le moteur ne lit pas l'horloge. */
  asOf: string;
}

type Read<T> = { kind: 'ok'; value: T } | { kind: 'missing' } | { kind: 'unknown' };

function read<T>(value: T | 'UNKNOWN' | undefined): Read<T> {
  if (value === undefined) return { kind: 'missing' };
  if (value === 'UNKNOWN') return { kind: 'unknown' };
  return { kind: 'ok', value };
}

const FIELD_LABEL_FR: Record<string, string> = {
  profit: 'le bénéfice imposable',
  donations: 'le montant des dons',
  cdiHires: 'le nombre de CDI',
  apprentices: 'le nombre d’apprentis',
  interns: 'le nombre de stagiaires',
  extraSalaries: 'les salaires supplémentaires',
  otherOutflows: 'les autres décaissements',
  isStartup: 'si l’entreprise est une startup numérique labellisée',
  startupLabelYear: 'l’année de labellisation',
  startupRegime: 'si l’entreprise est au régime réel, hors zone franche biotechnologie et TIC',
  vatAgri: 'si vous êtes exploitant agricole assujetti à la TVA par option, pour des produits dans le champ de la TVA',
  fuelVat: 'la TVA supportée sur le carburant des engins',
};

function inputReason(field: string, r: Read<unknown>): Reason {
  const what = FIELD_LABEL_FR[field] ?? field;
  return r.kind === 'unknown'
    ? { code: 'INPUT_UNKNOWN', field, message: `Vous ne savez pas ${what}. Saisissez une valeur pour calculer.` }
    : { code: 'INPUT_MISSING', field, message: `Saisissez ${what} pour calculer.` };
}

const LEVER_LABEL_FR: Record<LeverId, string> = {
  STARTUP_EXEMPTION: 'Exonération startup',
  VAT_FUEL_RECOVERY: 'TVA sur carburant agricole',
  DONATIONS: 'Dons déductibles',
  CREDIT_CDI: 'Crédit d’impôt — CDI',
  CREDIT_APPRENTICE: 'Crédit d’impôt — apprentis',
  CREDIT_INTERN: 'Crédit d’impôt — stagiaires',
};

function emptyLever(id: LeverId): LeverResult {
  return {
    id,
    label: LEVER_LABEL_FR[id],
    state: 'NOT_COMPUTABLE',
    gross: null,
    outflows: null,
    net: null,
    creditExcess: null,
    reasons: [],
    sources: [],
  };
}

function aggregate(parts: { value: bigint | null; name: string }[]): Aggregate {
  const missing = parts.filter((p) => p.value === null).map((p) => p.name);
  const subtotal = parts.reduce((sum, p) => sum + (p.value ?? 0n), 0n);
  if (missing.length === 0) return { state: 'COMPLETE', value: subtotal };
  if (missing.length === parts.length) return { state: 'NOT_COMPUTABLE', missing };
  return { state: 'PARTIAL', subtotal, missing };
}

/**
 * Calcul du levier de crédit ; l'imputation sur l'impôt se fait ensuite (étape 4).
 */
interface CreditCandidate {
  lever: LeverResult;
  credit: bigint;
}

export function simulate(
  input: EngineInput,
  snapshot: RegistrySnapshot,
  commercial: CommercialParams,
  options: SimulationOptions,
): EngineResult {
  const { mode, asOf } = options;
  const blocked: BlockedRule[] = [];
  const used = new Map<string, SourceRef>();

  const use = (res: AnyResolution): Reason | null => {
    if (res.ok) {
      used.set(res.source.ruleId, res.source);
      return null;
    }
    if (!blocked.some((b) => b.concept === res.blocked.concept)) blocked.push(res.blocked);
    return res.reason;
  };
  const sourcesOf = (...resolutions: AnyResolution[]): SourceRef[] =>
    resolutions.flatMap((r) => (r.ok ? [r.source] : []));

  const rateRes = resolveRule(snapshot, 'IS_RATE', mode, asOf);
  const donationRes = resolveRule(snapshot, 'DONATION_DEDUCTIBILITY', mode, asOf);
  const cdiRes = resolveRule(snapshot, 'CREDIT_CDI', mode, asOf);
  const apprenticeRes = resolveRule(snapshot, 'CREDIT_APPRENTICE', mode, asOf);
  const internRes = resolveRule(snapshot, 'CREDIT_INTERN', mode, asOf);
  const startupRes = resolveRule(snapshot, 'STARTUP_EXEMPTION', mode, asOf);
  const vatRes = resolveRule(snapshot, 'VAT_FUEL_RECOVERY', mode, asOf);

  const profit = read(input.profit);
  const donations = read(input.donations);
  const cdiHires = read(input.cdiHires);
  const apprentices = read(input.apprentices);
  const interns = read(input.interns);
  const salaries = read(input.extraSalaries);
  const others = read(input.otherOutflows);
  const isStartup = read(input.isStartup);
  const startupYear = read(input.startupLabelYear);
  const startupRegime = read(input.startupRegime);
  const vatAgri = read(input.vatAgri);
  const fuelVat = read(input.fuelVat);
  /** Exercice : l'année de la date de calcul (le moteur ne lit pas l'horloge). */
  const fiscalYear = Number.parseInt(asOf.slice(0, 4), 10);

  // Étape 1 — impôt avant opérations.
  const taxContextReasons: Reason[] = [];
  if (profit.kind !== 'ok') taxContextReasons.push(inputReason('profit', profit));
  if (!rateRes.ok) taxContextReasons.push(rateRes.reason);
  const taxContextOk = profit.kind === 'ok' && rateRes.ok;
  const taxBefore =
    profit.kind === 'ok' && rateRes.ok ? mulRate(rateRes.params.rate, max0(profit.value)) : null;
  const taxContextBlock = (): Reason[] =>
    taxContextReasons.length > 0
      ? taxContextReasons
      : [{ code: 'TAX_BASE_NOT_COMPUTABLE', message: 'L’impôt avant opérations n’est pas calculable.' }];

  // Levier startup (R08) : exonération de l'impôt sur les bénéfices pendant la durée fixée par la règle validée.
  const startupLever = emptyLever('STARTUP_EXEMPTION');
  let exempt = false;
  if (isStartup.kind !== 'ok') {
    startupLever.reasons.push(inputReason('isStartup', isStartup));
  } else if (isStartup.value === 'NO') {
    startupLever.state = 'NULL';
    startupLever.gross = 0n;
    startupLever.reasons.push({ code: 'CONDITION_NOT_MET', message: 'L’entreprise n’est pas une startup labellisée : ce levier ne produit pas d’économie fiscale.' });
  } else {
    const ruleReason = use(startupRes);
    if (ruleReason !== null) {
      startupLever.reasons.push(ruleReason);
    } else if (startupYear.kind !== 'ok') {
      startupLever.reasons.push(inputReason('startupLabelYear', startupYear));
    } else if (startupRegime.kind !== 'ok') {
      startupLever.reasons.push(inputReason('startupRegime', startupRegime));
    } else if (startupRes.ok) {
      const params = startupRes.params;
      const first = startupYear.value + (params.includesLabelYear ? 0 : 1);
      const last = first + params.durationYears - 1;
      startupLever.sources = sourcesOf(startupRes);
      if (startupRegime.value === 'NO') {
        startupLever.state = 'NULL';
        startupLever.gross = 0n;
        startupLever.reasons.push({ code: 'CONDITION_NOT_MET', message: 'Le texte réserve l’exonération aux startups au régime réel, hors zone franche biotechnologie et TIC.' });
      } else if (fiscalYear < first || fiscalYear > last) {
        startupLever.state = 'NULL';
        startupLever.gross = 0n;
        startupLever.reasons.push({ code: 'OUTSIDE_EXEMPTION_PERIOD', message: `L’exonération couvre les années ${first} à ${last} ; l’exercice ${fiscalYear} est hors période.` });
      } else if (!params.appliesToProfitTax) {
        startupLever.state = 'NULL';
        startupLever.gross = 0n;
        startupLever.reasons.push({ code: 'EXEMPTION_NOT_FOR_THIS_TAX', message: 'Selon la règle enregistrée, l’exonération ne vise pas l’impôt sur les sociétés.' });
      } else if (taxBefore !== null && rateRes.ok) {
        exempt = true;
        startupLever.state = 'CALCULATED';
        startupLever.gross = taxBefore;
        startupLever.sources = sourcesOf(rateRes, startupRes);
      } else {
        startupLever.reasons.push(...taxContextBlock());
      }
    }
  }
  // Une exonération possible mais non établie rend l'impôt après opérations indéterminé.
  const startupUnresolved = startupLever.state === 'NOT_COMPUTABLE';

  // Levier dons — étapes 2 et 3.
  const donationsLever = emptyLever('DONATIONS');
  const donationsKnown = donations.kind === 'ok' ? donations.value : null;
  donationsLever.outflows = donationsKnown;
  let deducted = 0n;
  if (donations.kind !== 'ok') {
    donationsLever.reasons.push(inputReason('donations', donations));
  } else if (donations.value === 0n) {
    donationsLever.state = 'NULL';
    donationsLever.gross = 0n;
    donationsLever.reasons.push({ code: 'NO_AMOUNT_ENTERED', message: 'Aucun don : ce levier ne produit pas d’économie fiscale.' });
  } else {
    const ruleReason = use(donationRes);
    if (ruleReason !== null) {
      donationsLever.reasons.push(ruleReason);
    } else if (donationRes.ok && !donationRes.params.deductible) {
      donationsLever.state = 'NULL';
      donationsLever.gross = 0n;
      donationsLever.sources = sourcesOf(donationRes);
      donationsLever.reasons.push({
        code: 'DONATIONS_NOT_DEDUCTIBLE',
        message: 'Ces dons ne sont pas déductibles selon la règle enregistrée. Le décaissement reste à votre charge.',
      });
    } else if (startupUnresolved) {
      donationsLever.reasons.push({ code: 'DEPENDS_ON_STARTUP_LEVER', message: 'L’impôt dépend de l’exonération startup, qui n’est pas calculable.' });
    } else if (exempt) {
      // L'impôt est déjà supprimé par l'exonération : la déduction ne l'abaisse plus. Zéro réel, pas une lacune.
      donationsLever.state = 'CALCULATED';
      donationsLever.gross = 0n;
      donationsLever.sources = sourcesOf(rateRes, donationRes);
      donationsLever.reasons.push({ code: 'ALREADY_EXEMPT', message: 'L’exonération startup supprime déjà l’impôt : la déduction des dons ne l’abaisse pas davantage.' });
    } else if (taxContextOk && donationRes.ok && rateRes.ok) {
      deducted = donations.value;
      donationsLever.state = 'CALCULATED';
      donationsLever.sources = sourcesOf(rateRes, donationRes);
    } else {
      donationsLever.reasons.push(...taxContextBlock());
    }
  }
  use(rateRes);

  // Un don possible mais non établi rend l'impôt après déductions indéterminé.
  const donationsUnresolved = donationsLever.state === 'NOT_COMPUTABLE';
  const taxAfterDeductions =
    profit.kind === 'ok' && rateRes.ok && !donationsUnresolved && !startupUnresolved
      ? exempt ? 0n : mulRate(rateRes.params.rate, max0(profit.value - deducted))
      : null;
  if (donationsLever.state === 'CALCULATED' && !exempt && taxBefore !== null && taxAfterDeductions !== null) {
    donationsLever.gross = taxBefore - taxAfterDeductions;
  }

  // Leviers de crédit — étape 4.
  const credits: CreditCandidate[] = [];
  const buildCredit = (
    id: LeverId,
    count: Read<number>,
    countField: string,
    res: AnyResolution,
    unit: bigint | null,
  ): LeverResult => {
    const lever = emptyLever(id);
    if (count.kind !== 'ok') {
      lever.reasons.push(inputReason(countField, count));
    } else if (count.value === 0) {
      lever.state = 'NULL';
      lever.gross = 0n;
      lever.outflows = 0n;
      lever.net = 0n;
      lever.creditExcess = 0n;
      lever.reasons.push({ code: 'NO_AMOUNT_ENTERED', message: 'Aucune embauche saisie : ce levier ne produit pas d’économie fiscale.' });
    } else {
      const ruleReason = use(res);
      if (ruleReason !== null) lever.reasons.push(ruleReason);
      else if (taxAfterDeductions === null) {
        if (startupUnresolved && taxContextOk) {
          lever.reasons.push({ code: 'DEPENDS_ON_STARTUP_LEVER', message: 'Le plafond du crédit dépend de l’exonération startup, qui n’est pas calculable.' });
        } else if (donationsUnresolved && taxContextOk) {
          lever.reasons.push({
            code: 'DEPENDS_ON_DONATIONS_LEVER',
            message: 'Le plafond du crédit dépend du levier dons, qui n’est pas calculable.',
          });
        } else {
          lever.reasons.push(...taxContextBlock());
        }
      } else if (unit !== null && rateRes.ok) {
        lever.sources = sourcesOf(rateRes, res);
        credits.push({ lever, credit: BigInt(count.value) * unit });
      }
    }
    return lever;
  };
  const cdiLever = buildCredit(
    'CREDIT_CDI',
    cdiHires,
    'cdiHires',
    cdiRes,
    cdiRes.ok ? cdiRes.params.amountPerHire : null,
  );
  const apprenticeLever = buildCredit(
    'CREDIT_APPRENTICE',
    apprentices,
    'apprentices',
    apprenticeRes,
    apprenticeRes.ok ? apprenticeRes.params.amountPerApprentice : null,
  );

  const internLever = buildCredit(
    'CREDIT_INTERN',
    interns,
    'interns',
    internRes,
    internRes.ok ? internRes.params.amountPerIntern : null,
  );

  // Imputation : leviers calculables d'abord, dans l'ordre d'affichage ; les non calculables passent en dernier (Q4).
  let remaining = taxAfterDeductions ?? 0n;
  for (const c of credits) {
    const applied = min(c.credit, remaining);
    remaining -= applied;
    c.lever.state = 'CALCULATED';
    c.lever.gross = applied;
    c.lever.creditExcess = c.credit - applied;
    c.lever.outflows = 0n;
    c.lever.net = applied;
    if (exempt) c.lever.reasons.push({ code: 'ALREADY_EXEMPT', message: 'L’exonération startup supprime déjà l’impôt : le crédit n’est pas imputable.' });
  }

  // Levier TVA sur le carburant agricole (R11) : droit à déduction sous conditions cumulatives.
  const vatLever = emptyLever('VAT_FUEL_RECOVERY');
  if (vatAgri.kind !== 'ok') {
    vatLever.reasons.push(inputReason('vatAgri', vatAgri));
  } else if (vatAgri.value === 'NO') {
    vatLever.state = 'NULL';
    vatLever.gross = 0n;
    vatLever.reasons.push({ code: 'CONDITION_NOT_MET', message: 'Les conditions cumulatives (assujettissement par option, produits dans le champ de la TVA) ne sont pas remplies : ce levier ne produit pas d’économie fiscale.' });
  } else if (fuelVat.kind !== 'ok') {
    vatLever.reasons.push(inputReason('fuelVat', fuelVat));
  } else if (fuelVat.value === 0n) {
    vatLever.state = 'NULL';
    vatLever.gross = 0n;
    vatLever.reasons.push({ code: 'NO_AMOUNT_ENTERED', message: 'Aucune TVA supportée sur le carburant : ce levier ne produit pas d’économie fiscale.' });
  } else {
    const ruleReason = use(vatRes);
    if (ruleReason !== null) {
      vatLever.reasons.push(ruleReason);
    } else if (vatRes.ok) {
      const cap = vatRes.params.capPercent;
      vatLever.state = 'CALCULATED';
      vatLever.gross = cap === null ? fuelVat.value : mulRate(cap, fuelVat.value);
      vatLever.sources = sourcesOf(vatRes);
    }
  }
  for (const lever of [startupLever, vatLever]) {
    if (lever.state !== 'NOT_COMPUTABLE') lever.outflows = 0n;
  }

  // Décaissements — étape 6.
  const levers = [startupLever, donationsLever, cdiLever, apprenticeLever, internLever, vatLever];
  for (const lever of levers) {
    if (lever.gross !== null && lever.outflows !== null) lever.net = lever.gross - lever.outflows;
  }
  let grossAgg = aggregate(levers.map((l) => ({ value: l.gross, name: l.id })));
  // Des zéros établis par condition (leviers NULS) ne suffisent pas à présenter un sous-total : sans levier calculé, le total n'est pas calculable.
  if (grossAgg.state === 'PARTIAL' && !levers.some((l) => l.state === 'CALCULATED')) {
    grossAgg = { state: 'NOT_COMPUTABLE', missing: grossAgg.missing };
  }
  const salariesValue = salaries.kind === 'ok' ? salaries.value : null;
  const othersValue = others.kind === 'ok' ? others.value : null;
  const unallocated = aggregate([
    { value: salariesValue, name: 'extraSalaries' },
    { value: othersValue, name: 'otherOutflows' },
  ]);
  const outflowsAgg = aggregate([
    { value: donationsKnown, name: 'donations' },
    { value: salariesValue, name: 'extraSalaries' },
    { value: othersValue, name: 'otherOutflows' },
  ]);

  // Étape 7 — économie nette.
  let net: Aggregate;
  if (grossAgg.state === 'COMPLETE' && outflowsAgg.state === 'COMPLETE') {
    net = { state: 'COMPLETE', value: grossAgg.value - outflowsAgg.value };
  } else if (grossAgg.state === 'NOT_COMPUTABLE') {
    net = { state: 'NOT_COMPUTABLE', missing: grossAgg.missing };
  } else {
    const grossPart = grossAgg.state === 'COMPLETE' ? grossAgg.value : grossAgg.subtotal;
    const knownOut = (donationsKnown ?? 0n) + (salariesValue ?? 0n) + (othersValue ?? 0n);
    net = {
      state: 'PARTIAL',
      subtotal: grossPart - knownOut,
      missing: [
        ...(grossAgg.state === 'PARTIAL' ? grossAgg.missing : []),
        ...(outflowsAgg.state === 'COMPLETE' ? [] : outflowsAgg.missing),
      ],
    };
  }

  // Étape 8 — commission, HT / TVA / TTC.
  let commission: Commission;
  if (net.state !== 'COMPLETE') {
    commission = {
      state: 'NOT_COMPUTED',
      reason: {
        code: 'TAX_BASE_NOT_COMPUTABLE',
        message: 'La commission n’est pas calculée : l’économie nette est partielle ou non calculable.',
      },
    };
  } else if (mode === 'CLIENT' && !commercial.validated) {
    commission = {
      state: 'NOT_COMPUTED',
      reason: {
        code: 'RULE_NOT_CONFIRMED',
        message: 'La commission n’est pas calculée : les paramètres commerciaux ne sont pas validés.',
      },
    };
  } else {
    const base = max0(net.value);
    let excl = mulRate(commercial.commissionRate, base);
    let capApplied = false;
    if (commercial.commissionCap !== null && excl > commercial.commissionCap) {
      excl = commercial.commissionCap;
      capApplied = true;
    }
    const vat = mulRate(commercial.vatRate, excl);
    commission = { state: 'COMPUTED', base, excl, vat, incl: excl + vat, capApplied };
  }

  // Hypothèses (mode interne) et avertissements.
  const assumptions: Assumption[] = [];
  for (const s of used.values()) {
    if (s.kind === 'TEST' || s.status !== 'CONFIRMED') {
      assumptions.push({
        ruleId: s.ruleId,
        label: s.label,
        kind: s.kind,
        status: s.status,
        message: `${CONCEPT_TITLE_FR[s.concept]} : règle non confirmée (${s.label}).`,
      });
    }
  }
  const warnings: Warning[] = [
    {
      code: 'SALARY_TAX_EFFECT_NOT_MODELED',
      message: 'L’effet fiscal des salaires n’est pas modélisé dans cette version : ils comptent comme décaissement uniquement.',
    },
  ];
  if (mode === 'INTERNAL') {
    warnings.push({ code: 'INTERNAL_MODE', message: 'Mode interne : ce résultat ne doit pas être remis à un client.' });
  }
  if (levers.some((l) => l.state === 'NOT_COMPUTABLE')) {
    warnings.push({ code: 'LEVERS_NOT_COMPUTABLE', message: 'Au moins un levier n’est pas calculable : le total n’est pas complet.' });
  }
  if (net.state === 'PARTIAL') {
    warnings.push({ code: 'NET_PARTIAL', message: 'Économie nette partielle : il manque au moins un montant.' });
  }
  if (levers.some((l) => (l.creditExcess ?? 0n) > 0n)) {
    warnings.push({ code: 'CREDIT_EXCESS', message: 'Excédent non remboursable sans texte : une partie des crédits n’est pas imputable.' });
  }

  const result: EngineResult = {
    mode,
    asOf,
    registryVersion: snapshot.version,
    taxBefore,
    taxSources: taxBefore !== null && rateRes.ok ? [rateRes.source] : [],
    taxAfterDeductions,
    levers,
    gross: grossAgg,
    outflows: outflowsAgg,
    unallocatedOutflows: unallocated,
    net,
    commission,
    blockedRules: blocked,
    assumptions: mode === 'INTERNAL' ? assumptions : [],
    warnings,
    disclaimer: DISCLAIMER,
  };
  assertClientSafe(result);
  return result;
}
