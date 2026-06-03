from django.core.management.base import BaseCommand

from apps.channels.models import Video
from apps.youtube.client import YouTubeAPIError
from apps.youtube.services import sync_video_comments


class Command(BaseCommand):
    help = "Fetch top-level comments for tracked videos from the YouTube Data API."

    def add_arguments(self, parser):
        parser.add_argument("--tenant", type=int, help="Limit to a single tenant id.")
        parser.add_argument("--channel", type=int, help="Limit to a single channel id.")
        parser.add_argument(
            "--max",
            type=int,
            default=100,
            help="Max comments per video (default 100, API max 100).",
        )

    def handle(self, *args, **options):
        qs = Video.objects.exclude(youtube_video_id="")
        if options["tenant"]:
            qs = qs.filter(channel__tenant_id=options["tenant"])
        if options["channel"]:
            qs = qs.filter(channel_id=options["channel"])

        total_fetched = 0
        for v in qs:
            try:
                result = sync_video_comments(v, max_results=options["max"])
                total_fetched += result["fetched"]
                self.stdout.write(
                    self.style.SUCCESS(
                        f"[OK] {v.youtube_video_id} → fetched={result['fetched']}, new={result['created']}"
                    )
                )
            except YouTubeAPIError as exc:
                self.stdout.write(self.style.ERROR(f"[ERR] {v.youtube_video_id}: {exc}"))
        self.stdout.write(f"Done. Total fetched: {total_fetched}")
