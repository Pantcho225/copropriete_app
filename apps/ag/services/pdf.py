from decimal import Decimal
from urllib.parse import quote

from django.conf import settings
from django.db.models import Sum
from django.http import HttpResponse
from django.template.loader import render_to_string
from django.utils import timezone

from weasyprint import HTML

from apps.ag.models import PresenceLot, Resolution, Vote

DEC0 = Decimal("0.00")


def _decision_for_resolution(resolution: Resolution) -> dict:
    """
    Calcule les résultats d'une résolution :
    - tantièmes pour / contre / abstention / exprimés
    - ratio POUR / exprimés
    - décision selon type_majorite
    """
    agg = (
        Vote.objects.filter(resolution_id=resolution.id)
        .values("choix")
        .annotate(t=Sum("tantiemes"))
    )
    by = {row["choix"]: Decimal(str(row["t"] or 0)) for row in agg}

    pour = by.get("POUR", DEC0)
    contre = by.get("CONTRE", DEC0)
    abstention = by.get("ABSTENTION", DEC0)
    exprimes = pour + contre  # abstention non exprimée

    decision = "REJETEE"
    maj = resolution.type_majorite

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

    ratio = (pour / exprimes) if exprimes > 0 else DEC0

    return {
        "pour": pour,
        "contre": contre,
        "abstention": abstention,
        "exprimes": exprimes,
        "ratio_pour_exprimes": ratio,
        "decision": decision,
        "type_majorite_code": maj,
        "type_majorite_label": getattr(resolution, "get_type_majorite_display", lambda: maj)(),
    }


def _build_base_url(request=None) -> str | None:
    """
    base_url sert à WeasyPrint pour résoudre les ressources (/static, /media).
    En prod, request.build_absolute_uri('/') est le plus fiable.
    En dev sans request, BASE_DIR aide à résoudre des chemins locaux.
    """
    if request:
        return request.build_absolute_uri("/")
    base_dir = getattr(settings, "BASE_DIR", None)
    return str(base_dir) if base_dir else None


def _media_url(request, file_field) -> str | None:
    """
    Retourne une URL absolue pour un FileField/ImageField si possible.
    """
    if not file_field:
        return None
    try:
        url = file_field.url
    except Exception:
        return None

    return request.build_absolute_uri(url) if request else url


def generate_ag_pv_pdf_bytes(ag, request=None) -> bytes:
    """
    Génère et retourne le PV en bytes (WeasyPrint).
    À utiliser pour :
    - signature PAdES (pyHanko)
    - archivage FileField (pv_pdf)
    """
    presences = (
        PresenceLot.objects
        .filter(ag_id=ag.id)
        .select_related("lot")
        .order_by("lot__reference", "lot_id")
    )

    total_tantiemes_copro = ag.total_tantiemes_copro()
    tantiemes_presents = Decimal(str(ag.total_tantiemes_presents() or DEC0))
    quorum_ok = ag.quorum_atteint()

    resolutions = Resolution.objects.filter(ag_id=ag.id).order_by("ordre", "id")

    resolutions_rows = []
    for r in resolutions:
        res_data = _decision_for_resolution(r)
        resolutions_rows.append(
            {
                "id": r.id,
                "ordre": r.ordre,
                "titre": r.titre,
                "texte": getattr(r, "texte", "") or "",
                "cloturee": bool(getattr(r, "cloturee", False)),
                **res_data,
            }
        )

    # Signatures visuelles optionnelles
    signature_president_url = _media_url(request, getattr(ag, "signature_president", None))
    signature_secretaire_url = _media_url(request, getattr(ag, "signature_secretaire", None))
    cachet_image_url = _media_url(request, getattr(ag, "cachet_image", None))

    generated_at = timezone.now()

    copropriete_label = str(getattr(ag, "copropriete", "") or "")
    exercice_label = str(getattr(ag, "exercice", "") or "")

    pv_signed_at = getattr(ag, "pv_signed_at", None)
    pv_signer_subject = getattr(ag, "pv_signer_subject", "") or ""
    pv_locked = bool(getattr(ag, "pv_locked", False))

    # État documentaire / signature
    has_visual_signatures = bool(
        signature_president_url or signature_secretaire_url or cachet_image_url
    )

    # Détection plus robuste de la signature numérique
    has_digital_signature = bool(
        getattr(ag, "pv_signed_pdf", None) or pv_signed_at
    )

    # Message volontairement neutre et toujours vrai,
    # pour éviter qu’un PDF archivé puis signé garde un faux bandeau “non signé”.
    pv_signature_state = "INFORMATION_DOCUMENTAIRE"
    pv_signature_message = (
        "Ce procès-verbal peut faire l’objet d’une signature numérique (PAdES). "
        "L’état réel de signature doit être vérifié dans le lecteur PDF "
        "ou dans le registre documentaire de l’application."
    )

    context = {
        "ag": ag,
        "generated_at": generated_at,
        "total_tantiemes_copro": total_tantiemes_copro,
        "tantiemes_presents": tantiemes_presents,
        "quorum_ok": quorum_ok,
        "presences": presences,
        "resolutions_rows": resolutions_rows,

        # Entête
        "copropriete_label": copropriete_label,
        "exercice_label": exercice_label,

        # État signature / traçabilité
        "pv_signed_at": pv_signed_at,
        "pv_signer_subject": pv_signer_subject,
        "pv_locked": pv_locked,
        "pv_signature_state": pv_signature_state,
        "pv_signature_message": pv_signature_message,
        "has_digital_signature": has_digital_signature,
        "has_visual_signatures": has_visual_signatures,

        # Signataires métier
        "president_nom": getattr(ag, "president_nom", "") or "",
        "secretaire_nom": getattr(ag, "secretaire_nom", "") or "",

        # URLs images
        "signature_president_url": signature_president_url,
        "signature_secretaire_url": signature_secretaire_url,
        "cachet_image_url": cachet_image_url,
    }

    html_string = render_to_string("ag/pv_pdf.html", context)
    pdf_bytes = HTML(
        string=html_string,
        base_url=_build_base_url(request),
    ).write_pdf()

    return pdf_bytes


def generate_ag_pv_pdf(ag, request=None):
    """
    Génère le PV PDF et le renvoie en inline HTTP.
    """
    pdf_bytes = generate_ag_pv_pdf_bytes(ag, request=request)
    if not pdf_bytes:
        return HttpResponse("Erreur génération PDF", status=500)

    filename = quote(f"PV-AG-{ag.id:05d}.pdf")
    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'inline; filename="{filename}"'
    return response