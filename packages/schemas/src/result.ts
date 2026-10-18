import type { Mode } from './input.ts';
import type { RuleConcept, RuleKind, RuleStatus } from './rule.ts';

export type LeverId = 'DONATIONS' | 'CREDIT_CDI' | 'CREDIT_APPRENTICE';
export type LeverState = 'CALCULATED' | 'NOT_COMPUTABLE' | 'NULL';

export type ReasonCode =
  | 'INPUT_MISSING'
  | 'INPUT_UNKNOWN'
  | 'RULE_PENDING'
  | 'RULE_NOT_CONFIRMED'
  | 'RULE_NOT_IN_FORCE'
  | 'RULE_NOT_AVAILABLE'
  | 'RULE_MISSING'
  | 'NO_AMOUNT_ENTERED'
  | 'DONATIONS_NOT_DEDUCTIBLE'
  | 'DEPENDS_ON_DONATIONS_LEVER'
  | 'TAX_BASE_NOT_COMPUTABLE';

export interface Reason {
  code: ReasonCode;
  message: string;
  field?: string;
  concept?: RuleConcept;
}

/** R2 : article, page, statut, date d’effet, version du registre. */
export interface SourceRef {
  ruleId: string;
  concept: RuleConcept;
  label: string;
  kind: RuleKind;
  status: RuleStatus;
  article: string;
  page: number;
  effectiveDate: string;
  source: string;
  registryVersion: string;
}

export interface BlockedRule {
  concept: RuleConcept;
  /** Absent pour une règle de TEST en mode client : elle n’apparaît jamais (T7). */
  ruleId?: string;
  status?: RuleStatus;
}

export interface LeverResult {
  id: LeverId;
  label: string;
  state: LeverState;
  /** Économie fiscale brute. `null` si NOT_COMPUTABLE : jamais 0 à la place d’une lacune. */
  gross: bigint | null;
  /** Décaissements rattachés au levier. */
  outflows: bigint | null;
  net: bigint | null;
  /** Crédit non imputé faute d’impôt : « excédent non remboursable sans texte ». */
  creditExcess: bigint | null;
  reasons: Reason[];
  sources: SourceRef[];
}

export type Aggregate =
  | { state: 'COMPLETE'; value: bigint }
  | { state: 'PARTIAL'; subtotal: bigint; missing: string[] }
  | { state: 'NOT_COMPUTABLE'; missing: string[] };

export type Commission =
  | {
      state: 'COMPUTED';
      base: bigint;
      excl: bigint;
      vat: bigint;
      incl: bigint;
      capApplied: boolean;
    }
  | { state: 'NOT_COMPUTED'; reason: Reason };

export interface Assumption {
  ruleId: string;
  label: string;
  kind: RuleKind;
  status: RuleStatus;
  message: string;
}

export interface Warning {
  code: string;
  message: string;
}

export interface EngineResult {
  mode: Mode;
  asOf: string;
  registryVersion: string;
  taxBefore: bigint | null;
  /** Texte du taux utilisé pour l'impôt avant opérations (R2) ; vide si l'impôt n'est pas calculé. */
  taxSources: SourceRef[];
  taxAfterDeductions: bigint | null;
  levers: LeverResult[];
  gross: Aggregate;
  outflows: Aggregate;
  /** Salaires et autres décaissements, non rattachés à un levier. */
  unallocatedOutflows: Aggregate;
  net: Aggregate;
  commission: Commission;
  blockedRules: BlockedRule[];
  assumptions: Assumption[];
  warnings: Warning[];
  disclaimer: string;
}
