import type { ReactNode } from 'react';

type ModuleSectionProps = {
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
};

export default function ModuleSection({
  eyebrow,
  title,
  subtitle,
  actions,
  children,
}: ModuleSectionProps) {
  return (
    <section className="moduleSection">
      {(eyebrow || title || subtitle || actions) ? (
        <div className="moduleSection__header">
          <div className="moduleSection__copy">
            {eyebrow ? <div className="moduleSection__eyebrow">{eyebrow}</div> : null}
            {title ? <h2>{title}</h2> : null}
            {subtitle ? <p>{subtitle}</p> : null}
          </div>

          {actions ? <div className="moduleSection__actions">{actions}</div> : null}
        </div>
      ) : null}

      <div className="moduleSection__body">{children}</div>
    </section>
  );
}
