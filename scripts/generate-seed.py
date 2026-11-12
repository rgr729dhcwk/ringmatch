"""Generates seed/listings.json (40 attribute-only sample cards). Run: python3 scripts/generate-seed.py
Prices are rough typical-market estimates (stone + setting), labeled "est." in the app."""
import json, math

SHAPES = ["Round","Oval","Cushion","Emerald","Princess","Pear","Marquise","Radiant","Asscher","Heart","Elongated Cushion","Old Mine/Old European"]
SETTINGS = ["Solitaire","Halo","Hidden Halo","Three-Stone","Pavé","Bezel","Vintage/Milgrain","Toi et Moi","Cathedral","Split Shank","Cluster"]
METALS = ["Yellow Gold","White Gold","Rose Gold","Platinum","Two-tone"]
PRONGS = ["4","6","Claw","Double","Compass"]
COLORS = ["D","E","F","G","H","I","J","K"]
CLARITIES = ["IF","VVS1","VVS2","VS1","VS2","SI1","SI2"]
CUTS = ["Ideal/Excellent","Very Good","Good"]
CARATS = [0.7,1.0,1.2,1.5,0.9,2.0,1.1,1.3,2.5,0.8,1.7,3.0]

# Hand-tuned stone mix: mostly diamonds, some moissanite/sapphire/other.
STONES = (["Diamond"]*7 + ["Moissanite","Diamond","Sapphire"]) * 4

def setting_cost(setting, metal):
    base = {"Solitaire":900,"Halo":1700,"Hidden Halo":1500,"Three-Stone":2200,"Pavé":1600,"Bezel":1100,
            "Vintage/Milgrain":1900,"Toi et Moi":1400,"Cathedral":1200,"Split Shank":1500,"Cluster":2000}[setting]
    return base * (1.35 if metal == "Platinum" else 1.0)

def stone_cost(stone, origin, carat, color, clarity, shape):
    if stone == "Diamond":
        if origin == "Lab-grown":
            per = 700 * carat ** 0.6
        else:
            per = 5200 * carat ** 0.9
            per *= {"D":1.35,"E":1.25,"F":1.15,"G":1.0,"H":0.9,"I":0.78,"J":0.68,"K":0.55}[color]
            per *= {"IF":1.4,"VVS1":1.25,"VVS2":1.15,"VS1":1.05,"VS2":1.0,"SI1":0.85,"SI2":0.72}[clarity]
            if shape != "Round": per *= 0.8
        return per * carat
    if stone == "Moissanite": return 450 * carat
    if stone == "Sapphire": return 1900 * carat ** 1.3
    return 700 * carat  # other (e.g. morganite)

OTHER_NAMES = {"Sapphire":"sapphire","Moissanite":"moissanite","Other":"morganite"}

listings = []
for i in range(40):
    shape = SHAPES[i % 12]
    setting = SETTINGS[(i * 5) % 11]       # 5 is coprime with 11 -> covers all settings
    metal = METALS[(i * 3 + i // 12) % 5]
    prongs = PRONGS[(i * 2 + i // 5) % 5]
    stone = STONES[i]
    if i in (17, 33): stone = "Other"
    origin = None if stone not in ("Diamond","Sapphire") else ("Lab-grown" if i % 3 == 1 else "Natural")
    carat = CARATS[(i * 7) % 12]
    if setting == "Cluster": carat = round(carat * 0.6, 2)
    color = COLORS[(i * 3) % 8] if stone == "Diamond" else None
    clarity = CLARITIES[(i * 5) % 7] if stone == "Diamond" else None
    cut = CUTS[i % 3] if stone in ("Diamond","Moissanite") else None
    band_style = "Pavé" if setting in ("Pavé",) or i % 6 == 0 else "Plain"
    band_profile = "Tapered" if i % 4 == 1 else "Straight"
    width = [1.6,1.8,2.0,2.2,2.5,1.5,3.0,1.9][i % 8]
    price = setting_cost(setting, metal) + stone_cost(stone, origin or "Natural", carat, color or "G", clarity or "VS2", shape)
    price = int(round(price / 50) * 50)
    stone_word = OTHER_NAMES.get(stone, "diamond" if origin != "Lab-grown" else "lab diamond")
    title = f"{shape} {stone_word} {setting.lower()} ring in {metal.lower()}"
    title = title[0].upper() + title[1:]
    listings.append({
        "externalId": f"sample-{i+1:03d}",
        "title": title,
        "isSample": True,
        "price": price,
        "currency": "USD",
        "shape": shape, "cut": cut, "color": color, "clarity": clarity,
        "caratWeight": carat, "origin": origin, "centerStone": stone,
        "setting": setting, "prongs": prongs, "metal": metal,
        "bandWidthMm": width, "bandStyle": band_style, "bandProfile": band_profile,
        "images": [],
    })

# Image-based samples: studio renders stored in public/seed/ (checked by the image validator like any URL).
CAD = [
    ("cad-001", 3, "/seed/cad-emerald-pave-two-tone.jpg"),
    ("cad-002", 20, "/seed/cad-asscher-halo-white-gold.jpg"),
    ("cad-003", 25, "/seed/cad-oval-pave-rose-gold.jpg"),
]
for ext, src_idx, url in CAD:
    base = dict(listings[src_idx])
    base.update({"externalId": f"sample-{ext}", "title": base["title"] + " (studio render)",
                 "images": [{"url": url, "kind": "cad"}]})
    listings.append(base)

json.dump({"$comment": "Sample cards: 40 attribute-only (procedural render) + 3 with studio-render images. Prices are typical-market estimates. Regenerate with scripts/generate-seed.py.",
           "listings": listings}, open("seed/listings.json","w"), indent=2, ensure_ascii=False)

from collections import Counter
for k in ("shape","setting","metal","prongs","centerStone","bandStyle","bandProfile","origin"):
    print(k, dict(Counter(l[k] for l in listings)))
print("price range", min(l["price"] for l in listings), max(l["price"] for l in listings))
