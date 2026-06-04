# apps/documents/services/pdf.py
from __future__ import annotations

from decimal import Decimal, InvalidOperation
from hashlib import sha256
from html import escape
from uuid import uuid4

from django.core.files.base import ContentFile
from django.utils import timezone
from django.utils.text import slugify

from weasyprint import HTML

from apps.documents.models import GeneratedDocument


def _build_base_url(request=None) -> str | None:
    if request:
        return request.build_absolute_uri("/")

    try:
        from django.conf import settings

        return str(settings.BASE_DIR)
    except Exception:
        return None


def _value(obj, *names: str, default: str = "") -> str:
    if not obj:
        return default

    for name in names:
        value = getattr(obj, name, None)
        if value not in (None, ""):
            return str(value)

    return default


def _money(value) -> str:
    try:
        amount = Decimal(str(value or 0)).quantize(Decimal("1"))
    except (InvalidOperation, TypeError):
        amount = Decimal("0")

    return f"{amount:,.0f}".replace(",", " ") + " FCFA"


def _date(value) -> str:
    if not value:
        return ""

    try:
        if hasattr(value, "date"):
            value = value.date()
        return value.strftime("%d/%m/%Y")
    except Exception:
        return str(value)


def _owner_name(owner) -> str:
    if not owner:
        return "Copropriétaire"

    parts = [
        _value(owner, "prenom"),
        _value(owner, "nom"),
    ]
    name = " ".join(part for part in parts if part).strip()
    return name or str(owner)


def _lot_label(lot) -> str:
    if not lot:
        return "Lot"

    return (
        _value(lot, "numero")
        or _value(lot, "reference")
        or f"Lot #{getattr(lot, 'id', '')}"
    )


def _copro_name(copropriete) -> str:
    return (
        _value(copropriete, "nom")
        or _value(copropriete, "name")
        or _value(copropriete, "raison_sociale")
        or str(copropriete)
    )


def _copro_address(copropriete) -> str:
    return (
        _value(copropriete, "adresse")
        or _value(copropriete, "address")
        or _value(copropriete, "commune")
        or ""
    )


def _copro_phone(copropriete) -> str:
    return _value(copropriete, "telephone", "phone", "contact_phone")


def _copro_email(copropriete) -> str:
    return _value(copropriete, "email", "contact_email")


def _html_base(*, title: str, copropriete, reference: str, body_html: str) -> str:
    copro_name = escape(_copro_name(copropriete))
    copro_address = escape(_copro_address(copropriete))
    copro_phone = escape(_copro_phone(copropriete))
    copro_email = escape(_copro_email(copropriete))
    generated_at = timezone.localtime(timezone.now()).strftime("%d/%m/%Y à %H:%M")

    contact_line = " | ".join(
        part
        for part in [
            copro_address,
            f"Tél : {copro_phone}" if copro_phone else "",
            f"Email : {copro_email}" if copro_email else "",
        ]
        if part
    )

    return f"""
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">
  <title>{escape(title)}</title>
  <style>
    @page {{
      size: A4;
      margin: 22mm 18mm 20mm 18mm;
    }}

    body {{
      font-family: DejaVu Sans, Arial, sans-serif;
      color: #0f172a;
      font-size: 12px;
      line-height: 1.55;
    }}

    .header {{
      border-bottom: 2px solid #1e293b;
      padding-bottom: 12px;
      margin-bottom: 24px;
      text-align: center;
    }}

    .copro-name {{
      font-size: 19px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }}

    .contact {{
      margin-top: 4px;
      color: #475569;
      font-size: 10.5px;
    }}

    .doc-title {{
      margin-top: 18px;
      font-size: 16px;
      font-weight: 800;
      text-transform: uppercase;
      color: #111827;
    }}

    .reference {{
      margin-top: 5px;
      font-size: 10.5px;
      color: #64748b;
    }}

    .section {{
      margin-top: 18px;
    }}

    .box {{
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 12px;
      background: #f8fafc;
      margin: 14px 0;
    }}

    .grid {{
      width: 100%;
      border-collapse: collapse;
      margin-top: 10px;
    }}

    .grid td {{
      border: 1px solid #cbd5e1;
      padding: 8px;
      vertical-align: top;
    }}

    .label {{
      color: #475569;
      font-weight: 700;
      width: 34%;
      background: #f1f5f9;
    }}

    .signature-row {{
      margin-top: 40px;
      display: table;
      width: 100%;
    }}

    .signature-cell {{
      display: table-cell;
      width: 50%;
      text-align: center;
      padding-top: 20px;
    }}

    .signature-line {{
      display: inline-block;
      width: 210px;
      border-top: 1px solid #334155;
      padding-top: 7px;
      font-size: 11px;
      color: #334155;
    }}

    .footer {{
      position: fixed;
      bottom: -9mm;
      left: 0;
      right: 0;
      border-top: 1px solid #cbd5e1;
      padding-top: 6px;
      color: #64748b;
      font-size: 9px;
      text-align: center;
    }}

    .muted {{
      color: #64748b;
    }}

    .warning {{
      border-left: 4px solid #f59e0b;
      padding: 8px 10px;
      background: #fffbeb;
      margin-top: 16px;
      font-size: 11px;
    }}
  </style>
</head>
<body>
  <div class="header">
    <div class="copro-name">{copro_name}</div>
    <div class="contact">{contact_line}</div>
    <div class="doc-title">{escape(title)}</div>
    <div class="reference">Référence : {escape(reference)}</div>
  </div>

  {body_html}

  <div class="footer">
    Document généré par copropriete_app — {copro_name} — Référence : {escape(reference)} — Généré le {generated_at} — Page 1/1
  </div>
</body>
</html>
"""


def make_reference(prefix: str, source_id: int | str | None = None) -> str:
    today = timezone.localtime(timezone.now()).strftime("%Y%m%d")
    suffix = uuid4().hex[:6].upper()
    if source_id:
        return f"{prefix}-{today}-{source_id}-{suffix}"
    return f"{prefix}-{today}-{suffix}"


def render_pdf_bytes(html: str, *, request=None) -> bytes:
    return HTML(
        string=html,
        base_url=_build_base_url(request),
    ).write_pdf()


def generate_relance_impaye_pdf_bytes(
    *,
    dossier,
    relance=None,
    reference: str,
    request=None,
    message: str = "",
) -> bytes:
    copropriete = dossier.copropriete
    owner = getattr(dossier, "coproprietaire", None)
    lot = getattr(dossier, "lot", None)
    appel = getattr(dossier, "appel", None)

    owner_name = escape(_owner_name(owner))
    lot_label = escape(_lot_label(lot))
    reference_appel = escape(
        _value(dossier, "reference_appel")
        or _value(appel, "reference")
        or _value(appel, "titre")
        or str(appel)
    )

    montant_du = _money(getattr(dossier, "reste_a_payer", 0))
    montant_initial = _money(getattr(dossier, "montant_initial", 0))
    montant_paye = _money(getattr(dossier, "montant_paye", 0))
    date_echeance = _date(getattr(dossier, "date_echeance", None))

    if not message:
        message = (
            "Sauf erreur ou omission de notre part, nous constatons que le règlement "
            "des charges indiquées ci-dessous n’a pas encore été régularisé. "
            "Nous vous invitons à procéder au paiement dans les meilleurs délais ou "
            "à vous rapprocher du syndic pour toute clarification."
        )

    body = f"""
  <div class="section">
    <p>Madame, Monsieur,</p>

    <p>
      Le présent courrier vous est adressé au titre d’une relance pour impayé de charges
      concernant votre lot dans la copropriété.
    </p>

    <table class="grid">
      <tr>
        <td class="label">Copropriétaire concerné</td>
        <td>{owner_name}</td>
      </tr>
      <tr>
        <td class="label">Lot concerné</td>
        <td>{lot_label}</td>
      </tr>
      <tr>
        <td class="label">Appel / période</td>
        <td>{reference_appel}</td>
      </tr>
      <tr>
        <td class="label">Date d’échéance</td>
        <td>{escape(date_echeance)}</td>
      </tr>
      <tr>
        <td class="label">Montant initial</td>
        <td>{escape(montant_initial)}</td>
      </tr>
      <tr>
        <td class="label">Montant déjà réglé</td>
        <td>{escape(montant_paye)}</td>
      </tr>
      <tr>
        <td class="label">Reste à payer</td>
        <td><strong>{escape(montant_du)}</strong></td>
      </tr>
    </table>

    <div class="box">
      {escape(message).replace(chr(10), "<br>")}
    </div>

    <p>
      Nous vous remercions de bien vouloir régulariser cette situation ou de contacter
      le syndic si un paiement a déjà été effectué.
    </p>

    <div class="warning">
      Le texte juridique définitif de ce courrier doit rester configurable et validé
      par le syndic ou son conseil avant usage officiel.
    </div>

    <div class="signature-row">
      <div class="signature-cell"></div>
      <div class="signature-cell">
        <span class="signature-line">Le syndic / Gestionnaire</span>
      </div>
    </div>
  </div>
"""

    html = _html_base(
        title="Courrier de relance pour impayé de charges",
        copropriete=copropriete,
        reference=reference,
        body_html=body,
    )
    return render_pdf_bytes(html, request=request)


def generate_mandat_ag_pdf_bytes(
    *,
    ag,
    reference: str,
    request=None,
) -> bytes:
    copropriete = ag.copropriete

    ag_title = escape(getattr(ag, "titre", "") or f"Assemblée Générale #{ag.id}")
    ag_date = escape(_date(getattr(ag, "date_ag", None)))
    ag_lieu = escape(getattr(ag, "lieu", "") or "")

    body = f"""
  <div class="section">
    <table class="grid">
      <tr>
        <td class="label">Assemblée Générale</td>
        <td>{ag_title}</td>
      </tr>
      <tr>
        <td class="label">Date</td>
        <td>{ag_date}</td>
      </tr>
      <tr>
        <td class="label">Lieu</td>
        <td>{ag_lieu}</td>
      </tr>
    </table>

    <div class="section">
      <p>
        Je soussigné(e), copropriétaire mandant, donne par la présente pouvoir au mandataire
        désigné ci-dessous pour me représenter à l’Assemblée Générale mentionnée ci-dessus.
      </p>
    </div>

    <table class="grid">
      <tr>
        <td class="label">Nom et prénom du mandant</td>
        <td>&nbsp;</td>
      </tr>
      <tr>
        <td class="label">Lot / Appartement</td>
        <td>&nbsp;</td>
      </tr>
      <tr>
        <td class="label">Bâtiment / Étage</td>
        <td>&nbsp;</td>
      </tr>
      <tr>
        <td class="label">Téléphone du mandant</td>
        <td>&nbsp;</td>
      </tr>
      <tr>
        <td class="label">Nom et prénom du mandataire</td>
        <td>&nbsp;</td>
      </tr>
      <tr>
        <td class="label">Téléphone du mandataire</td>
        <td>&nbsp;</td>
      </tr>
    </table>

    <div class="box">
      <strong>Déclaration :</strong><br>
      Le mandataire est autorisé à me représenter, signer la feuille de présence,
      participer aux échanges et exprimer les votes relatifs aux résolutions inscrites
      à l’ordre du jour, selon les règles retenues par la copropriété et le syndic.
    </div>

    <div class="signature-row">
      <div class="signature-cell">
        <span class="signature-line">Signature du mandant</span>
      </div>
      <div class="signature-cell">
        <span class="signature-line">Signature du mandataire</span>
      </div>
    </div>

    <div class="warning">
      Réservé au syndic : mandat reçu, contrôlé, validé ou rejeté avec motif.
      Ce document pourra ensuite être rattaché au suivi des présences, du quorum et des votes.
    </div>
  </div>
"""

    html = _html_base(
        title="Mandat de représentation à l’Assemblée Générale",
        copropriete=copropriete,
        reference=reference,
        body_html=body,
    )
    return render_pdf_bytes(html, request=request)


def save_generated_document(
    *,
    copropriete,
    document_type: str,
    title: str,
    reference: str,
    pdf_bytes: bytes,
    created_by=None,
    related_owner=None,
    related_lot=None,
    related_ag=None,
    related_dossier_impaye=None,
    related_relance=None,
    is_visible_to_owner: bool = False,
    metadata: dict | None = None,
) -> GeneratedDocument:
    if not pdf_bytes:
        raise ValueError("Impossible de créer un document avec un PDF vide.")

    digest = sha256(pdf_bytes).hexdigest()
    safe_title = slugify(title)[:60] or "document"
    filename = f"{reference}-{safe_title}.pdf"

    document = GeneratedDocument(
        copropriete=copropriete,
        document_type=document_type,
        title=title,
        reference=reference,
        file_hash=digest,
        created_by=created_by if getattr(created_by, "is_authenticated", False) else None,
        related_owner=related_owner,
        related_lot=related_lot,
        related_ag=related_ag,
        related_dossier_impaye=related_dossier_impaye,
        related_relance=related_relance,
        is_visible_to_owner=is_visible_to_owner,
        metadata=metadata or {},
    )
    document.file.save(filename, ContentFile(pdf_bytes), save=False)
    document.save()
    return document