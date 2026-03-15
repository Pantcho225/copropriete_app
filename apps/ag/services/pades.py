from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from pathlib import Path

from pyhanko.pdf_utils.incremental_writer import IncrementalPdfFileWriter
from pyhanko.sign import signers
from pyhanko.sign.fields import SigFieldSpec


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
        raise ValueError("PDF vide : impossible de signer.")

    if not pfx_path:
        raise ValueError("Chemin PKCS#12 manquant.")

    pfx_file_path = Path(pfx_path)
    if not pfx_file_path.exists():
        raise FileNotFoundError(f"Fichier PFX/P12 introuvable : {pfx_file_path}")

    if not pfx_file_path.is_file():
        raise ValueError(f"Le chemin fourni n'est pas un fichier valide : {pfx_file_path}")

    password = (pfx_password or "").strip().replace("\x00", "")
    if not password:
        raise ValueError("Mot de passe PKCS#12 vide ou invalide.")

    try:
        signer = signers.SimpleSigner.load_pkcs12(
            pfx_file=str(pfx_file_path),
            passphrase=password.encode("utf-8"),
        )
    except Exception as e:
        raise ValueError(f"Impossible de charger le PKCS#12 : {e}") from e

    signer_subject = ""
    try:
        cert = getattr(signer, "signing_cert", None)
        if cert is not None and getattr(cert, "subject", None):
            signer_subject = cert.subject.human_friendly
    except Exception:
        signer_subject = ""

    try:
        signature_meta = signers.PdfSignatureMetadata(
            field_name="Signature1",
            reason=reason or "Signature PV Assemblée Générale",
            location=location or "",
        )

        pdf_signer = signers.PdfSigner(
            signature_meta=signature_meta,
            signer=signer,
            new_field_spec=SigFieldSpec("Signature1"),
        )

        in_buf = BytesIO(pdf_bytes)
        writer = IncrementalPdfFileWriter(in_buf)

        out_buf = BytesIO()
        pdf_signer.sign_pdf(writer, output=out_buf)

        signed_pdf_bytes = out_buf.getvalue()
    except Exception as e:
        raise ValueError(f"Erreur lors de la signature PAdES : {e}") from e

    if not signed_pdf_bytes:
        raise ValueError("Signature impossible : PDF signé vide.")

    return SignResult(
        signed_pdf_bytes=signed_pdf_bytes,
        signer_subject=signer_subject,
    )