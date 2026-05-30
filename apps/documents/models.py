# apps/documents/models.py
from __future__ import annotations

from django.conf import settings
from django.db import models


class DocumentMasqueCoproprietaire(models.Model):
    """
    Masquage personnel d'un document dans l'espace copropriétaire.

    Important :
    - le document source n'est jamais supprimé physiquement ;
    - on mémorise seulement que ce user ne veut plus voir ce document
      dans son espace personnel.
    """

    user = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="documents_masques_coproprietaire",
    )
    document_id = models.CharField(max_length=255)
    categorie = models.CharField(max_length=50, blank=True)
    source = models.CharField(max_length=120, blank=True)
    titre = models.CharField(max_length=255, blank=True)
    hidden_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = "Document masqué copropriétaire"
        verbose_name_plural = "Documents masqués copropriétaires"
        constraints = [
            models.UniqueConstraint(
                fields=["user", "document_id"],
                name="unique_document_masque_par_user",
            )
        ]
        indexes = [
            models.Index(fields=["user", "document_id"]),
            models.Index(fields=["user", "categorie"]),
            models.Index(fields=["hidden_at"]),
        ]

    def __str__(self) -> str:
        return f"{self.user} — {self.document_id}"