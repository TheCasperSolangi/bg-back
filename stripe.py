import stripe
import datetime

# Your Stripe Secret Key (keep safe!)
stripe.api_key = "sk_live_dSqzdUq80sw9GWmuoI0qJ9rL"

# Track daily transactions (in memory for demo, use DB in production)
DAILY_LIMIT = 10
MAX_AMOUNT = 15000  # Stripe uses cents, so $150 = 15000
transactions_today = []

def can_process_transaction(amount_cents):
    today = datetime.date.today()
    # remove expired logs
    global transactions_today
    transactions_today = [t for t in transactions_today if t["date"] == today]

    if len(transactions_today) >= DAILY_LIMIT:
        return False, "Daily limit reached (10 transactions)"
    if amount_cents > MAX_AMOUNT:
        return False, "Amount cannot exceed $150"
    return True, None

def create_connected_account(recipient_name, email):
    """Create a Stripe Custom Connected Account for the recipient"""
    account = stripe.Account.create(
        type="custom",
        country="US",
        email=email,
        business_type="individual",
        capabilities={
            "transfers": {"requested": True},
        },
        business_profile={
            "name": recipient_name,
        }
    )
    return account.id

def attach_bank_account(account_id, routing_number, account_number):
    """Attach bank details to the connected account"""
    bank_account = stripe.Account.create_external_account(
        account_id,
        external_account={
            "object": "bank_account",
            "country": "US",
            "currency": "usd",
            "routing_number": routing_number,
            "account_number": account_number,
        },
    )
    return bank_account.id

def send_payment(account_id, amount_cents):
    """Send payment to recipient's bank account"""
    ok, msg = can_process_transaction(amount_cents)
    if not ok:
        raise Exception(msg)

    payout = stripe.Transfer.create(
        amount=amount_cents,
        currency="usd",
        destination=account_id,
        description="Payroll Payment"
    )

    # Log transaction
    transactions_today.append({
        "date": datetime.date.today(),
        "amount": amount_cents,
        "recipient": account_id,
    })

    return payout

# ----------------- DEMO ------------------
if __name__ == "__main__":
    recipient_name = "John Doe"
    recipient_email = "john.doe@example.com"
    routing_number = "110000000"  # Test routing
    account_number = "000123456789"  # Test account
    amount_usd = 120

    # Create account
    account_id = create_connected_account(recipient_name, recipient_email)
    print("Created account:", account_id)

    # Attach bank
    bank_id = attach_bank_account(account_id, routing_number, account_number)
    print("Attached bank:", bank_id)

    # Send payment
    payout = send_payment(account_id, amount_usd * 100)  # convert to cents
    print("Payment sent:", payout.id)