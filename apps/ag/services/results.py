from __future__ import annotations

from decimal import Decimal

from django.db.models import Sum

from ..models import Resolution, Vote


def compute_resolution_result(res: Resolution) -> dict:
    agg = (
        Vote.objects.filter(resolution_id=res.id)
        .values("choix")
        .annotate(t=Sum("tantiemes"))
    )
    by = {row["choix"]: Decimal(str(row["t"] or 0)) for row in agg}

    pour = by.get("POUR", Decimal("0"))
    contre = by.get("CONTRE", Decimal("0"))
    abst = by.get("ABSTENTION", Decimal("0"))
    exprimes = pour + contre

    def ratio(x: Decimal, denom: Decimal) -> float:
        return float(x / denom) if denom and denom > 0 else 0.0

    decision = "REJETEE"
    maj = res.type_majorite

    if maj == "SIMPLE":
        if pour > contre:
            decision = "ADOPTEE"
    elif maj == "ABSOLUE":
        if exprimes > 0 and pour > (exprimes * Decimal("0.50")):
            decision = "ADOPTEE"
    elif maj == "QUALIFIEE_2_3":
        if exprimes > 0 and pour >= (exprimes * Decimal("0.6667")):
            decision = "ADOPTEE"
    elif maj == "UNANIMITE":
        if exprimes > 0 and contre == 0 and pour == exprimes:
            decision = "ADOPTEE"

    return {
        "resolution_id": res.id,
        "type_majorite": maj,
        "tantiemes": {
            "pour": float(pour),
            "contre": float(contre),
            "abstention": float(abst),
            "exprimes": float(exprimes),
            "ratio_pour_exprimes": ratio(pour, exprimes),
        },
        "decision": decision,
    }