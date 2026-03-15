from __future__ import annotations

import hashlib
import os
from dataclasses import dataclass
from decimal import Decimal
from pathlib import Path
from typing import Any

from django.conf import settings
from django.template.loader import render_to_string
from django.utils import timezone

from weasyprint import HTML

from pyhanko.sign import signers
from pyhanko.sign.fields import SigFieldSpec, append_signature_field
from pyhanko.sign.signers import PdfSigner, PdfSignatureMetadata
from pyhanko_certvalidator import ValidationContext

from apps.ag.models import AssembleeGenerale, PresenceLot, Resolution, Vote
from apps.lots.models import LotTantieme


DECIMAL_ZERO = Decimal("0")


@dataclass
class PVBuildResult:
    pdf_abs_path: str
    pdf_rel_path: str
    pdf_hash: str


def ensure_media_parent(abs_path: str) -> None:
    Path(abs_path).parent.mkdir(parents=True, exist_ok=True)


def file_sha256(abs_path: str) -> str:
    h = hashlib.sha256()
    with open(abs_path, "rb") as f:
        for chunk in iter(lambda: f.read(8192), b""):
            h.update(chunk)
    return h.hexdigest()


def media_relative_path(*parts: str) -> str:
    return "/".join(str(p).strip("/").replace("\\", "/") for p in parts)


def media_absolute_path(rel_path: str) -> str:
    return os.path.join(settings.MEDIA_ROOT, rel_path)


def build_ag_pdf_reference(ag: AssembleeGenerale) -> str:
    return f"PV-AG-{ag.id:05d}.pdf"


def build_ag_signed_pdf_reference(ag: AssembleeGenerale) -> str:
    return f"PV-AG-{ag.id:05d}-SIGNE.pdf"


def _get_lot_tantiemes_map(copropriete_id: int) -> dict[int, Decimal]:
    """
    Retourne {lot_id: tantiemes_total}
    """
    rows = LotTantieme.objects.filter(
        lot__copropriete_id=copropriete_id
    ).select_related("lot")

    result: dict[int, Decimal] = {}
    for row in rows:
        current = result.get(row.lot_id, DECIMAL_ZERO)
        valeur = row.valeur if row.valeur is not None else DECIMAL_ZERO
        result[row.lot_id] = current + Decimal(valeur)
    return result


def _presence_rows(ag: AssembleeGenerale) -> tuple[list[dict[str, Any]], Decimal, Decimal]:
    presences_qs = (
        PresenceLot.objects.filter(assemblee=ag)
        .select_related("lot")
        .order_by("lot__reference", "id")
    )

    tantiemes_map = _get_lot_tantiemes_map(ag.copropriete_id)
    total_tantiemes_copro = sum(tantiemes_map.values(), DECIMAL_ZERO)

    rows: list[dict[str, Any]] = []
    tantiemes_presents = DECIMAL_ZERO

    for p in presences_qs:
        tantiemes = tantiemes_map.get(p.lot_id, DECIMAL_ZERO)

        if p.present_ou_represente:
            tantiemes_presents += tantiemes

        rows.append(
            {
                "id": p.id,
                "lot": p.lot,
                "tantiemes": tantiemes,
                "present_ou_represente": p.present_ou_represente,
                "representant_nom": p.representant_nom or "",
                "commentaire": p.commentaire or "",
            }
        )

    return rows, total_tantiemes_copro, tantiemes_presents


def _resolution_vote_rows(ag: AssembleeGenerale) -> list[dict[str, Any]]:
    resolutions = (
        Resolution.objects.filter(assemblee=ag)
        .prefetch_related("votes")
        .order_by("ordre", "id")
    )

    tantiemes_map = _get_lot_tantiemes_map(ag.copropriete_id)

    rows: list[dict[str, Any]] = []
    for r in resolutions:
        votes_qs = Vote.objects.filter(resolution=r).select_related("lot")

        pour = DECIMAL_ZERO
        contre = DECIMAL_ZERO
        abstention = DECIMAL_ZERO

        for v in votes_qs:
            poids = tantiemes_map.get(v.lot_id, DECIMAL_ZERO)

            if v.choix == "POUR":
                pour += poids
            elif v.choix == "CONTRE":
                contre += poids
            elif v.choix == "ABSTENTION":
                abstention += poids

        exprimes = pour + contre

        decision = "ADOPTEE" if pour > contre else "REJETEE"

        rows.append(
            {
                "id": r.id,
                "ordre": r.ordre,
                "titre": r.titre,
                "texte": getattr(r, "texte", "") or "",
                "type_majorite": r.type_majorite,
                "type_majorite_label": getattr(r, "get_type_majorite_display", lambda: r.type_majorite)(),
                "pour": pour,
                "contre": contre,
                "abstention": abstention,
                "exprimes": exprimes,
                "decision": decision,
                "cloturee": getattr(r, "cloturee", False),
            }
        )

    return rows


def build_pv_signature_message(ag: AssembleeGenerale) -> str:
    if getattr(ag, "pv_signed_pdf", None):
        return "Document signé numériquement (PAdES). La signature numérique et le fichier signé font foi."
    if getattr(ag, "pv_archive_pdf", None):
        return "Document archivé, non signé numériquement (PAdES). La version signée fera foi après signature."
    return "Document non signé numériquement (PAdES). La version signée fait foi après signature."


def build_pv_template_context(ag: AssembleeGenerale) -> dict[str, Any]:
    presences, total_tantiemes_copro, tantiemes_presents = _presence_rows(ag)
    resolutions_rows = _resolution_vote_rows(ag)

    quorum_ok = False
    if total_tantiemes_copro > 0:
        quorum_ok = tantiemes_presents >= (total_tantiemes_copro / 2)

    has_digital_signature = bool(getattr(ag, "pv_signed_pdf", None) or getattr(ag, "pv_signed_at", None))
    has_visual_signatures = bool(
        getattr(ag, "signature_president", None)
        or getattr(ag, "signature_secretaire", None)
        or getattr(ag, "cachet_image", None)
    )

    signature_president_url = ag.signature_president.url if getattr(ag, "signature_president", None) else None
    signature_secretaire_url = ag.signature_secretaire.url if getattr(ag, "signature_secretaire", None) else None
    cachet_image_url = ag.cachet_image.url if getattr(ag, "cachet_image", None) else None

    president_nom = getattr(ag, "president_nom", None) or "KORE"
    secretaire_nom = getattr(ag, "secretaire_nom", None) or "IBLANC"

    return {
        "ag": ag,
        "generated_at": timezone.now(),
        "copropriete_label": getattr(ag.copropriete, "nom", None) or str(ag.copropriete),
        "exercice_label": getattr(getattr(ag, "exercice", None), "nom", None) or getattr(getattr(ag, "exercice", None), "libelle", None) or "-",
        "pv_signature_message": build_pv_signature_message(ag),
        "has_digital_signature": has_digital_signature,
        "has_visual_signatures": has_visual_signatures,
        "pv_signed_at": getattr(ag, "pv_signed_at", None),
        "pv_signer_subject": getattr(ag, "pv_signer_subject", None),
        "pv_locked": bool(getattr(ag, "pv_locked_at", None)),
        "signature_president_url": signature_president_url,
        "signature_secretaire_url": signature_secretaire_url,
        "cachet_image_url": cachet_image_url,
        "president_nom": president_nom,
        "secretaire_nom": secretaire_nom,
        "total_tantiemes_copro": total_tantiemes_copro,
        "tantiemes_presents": tantiemes_presents,
        "quorum_ok": quorum_ok,
        "presences": presences,
        "resolutions_rows": resolutions_rows,
    }


def render_pv_pdf(ag: AssembleeGenerale) -> PVBuildResult:
    """
    Génère le PDF archive (non signé) à partir du template HTML.
    """
    context = build_pv_template_context(ag)
    html = render_to_string("ag/pv_ag.html", context)

    rel_path = media_relative_path("ag", "pv_archive", build_ag_pdf_reference(ag))
    abs_path = media_absolute_path(rel_path)
    ensure_media_parent(abs_path)

    HTML(string=html, base_url=settings.MEDIA_ROOT).write_pdf(abs_path)

    pdf_hash = file_sha256(abs_path)

    return PVBuildResult(
        pdf_abs_path=abs_path,
        pdf_rel_path=rel_path,
        pdf_hash=pdf_hash,
    )


def lock_pv_document(ag: AssembleeGenerale, save: bool = True) -> AssembleeGenerale:
    ag.pv_locked_at = timezone.now()
    if save:
        ag.save(update_fields=["pv_locked_at"])
    return ag


def unlock_pv_document(ag: AssembleeGenerale, save: bool = True) -> AssembleeGenerale:
    ag.pv_locked_at = None
    if save:
        ag.save(update_fields=["pv_locked_at"])
    return ag


def assert_pv_not_locked(ag: AssembleeGenerale) -> None:
    if getattr(ag, "pv_locked_at", None):
        raise ValueError("Ce procès-verbal est verrouillé et ne peut plus être modifié.")


def sign_pv_with_pades(
    ag: AssembleeGenerale,
    *,
    pkcs12_path: str,
    pkcs12_password: bytes,
    reason: str = "Signature du procès-verbal d’assemblée générale",
    location: str = "Côte d’Ivoire",
    field_name: str = "SignaturePV",
) -> PVBuildResult:
    """
    Signe le PDF archive de l'AG et produit le PDF signé.
    """
    archive_field = getattr(ag, "pv_archive_pdf", None)
    if not archive_field or not archive_field.name:
        raise ValueError("Aucun PV archivé à signer. Générez d’abord le PV.")

    input_abs_path = media_absolute_path(archive_field.name)
    if not os.path.exists(input_abs_path):
        raise ValueError("Le fichier PV archivé est introuvable sur le disque.")

    rel_signed_path = media_relative_path("ag", "pv_signed", build_ag_signed_pdf_reference(ag))
    output_abs_path = media_absolute_path(rel_signed_path)
    ensure_media_parent(output_abs_path)

    signer = signers.SimpleSigner.load_pkcs12(
        pfx_file=pkcs12_path,
        passphrase=pkcs12_password,
    )

    with open(input_abs_path, "rb") as inf:
        writer = append_signature_field(
            inf,
            SigFieldSpec(sig_field_name=field_name),
        )

        meta = PdfSignatureMetadata(
            field_name=field_name,
            reason=reason,
            location=location,
            validation_context=ValidationContext(allow_fetching=False),
        )

        pdf_signer = PdfSigner(
            signature_meta=meta,
            signer=signer,
        )

        with open(output_abs_path, "wb") as outf:
            pdf_signer.sign_pdf(writer, output=outf)

    signed_hash = file_sha256(output_abs_path)

    return PVBuildResult(
        pdf_abs_path=output_abs_path,
        pdf_rel_path=rel_signed_path,
        pdf_hash=signed_hash,
    )