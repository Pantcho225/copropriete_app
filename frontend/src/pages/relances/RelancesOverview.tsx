import { useEffect, useState } from "react";
import { relancesAPI } from "../../api/relances";

export default function RelancesOverview() {
  const [loading, setLoading] = useState(true);
  const [dossiers, setDossiers] = useState<any[]>([]);
  const [relances, setRelances] = useState<any[]>([]);

  useEffect(() => {
    Promise.all([
      relancesAPI.getDossiers(),
      relancesAPI.getRelances(),
    ])
      .then(([d, r]) => {
        setDossiers(d.data);
        setRelances(r.data);
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p>Chargement des relances...</p>;

  const totalImpayes = dossiers.reduce(
    (acc, d) => acc + parseFloat(d.reste_a_payer || 0),
    0
  );

  return (
    <div>
      <h2>Vue d’ensemble des relances</h2>

      <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
        <Card title="Dossiers impayés" value={dossiers.length} />
        <Card title="Relances envoyées" value={relances.length} />
        <Card title="Montant impayé" value={`${totalImpayes} FCFA`} />
      </div>
    </div>
  );
}

function Card({ title, value }: any) {
  return (
    <div
      style={{
        padding: 20,
        borderRadius: 12,
        background: "#fff",
        border: "1px solid #eee",
        minWidth: 200,
      }}
    >
      <div style={{ fontSize: 13, color: "#888" }}>{title}</div>
      <div style={{ fontSize: 20, fontWeight: 800 }}>{value}</div>
    </div>
  );
}