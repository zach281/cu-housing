#!/usr/bin/env python3
"""
Generates the fictional development listings.

  supabase/seed.sql                      local development only (loaded by
                                         `supabase db reset` and e2e/stack).
                                         Demo accounts get a known password.
  supabase/demo/add-demo-listings.sql    OPTIONAL, for trying the live site
                                         before real listings exist. Titles are
                                         prefixed "[Demo]" and the accounts
                                         have no password (can't sign in).
  supabase/demo/remove-demo-listings.sql removes all of the above.

Every listing, address and person here is invented. Coordinates sit in real
Boulder neighborhoods so distance filters and the map behave realistically.

Run:  python3 scripts/seed/generate.py
"""
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DEMO_DOMAIN = "demo.campusnest.invalid"  # .invalid is reserved; can never receive email
LOCAL_PASSWORD = "demo-password-1"

OWNERS = [
    # (uuid suffix, name, role, provider_verified, cu_verified)
    ("01", "Flatirons Property Group (demo)", "provider", True, False),
    ("02", "Maya Chen (demo)", "student", False, True),
    ("03", "Pearl Street Rentals (demo)", "provider", True, False),
    ("04", "Jordan Alvarez (demo)", "student", False, True),
    ("05", "Sam Okafor (demo)", "provider", False, False),
]

# owner, title, listing type, property type, rent, beds, baths, move-in offset (days), lease length (days or None),
# street address (fictional number), neighborhood, lat, lng, furnished, parking, pets, utilities, description
LISTINGS = [
    ("01", "Bright 2-bed apartment two blocks from campus", "lease", "apartment", 2350, 2, 1, 75, None, "1180 College Ave", "University Hill", 40.00470, -105.27820, False, False, False, False,
     "Second-floor unit with big east-facing windows, updated kitchen and in-unit laundry. Two blocks to the UMC and Norlin Quad. 12-month lease starting in August."),
    ("02", "Furnished room in a quiet 4-bed house", "room", "house", 950, 4, 2, 20, 210, "870 14th St", "University Hill", 40.00210, -105.27950, True, False, False, True,
     "Your own furnished bedroom in a house with three grad students. Shared kitchen and backyard, quiet hours after 10pm. Utilities and internet included."),
    ("03", "Spring sublease in Goss-Grove studio", "sublease", "studio", 1325, 0, 1, 40, 120, "1710 Grove St", "Goss-Grove", 40.01290, -105.26880, True, True, False, False,
     "Studying abroad in the spring, so my studio is free January through mid-May. Comes furnished with a full bed and desk. Off-street parking spot included."),
    ("01", "Updated 3-bed townhouse with garage", "lease", "townhouse", 3600, 3, 2.5, 100, None, "2885 Aurora Ave", "Baseline", 39.99860, -105.25610, False, True, True, False,
     "Two-story townhouse with an attached one-car garage, private patio and washer/dryer. Pets considered with deposit. On the Skip bus line."),
    ("04", "Take over my lease in Martin Acres", "lease_takeover", "duplex", 2100, 2, 1, 30, 300, "540 S 41st St", "Martin Acres", 39.99310, -105.25640, False, True, True, False,
     "Moving for an internship and need someone to take over my duplex lease. Fenced yard, dogs OK. Landlord has approved a takeover."),
    ("03", "Pearl Street loft above the shops", "lease", "condo", 2950, 1, 1, 60, None, "1426 Pearl St", "Downtown / Pearl Street", 40.01790, -105.27620, True, False, False, True,
     "Exposed brick loft in the middle of downtown. Furnished, utilities included. Bike to campus in ten minutes along the Boulder Creek path."),
    ("05", "Room in a 5-bed house near Baseline", "room", "house", 825, 5, 2, 10, None, "395 Pawnee Dr", "Baseline", 39.99620, -105.25190, False, True, False, False,
     "Large room with a closet in a five-bedroom house shared with CU juniors. Street parking plus one driveway spot. Month-to-month available."),
    ("02", "Summer sublease, walk to campus", "sublease", "apartment", 1100, 1, 1, 200, 80, "1035 Broadway", "University Hill", 40.00560, -105.27490, True, False, False, True,
     "One-bedroom apartment free for the summer. Furnished, utilities included, AC. Five minute walk to the Engineering Center."),
    ("01", "Williams Village area 2-bed condo", "lease", "condo", 2275, 2, 2, 50, None, "3200 Darley Ave", "Williams Village", 39.99980, -105.25120, False, True, False, False,
     "Two bedrooms, two full baths, each room with its own bathroom. Covered parking, pool in the summer. Bus stop right outside."),
    ("04", "Cozy room in Whittier bungalow", "room", "house", 1050, 3, 1, 25, None, "2215 Spruce St", "Whittier", 40.02180, -105.26970, False, False, True, False,
     "Sunny room in a 1920s bungalow with two roommates and a friendly cat. Walk to Pearl Street; 15 minutes by bike to campus."),
    ("03", "Large 4-bed house in Table Mesa", "lease", "house", 4200, 4, 2.5, 90, None, "4170 Eutaw Dr", "Table Mesa", 39.98510, -105.24840, False, True, True, False,
     "Split-level house with a two-car garage, big backyard and mountain views. Good for a group of four. Close to the Table Mesa park-n-ride."),
    ("05", "Basement studio with private entrance", "lease", "studio", 1195, 0, 1, 15, None, "3060 7th St", "North Boulder", 40.03550, -105.28370, True, True, False, True,
     "Furnished garden-level studio with its own entrance and kitchenette. Utilities included. Quiet street near the Boulder Valley trailheads."),
    ("02", "Fall semester sublease in Goss-Grove", "sublease", "apartment", 1400, 2, 1, 120, 120, "1945 Goss St", "Goss-Grove", 40.01410, -105.26510, False, False, False, False,
     "Subletting my room in a two-bedroom for fall semester only. Roommate is a CU senior. Walk or bike to campus in under ten minutes."),
    ("01", "Modern 1-bed near 29th Street", "lease", "apartment", 1875, 1, 1, 35, None, "2955 Walnut St", "Central Boulder", 40.01890, -105.25480, False, True, False, False,
     "Newer building with a gym and secure bike storage. Walk to 29th Street shopping. HOP bus to campus."),
    ("04", "Shared room for budget-minded student", "room", "apartment", 650, 2, 1, 5, None, "1255 Grandview Ave", "University Hill", 40.00780, -105.27930, False, False, False, True,
     "Shared bedroom (two beds) in a two-bedroom apartment, closest you can get to campus for the price. Utilities included."),
    ("03", "Gunbarrel 3-bed with mountain views", "lease", "townhouse", 2800, 3, 2, 70, None, "6810 Twin Lakes Rd", "Gunbarrel", 40.06290, -105.19830, False, True, True, False,
     "Quiet end-unit townhouse near the lakes. Garage, fireplace, dogs welcome. About 20 minutes to campus by bus."),
    ("05", "Lease takeover: Frasier Meadows 1-bed", "lease_takeover", "apartment", 1550, 1, 1, 45, 240, "350 Ponca Pl", "Frasier Meadows", 39.99180, -105.24480, False, True, False, False,
     "Graduating early and looking for someone to take over the rest of my lease. Covered parking, balcony, laundry on-site."),
    ("02", "Room with private bath on the Hill", "room", "house", 1225, 4, 3, 30, None, "765 12th St", "University Hill", 40.00250, -105.28180, True, False, False, True,
     "Furnished bedroom with its own bathroom in a four-bedroom house. Two-minute walk to the Hill shops and campus. Utilities included."),
    ("01", "Duplex half with yard in Martin Acres", "lease", "duplex", 2650, 3, 1.5, 85, None, "455 S 38th St", "Martin Acres", 39.99050, -105.25410, False, True, True, False,
     "Three bedrooms, 1.5 baths, fenced yard and shed for bikes. Pets OK. Walk to the Engineering Center across Baseline."),
    ("04", "Winter-break sublease, fully furnished", "sublease", "condo", 900, 1, 1, 55, 35, "2600 Arapahoe Ave", "Central Boulder", 40.01480, -105.25960, True, True, False, True,
     "Short sublease over winter break for visiting researchers or students between leases. Everything included."),
    ("03", "Mapleton Hill garden apartment", "lease", "apartment", 1950, 1, 1, 110, None, "540 Maxwell Ave", "Mapleton Hill", 40.02290, -105.28640, False, False, True, False,
     "Garden apartment under a historic home on a quiet tree-lined street. Cats welcome. Walk to Pearl Street."),
    ("05", "Louisville 2-bed for commuters", "lease", "apartment", 1795, 2, 1, 25, None, "780 Main St", "Louisville", 39.97770, -105.13180, False, True, True, False,
     "Lower rent if you don't mind a commute. On the DASH bus line to campus. Parking and pets OK."),
    ("02", "Room in East Boulder house, bike to campus", "room", "house", 875, 3, 2, 15, None, "4875 Sioux Dr", "East Boulder", 39.99940, -105.22830, False, True, False, False,
     "Quiet house with two roommates who work in tech. Big room, shared garage for bikes. Twelve minutes to campus by bike."),
    ("04", "Studio sublease near Folsom Field", "sublease", "studio", 1150, 0, 1, 12, 150, "1155 Folsom St", "Goss-Grove", 40.01020, -105.26690, True, False, False, True,
     "Furnished studio a short walk from Folsom Field and the Rec Center. Utilities included. Available now through spring."),
]

LOCAL_PHOTO_NOTE = "Demo listing for development and testing. Not a real place."


def q(s: str) -> str:
    return "'" + s.replace("'", "''") + "'"


def uid(suffix: str) -> str:
    return f"de000000-0000-4000-8000-0000000000{suffix}"


def listing_uuid(i: int) -> str:
    return f"de000000-0000-4000-9000-{i:012d}"


def build(local: bool) -> str:
    out = []
    if local:
        out.append("-- =============================================================================")
        out.append("-- DEVELOPMENT SEED DATA. Generated by scripts/seed/generate.py; do not edit by hand.")
        out.append("-- Loaded only into local databases (supabase db reset, e2e/stack). Never run in")
        out.append("-- production. Every listing, address and person is fictional.")
        out.append(f"-- Demo accounts sign in with password: {LOCAL_PASSWORD}")
        out.append("-- =============================================================================")
        out.append("set search_path = public, extensions;")
    else:
        out.append("-- =============================================================================")
        out.append("-- OPTIONAL DEMO LISTINGS for trying the live site before real listings exist.")
        out.append("-- Generated by scripts/seed/generate.py. Every listing, address and person is")
        out.append("-- fictional, and titles start with [Demo]. The demo accounts have no password,")
        out.append("-- so nobody can sign in as them.")
        out.append("-- REMOVE BEFORE LAUNCH with supabase/demo/remove-demo-listings.sql")
        out.append("-- =============================================================================")
    out.append("begin;")
    out.append("")
    out.append("-- Demo accounts (profiles are created by the on_auth_user_created trigger)")
    for suffix, name, role, _pv, _cu in OWNERS:
        email = f"owner{suffix}@{DEMO_DOMAIN}"
        password = f"crypt({q(LOCAL_PASSWORD)}, gen_salt('bf'))" if local else "''"
        out.append(
            "insert into auth.users (instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,\n"
            "  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,\n"
            "  confirmation_token, recovery_token, email_change_token_new, email_change)\n"
            f"values ('00000000-0000-0000-0000-000000000000', {q(uid(suffix))}, 'authenticated', 'authenticated', {q(email)}, {password}, now(),\n"
            f"  '{{\"provider\":\"email\",\"providers\":[\"email\"]}}', {q('{\"name\":\"' + name + '\",\"intended_role\":\"' + role + '\"}')}, now(), now(), '', '', '', '')\n"
            "on conflict (id) do nothing;"
        )
        out.append(
            "insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)\n"
            f"select {q(uid(suffix))}, {q(uid(suffix))}, jsonb_build_object('sub', {q(uid(suffix))}, 'email', {q(email)}, 'email_verified', true), 'email', now(), now(), now()\n"
            f"where not exists (select 1 from auth.identities where user_id = {q(uid(suffix))});"
        )
    out.append("")
    out.append("-- Badges: two verified providers, two CU-verified students")
    for suffix, _n, _r, provider_verified, cu_verified in OWNERS:
        sets = []
        if provider_verified:
            sets.append("provider_verified_at = now()")
        if cu_verified:
            sets.append("cu_verified_at = now()")
        if sets:
            out.append(f"update public.profiles set {', '.join(sets)} where id = {q(uid(suffix))};")
    out.append("")
    out.append("-- Listings (dates are relative to today so they never go stale)")
    for i, (owner, title, ltype, ptype, rent, beds, baths, move_in, length, address, hood, lat, lng, furn, park, pets, util, desc) in enumerate(LISTINGS, 1):
        title_v = title if local else f"[Demo] {title}"
        desc_v = f"{LOCAL_PHOTO_NOTE}\n\n{desc}"
        end = f"current_date + {move_in + length}" if length else "null"
        out.append(
            "insert into public.listings (id, owner_id, title, description, property_type, listing_type, monthly_rent,\n"
            "  bedrooms, bathrooms, available_date, lease_end_date, address, neighborhood, latitude, longitude,\n"
            "  furnished, parking, pets_allowed, utilities_included, status)\n"
            f"values ({q(listing_uuid(i))}, {q(uid(owner))}, {q(title_v)}, {q(desc_v)}, '{ptype}', '{ltype}', {rent},\n"
            f"  {beds}, {baths}, current_date + {move_in}, {end}, {q(address + ', Boulder, CO')}, {q(hood)}, {lat}, {lng},\n"
            f"  {str(furn).lower()}, {str(park).lower()}, {str(pets).lower()}, {str(util).lower()}, 'active')\n"
            "on conflict (id) do nothing;"
        )
    out.append("")
    out.append("commit;")
    return "\n".join(out) + "\n"


REMOVE = f"""-- =============================================================================
-- Removes the optional demo listings and demo accounts added by
-- supabase/demo/add-demo-listings.sql. Safe to run more than once.
-- Deleting the accounts deletes their profiles, listings and photos rows.
-- =============================================================================
delete from auth.users where email like '%@{DEMO_DOMAIN}';
"""

if __name__ == "__main__":
    (ROOT / "supabase/seed.sql").write_text(build(local=True))
    demo = ROOT / "supabase/demo"
    demo.mkdir(exist_ok=True)
    (demo / "add-demo-listings.sql").write_text(build(local=False))
    (demo / "remove-demo-listings.sql").write_text(REMOVE)
    print(f"Wrote {len(LISTINGS)} listings for {len(OWNERS)} demo owners.")
