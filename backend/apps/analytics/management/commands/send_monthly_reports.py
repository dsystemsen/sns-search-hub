from datetime import date

from django.core.management.base import BaseCommand

from apps.analytics.emailing import previous_month_range, send_monthly_reports
from apps.tenants.models import Tenant


class Command(BaseCommand):
    help = "Generate and email monthly Excel reports for the previous month (or specified range)."

    def add_arguments(self, parser):
        parser.add_argument("--tenant", type=int, help="Limit to a single tenant id.")
        parser.add_argument("--start", type=str, help="Period start YYYY-MM-DD (overrides default).")
        parser.add_argument("--end", type=str, help="Period end YYYY-MM-DD (overrides default).")

    def handle(self, *args, **options):
        tenant = None
        if options["tenant"]:
            tenant = Tenant.objects.get(pk=options["tenant"])

        if options["start"] and options["end"]:
            start = date.fromisoformat(options["start"])
            end = date.fromisoformat(options["end"])
        else:
            start, end = previous_month_range()

        self.stdout.write(f"Generating reports for {start} 〜 {end}...")
        count = send_monthly_reports(tenant=tenant, period_start=start, period_end=end)
        self.stdout.write(self.style.SUCCESS(f"Sent {count} report email(s)."))
