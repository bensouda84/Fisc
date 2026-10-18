import '@material/web/button/filled-button.js';
import '@material/web/chips/assist-chip.js';
import '@material/web/chips/chip-set.js';
import '@material/web/labs/navigationbar/navigation-bar.js';
import '@material/web/labs/navigationtab/navigation-tab.js';
import '@material/web/textfield/outlined-text-field.js';
import '@fontsource/mulish/400.css';
import '@fontsource/mulish/700.css';
import { createRoot } from 'react-dom/client';
import { CHIPS, applyTokens, dark, initialScheme, light } from './tokens.ts';

const scheme = initialScheme();
applyTokens(scheme === 'dark' ? dark : light, scheme);
const t = scheme === 'dark' ? dark : light;

// React 19 transmet attributs et propriétés aux éléments personnalisés sans adaptateur ; seul le typage JSX est à déclarer.
const Icon = ({ d }: { d: string }) => (
  <svg slot="icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" fill="currentColor"><path d={d} /></svg>
);

function App() {
  return (
    <main style={{ fontFamily: 'Mulish, sans-serif', padding: 16, maxWidth: 480 }}>
      <h1>Essai Material Web</h1>
      <ul style={{ listStyle: 'none', padding: 0, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {CHIPS.map((c) => (
          <li key={c.id} data-chip={c.id}>
            {/* Aucun chip « statut » dans Material Web : le plus proche est assist-chip, un contrôle interactif (role=button). */}
            <md-assist-chip
              label={c.label}
              elevated
              style={{
                '--md-assist-chip-container-height': '32px',
                '--md-assist-chip-label-text-color': t[c.fg],
                '--md-assist-chip-leading-icon-color': t[c.fg],
                '--md-assist-chip-icon-size': '18px',
                '--md-assist-chip-outline-color': 'transparent',
                // Pas de couleur de fond pour le chip « plat » : seule la variante `elevated` en accepte une.
                '--md-assist-chip-elevated-container-color': t[c.bg],
                '--md-assist-chip-elevated-container-shadow-color': 'transparent',
                '--md-assist-chip-label-text-weight': '700',
              } as React.CSSProperties}
            >
              <Icon d={c.path} />
            </md-assist-chip>
          </li>
        ))}
      </ul>
      <md-outlined-text-field label="Bénéfice imposable (F CFA)" value="" style={{ width: '100%', '--md-outlined-text-field-container-shape': '12px' } as React.CSSProperties} />
      <p>
        <md-filled-button style={{ '--md-filled-button-container-height': '48px' } as React.CSSProperties}>Continuer</md-filled-button>
      </p>
      <md-navigation-bar activeIndex={0} aria-label="Navigation principale" style={{ position: 'fixed', bottom: 0, left: 0, right: 0 }}>
        <md-navigation-tab label="Diagnostic" />
        <md-navigation-tab label="Résultat" />
        <md-navigation-tab label="Simulation" />
      </md-navigation-bar>
    </main>
  );
}

createRoot(document.getElementById('root')!).render(<App />);
