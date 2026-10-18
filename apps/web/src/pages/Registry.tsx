import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { useCallback, useEffect, useState } from 'react';
import { CONCEPT_TITLE_FR, formatDate } from '@fisc/engine';
import { RULE_STATUS_LABEL_FR } from '@fisc/schemas';
import { api } from '../api.ts';
import { useApp } from '../state.tsx';
import type { WireRule } from '../wire.ts';

const PARAM_FIELDS: Record<string, { key: string; label: string; kind: 'rate' | 'money' | 'bool' }> = {
  IS_RATE: { key: 'rate', label: 'Taux (fraction : numérateur / dénominateur)', kind: 'rate' },
  DONATION_DEDUCTIBILITY: { key: 'deductible', label: 'Les dons sont déductibles', kind: 'bool' },
  CREDIT_CDI: { key: 'amountPerHire', label: 'Crédit par CDI (F CFA)', kind: 'money' },
  CREDIT_APPRENTICE: { key: 'amountPerApprentice', label: 'Crédit par apprenti (F CFA)', kind: 'money' },
};

function ReviseDialog({ rule, onClose, onSaved }: { rule: WireRule; onClose: () => void; onSaved: () => void }) {
  const { notify } = useApp();
  const spec = PARAM_FIELDS[rule.concept]!;
  const [article, setArticle] = useState(rule.article ?? '');
  const [page, setPage] = useState(String(rule.page ?? ''));
  const [date, setDate] = useState(rule.effectiveDate ?? '');
  const [source, setSource] = useState(rule.source ?? '');
  const prev = (rule.params ?? {}) as Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
  const [num, setNum] = useState(String(prev.rate?.num ?? ''));
  const [den, setDen] = useState(String(prev.rate?.den ?? ''));
  const [amount, setAmount] = useState(String(prev[spec.key] ?? ''));
  const [flag, setFlag] = useState(Boolean(prev.deductible ?? true));

  async function save(): Promise<void> {
    const params = spec.kind === 'rate' ? { rate: { num, den } } : spec.kind === 'bool' ? { deductible: flag } : { [spec.key]: amount };
    try {
      await api.revise(rule.id, { article, page: Number.parseInt(page, 10), effectiveDate: date, source, params });
      notify('Règle enregistrée. Les validations sont à poser de nouveau.');
      onSaved();
    } catch (e) {
      notify((e as Error).message);
    }
  }
  return (
    <Dialog open onClose={onClose} fullWidth maxWidth="sm" aria-labelledby="revise-title">
      <DialogTitle id="revise-title">Renseigner la règle : {rule.label}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          <TextField label="Article" value={article} onChange={(e) => setArticle(e.target.value)} fullWidth />
          <TextField label="Page du texte source" value={page} onChange={(e) => setPage(e.target.value)} fullWidth slotProps={{ htmlInput: { inputMode: 'numeric' } }} />
          <TextField label="Date d’effet (AAAA-MM-JJ)" value={date} onChange={(e) => setDate(e.target.value)} fullWidth />
          <TextField label="Source (texte, numéro, date)" value={source} onChange={(e) => setSource(e.target.value)} fullWidth />
          {spec.kind === 'rate' && (
            <Stack direction="row" sx={{ gap: 2 }}>
              <TextField label="Numérateur" value={num} onChange={(e) => setNum(e.target.value)} fullWidth />
              <TextField label="Dénominateur" value={den} onChange={(e) => setDen(e.target.value)} fullWidth />
            </Stack>
          )}
          {spec.kind === 'money' && <TextField label={spec.label} value={amount} onChange={(e) => setAmount(e.target.value)} fullWidth slotProps={{ htmlInput: { inputMode: 'numeric' } }} />}
          {spec.kind === 'bool' && <FormControlLabel control={<Switch checked={flag} onChange={(e) => setFlag(e.target.checked)} />} label={spec.label} />}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ p: 2 }}>
        <Button variant="text" onClick={onClose}>Annuler</Button>
        <Button variant="contained" onClick={save}>Enregistrer</Button>
      </DialogActions>
    </Dialog>
  );
}

function Rules() {
  const { user, notify } = useApp();
  const [rules, setRules] = useState<WireRule[]>([]);
  const [editing, setEditing] = useState<WireRule | null>(null);
  const load = useCallback(() => { api.rules().then(setRules).catch((e: Error) => notify(e.message)); }, [notify]);
  useEffect(load, [load]);

  async function validate(r: WireRule): Promise<void> {
    try {
      const out = await api.validate(r.id);
      notify(`Validation posée : règle « ${RULE_STATUS_LABEL_FR[out.status]} ».`);
      load();
    } catch (e) {
      notify((e as Error).message);
    }
  }

  return (
    <Stack spacing={1.5} component="ul" sx={{ p: 0, m: 0 }}>
      {rules.map((r) => (
        <Card component="li" key={r.id} sx={{ listStyle: 'none' }} data-testid={`rule-${r.id}`}>
          <CardContent>
            <Stack direction="row" sx={{ gap: 1, justifyContent: 'space-between', flexWrap: 'wrap' }}>
              <Typography variant="h5" component="h3">{r.label}</Typography>
              <Stack direction="row" sx={{ gap: 1 }}>
                {r.kind === 'TEST' && <Chip label="TEST" size="small" variant="outlined" />}
                <Chip label={RULE_STATUS_LABEL_FR[r.status]} size="small" icon={r.status === 'CONFIRMED' ? <CheckCircleIcon /> : undefined} />
              </Stack>
            </Stack>
            <Typography variant="body2" color="text.secondary">{CONCEPT_TITLE_FR[r.concept]} · identifiant {r.id} · version {r.version}</Typography>
            <Box component="dl" sx={{ m: 0, mt: 1, display: 'grid', gridTemplateColumns: 'auto 1fr', columnGap: 2, rowGap: 0.25 }}>
              <Typography component="dt" variant="body2" color="text.secondary">Article, page</Typography><Typography component="dd" variant="body2" sx={{ m: 0 }}>{r.article ? `${r.article}, page ${r.page}` : 'à obtenir'}</Typography>
              <Typography component="dt" variant="body2" color="text.secondary">Date d’effet</Typography><Typography component="dd" variant="body2" sx={{ m: 0 }}>{r.effectiveDate ? formatDate(r.effectiveDate) : '—'}</Typography>
              <Typography component="dt" variant="body2" color="text.secondary">Source</Typography><Typography component="dd" variant="body2" sx={{ m: 0 }}>{r.source ?? r.sourceToObtain ?? '—'}</Typography>
              <Typography component="dt" variant="body2" color="text.secondary">Auteur</Typography><Typography component="dd" variant="body2" sx={{ m: 0 }}>{r.author}</Typography>
              <Typography component="dt" variant="body2" color="text.secondary">Validations</Typography>
              <Typography component="dd" variant="body2" sx={{ m: 0 }}>
                {r.validations.length === 0 ? 'aucune' : r.validations.map((v) => `${v.role === 'LEGAL' ? 'juridique' : 'comptable'} : ${v.validator}`).join(' ; ')}
              </Typography>
            </Box>
            <Stack direction="row" sx={{ gap: 1, flexWrap: 'wrap', mt: 1.5 }}>
              {user.role === 'admin' && r.kind === 'REAL' && <Button variant="outlined" onClick={() => setEditing(r)}>Renseigner</Button>}
              {user.role === 'validator' && r.kind === 'REAL' && r.status !== 'PENDING' && r.status !== 'CONFIRMED' &&
                !r.validations.some((v) => v.role === user.specialty) && r.author !== user.email && (
                <Button variant="contained" onClick={() => validate(r)}>Valider ({user.specialty === 'LEGAL' ? 'juridique' : 'comptable'})</Button>
              )}
            </Stack>
          </CardContent>
        </Card>
      ))}
      {editing && <ReviseDialog rule={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load(); }} />}
    </Stack>
  );
}

function Versions() {
  const { user, notify } = useApp();
  const [snaps, setSnaps] = useState<{ version: string; publishedAt: string; hash: string }[]>([]);
  const [version, setVersion] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [diff, setDiff] = useState<{ ruleId: string; change: string; fields: string[] }[] | null>(null);
  const [commercial, setCommercial] = useState<Awaited<ReturnType<typeof api.commercial>> | null>(null);
  const load = useCallback(() => { api.snapshots().then(setSnaps).catch((e: Error) => notify(e.message)); }, [notify]);
  useEffect(load, [load]);
  useEffect(() => { if (user.role === 'admin') api.commercial().then(setCommercial).catch(() => undefined); }, [user.role]);

  return (
    <Stack spacing={3}>
      <Box component="section" aria-labelledby="snaps-title">
        <Typography id="snaps-title" variant="h4" component="h2" sx={{ mb: 1 }}>Versions publiées</Typography>
        <Stack component="ul" sx={{ p: 0, m: 0 }} spacing={1}>
          {snaps.map((s) => (
            <Card component="li" key={s.version} sx={{ listStyle: 'none' }}><CardContent sx={{ py: 1.5 }}>
              <Typography sx={{ fontWeight: 700 }}>{s.version}</Typography>
              <Typography variant="body2" color="text.secondary">Publiée le {formatDate(s.publishedAt.slice(0, 10))} · empreinte {s.hash.slice(0, 12)}…</Typography>
            </CardContent></Card>
          ))}
        </Stack>
        {user.role === 'admin' && (
          <Stack direction="row" sx={{ gap: 2, alignItems: 'flex-start', flexWrap: 'wrap', mt: 2 }}>
            <TextField label="Nouvelle version (vX.Y.Z)" value={version} onChange={(e) => setVersion(e.target.value)} />
            <Button variant="contained" sx={{ mt: 0.5 }} disabled={!/^v\d+\.\d+\.\d+$/.test(version)}
              onClick={() => api.publish(version).then(() => { notify(`Version ${version} publiée.`); setVersion(''); load(); }).catch((e: Error) => notify(e.message))}>
              Publier
            </Button>
          </Stack>
        )}
      </Box>
      <Box component="section" aria-labelledby="diff-title">
        <Typography id="diff-title" variant="h4" component="h2" sx={{ mb: 1 }}>Comparer deux versions</Typography>
        <Stack direction="row" sx={{ gap: 2, alignItems: 'flex-start', flexWrap: 'wrap' }}>
          <TextField select label="De" value={from} onChange={(e) => setFrom(e.target.value)} sx={{ minWidth: 160 }}>
            {snaps.map((s) => <MenuItem key={s.version} value={s.version}>{s.version}</MenuItem>)}
          </TextField>
          <TextField select label="À" value={to} onChange={(e) => setTo(e.target.value)} sx={{ minWidth: 160 }}>
            {snaps.map((s) => <MenuItem key={s.version} value={s.version}>{s.version}</MenuItem>)}
          </TextField>
          <Button variant="outlined" sx={{ mt: 0.5 }} disabled={!from || !to}
            onClick={() => api.diff(from, to).then(setDiff).catch((e: Error) => notify(e.message))}>Comparer</Button>
        </Stack>
        {diff && (
          diff.length === 0 ? <Typography sx={{ mt: 2 }}>Aucune différence entre ces deux versions.</Typography> : (
            <Box component="ul" sx={{ mt: 2, pl: 2.5 }} data-testid="diff">
              {diff.map((d) => <li key={d.ruleId}><Typography><b>{d.ruleId}</b> : {d.change === 'ADDED' ? 'ajoutée' : d.change === 'REMOVED' ? 'retirée' : `modifiée (${d.fields.join(', ')})`}</Typography></li>)}
            </Box>
          )
        )}
      </Box>
      {commercial && (
        <Box component="section" aria-labelledby="com-title">
          <Typography id="com-title" variant="h4" component="h2" sx={{ mb: 1 }}>Paramètres commerciaux</Typography>
          <Card><CardContent>
            <Typography>Commission : {commercial.commissionRate.num}/{commercial.commissionRate.den} du montant net positif, HT. TVA : {commercial.vatRate.num}/{commercial.vatRate.den}. Plafond : {commercial.commissionCap ?? 'aucun'}.</Typography>
            <FormControlLabel sx={{ mt: 1 }} label="Paramètres validés par MARABU (requis pour afficher une commission à un client)"
              control={<Switch checked={commercial.validated} onChange={(e) => {
                const next = { ...commercial, validated: e.target.checked };
                api.setCommercial(next).then(() => { setCommercial(next); notify('Paramètres commerciaux mis à jour.'); }).catch((err: Error) => notify(err.message));
              }} />} />
          </CardContent></Card>
        </Box>
      )}
    </Stack>
  );
}

function Audit() {
  const { notify } = useApp();
  const [data, setData] = useState<Awaited<ReturnType<typeof api.audit>> | null>(null);
  useEffect(() => { api.audit().then(setData).catch((e: Error) => notify(e.message)); }, [notify]);
  if (!data) return null;
  return (
    <Stack spacing={2}>
      <Alert severity={data.intact ? 'success' : 'error'}>{data.intact ? 'Chaîne d’empreintes intacte : aucune entrée n’a été modifiée.' : 'Chaîne d’empreintes rompue : le journal a été altéré.'}</Alert>
      <Stack component="ol" sx={{ p: 0, m: 0 }} spacing={1} aria-label="Journal d’audit, lecture seule">
        {[...data.entries].reverse().map((e) => (
          <Card component="li" key={e.seq} sx={{ listStyle: 'none' }}><CardContent sx={{ py: 1.5 }}>
            <Typography variant="body2" color="text.secondary">n° {e.seq} · {e.at.slice(0, 16).replace('T', ' ')} · {e.actor}</Typography>
            <Typography>{e.action} — {e.target}</Typography>
          </CardContent></Card>
        ))}
      </Stack>
    </Stack>
  );
}

export default function Registry() {
  const [tab, setTab] = useState(0);
  return (
    <Stack spacing={2} component="section" aria-labelledby="reg-title">
      <Typography id="reg-title" variant="h3" component="h1">Registre des règles</Typography>
      <Tabs value={tab} onChange={(_e, v: number) => setTab(v)} aria-label="Sections du registre" variant="scrollable" scrollButtons={false}>
        <Tab label="Règles" id="tab-0" aria-controls="panel-0" sx={{ minHeight: 48 }} />
        <Tab label="Versions" id="tab-1" aria-controls="panel-1" sx={{ minHeight: 48 }} />
        <Tab label="Journal d’audit" id="tab-2" aria-controls="panel-2" sx={{ minHeight: 48 }} />
      </Tabs>
      <Box role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`}>
        {tab === 0 && <Rules />}
        {tab === 1 && <Versions />}
        {tab === 2 && <Audit />}
      </Box>
    </Stack>
  );
}
