from __future__ import annotations

# On garde ce nom car d'autres apps (ex: billing) l'importent déjà.
# Dans apps.core.permissions.copro, la classe existante est CoproWriteReadOnly.
from apps.core.permissions.copro import CoproWriteReadOnly as IsAdminOrSyndicWriteReadOnly