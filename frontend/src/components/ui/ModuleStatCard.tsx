type ModuleStatTone = 'neutral' | 'blue' | 'green' | 'amber' | 'red' | 'purple';

type ModuleStatCardProps = {
  label: string;
  value: string | number;
  hint?: string;
  tone?: ModuleStatTone;
};

export default function ModuleStatCard({
  label,
  value,
  hint,
  tone = 'neutral',
}: ModuleStatCardProps) {
  return (
    <article className={`moduleStatCard moduleStatCard--${tone}`}>
      <div className="moduleStatCard__label">{label}</div>
      <div className="moduleStatCard__value">{value}</div>
      {hint ? <div className="moduleStatCard__hint">{hint}</div> : null}
    </article>
  );
}
