from django.core.management.base import BaseCommand

from apps.billing.models import Plan


PLANS = [
    {
        "code": "starter",
        "name": "Starter",
        "monthly_price_jpy": 30000,
        "annual_price_jpy": 324000,
        "included_channels": 1,
        "extra_channel_price_jpy": 10000,
    },
    {
        "code": "pro",
        "name": "Pro",
        "monthly_price_jpy": 50000,
        "annual_price_jpy": 540000,
        "included_channels": 3,
        "extra_channel_price_jpy": 8000,
    },
    {
        "code": "enterprise",
        "name": "Enterprise",
        "monthly_price_jpy": 150000,
        "annual_price_jpy": 1620000,
        "included_channels": 15,
        "extra_channel_price_jpy": 5000,
    },
]


class Command(BaseCommand):
    help = "Seed default subscription plans (Starter / Pro / Enterprise)."

    def handle(self, *args, **options):
        for spec in PLANS:
            plan, created = Plan.objects.update_or_create(
                code=spec["code"], defaults=spec
            )
            self.stdout.write(
                self.style.SUCCESS(f"{'Created' if created else 'Updated'}: {plan.name}")
            )
