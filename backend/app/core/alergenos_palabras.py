"""Words and labels that point to an allergen of the catalog (HU13 / T13-04).

Data only, in one place, so the detection can be reused by other sources (HU07). Every value that
names an allergen is a `codigo` of the `alergenos` catalog; the codes never change.

Texts are compared after `normalizar_texto`: lower case, no accents, single spaces. So everything
below is written in lower case and WITHOUT accents («mani», not «maní»).
"""

# --- labels of Open Food Facts -> catalog code ---------------------------------------------------
# A label that is not here is not guessed: it goes to manual assignment (`sin_reconocer`).
ETIQUETAS_OFF: dict[str, str] = {
    "en:milk": "lacteos",
    "en:gluten": "gluten",
    "en:eggs": "huevos",
    "en:peanuts": "cacahuetes",
    "en:soybeans": "soja",
    "en:nuts": "frutos_cascara",
    "en:sulphur-dioxide-and-sulphites": "sulfitos",
    "en:sesame-seeds": "sesamo",
    "en:lupin": "altramuces",
    "en:fish": "pescado",
    "en:crustaceans": "crustaceos",
    "en:molluscs": "moluscos",
    "en:celery": "apio",
    "en:mustard": "mostaza",
}

# --- Spanish keywords per allergen ---------------------------------------------------------------
# A trailing plural («s» / «es») is accepted by the matcher, so only the singular is listed unless
# the plural is irregular (nuez / nueces).
PALABRAS_CLAVE: dict[str, tuple[str, ...]] = {
    "lacteos": (
        "leche",
        "lactosa",
        "suero de leche",
        "lactosuero",
        "caseina",
        "caseinato",
        "lactoalbumina",
        "lactoglobulina",
        "mantequilla",
        "crema",
        "nata",
        "queso",
        "manjar",
        "yogur",
        "yogurt",
        "lacteo",
    ),
    "gluten": (
        "trigo",
        "harina de trigo",
        "cebada",
        "centeno",
        "avena",
        "gluten",
        "semola",
        "malta",
        "espelta",
        "kamut",
    ),
    "huevos": ("huevo", "clara", "yema", "albumina", "ovoalbumina"),
    "cacahuetes": ("mani", "cacahuate", "cacahuete"),
    "soja": ("soya", "soja", "lecitina de soya", "lecitina de soja", "tofu"),
    "frutos_cascara": (
        "nuez",
        "nueces",
        "almendra",
        "avellana",
        "castana de caju",
        "anacardo",
        "caju",
        "pistacho",
        "macadamia",
        "pecana",
        "nuez de brasil",
    ),
    "pescado": (
        "pescado",
        "atun",
        "salmon",
        "merluza",
        "bacalao",
        "anchoa",
        "sardina",
        "jurel",
        "caballa",
        "trucha",
        "congrio",
        "reineta",
        "surimi",
    ),
    "crustaceos": ("crustaceo", "camaron", "langostino", "langosta", "cangrejo", "jaiba", "krill"),
    "moluscos": ("molusco", "calamar", "pulpo", "mejillon", "almeja", "ostra", "ostion", "chorito"),
    "sulfitos": (
        "sulfito",
        "metabisulfito",
        "bisulfito",
        "anhidrido sulfuroso",
        "dioxido de azufre",
    ),
    "apio": ("apio",),
    "mostaza": ("mostaza",),
    "sesamo": ("sesamo", "ajonjoli", "tahini", "tahina"),
    "altramuces": ("altramuz", "altramuces", "lupino", "lupin"),
}

# Regular expressions that a plain word cannot express (applied to the normalized text).
PATRONES_CLAVE: dict[str, tuple[str, ...]] = {
    # Food additives E220 to E228: sulphur dioxide and sulphites.
    "sulfitos": (r"e[ -]?22[0-8]",),
}

# --- phrases that start a "may contain traces" statement -----------------------------------------
# What follows, up to the next full stop, is trace. They are regular expressions on the normalized
# text; the most specific ones come first only for readability, the matcher takes them all.
FRASES_TRAZAS: tuple[str, ...] = (
    r"puede(?:n)? contener(?: trazas(?: de)?)?",
    r"podria(?:n)? contener(?: trazas(?: de)?)?",
    r"contiene(?:n)? trazas(?: de)?",
    r"trazas? de",
    r"may contain",
    r"traces of",
    (
        r"(?:elaborad|producid|fabricad|envasad|procesad)[oa]s? en (?:una |un )?"
        r"(?:lineas?|instalaciones?|plantas?|fabricas?|talleres?)"
        r"(?: [a-z]+){0,4}? que (?:tambien |ademas )?"
        r"(?:procesa|procesan|manipula|manipulan|utiliza|utilizan|elabora|elaboran|usa|usan|contiene|contienen)"
    ),
)

# --- negation: «sin gluten», «libre de gluten» do not add the allergen ---------------------------
NEGACIONES: tuple[str, ...] = (
    r"sin",
    r"libres? de",
    r"exent[oa]s? de",
    r"no contiene(?:n)?",
    r"sin contenido de",
    r"free of",
)
# Words allowed between the negation and the allergen («sin ningun gluten», «sin trazas de ...»).
RELLENOS_NEGACION: tuple[str, ...] = (
    "el", "la", "los", "las", "un", "una", "ningun", "ninguna", "ningunos", "ningunas",
    "trazas de", "contenido de", "de",
)  # fmt: skip

# Words that a negation never cancels. «Sin lactosa» is a milk product with the sugar removed:
# it still carries milk proteins.
NO_NEGABLES: frozenset[str] = frozenset({"lactosa"})

# --- dairy words that are not dairy when a plant follows: «leche de coco», «mantequilla de mani» --
PALABRAS_LACTEAS_CALIFICABLES: tuple[str, ...] = (
    "leche", "mantequilla", "crema", "queso", "manjar", "yogur", "yogurt",
)  # fmt: skip

# «leche de <planta>»: not dairy, but the productor decides (it goes to `sin_reconocer`).
CALIFICADORES_LECHE_VEGETAL: tuple[str, ...] = (
    "coco", "almendra", "avena", "arroz", "soya", "soja", "anacardo", "avellana", "nuez",
    "nueces", "mani", "cacahuate", "cacahuete", "quinoa", "castana de caju", "pistacho",
)  # fmt: skip

# «mantequilla/crema/queso de <x>»: covered by its own allergen keyword, so nothing is left to decide.
CALIFICADORES_CUBIERTOS: tuple[str, ...] = (
    "mani", "cacahuate", "cacahuete", "almendra", "avellana", "nuez", "nueces", "anacardo",
    "pistacho", "sesamo", "castana de caju", "macadamia", "pecana",
)  # fmt: skip
# Not covered by any keyword: not dairy, and the productor decides.
CALIFICADORES_A_REVISAR: tuple[str, ...] = (
    "cacao", "karite", "coco", "arroz", "soya", "soja", "avena", "quinoa", "linaza",
)  # fmt: skip

# --- words that, followed by a given text, do not point to the allergen --------------------------
# «nuez moscada» is a spice, not a tree nut.
IGNORAR_SI_SIGUE: dict[str, str] = {
    "nuez": r" moscada",
}

# --- words that only point to an allergen when nothing specifies them ----------------------------
# «harina» alone may or may not be wheat: it goes to manual assignment. «harina de trigo» has its
# own keyword; «harina de maiz» is specified and is not gluten.
AMBIGUAS: dict[str, str] = {
    "harina": "gluten",
}
