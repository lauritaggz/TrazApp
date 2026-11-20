"""Anonymous evaluation of the usefulness of a consultation (HU11, T11-01).

Everything the client sends is checked here; nothing unsigned is trusted. The elaboración is the one
INSIDE the signed token, never one the client names. Nothing that identifies who answers is read or
stored: the service does not even receive the request.

Order: token (422) -> token belongs to the path's product (422) -> product available (404) ->
elaboración still visible (404) -> token not used yet (409) -> insert.
"""

from datetime import date

from app.core.evaluacion_token import TokenEvaluacionInvalidoError, hash_nonce, verificar_token
from app.repositories.consulta_publica_repository import ConsultaPublicaRepository
from app.repositories.evaluacion_repository import EvaluacionRepository, NonceYaUsadoError
from app.services.consulta_publica_service import MENSAJE_NO_DISPONIBLE, FichaNoDisponibleError, normalizar_codigo
from app.services.elaboracion_service import elaboracion_visible_publicamente, hoy_santiago, producto_disponible_publicamente

MENSAJE_TOKEN_INVALIDO = "El enlace para evaluar no es válido o venció. Vuelve a abrir la ficha."
MENSAJE_YA_EVALUADA = "Esta consulta ya fue evaluada."


class TokenInvalidoError(Exception):
    """Same error and same message whatever the reason (422)."""


class ConsultaYaEvaluadaError(Exception):
    """The token was already used (409)."""


class EvaluacionService:
    def __init__(self, consultas: ConsultaPublicaRepository, evaluaciones: EvaluacionRepository) -> None:
        self.consultas = consultas
        self.evaluaciones = evaluaciones

    def registrar(self, id_publico: str, token: str, util: bool, hoy: date | None = None) -> None:
        try:
            firmada = verificar_token(token)
        except TokenEvaluacionInvalidoError:
            raise TokenInvalidoError(MENSAJE_TOKEN_INVALIDO) from None
        # A token of another product cannot be used on this path: same 422 as an altered one.
        if firmada.id_publico != id_publico:
            raise TokenInvalidoError(MENSAJE_TOKEN_INVALIDO)

        producto = self.consultas.get_producto_por_id_publico(id_publico)
        if producto is None or not producto_disponible_publicamente(producto):
            raise FichaNoDisponibleError(MENSAJE_NO_DISPONIBLE)
        clave = normalizar_codigo(firmada.codigo)
        elaboracion = next(
            (
                fila
                for fila in self.consultas.filas_elaboraciones(producto.id)
                if normalizar_codigo(fila.codigo) == clave and elaboracion_visible_publicamente(producto, fila, fila.oculta)
            ),
            None,
        )
        if elaboracion is None:
            raise FichaNoDisponibleError(MENSAJE_NO_DISPONIBLE)

        nonce_hash = hash_nonce(firmada.nonce)
        if self.evaluaciones.existe_nonce(nonce_hash):
            raise ConsultaYaEvaluadaError(MENSAJE_YA_EVALUADA)
        try:
            self.evaluaciones.registrar(producto.id, elaboracion.id, util, nonce_hash, hoy or hoy_santiago())
        except NonceYaUsadoError:
            raise ConsultaYaEvaluadaError(MENSAJE_YA_EVALUADA) from None
