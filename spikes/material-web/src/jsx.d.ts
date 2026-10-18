import type { MdAssistChip } from '@material/web/chips/assist-chip.js';
import type { MdFilledButton } from '@material/web/button/filled-button.js';
import type { MdOutlinedTextField } from '@material/web/textfield/outlined-text-field.js';
import type { MdNavigationBar } from '@material/web/labs/navigationbar/navigation-bar.js';
import type { MdNavigationTab } from '@material/web/labs/navigationtab/navigation-tab.js';
import type { DetailedHTMLProps, HTMLAttributes } from 'react';

type El<T> = DetailedHTMLProps<HTMLAttributes<T>, T> & Partial<Omit<T, keyof HTMLElement>> & { [k: string]: unknown };

declare module 'react' {
  namespace JSX {
    interface IntrinsicElements {
      'md-assist-chip': El<MdAssistChip>;
      'md-filled-button': El<MdFilledButton>;
      'md-outlined-text-field': El<MdOutlinedTextField>;
      'md-navigation-bar': El<MdNavigationBar>;
      'md-navigation-tab': El<MdNavigationTab>;
    }
  }
}
