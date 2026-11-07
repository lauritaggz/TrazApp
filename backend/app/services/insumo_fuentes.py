"""Where each part of a retrieved supply came from, kept in `ficha["fuentes"]` (HU07 / T07-05, D3).

A pure function: no database, no network. The list is what the productor confirmed:

    [{"fuente": "open_food_facts", "fecha": "...", "campos": ["nombre", "alergenos"]},
     {"fuente": "jumbo", "fecha": "...", "campos": ["ingredientes_declarados", "alergenos"]},
     {"fuente": "manual", "fecha": "...", "campos": ["presentacion"]}]

The fields are those of the proposal plus «alergenos» (the confirmed allergens). A field the productor
edited before confirming is no longer the source's: it goes under «manual».
"""

from datetime import datetime

FUENTE_MANUAL = "manual"
FUENTES_EXTERNAS = ("open_food_facts", "jumbo")
# What the allergen detection reads from the text, not from a source of its own.
FUENTE_INGREDIENTES = "ingredientes"
CAMPOS_DEL_PRODUCTO = ("nombre", "marca_origen", "presentacion", "ingredientes_declarados")
CAMPO_ALERGENOS = "alergenos"
CAMPOS_EDITABLES = CAMPOS_DEL_PRODUCTO + (CAMPO_ALERGENOS,)


def construir_fuentes(
    fuentes_campos: dict[str, str],
    campos_editados: list[str] | None,
    fuentes_alergenos: list[str] | None,
    fecha_recuperacion: datetime,
    ahora: datetime,
) -> list[dict]:
    """The sources of a confirmed supply: what each one supplied and what the productor edited.

    `fuentes_alergenos` are the sources that named the confirmed allergens («ingredientes» stands for
    the source of the ingredient text).
    """
    editados = set(campos_editados or ())

    atribuidos: dict[str, set[str]] = {fuente: set() for fuente in FUENTES_EXTERNAS}
    for campo in CAMPOS_DEL_PRODUCTO:
        fuente = fuentes_campos.get(campo)
        if fuente in atribuidos and campo not in editados:
            atribuidos[fuente].add(campo)
    if CAMPO_ALERGENOS not in editados:
        for fuente in fuentes_alergenos or ():
            if fuente == FUENTE_INGREDIENTES:
                fuente = fuentes_campos.get("ingredientes_declarados", "")
            if fuente in atribuidos:
                atribuidos[fuente].add(CAMPO_ALERGENOS)

    entradas = [
        {
            "fuente": fuente,
            "fecha": fecha_recuperacion.isoformat(),
            "campos": [campo for campo in CAMPOS_EDITABLES if campo in campos],
        }
        for fuente, campos in atribuidos.items()
        if campos
    ]
    manuales = [campo for campo in CAMPOS_EDITABLES if campo in editados]
    if manuales:
        entradas.append({"fuente": FUENTE_MANUAL, "fecha": ahora.isoformat(), "campos": manuales})
    return entradas
