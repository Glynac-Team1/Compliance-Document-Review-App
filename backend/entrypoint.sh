#!/bin/sh
set -e

alembic -c alembic.ini upgrade head
exec "$@"
