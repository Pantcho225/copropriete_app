# apps/ag/services/signing.py
from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO

from pyhanko.sign import signers
from pyhanko.sign.fields import SigFieldSpec
from pyhanko.sign.signers.pdf_signer import PdfSigner, PdfSignatureMetadata


@dataclass
class SignedPDFResult:
    pdf_bytes: bytes


def sign_pdf_bytes(
    pdf_bytes: bytes,
    *,
    p12_path: str,
    p12_password: str,
    reason: str = "Procès-verbal signé",
    location: str = "Syndic",
    contact: str = "",
    field_name: str = "Signature1",
) -> SignedPDFResult:
    """
    Signe un PDF (bytes) avec un certificat PKCS#12 (.p12/.pfx).
    Compatible avec les versions pyHanko où PdfSigner ne prend PAS validation_context.
    """

    signer = signers.SimpleSigner.load_pkcs12(
        pfx_file=p12_path,
        passphrase=p12_password.encode("utf-8"),
    )

    meta = PdfSignatureMetadata(
        field_name=field_name,
        reason=reason,
        location=location,
        contact_info=contact,
        # embed_validation_info=False par défaut => pas besoin de validation_context
    )

    pdf_signer = PdfSigner(
        signature_meta=meta,
        signer=signer,
        new_field_spec=SigFieldSpec(sig_field_name=field_name),
    )

    out = BytesIO()
    pdf_signer.sign_pdf(BytesIO(pdf_bytes), output=out)
    return SignedPDFResult(pdf_bytes=out.getvalue())