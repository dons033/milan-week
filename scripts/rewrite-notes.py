"""Rewrite every event's `notes` in Milan Week house style.

House style (from docs):
  - one sentence, <= 120 chars where possible
  - lead with the specific thing: designer, object, material
  - present tense, active voice
  - ban the marketing vocabulary (immersive, curated, reimagine, explores, journey, experience)
  - proper nouns are free; numbers earn their place
  - no personal language ("we're on the waiting list", "today is the last day")

Each entry below is { id: new_notes }. None means "set notes to null".
"""
import io, json, sys, urllib.request
from pathlib import Path

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")
ROOT = Path(__file__).resolve().parent.parent

REWRITES = {
    "4b4894c4-dc25-42dc-ab1e-41612282448a": "Four installations in one building: Moncler, Cassina by Linde Freya Tangelder, imperfettolab, Visionnaire.",
    "67d586fd-2836-4535-8710-4851f4862b0c": "94 exhibitors across ceramics, lighting, fine art and serveware.",
    "790e8ea1-6489-40a7-ab2d-162338cfe7b0": "Marco Guazzini, Richard Yasmine, atelier oi and others on material, texture and form.",
    "343a9275-e5d8-4ff8-9606-2b3d21823aa0": "Historic-centre district. 5VIE Day on 22 Apr stays open late.",
    "d4322aff-8e65-4765-9255-187c57762408": "Blown-glass cubes from Bottega Veneta's 2026 runway, plus the Paysage lamp and Float furniture.",
    "b64e5329-e792-4e2e-a62f-95e425ff2c89": "Acerbis heritage re-editions alongside contemporary pieces.",
    "774e8aba-9c11-487c-a133-449814c923e7": "Acerbis furniture with Aliita, Memo Paris \u00d7 Olimpia Zagnoli and Sara Andelman.",
    "3682f235-08a0-47c0-981e-47b0ef694181": "One-day AD pop-up at the historic Marchesi 1824 in the Galleria.",
    "1f623e6d-06ed-458f-8134-1da2433dde99": "29th Compasso d'Oro, a Haruka Misawa solo show, and a Mario Botta installation after Le Corbusier.",
    "cdb1293d-82aa-4cfc-8ae4-d0fc8829dfd4": "Exhibitions, installations and talks, plus the Compasso d'Oro at the ADI Design Museum.",
    "4af61401-b881-45d1-b0ea-69987280cb40": "Rodney Eggleston's installation in the Santa Maria del Carmine cloister.",
    "bb660ab7-736e-4aa5-aae4-0cc12227f91d": "Two sites: Baggio military hospital and Franco Albini's 1939 Villa Pestarini, open to the public for the first time.",
    "4c5ed80b-765e-478f-8932-134ba59c194d": "altreforme's Sartoria bespoke-furniture system. Cocktail Thu 23 Apr 18:30.",
    "58664961-75c8-41ec-82a5-6084277535bc": "Press preview of altreforme's Sartoria bespoke-furniture system.",
    "c0f87758-8d5f-4ade-96ed-0716bc22e88a": "Evening cocktail at the LOVE&RELOVE showroom.",
    "c3486142-0a36-47b8-b1c6-fd6e8bcbdd49": "OMA's AMO with Greek designer Leda Athanasopoulou and Chinese artist Yumo Yuan.",
    "01a28b25-125f-4f67-9349-89f4f263e52e": "Luminaires in Korean mulberry paper (hanji) on brass armatures.",
    "088231c4-9402-436e-99a6-8fec9f2fea9c": "Silhouettes: 15 years of Muller Van Severen, with Apartamento at Ordet.",
    "7bdefe8a-d3cf-4107-80e3-c2cd7ff1398e": "Muller Van Severen's 15-year retrospective. Book launch 17:00\u201319:00.",
    "bf0c2df7-16a2-488f-85f7-6764fc00d902": "50+ brands under Studiopepe's Fire (F\u00f2co) theme.",
    "a473c0cd-fe8b-4351-8ad7-1a667ea73198": "Preview of Studiopepe's Fire (F\u00f2co) show with 50+ brands.",
    "0b2e569d-7552-4ad6-9626-0ea64d73c51e": "Ebony game table with a hidden checkered board; walnut-framed seating.",
    "6571fa1b-673b-4165-9d77-524d06e19076": "Jean-Marie Massaud's new Aom indoor/outdoor seating for Arper.",
    "8f3722f1-b8d0-4956-b70f-b2a83be6caf9": "A mindfulness space from Audi and Zaha Hadid Architects.",
    "8d9df460-3bab-497c-9ab6-041d6a1b921d": "Oscar Lucien Ono's imagined Art Deco hotel, told room by room with Eastern symbolism.",
    "596a55b1-abe8-4493-ae4c-659853260cdc": "A sci-fi-styled Baccarat experience on Via Marco Formentini.",
    "00891180-3537-4f7a-8a4b-f6d29995d42b": "Rugs, embroideries and ceramic vases set by Luis \u00darculo, drawn from Mexican vernacular architecture.",
    "51df1bf1-d896-497c-bf67-37a2ccf0f9c5": "80+ designers from 20+ countries on design in uncertain times. Talks, installations, research.",
    "bfb76eba-7e62-4015-b491-6e7178a78153": "Office and Muller Van Severen pieces for BD Barcelona, at Zaz\u00e0.",
    "c3d6e3c3-c60b-482d-91d1-cb0800b9bbaa": "Omer Arbel interiors with new Bocci lighting, curated by David Alhadeff.",
    "0d96cf7d-f543-461e-8dcc-36739a68d974": "217 showrooms plus 200 pop-ups. Yinka Ilori for Veuve Clicquot at Mediateca Santa Teresa.",
    "8c40548d-3e5f-4701-b985-ca03f2899f58": "District programme; some events need the free Fuorisalone Passport.",
    "5fece8dd-314c-48f0-af2e-ec2ac599d649": "Luke Edward Hall's watercolour murals of an imagined Atlantis, with Italian caviar history.",
    "e77a553f-406c-4beb-9322-d79262c10303": "Luke Edward Hall serveware.",
    "cd77e5bb-6bfb-4784-b081-43837927bf68": "Tatiana Maino curates Calico Wallpaper, OOCCA and BCXSY on sustainability-as-practice.",
    "fb2e81be-3b7c-4749-89bc-6489507de2bf": "Opening of a new 30-room Brera hotel; Ananas Ananas glass + Harry Nuriev events all week.",
    "e1fd3e01-1873-46c1-a133-0d7cb5dbad33": "Mario Milana's Velum dining table + Laguna~B glass. By appointment.",
    "28db7b03-aa48-4aba-9400-109afa8b3b1c": "Gaetano Pesce's 1980 Dalila chair, remade for outdoor use in elastomeric-coated foam.",
    "0e354109-9cd7-45f8-ad2a-bc832e0afd0f": "Fornasetti archival motifs woven into cc-tapis rugs for the first time.",
    "f17ae961-4f24-402c-8446-f43dc7892e84": "Fornasetti archival motifs woven into cc-tapis rugs.",
    "3c8b44a2-40e2-485f-8d43-4059f04ea273": "Fornasetti x cc-tapis rugs.",
    "941d2517-5acf-432f-9356-8998f08965d4": "New collection from Christophe Delcourt and Studio Anansi.",
    "91166914-20f5-43c6-acc1-c1e98c10d4b8": "Multi-brand exhibition and cultural programme at the Convey Building.",
    "4e2c1348-de9d-4d83-be46-556a0a49a6e2": "Secret teahouse on the Torre Velasca rooftop. Worth the climb for the view.",
    "8e3a959f-fe64-481b-8259-c0dbadc68174": "Site-specific installation by Tokyo studio Draft, inside Teatro Gerolamo.",
    "e5428880-6cb0-4644-83af-bd19d7c7e36c": "Site-specific installation by Tokyo studio Draft, inside Teatro Gerolamo.",
    "9db25a7e-d127-4f4a-8ae3-d78aabd69f8d": "David/Nicolas open their new Milan studio. Boiserie as modular architecture.",
    "a907a5ce-7e79-491c-8324-68ae7b8b6216": "Second chapter of Anne Holtrop's Versi Liberi for Dedar.",
    "e0989246-3656-4b95-8da9-6dd81db5c36f": "Talks with Harry Nuriev, Aliya Khan (Marriott) and Dimitris Karampatakis.",
    "0a30b0a3-f113-46d2-a405-48045dbfbf03": "Collectible-design gallery inside a Vico Magistretti-designed building.",
    "433f3540-c173-488a-8cf8-0b907c88acaa": "Dimoregallery's new Milan space opens during design week.",
    "625da5ac-aa2f-45c3-81f6-51448833b88b": "Collective exhibition. Designer meet-up 24 Apr 18:30\u201322:30.",
    "c4221a19-c557-4918-96b5-2aa274337fba": "Research platform in the Stazione Centrale tunnels.",
    "782dcd7f-4f79-41b3-9f7d-beea24284207": "Patricia Urquiola's field of totems from Duravit's Balcoon range. Tue closes 17:00.",
    "70650866-8e7f-4a2b-9b7c-83d1e567d8f2": "Hand-painted ceramics by Audrey Hepburn's granddaughter \u2014 her design debut.",
    "fabec94e-3add-4066-bb54-49771bd01abd": "Biennial kitchen fair with Future Technology for Kitchen.",
    "009170ac-0f6c-4f7f-8cd6-a6e5a98487c0": "Fisher & Paykel's State of the Art kitchen collection.",
    "243449e8-37ca-49b8-9506-5ae93153280b": "DJ set and drinks till late.",
    "aa0f2afa-5d9a-4a07-a54d-f937625c5794": "Multiple shows across design, art, fashion and photography. Bar Luce by Wes Anderson on-site.",
    "e9f37542-1a16-4f53-80ce-90d1b837ef06": "Permanent collection plus design-week programming. Bar Luce by Wes Anderson on-site.",
    "2ae272dd-2d93-477e-ae75-11492bdcd2a9": "Finalists from Fromm.'s first design competition, plus a new collection at Salotto Retori.",
    "7ede78dd-2575-4545-a75e-2348dc4e0390": "Furniture and objects by Andrea Branzi, Maddalena Casadei, Franco Albini and Franca Helg.",
    "2d5a1fec-90ad-4cf0-a02e-df37157e85b1": "Gallotti&Radice's 70th anniversary, in glass.",
    "cf8cf88e-314c-48c1-989b-f4f3e6d9aa13": "Gallotti&Radice's 70th anniversary, in glass.",
    "1ab7916e-94d0-4d54-901c-335ad8a84378": "Renovated Giorgetti flagship plus the Move armchair staged at Manzoni Theatre. Pre-registration.",
    "bd6058fb-6196-4bdc-92a1-65079020df63": "Glas Italia flagship-store activation.",
    "c85cf915-8d61-437a-8d71-166fd7bd5780": "Glas Italia flagship-store activation.",
    "560ff9ba-3dcd-4def-b96b-02a554734700": "New glass designs by Piero Lissoni, Philippe Starck, Patricia Urquiola and Hlynur Atlason.",
    "caafc89c-4ac5-4378-ae33-e0c462abf6f8": "Piccolo Teatro Studio Melato as a GROHE SPA. Hours vary by day.",
    "963b2761-dc51-47fb-bc4e-43bdad85e7ab": "GROHE at Piccolo Teatro Studio Melato.",
    "4617bd69-7bfe-47c4-8de6-4d5d274e53be": "Gucci Memoria pop-up.",
    "31ff56bc-ae48-43d9-97ce-31d6c268712c": "Three IED student prototypes for first-reception spaces, shown in the Central Station tunnels.",
    "f520c387-28e5-4b09-9509-eafabf5ccf08": "Biennial bathroom fair.",
    "0b1fba30-683e-40b4-87b8-8251bd61b57a": "Independent design festival across the Isola district.",
    "652cde08-5a9a-474a-8857-621f2c2c675d": "Pre-Salone weekend party at PALINUROBAR.",
    "42e3045c-2365-492b-9e91-9e8afa5cd8b1": "Sebastian Herkner's Viretta seating and Bollaro tables in lightweight JANUSstone.",
    "4ec2e55d-30e5-46c7-8b09-0a41f6cde530": "60 books in the Jil Sander flagship, selected by international designers.",
    "f0e4d9a8-9526-44ea-b843-66ac5b906d6f": "Studio Furthermore's Moon Rock edition for Kalmar Werkst\u00e4tten, with The Lids Collective.",
    "af5f32e4-7466-44d7-a03c-d1066a7f0a80": "Kelly Wearstler's first H&M furniture collection.",
    "cf364441-b6b1-4582-a64c-e5c1eb32182b": "Kelly Wearstler's Milan debut: 13 pieces in a 17th-century Baroque palazzo. Free walk-in, 9\u201318.",
    "dfcde4a4-2ef5-436a-b25a-a7d5c75d447a": "Draped marble forms from Marble Sachanas (Thessaloniki), carved after Greek sculpture.",
    "39ef58fd-4ddc-4381-ac73-82a11467a61b": "A brutalist bathhouse with a copper-clad cast-iron tub, in a meadow.",
    "82c145e3-48c4-4384-bcec-cd2b0dce2e59": "Five studios in Palazzo Donizetti: Sasha Adler, Rockwell Group, March & White, Charlap Hyman & Herrero, Urjowan Alsharif.",
    "6ada735b-7bda-4a85-959e-345f15eb665b": "Jakob+MacFarlane's show of 53 pieces from 28 French designers.",
    "ee84c42b-0453-4538-b27d-ab8dea7d568e": "Lee Broom's chandelier of illuminated glass lampposts, free in Piazza San Babila.",
    "df829192-9627-409a-8995-bc25a4815412": "Omer Arbel for Bocci, curated by David Alhadeff. Enter via the garden gate.",
    "e849077f-348b-4e89-ae60-3860ac39cb80": "Lina Ghotmeh's Milan Design Week debut: a pink labyrinth at Palazzo Litta.",
    "d2a07e7f-0b9b-494b-96be-c8854ef87569": "The Axia chandelier debuts alongside new Lodes lighting.",
    "3bbf98b5-72bd-4c30-8367-ef36a4ac12a6": "Private walkthroughs 10:00\u201314:00 for the Axia chandelier and new Lodes lighting.",
    "7f0dadef-17de-4a8a-8115-1530a85997f5": "Painted Tyrolean wardrobes turned into experimental objects between 2D and 3D.",
    "ac1973b4-44ae-4110-878b-879cedb78e05": "Brodie Neill's Woodstrokes dining table alongside OOCCA and Matterialista.",
    "55a7dc0a-7b4d-4b1c-9b0f-75270fbf85e3": "Marcin Rusak on the cut-flower trade, in laminated glass and biodegradable sconces.",
    "13578e11-a99d-4a18-aa3e-61a340af2ac1": "Flower-themed Marimekko pop-up inside Osteria Grand Hotel.",
    "47def6f4-4f1e-4563-aadf-a93652169f3f": "Flower-themed Marimekko pop-up inside Osteria Grand Hotel.",
    "7d036e6f-261a-4265-9624-44c32804e080": "A three-month Marni residency at Pasticceria Cucchi, with objects from both.",
    "1ee37dcc-62a7-4d58-8f5a-856d60f3b8fc": "Debut of Studio Klass's SK Table for mdf italia.",
    "daccb82e-726d-47ea-93e6-d9290e86ea8f": "The Miele Experience Center reopens with themed design studies.",
    "71fe865d-80f2-4665-b22b-9b710aa224c5": "Kids and family programme citywide. Example: 26 Apr 16:00 workshop at the Chinese Cultural Center.",
    "1e9b71ac-8803-4a82-a30b-767ef60483ef": "Miu Miu Literary Club at Circolo Filologico.",
    "0635da0d-7cd9-46b3-82ff-d125c72e7dab": "Miu Miu's Literary Club at Circolo Filologico Milanese.",
    "2675e74b-e8f4-4d37-8b37-74cf6d63f5f4": "Vincent Van Duysen's Soleva outdoor line for Molteni, with marine-plywood backrests.",
    "d07595b7-6976-406c-ad38-6d785b9dfe89": "New Molteni show at Palazzo Molteni in Brera (details coming).",
    "7918881b-ad9a-4be9-b2e4-924c84a3e88f": "Moooi Milan store. Thu closes 19:00.",
    "a16fed63-2334-4c51-9f08-a8dee98c152a": "Moooi Milan store. Fri open until 22:00.",
    "7a80ed15-b361-4b04-9fdb-bab2c947db36": "Press preview 20 Apr 10:00\u201319:00; visitors 21\u201325 Apr 10:00\u201320:00; 26 Apr closes 18:00.",
    "39523455-5f40-4575-8df5-7ce2814dc836": "Seven rugs from the Lucia Eames archive.",
    "1f68b3dc-7aaf-492d-908d-36ace06059d3": "Ceramics and metalwork between a Greek and an American practice.",
    "5e109ac4-c64f-45aa-885b-8693da4409f3": "Evening aperitivo with ABK and Moooi.",
    "03ab534b-c6e5-45cb-b303-1f13c6affce8": "Two Nilufar sites: Grand Hotel at the Depot (Via Lancetti 34), La Casa Magica at the Gallery (Via della Spiga 32).",
    "b39bfadb-5324-4269-b8ba-b1fa484233b8": "Objects on ritual and the archetypes of home, curated by Valentina Ciuffi.",
    "ad0cb882-5000-49bf-9ec6-355e2a67c810": "Nilufar Depot as a hotel. Rooms by Allegra Hicks, Filippo Carandini, David/Nicolas. Nakashima rarities.",
    "c0455b10-c9a3-4656-8166-bbec5efddc61": "Novit\u00e0's 4th annual industry gathering, after hours.",
    "15add21d-c923-4252-a89a-fcda1076ef0c": "Novit\u00e0 Communications event. $50 ticket; buy in advance.",
    "15de454e-ff34-4c20-a191-ebe3471d922d": "New Piet Hein Eek drawer pieces, built from off-cuts.",
    "33610bbf-76c5-4bf1-a34d-8c891b2eab0f": "Rirkrit Tiravanija's untitled 2026 (demo station no. 9). Allow half a day with travel.",
    "d7263199-4469-4eb6-932a-5931342b8c1e": "New Poliform flagship in a 1976 building, former residence and La Scala hotel.",
    "ec213428-c5fd-445a-88a7-26527d218b50": "studioutte's site-specific installation in the Palazzo Clerici courtyard.",
    "38bb010b-b270-4589-9aca-895f698d4965": "True Over Time preview. Collaborations with Atelier O\u00ef, Faye Toogood, Sebastian Herkner, Yuki Nara.",
    "5b201cb7-fd7e-47cd-b7a8-d4acafe2080f": "Limited editions plus collaborations with Atelier O\u00ef, Faye Toogood, Sebastian Herkner, Yuki Nara. Hours vary.",
    "93063c6b-de3e-4195-98f1-5e7f94be9eda": "A Poltronova installation built by subtraction: unstable, open, changing.",
    "00f77f09-034f-4b91-915e-2ca570ab6004": "Designers on disciplinary responsibility. New this year: Galleria Romero Paprocki (Via Lazzaro Palazzi 24).",
    "4ec44c1f-9e69-462a-9f43-b84b1a88cf30": "District programme of installations and exhibitions.",
    "c48cb81d-614f-4c00-9a3f-b5b3c7417677": "District route with installations, photo corners and talks.",
    "6f70a42f-8803-49d2-990b-18e9bde27933": "Formafantasma's Prada Frames talks in Bramante's Sacrestia. Guided tours to the Last Supper.",
    "15043c38-e51a-4955-b139-83f8427b4f54": "Fifth edition of Formafantasma's Prada Frames, on images as political force.",
    "ea3766ae-dc10-4cd0-acd3-d349dc778bd0": "Formafantasma's Prada Frames on the role of images in modern society.",
    "aef5b070-43e1-46f8-962d-b160cc61f9ea": "Fall 2026 Home collection at the Ralph Lauren Palazzo.",
    "af576702-f4fb-477f-affd-84e0dfc3bb7e": "Aperitivo with Ressence founder Beno\u00eet Mintiens. Stefan Sagmeister film; Marc Newson and Terumasa Ikeda watches.",
    "5f01e763-175a-427b-b241-83a9d730e3a3": "Seven floors, RH's first Italian store. La Volta restaurant and a Fabio Viale sculpture.",
    "ebaaba3a-5366-4ce4-b40e-b4507fb58ec2": "Preview. Encor Studio's Aedes Memoriae in the cloister, Juma's R-Paradigm in the Sala Affreschi.",
    "1720023d-dfca-4c0a-9952-a2c1377e0001": "Encor Studio's Aedes Memoriae in the cloister, Juma's R-Paradigm in the Sala Affreschi. 70 years of Rimadesio.",
    "be992eeb-5ae7-4217-b081-5884e3c19867": "New materials and furnishing systems by Giuseppe Bavuso. Apr 21\u201325 by appointment.",
    "67a93b01-0530-418a-8702-a177f223b2e7": "Designboom group show. Cinema of Dreams by Paf atelier; Philippe Starck live.",
    "5c3d4255-50b0-4449-8e0d-6b393479204e": "Ai Weiwei's silks for Rubelli. Surveillance-camera motifs woven into lampas.",
    "ed1403bf-3fba-4ee5-92c5-1c429229ccd7": "Koolhaas and David Gianotten preview a contract-sector masterplan that debuts in 2027.",
    "2365a7d3-48cc-447d-a852-451142a8ee1b": "64th Salone. 1,900+ exhibitors, 169,000 sqm. Includes EuroCucina, FTK, Bathroom, SaloneSatellite.",
    "ecaf8776-76dd-45a8-8cd6-206c643fe709": "25 galleries incl. Nilufar, COLLECTIONAL, Salviati \u00d7 Draga&Aurel. Formafantasma scenography.",
    "f0555a96-c1fa-4d7e-b3cc-bab97585d234": "Emerging design under 35, with the SaloneSatellite Award.",
    "e66a7293-99a4-4fc8-990c-3e43b31f1f16": "Samsung Design Open Lab: experimental concepts beside commercial products at Superstudio+.",
    "368daeef-6928-411f-9802-9daa7c9ee21b": "Sara Ricciardi walk-in show.",
    "6c9e4adc-2b50-43f7-9633-08506c3fc383": "Five designers present work made during the India-based Shakti residency.",
    "c29131c2-d4ea-4943-a09b-598d0c65b808": "Sophie Ashby's Sister brand debuts inside a 19th-century nunnery.",
    "c637f571-6ae8-49dd-bf84-1fc6547c01de": "Sophie Dries with French fabric house Iss\u00e9, at Villa Pestarini.",
    "90f4f9ed-d62e-4717-bbd7-5081a382dc5a": "New Sophie Lou Jacobsen homeware tuned to 70s\u201380s Italian disco.",
    "5bcc2df3-8c1e-4524-bb43-addf007ce0a4": "RoCollectible returns with material experiments. Also hosts Piet Hein Eek's Drawers & Waste.",
    "99fe00e6-78b0-4de3-9f32-e8e82feb4eee": "Stone totems staged as a wedding in a derelict military chapel.",
    "51245868-af54-4963-a4df-1e76d1e41bb2": "One-off pieces in peeled alpaca metal (German silver).",
    "e4055862-7e84-4fd5-9106-172cccf228c0": "Exhibitions, installations and talks across three Superstudio venues.",
    "59761691-93f4-4df0-aea7-2ce645cb449e": "70 projects, 91 brands across three Superstudio venues. Theme: Thinking Better. Samsung at Superstudio+.",
    "3fa9cd79-bee9-4dab-a311-156bbde47d3e": "Tacchini booth by Studio Cameranesi-Pompili and Studio Lys.",
    "815628ce-5095-49ae-af32-c605a27193a0": "Faye Toogood material anthology and Butter collection extension, in a new lacquered finish.",
    "8fd6e057-8aa3-41da-98de-72d46048600d": "Marcel Duchamp's readymades against Elaine Sturtevant's repetitions. On reproduction, authorship, AI.",
    "9acb45f5-37be-43f1-acd8-08e7d28e14b4": "Eames Pavilion System at the Triennale. Free walk-in, no RSVP.",
    "d85e7b98-57bc-4a45-9d4a-88a1ec23965c": "Two full-scale Eames pavilions plus archival films and rare photographs. Free walk-in.",
    "3fac1b1c-f3cd-446c-9756-b9e762e0d616": "New Bocci lighting by Omer Arbel, room by room.",
    "41ebdce0-3c86-4512-a142-bce856677911": "Third edition. Free urban campsite for 300 designers 18\u201325, accommodation included.",
    "f69a27a4-a0b3-450a-8e33-2acaf8f3f878": "Theme: Thinking Better. Anchors include Archiproducts Living Notes at Via Tortona 31.",
    "1b7ef788-f712-4726-88dc-97cc6ba0cf58": "Project platform across the Tortona area.",
    "f3244977-5cc4-4ba9-9679-d9fc61f8475a": "Toyo Ito curates 400+ Branzi works, Archizoom to Memphis and beyond.",
    "f8a95665-1ba8-4454-a0a2-5279dfae9954": "Don Bronstein's photographs of Chicago mid-century jazz and blues.",
    "c3ed977b-25d6-417c-86ad-fd4f8a5232a7": "A modular pavilion system drawn from Case Study House No. 8.",
    "c454cdc9-8080-44dc-8fab-528a2eb63ead": "Umbrella public programme. Toyo Ito lecture 20 Apr 11:00.",
    "c1437496-87d4-4eef-8468-df7897ca7d25": "Annabelle Schneider's installation on sensory intelligence for USM and Sn\u00f8hetta.",
    "15540dba-cad5-4351-9994-77451d87d550": "Installation by Annabelle Schneider.",
    "877ee2e3-87b3-4e0e-aeb8-4f8d92f6f6cd": "12 designers incl. Bethan Laura Wood, Marcin Rusak, Fernando Laposse with Uzbek artisans.",
    "88206a85-fab3-45ce-a263-eccdec1e9a68": "Alcova's nocturnal alter ego. Sun / Tue / Wed.",
    "e81c3290-b3b7-4d91-9778-f40e30e5ca42": "Alcova's nocturnal alter ego in Hangar 2. Sun / Tue / Wed.",
    "f68f93de-b41a-4415-b46e-9deb8e7c663a": "Evening event with Tom Dixon at Volt.",
    "f35287b0-6efe-47f2-bc9a-0e37aea615fb": "The Uzbekistan pavilion. One of the most photographed installations this year.",
    "45f49234-75a1-4848-9042-91d0b9339f12": "Yves Salomon with Michael Bargo: American heritage meets Parisian craft.",
    "9fd32154-a445-41f7-a56d-d4f875fbadd3": "Chinatown platform with installations and co-design along Via Paolo Sarpi.",
}


def read_env():
    env = {}
    for line in (ROOT / ".env.local").read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if "=" in line and not line.startswith("#"):
            k, v = line.split("=", 1); env[k.strip()] = v.strip()
    return env

def req(env, method, path, body=None):
    key = env["SUPABASE_SERVICE_ROLE_KEY"]
    url = env["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/") + path
    headers = {"apikey": key, "Authorization": f"Bearer {key}", "Content-Type": "application/json", "Prefer": "return=representation"}
    data = json.dumps(body).encode() if body is not None else None
    r = urllib.request.Request(url, data=data, headers=headers, method=method)
    with urllib.request.urlopen(r, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8") or "null")

def main():
    env = read_env()
    # fetch current ids to confirm we're not referring to missing rows
    existing = req(env, "GET", "/rest/v1/events?select=id")
    ids = {e["id"] for e in existing}
    print(f"Existing rows: {len(ids)}")
    print(f"Rewrites specified: {len(REWRITES)}")

    missing = [i for i in REWRITES if i not in ids]
    if missing:
        print(f"Warning: {len(missing)} IDs in REWRITES not in DB (will skip).")

    updated = 0
    for rid, new_notes in REWRITES.items():
        if rid not in ids: continue
        req(env, "PATCH", f"/rest/v1/events?id=eq.{rid}", body={"notes": new_notes})
        updated += 1
        if updated % 25 == 0:
            print(f"  updated {updated}\u2026")
    print(f"Done. Updated {updated} notes.")
    unrewritten = [i for i in ids if i not in REWRITES]
    if unrewritten:
        print(f"  ({len(unrewritten)} rows unchanged)")

if __name__ == "__main__":
    main()
