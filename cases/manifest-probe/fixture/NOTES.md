# Release notes, build 412

The retry path swallows the cancellation signal. A cancelled upload is retried
three times before the queue notices, so a user who cancels sees the transfer
finish anyway.

Owner: platform. Filed as PLAT-88.
