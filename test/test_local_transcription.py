import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from local_transcription import Transcriber


class TestTranscriber(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.worker = Transcriber(self.tmp.name, "test-model")
        self.image = self.worker.inbox / "act.jpg"
        self.image.write_bytes(b"image fixture")

    def test_cache_and_record(self):
        with patch.object(self.worker, "_infer", return_value="Le vingt mai [illisible]") as infer:
            first = self.worker.transcribe("act.jpg")
            second = self.worker.transcribe("act.jpg")
        self.assertFalse(first["cacheHit"])
        self.assertTrue(second["cacheHit"])
        infer.assert_called_once()
        record = self.worker.record_payload("act.jpg", "https://example.org/act/1")
        self.assertEqual(record["status"], "needs_review")
        self.assertEqual(record["extractedText"], first["extractedText"])
        self.assertEqual(record["fields"], {})
        self.assertEqual(self.worker.list_manuscripts(), ["act.jpg"])

    def test_changed_image_invalidates_cache(self):
        with patch.object(self.worker, "_infer", return_value="text") as infer:
            self.worker.transcribe("act.jpg")
            self.image.write_bytes(b"new bytes")
            self.assertIsNone(self.worker.get_transcription("act.jpg"))
            self.worker.transcribe("act.jpg")
        self.assertEqual(infer.call_count, 2)

    def test_failed_inference_not_cached(self):
        with patch.object(self.worker, "_infer", side_effect=RuntimeError("offline")):
            with self.assertRaises(RuntimeError):
                self.worker.transcribe("act.jpg")
        self.assertIsNone(self.worker.get_transcription("act.jpg"))

    def test_reject_outside_folder(self):
        outside = Path(self.tmp.name) / "outside.png"
        outside.write_bytes(b"secret")
        (self.worker.inbox / "link.png").symlink_to(outside)
        self.assertNotIn("link.png", self.worker.list_manuscripts())
        for filename in ("../outside.png", "link.png"):
            with self.assertRaises(ValueError):
                self.worker.transcribe(filename)

    def test_ollama_request(self):
        with patch("local_transcription.urlopen") as open_url:
            response = open_url.return_value.__enter__.return_value
            response.read.return_value = json.dumps({"message": {"content": "abc"}}).encode()
            self.assertEqual(self.worker.transcribe("act.jpg")["extractedText"], "abc")
            request = open_url.call_args.args[0]
            self.assertEqual(request.full_url, "http://127.0.0.1:11434/api/chat")
            self.assertEqual(json.loads(request.data)["model"], "test-model")


if __name__ == "__main__":
    unittest.main()
