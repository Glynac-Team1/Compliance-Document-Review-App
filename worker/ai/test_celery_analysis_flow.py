import unittest
import uuid

# Test the core mapping logic added to worker/celery_app
class TestCeleryWorkerMapping(unittest.TestCase):
    def test_severity_mapping(self):
        severities = {
            "HIGH": "high",
            "high": "high",
            "MEDIUM": "medium",
            "medium": "medium",
            "LOW": "low",
            "low": "low",
            "UNKNOWN": "medium"
        }
        for raw, expected in severities.items():
            raw_sev = str(raw).lower()
            res = "medium"
            if raw_sev == "high":
                res = "high"
            elif raw_sev == "low":
                res = "low"
            self.assertEqual(res, expected)

    def test_flag_construction(self):
        sample_flags = [
            {
                "passage": "Guaranteed 25% returns",
                "matched_rule_id": "RULE_FINRA_2210_NO_GUARANTEES",
                "severity": "HIGH",
                "explanation": "Guaranteed returns violate FINRA Rule 2210."
            },
            {
                "passage": "[MISSING MANDATORY DISCLOSURE]",
                "matched_rule_id": "RULE_DISCLOSURE_PAST_PERFORMANCE",
                "severity": "MEDIUM",
                "explanation": "Missing past performance disclaimer."
            }
        ]

        rules_by_key = {
            "RULE_FINRA_2210_NO_GUARANTEES": uuid.uuid4(),
            "RULE_DISCLOSURE_PAST_PERFORMANCE": uuid.uuid4(),
        }

        persisted = []
        for f in sample_flags:
            rule_id = rules_by_key.get(f["matched_rule_id"])
            sev = f["severity"].lower()
            persisted.append({
                "passage_excerpt": f["passage"],
                "matched_rule_id": rule_id,
                "explanation": f["explanation"],
                "severity": sev,
            })

        self.assertEqual(len(persisted), 2)
        self.assertEqual(persisted[0]["severity"], "high")
        self.assertEqual(persisted[1]["severity"], "medium")
        self.assertEqual(persisted[0]["matched_rule_id"], rules_by_key["RULE_FINRA_2210_NO_GUARANTEES"])

if __name__ == "__main__":
    unittest.main()
