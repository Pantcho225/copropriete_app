import { Link } from "react-router-dom";

type StatTone = "blue" | "green" | "yellow" | "purple";

type StatCardProps = {
  label: string;
  value: string;
  description: string;
  tone: StatTone;
};

const statToneClasses: Record<StatTone, string> = {
  blue: "border-blue-100 bg-blue-50 text-blue-700",
  green: "border-emerald-100 bg-emerald-50 text-emerald-700",
  yellow: "border-amber-100 bg-amber-50 text-amber-700",
  purple: "border-violet-100 bg-violet-50 text-violet-700",
};

function StatCard({ label, value, description, tone }: StatCardProps) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
      <div
        className={`mb-4 inline-flex rounded-full border px-3 py-1 text-xs font-semibold ${statToneClasses[tone]}`}
      >
        {label}
      </div>

      <div className="text-3xl font-bold text-slate-900">{value}</div>

      <p className="mt-2 text-sm leading-6 text-slate-500">{description}</p>
    </div>
  );
}

type QuickActionProps = {
  title: string;
  description: string;
  to: string;
  label: string;
};

function QuickAction({ title, description, to, label }: QuickActionProps) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>

      <p className="mt-2 min-h-[48px] text-sm leading-6 text-slate-500">
        {description}
      </p>

      <Link
        to={to}
        className="mt-5 inline-flex items-center justify-center rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
      >
        {label}
      </Link>
    </div>
  );
}

export default function RHHome() {
  return (
    <div className="space-y-8">
      <section className="overflow-hidden rounded-3xl border border-slate-100 bg-gradient-to-br from-slate-950 via-slate-900 to-blue-950 p-6 text-white shadow-sm md:p-8">
        <div className="max-w-4xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-blue-200">
            Ressources humaines
          </p>

          <h1 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
            Pilotez vos employés, contrats et affectations avec une vision
            claire.
          </h1>

          <p className="mt-4 max-w-3xl text-sm leading-7 text-slate-200 md:text-base">
            Le module RH centralise le suivi des employés, la gestion des
            contrats, les statuts d’activité et les informations utiles à la
            bonne administration de la copropriété.
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              to="/rh/employes"
              className="rounded-xl bg-white px-4 py-2 text-sm font-semibold text-slate-900 transition hover:bg-slate-100"
            >
              Voir les employés
            </Link>

            <Link
              to="/rh/contrats"
              className="rounded-xl border border-white/30 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10"
            >
              Voir les contrats
            </Link>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Effectif"
          value="—"
          description="Nombre total d’employés enregistrés dans la copropriété active."
          tone="blue"
        />

        <StatCard
          label="Actifs"
          value="—"
          description="Employés actuellement actifs et disponibles pour les opérations courantes."
          tone="green"
        />

        <StatCard
          label="Contrats"
          value="—"
          description="Contrats enregistrés, en cours, terminés ou à venir."
          tone="purple"
        />

        <StatCard
          label="À surveiller"
          value="—"
          description="Contrats proches de leur échéance ou informations nécessitant une vérification."
          tone="yellow"
        />
      </section>

      <section className="grid gap-5 lg:grid-cols-2">
        <QuickAction
          title="Gestion des employés"
          description="Consultez la liste des employés, ajoutez un nouveau profil, modifiez les informations ou désactivez un employé."
          to="/rh/employes"
          label="Ouvrir les employés"
        />

        <QuickAction
          title="Gestion des contrats"
          description="Suivez les contrats de travail, les périodes, les montants, les statuts et les clôtures."
          to="/rh/contrats"
          label="Ouvrir les contrats"
        />
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-slate-900">
          Priorités de consolidation RH
        </h2>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">
              Wording produit
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Harmoniser les libellés : employés, contrats, statuts, rôles et
              messages d’action.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">
              Cohérence visuelle
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Aligner le module RH avec le niveau premium des modules AG,
              Relances, Comptabilité et Travaux.
            </p>
          </div>

          <div className="rounded-2xl bg-slate-50 p-4">
            <p className="text-sm font-semibold text-slate-900">
              Stabilité technique
            </p>
            <p className="mt-2 text-sm leading-6 text-slate-500">
              Vérifier routes, endpoints, hooks, lint, build et comportements
              d’activation ou de clôture.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}