import unittest

from worker.data_eng.evaluate_disclosure_threshold import (
    DisclosureExample,
    choose_threshold,
)


class TestDisclosureThresholdEvaluation(unittest.TestCase):
    def test_selects_threshold_from_labeled_examples(self):
        examples = [
            DisclosureExample("risk", [1.0, 0.0], True),
            DisclosureExample("risk", [0.9, 0.1], True),
            DisclosureExample("risk", [0.0, 1.0], False),
        ]
        selected = choose_threshold(examples, {"risk": [1.0, 0.0]}, [0.1, 0.5, 1.0])
        self.assertEqual(selected.threshold, 0.1)
        self.assertEqual(selected.precision, 1.0)
        self.assertEqual(selected.recall, 1.0)


if __name__ == "__main__":
    unittest.main()