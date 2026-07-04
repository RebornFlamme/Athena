"""Consistent voice assignment: one Gradium voice per character / radio callsign.

Voices are real Gradium uids (from the catalog fetched 2026, 300 voices).
Rules:
- Emergency calls use only OPERATOR / CALLER labels; each call file maps those
  two labels to the file's real operator/caller (CALL_ROLES below), so a dialogue
  always has two distinct, gender-appropriate voices.
- No Arabic voice exists in Gradium -> Fatima (CALL-04, darija) uses a French
  female voice (closest phonetically). Rosa (CALL-09) uses a Spanish female voice.
- Radio callsigns map to English voices; known-female commanders overridden.
- Any callsign not listed explicitly hash-picks a stable voice from a pool.
"""
import hashlib

# --- named character -> (voice_uid, gender, lang, treatment) ------------------
# treatment: "operator" (clean headset) | "caller" (phone line) for calls.
CHARACTERS = {
    # operators (calm, customer-service voices)
    "Lucas Ferry":     ("nlYB3lceu4gwj9Eu", "m", "en"),   # Graham
    "Marta Lopez":     ("Zd5POlBGSbD-JBXF", "f", "en"),   # Audrey
    "Anna Marchand":   ("ru5NfxcQb-xjB2ov", "f", "en"),   # Sloane
    "Daniel Reeves":   ("IvU7qOuioP04a4eX", "m", "en"),   # Harrison
    "Emma Rossi":      ("WHINGSh2X5oidrhY", "f", "en"),   # Brooke
    "Remi Fontaine":   ("_6Aslh2DxfmnRLmP", "m", "en"),   # Russell
    "Sofia Klein":     ("7c5UOKm7AiBgJADg", "f", "en"),   # Holly
    "Karim Ben Salem": ("CF0NgaMwHMMrHZn0", "m", "en"),   # Reuben
    "David Okafor":    ("POBHtemksfWQbng0", "m", "en"),   # Garrett
    "Julia Carvalho":  ("7aEKz4P1ogZ0UsRP", "f", "en"),   # Riley
    # callers (conversational / emotional)
    "Leila Benali":    ("cLONiZ4hQ8VpQ4Sz", "f", "en"),   # Skyler
    "Roger Fabre":     ("vzanWTXLIajkUaaT", "m", "en"),   # Arlo (older timbre)
    "Dylan Girard":    ("KUpE0JVhjiIzp1Fk", "m", "en"),   # Damon (young, agitated)
    "Fatima Belkacem": ("3hQIj8JOo7bU31Jw", "f", "fr"),   # Garance (FR, for darija)
    "Theo Marchal":    ("6MFfc37kq0sBjBjy", "m", "en"),   # Sterling
    "Nadia Ferrand":   ("4SZHfMpw-p46Ywgs", "f", "en"),   # Harper
    "Marc Djemba":     ("dME3IWyZBvmh1n1q", "m", "en"),   # Toby
    "Sami Haddad":     ("s_k3kLBbgeK9-xUg", "m", "en"),   # Freddie
    "Rosa Delgado":    ("4NLtOv1m0azv9rGL", "f", "es"),   # Camila (ES)
    "Bruno Keller":    ("kfzLbcdE_yXgLeUI", "m", "en"),   # Archie
}

# --- per call file: OPERATOR / CALLER -> character name -----------------------
CALL_ROLES = {
    "CALL-01": {"OPERATOR": "Lucas Ferry",     "CALLER": "Leila Benali"},
    "CALL-02": {"OPERATOR": "Marta Lopez",     "CALLER": "Roger Fabre"},
    "CALL-03": {"OPERATOR": "Anna Marchand",   "CALLER": "Dylan Girard"},
    "CALL-04": {"OPERATOR": "Daniel Reeves",   "CALLER": "Fatima Belkacem"},
    "CALL-05": {"OPERATOR": "David Okafor",    "CALLER": "Theo Marchal"},
    "CALL-06": {"OPERATOR": "Emma Rossi",      "CALLER": "Nadia Ferrand"},
    "CALL-07": {"OPERATOR": "Karim Ben Salem", "CALLER": "Marc Djemba"},
    "CALL-08": {"OPERATOR": "Remi Fontaine",   "CALLER": "Sami Haddad"},
    "CALL-09": {"OPERATOR": "Sofia Klein",     "CALLER": "Rosa Delgado"},
    "CALL-10": {"OPERATOR": "Julia Carvalho",  "CALLER": "Bruno Keller"},
}

# --- radio callsign -> voice_uid (English; known-female roles use female) -----
RADIO_VOICES = {
    "CENTRAL":               "Zd5POlBGSbD-JBXF",  # Audrey (dispatch, F)
    "ENGINE LOUVAIN 1":      "dME3IWyZBvmh1n1q",  # Toby   (CPO Bouzid)
    "ENGINE SAINT-PIERRE 1": "kfzLbcdE_yXgLeUI",  # Archie (CPO Le Goff)
    "ENGINE CANEBIERE 1":    "s_k3kLBbgeK9-xUg",  # Freddie
    "ENGINE ENDOUME 1":      "CF0NgaMwHMMrHZn0",  # Reuben
    "GROUP SOUTH":           "4SZHfMpw-p46Ywgs",  # Harper (LT Claire Aubry, F)
    "GROUP NORTH":           "6MFfc37kq0sBjBjy",  # Sterling (LT Hugo Reyes, M)
    "COLUMN 1":              "IvU7qOuioP04a4eX",  # Harrison (LCDR Verne, M)
    "COMMAND POST":          "POBHtemksfWQbng0",  # Garrett (PO1 Adler)
    "LADDER LOUVAIN":        "6MFfc37kq0sBjBjy",  # Sterling (PO1 Lange)
    "LADDER LOUVAIN — CAGE": "r2sIQdqqoqgRJuXw",  # Marcus (op Muller)
    "LADDER SAINT-PIERRE":   "6MFfc37kq0sBjBjy",  # Sterling
    "LADDER SAINT-PIERRE — CAGE": "r2sIQdqqoqgRJuXw",  # Marcus
    "MEDIC LOUVAIN":         "ru5NfxcQb-xjB2ov",  # Sloane (PO2 Ines Robert, F)
    "MEDIC SAINT-PIERRE":    "_6Aslh2DxfmnRLmP",  # Russell
    "MEDIC ENDOUME":         "6MFfc37kq0sBjBjy",  # Sterling
    "MEDICAL 1":             "WHINGSh2X5oidrhY",  # Brooke (LCDR Sarah Bonnet, F)
    "SMUR 1":                "nlYB3lceu4gwj9Eu",  # Graham (SAMU physician)
    "AIR SUPPORT":           "CF0NgaMwHMMrHZn0",  # Reuben
    "ATTACK 1 — COSTA":      "KUpE0JVhjiIzp1Fk",  # Damon
    "ATTACK 2 — OSEI":       "vzanWTXLIajkUaaT",  # Arlo
    "ATTACK 2 — CANEBIÈRE PAIR": "s_k3kLBbgeK9-xUg",  # Freddie
    "ATTACK 3 — CANEBIÈRE PAIR": "s_k3kLBbgeK9-xUg",
    "RELIEF 1 — ENDOUME PAIR":   "CF0NgaMwHMMrHZn0",
    "SAFETY — LEROY":        "POBHtemksfWQbng0",  # Garrett
    "SUPPLY 1 — DIALLO":     "kfzLbcdE_yXgLeUI",  # Archie
    "SUPPLY 2 — FONTANA":    "_6Aslh2DxfmnRLmP",  # Russell
    "SUPPLY 3 — CANEBIÈRE":  "s_k3kLBbgeK9-xUg",
    "SEARCH 1":              "dME3IWyZBvmh1n1q",  # Toby
    "SEARCH 2":              "r2sIQdqqoqgRJuXw",  # Marcus
    "SEARCH 3":              "KUpE0JVhjiIzp1Fk",  # Damon
    "SEARCH 4":              "vzanWTXLIajkUaaT",  # Arlo
}

# fallback pool for any unlisted callsign (male English conversational voices)
POOL = ["dME3IWyZBvmh1n1q", "kfzLbcdE_yXgLeUI", "s_k3kLBbgeK9-xUg",
        "CF0NgaMwHMMrHZn0", "6MFfc37kq0sBjBjy", "r2sIQdqqoqgRJuXw",
        "_6Aslh2DxfmnRLmP", "POBHtemksfWQbng0", "vzanWTXLIajkUaaT"]


def call_voice(call_id, label):
    name = CALL_ROLES[call_id][label]
    uid, gender, lang = CHARACTERS[name]
    return {"uid": uid, "name": name, "gender": gender, "lang": lang,
            "treatment": "operator" if label == "OPERATOR" else "caller"}


def radio_voice(callsign):
    uid = RADIO_VOICES.get(callsign)
    if not uid:
        i = int(hashlib.sha1(callsign.encode()).hexdigest(), 16) % len(POOL)
        uid = POOL[i]
    return {"uid": uid, "name": callsign, "treatment": "radio"}
