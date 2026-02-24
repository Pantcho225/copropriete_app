# apps/billing/services/pdf.py

import base64
from decimal import Decimal
from io import BytesIO
from urllib.parse import quote

import qrcode
from django.conf import settings
from django.http import HttpResponse
from django.template.loader import render_to_string
from weasyprint import HTML


DEC0 = Decimal("0.00")


def generate_relance_pdf(relance, request=None):
    """
    Génère un PDF de relance (WeasyPrint) + QR code de vérification.

    ✅ Inclus :
    - URL de vérification recommandée (sécurisée) : /api/billing/public/qr/<uuid>/
    - montant_paye_affiche (capé) : min(montant_paye_brut, montant_du)
    - trop_percu (si payé > dû)
    - option show_brut (settings.PDF_SHOW_BRUT_PAYMENT) pour afficher ou non le brut dans le PDF

    Contexte template fourni:
    - relance, ligne, restant, trop_percu
    - montant_paye_affiche, montant_paye_brut
    - qr (data URI), verify_url
    - show_brut (bool)
    """

    # --- Options (template) ---
    show_brut = bool(getattr(settings, "PDF_SHOW_BRUT_PAYMENT", False))

    # --- Ligne + montants ---
    ligne = None
    restant = None
    trop_percu = None
    montant_paye_affiche = None
    montant_paye_brut = None

    if relance.appel_id:
        # import local (évite imports circulaires)
        from apps.billing.models import LigneAppelDeFonds

        ligne = (
            LigneAppelDeFonds.objects
            .filter(appel_id=relance.appel_id, lot_id=relance.lot_id)
            .first()
        )

        if ligne:
            du = Decimal(str(ligne.montant_du or DEC0))
            paye_brut = Decimal(str(ligne.montant_paye or DEC0))

            # ✅ payé corrigé (capé)
            paye_cape = min(paye_brut, du)

            restant = du - paye_cape
            if restant < 0:
                restant = DEC0

            trop_percu = paye_brut - du
            if trop_percu < 0:
                trop_percu = DEC0

            montant_paye_affiche = paye_cape
            montant_paye_brut = paye_brut

    # --- URL publique de vérification (QR) ---
    # Route réelle dans apps/billing/urls.py :
    # /api/billing/public/qr/<uuid:token>/
    token = getattr(relance, "qr_token", None)
    if not token:
        # Si jamais (cas très rare), on fallback sur l'ancienne route pk+token
        # mais normalement qr_token est toujours présent.
        legacy_path = f"/api/billing/public/relances/{relance.id}/verify/"
        if request:
            verify_url = request.build_absolute_uri(legacy_path)
        else:
            base_url = getattr(settings, "PUBLIC_BASE_URL", "") or "http://127.0.0.1:8002"
            verify_url = f"{base_url}{legacy_path}"
        verify_url = f"{verify_url}?token="
    else:
        path = f"/api/billing/public/qr/{token}/"
        if request:
            verify_url = request.build_absolute_uri(path)
        else:
            # ✅ fallback configurable (recommandé en prod)
            base_url = getattr(settings, "PUBLIC_BASE_URL", "") or "http://127.0.0.1:8002"
            verify_url = f"{base_url}{path}"

    # --- QR code en base64 ---
    qr_img = qrcode.make(verify_url)
    buf = BytesIO()
    qr_img.save(buf, format="PNG")
    qr_b64 = base64.b64encode(buf.getvalue()).decode("utf-8")
    qr_data_uri = f"data:image/png;base64,{qr_b64}"

    # --- Render HTML template ---
    html_string = render_to_string(
        "billing/relance_pdf.html",
        {
            "relance": relance,
            "ligne": ligne,
            "restant": restant,
            "trop_percu": trop_percu,
            "montant_paye_affiche": montant_paye_affiche,  # ✅ capé
            "montant_paye_brut": montant_paye_brut,        # ✅ brut
            "show_brut": show_brut,                        # ✅ option d'affichage
            "qr": qr_data_uri,
            "verify_url": verify_url,
        },
    )

    # --- HTML -> PDF ---
    pdf_bytes = HTML(string=html_string).write_pdf()

    # Nom de fichier propre (évite espaces/accents qui cassent certains navigateurs)
    base_name = relance.numero or f"RL-{relance.id:05d}"
    filename = quote(f"{base_name}.pdf")

    response = HttpResponse(pdf_bytes, content_type="application/pdf")
    response["Content-Disposition"] = f'inline; filename="{filename}"'
    return response