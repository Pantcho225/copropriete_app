import { useEffect, useState } from "react";
import { relancesAPI } from "../../api/relances";

type DossierImpayeItem = {
  id: number;
  lot?: string | number | null;
  coproprietaire_nom?: string | null;
  montant_initial?: string | number | null;
  montant_paye?: string | number | null;
  reste_a_payer?: string | number | null;
  niveau_relance?: string | number | null;
};

export default function DossiersImpayes() {
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DossierImpayeItem[]>([]);

  useEffect(() => {
    relancesAPI
      .getDossiers()
      .then((items) => setData(items))
      .catch((error) => {
        console.error("Erreur chargement dossiers impayés :", error);
        setData([]);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Chargement...</p>;

  if (!data.length) return <p>Aucun dossier impayé</p>;

  return (
    <div>
      <h2>Dossiers impayés</h2>

      <table style={{ width: "100%", marginTop: 20 }}>
        <thead>
          <tr>
            <th>Lot</th>
            <th>Propriétaire</th>
            <th>Montant initial</th>
            <th>Payé</th>
            <th>Reste</th>
            <th>Niveau</th>
          </tr>
        </thead>

        <tbody>
          {data.map((d) => (
            <tr key={d.id}>
              <td>{d.lot ?? "-"}</td>
              <td>{d.coproprietaire_nom ?? "-"}</td>
              <td>{d.montant_initial ?? "-"}</td>
              <td>{d.montant_paye ?? "-"}</td>
              <td style={{ color: "red", fontWeight: 700 }}>
                {d.reste_a_payer ?? "-"}
              </td>
              <td>{d.niveau_relance ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}