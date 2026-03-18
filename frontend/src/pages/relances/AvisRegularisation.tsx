import { useEffect, useState } from "react";
import { relancesAPI } from "../../api/relances";

type AvisRegularisationItem = {
  id: number;
  lot?: string | number | null;
  montant_total_regle?: string | number | null;
  statut?: string | null;
  created_at?: string | null;
};

export default function AvisRegularisation() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AvisRegularisationItem[]>([]);

  useEffect(() => {
    relancesAPI
      .getAvis()
      .then((items) => setData(items))
      .catch((error) => {
        console.error("Erreur chargement avis de régularisation :", error);
        setData([]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Chargement...</p>;

  if (!data.length) return <p>Aucun avis de régularisation</p>;

  return (
    <div>
      <h2>Avis de régularisation</h2>

      <table style={{ width: "100%", marginTop: 20 }}>
        <thead>
          <tr>
            <th>Lot</th>
            <th>Montant</th>
            <th>Statut</th>
            <th>Date</th>
          </tr>
        </thead>

        <tbody>
          {data.map((a) => (
            <tr key={a.id}>
              <td>{a.lot ?? "-"}</td>
              <td>{a.montant_total_regle ?? "-"}</td>
              <td>{a.statut ?? "-"}</td>
              <td>{a.created_at ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}