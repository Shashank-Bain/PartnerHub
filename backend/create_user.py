import argparse

from werkzeug.security import generate_password_hash

from app import Sector, User, app, db


def parse_sector_list(sector_csv):
    if not sector_csv:
        return []
    return sorted({item.strip() for item in sector_csv.split(",") if item.strip()})


def create_user(email, password, first_name, last_name, sectors, is_admin=False, must_change_password=True):
    with app.app_context():
        existing = User.query.filter_by(email=email.lower().strip()).first()
        if existing:
            print(f"User with email {email} already exists.")
            return

        sector_objects = []
        if sectors:
            sector_objects = Sector.query.filter(Sector.name.in_(sectors)).all()
            found_sector_names = {sector.name for sector in sector_objects}
            missing_sectors = [sector for sector in sectors if sector not in found_sector_names]
            if missing_sectors:
                print(f"Invalid sectors: {', '.join(missing_sectors)}")
                return

        user = User(
            email=email.lower().strip(),
            password_hash=generate_password_hash(password),
            first_name=first_name.strip(),
            last_name=last_name.strip(),
            must_change_password=must_change_password,
            is_admin=is_admin,
        )
        user.sectors = sector_objects

        db.session.add(user)
        db.session.commit()
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
