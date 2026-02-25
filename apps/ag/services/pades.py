# apps/ag/services/pades.py
from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

from pyhanko.sign import signers
from pyhanko.sign.fields import SigFieldSpec
from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter


@dataclass
class SignResult:
    signed_pdf_bytes: bytes
    signer_subject: str


def sign_pdf_pades(
    pdf_bytes: bytes,
    pfx_path: str,
    pfx_password: str,
    reason: str = "Signature PV Assemblée Générale",
    location: str = "",
) -> SignResult:

    if not pdf_bytes:
        raise ValueError("PDF vide: impossible de signer.")

    pfx_file_path = Path(pfx_path)
    if not pfx_file_path.exists():
        raise FileNotFoundError(f"Fichier PFX/P12 introuvable: {pfx_file_path}")

    # ✅ IMPORTANT : passer le CHEMIN (str), pas des bytes
    try:
        signer = signers.SimpleSigner.load_pkcs12(
            pfx_file=str(pfx_file_path),
            passphrase=pfx_password.encode("utf-8"),
        )
    except Exception as e:
        raise ValueError(f"Impossible de charger le PKCS#12: {e}") from e

    subject = ""
    try:
        cert = getattr(signer, "signing_cert", None)
        if cert and getattr(cert, "subject", None):
            subject = cert.subject.human_friendly
    except Exception:
        subject = ""

    meta = signers.PdfSignatureMetadata(
        field_name="Signature1",
        reason=reason,
        location=location,
    )

    pdf_signer = signers.PdfSigner(
        signature_meta=meta,
        signer=signer,
        new_field_spec=SigFieldSpec("Signature1"),
    )

    in_buf = BytesIO(pdf_bytes)
    writer = IncrementalPdfFileWriter(in_buf)

    out_buf = BytesIO()
    pdf_signer.sign_pdf(writer, output=out_buf)

    signed = out_buf.getvalue()
    if not signed:
        raise ValueError("Signature impossible (PDF signé vide).")

    return SignResult(
        signed_pdf_bytes=signed,
        signer_subject=subject,
    )