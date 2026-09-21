#!/bin/sh
set -eu

python -m worker.data_eng.seed_rules_corpus
python -m worker.data_eng.seed_precedents_corpus

exec "$@"