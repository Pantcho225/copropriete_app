import type { ReactNode } from 'react';

type ModuleHeroProps = {
  eyebrow?: string;
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  aside?: ReactNode;
  children?: ReactNode;
};

export default function ModuleHero({
  eyebrow,
  title,
  subtitle,
  actions,
  aside,
  children,
}: ModuleHeroProps) {
  return (
    <section className="moduleHero">
      <div className="moduleHero__grid">
        <div className="moduleHero__main">
          {eyebrow ? <div className="moduleHero__eyebrow">{eyebrow}</div> : null}

          <div className="moduleHero__copy">
            <h2>{title}</h2>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>

          {children ? <div className="moduleHero__body">{children}</div> : null}
          {actions ? <div className="moduleHero__actions">{actions}</div> : null}
        </div>

        {aside ? <aside className="moduleHero__aside">{aside}</aside> : null}
      </div>
    </section>
  );
}
