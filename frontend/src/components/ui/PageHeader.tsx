import type { ReactNode } from 'react';
import BackButton from './BackButton';

type PageHeaderProps = {
  title: string;
  subtitle?: string;
  backTo?: string;
  backLabel?: string;
  actions?: ReactNode;
};

export default function PageHeader({
  title,
  subtitle,
  backTo,
  backLabel,
  actions,
}: PageHeaderProps) {
  return (
    <header className="pageHeader">
      <div className="pageHeader__top">
        {backTo || backLabel ? (
          <BackButton to={backTo} label={backLabel ?? 'Retour'} />
        ) : null}

        {actions ? <div className="pageHeader__actions">{actions}</div> : null}
      </div>

      <div className="pageHeader__content">
        <h1>{title}</h1>
        {subtitle ? <p>{subtitle}</p> : null}
      </div>
    </header>
  );
}
