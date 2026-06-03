"""Streaming CSV helper shared across tables.

Centralizes the BOM, header row, and chunked iteration so each viewset can
export with one line. Excel opens UTF-8 CSV correctly thanks to the BOM.
"""

from __future__ import annotations

import csv
from typing import Callable, Iterable

from django.http import StreamingHttpResponse


class _Echo:
    def write(self, value):
        return value


def stream_csv(
    *,
    filename: str,
    headers: list[str],
    rows: Iterable,
    serialize: Callable[[object], list],
) -> StreamingHttpResponse:
    writer = csv.writer(_Echo())

    def generator():
        yield "﻿"  # UTF-8 BOM
        yield writer.writerow(headers)
        for obj in rows:
            yield writer.writerow(serialize(obj))

    response = StreamingHttpResponse(generator(), content_type="text/csv; charset=utf-8")
    response["Content-Disposition"] = f'attachment; filename="{filename}"'
    return response
