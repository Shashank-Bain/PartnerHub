import argparse

from app import create_user_record, get_user_by_email, resolve_sector_names


def parse_sector_list(sector_csv):
    if not sector_csv:
        return []
    return sorted({item.strip() for item in sector_csv.split(",") if item.strip()})


def create_user(email, password, first_name, last_name, sectors, is_admin=False, must_change_password=True):
    normalized_email = email.lower().strip()
    if get_user_by_email(normalized_email):
        print(f"User with email {email} already exists.")
        return

    valid_sectors, missing_sectors = resolve_sector_names(sectors)
    if missing_sectors:
        print(f"Invalid sectors: {', '.join(missing_sectors)}")
        return

    created_user = create_user_record(
        email=normalized_email,
        password=password,
        first_name=first_name.strip(),
        last_name=last_name.strip(),
        sector_names=valid_sectors,
        is_admin=is_admin,
        must_change_password=must_change_password,
    )

    if not created_user:
        print(f"User with email {email} already exists.")
        return

    print(f"User created successfully: {email}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Create a user manually")
    parser.add_argument("--email", required=True)
    parser.add_argument("--password", required=True)
    parser.add_argument("--first-name", required=True)
    parser.add_argument("--last-name", required=True)
    parser.add_argument(
        "--skip-force-password-change",
        action="store_true",
        help="Do not force password change on first login",
    )
    parser.add_argument(
        "--sectors",
        default="",
        help="Comma separated sectors, e.g. 'Consumer Products,Mining'",
    )
    parser.add_argument("--is-admin", action="store_true", help="Grant admin access")

    args = parser.parse_args()

    create_user(
        email=args.email,
        password=args.password,
        first_name=args.first_name,
        last_name=args.last_name,
        sectors=parse_sector_list(args.sectors),
        is_admin=args.is_admin,
        must_change_password=not args.skip_force_password_change,
    )
