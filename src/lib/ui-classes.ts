/**
 * Shared visual classes for the ColdFox interface.
 * One place for the neumorphic control styles, so every screen uses the
 * same radius, the same inset depth and the same motion.
 */

/** Inset field: sits into the surface. */
export const fieldCls =
  'rounded-[10px] border border-transparent bg-input text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] placeholder:text-muted-foreground focus:border-ring focus:ring-[3px] focus:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-60';

/** Primary action: the icy blue fill, raised. */
export const primaryBtnCls =
  'inline-flex items-center justify-center gap-2 rounded-[10px] bg-primary text-sm font-medium text-primary-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform,filter] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:brightness-[1.07] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50';

/** Secondary action: a raised neutral surface. */
export const secondaryBtnCls =
  'inline-flex items-center justify-center gap-2 rounded-[10px] bg-card text-sm font-medium text-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px hover:shadow-[var(--shadow-raised)] active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:pointer-events-none disabled:opacity-50';

/** Quiet action: text only, no surface. */
export const ghostBtnCls =
  'inline-flex items-center justify-center gap-2 rounded-[10px] px-3 py-2 text-sm font-medium text-muted-foreground transition-[color,background-color,box-shadow] duration-[var(--dur)] ease-[var(--ease)] hover:bg-muted hover:text-foreground disabled:opacity-50';

/** Destructive action. */
export const dangerBtnCls =
  'inline-flex items-center justify-center gap-2 rounded-[10px] bg-destructive px-4 py-2 text-sm font-medium text-destructive-foreground shadow-[var(--shadow-raised-sm)] transition-[box-shadow,transform] duration-[var(--dur)] ease-[var(--ease)] hover:-translate-y-px active:translate-y-0 active:shadow-[var(--shadow-inset-sm)] disabled:opacity-50';

/** Search field with the icon slot. */
export const searchFieldCls =
  'w-full rounded-[10px] bg-input py-2 pl-9 pr-3 text-sm shadow-[var(--shadow-inset-sm)] outline-none transition-[box-shadow] duration-[var(--dur)] ease-[var(--ease)] focus:border-ring focus:ring-[3px] focus:ring-ring/50';

/** Raised card surface. */
export const cardCls = 'neu-card rounded-[16px]';

/** Inset well for grouped data. */
export const insetCls = 'rounded-[10px] neu-inset-sm';

/** Page frame for app screens. */
export const pageCls = 'mx-auto max-w-[1440px] space-y-6 px-6 py-6 lg:px-8 lg:py-8';
