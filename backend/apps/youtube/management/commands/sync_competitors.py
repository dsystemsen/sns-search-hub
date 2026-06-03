from django.core.management.base import BaseCommand

from apps.channels.models import Competitor
from apps.youtube.client import YouTubeAPIError
from apps.youtube.services import sync_competitor


class Command(BaseCommand):
    help = "Refresh competitor channel stats from the YouTube Data API."

    def add_arguments(self, parser):
        parser.add_argument("--tenant", type=int, help="Limit to a single tenant id.")

    def handle(self, *args, **options):
        qs = Competitor.objects.all()
        if options["tenant"]:
            qs = qs.filter(tenant_id=options["tenant"])

        ok = 0
        for c in qs:
            try:
                metric = sync_competitor(c)
                ok += 1
                self.stdout.write(
                    self.style.SUCCESS(
                        f"[OK] {c.name} → subs={metric.subscribers_total}, videos={metric.videos_total}"
                    )
                )
            except YouTubeAPIError as exc:
                self.stdout.write(self.style.ERROR(f"[ERR] {c.name}: {exc}"))
        self.stdout.write(f"Done. Synced {ok}/{qs.count()} competitors.")
