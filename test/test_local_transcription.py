import json
from pathlib import Path
import tempfile
from types import SimpleNamespace
import unittest
from unittest.mock import Mock, patch

from local_transcription import Transcriber


class TestTranscriber(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.worker = Transcriber(self.tmp.name, "test-model", backend="ollama")
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

    def test_mlx_separate_cache_and_metadata(self):
        mlx = Transcriber(self.tmp.name, "test-model", backend="mlx")
        with patch.object(self.worker, "_infer", return_value="Ollama"):
            self.worker.transcribe("act.jpg")
        self.assertIsNone(mlx.get_transcription("act.jpg"))
        with patch.object(mlx, "_infer_mlx", return_value="MLX") as infer:
            result = mlx.transcribe("act.jpg")
            self.assertTrue(mlx.transcribe("act.jpg")["cacheHit"])
        infer.assert_called_once()
        self.assertEqual(result["parserVersion"], "mlx/test-model/prompt-1")
        self.assertEqual(self.worker.get_transcription("act.jpg")["extractedText"], "Ollama")
        self.assertIsNone(Transcriber(self.tmp.name, "test-model", backend="mlx", max_tokens=100).get_transcription("act.jpg"))

    def test_mlx_generation(self):
        worker = Transcriber(self.tmp.name, "test-model", backend="mlx", max_tokens=10)
        load = Mock(return_value=("model", "processor"))
        generate = Mock(return_value=SimpleNamespace(text="transcription", generation_tokens=5))
        template = Mock(return_value="formatted")
        image = Mock()
        image.open.return_value.__enter__ = Mock(return_value=Mock())
        image.open.return_value.__exit__ = Mock(return_value=False)
        modules = {"mlx_vlm": SimpleNamespace(load=load, generate=generate),
                   "mlx_vlm.prompt_utils": SimpleNamespace(apply_chat_template=template),
                   "mlx_vlm.utils": SimpleNamespace(load_config=Mock(return_value={})),
                   "PIL": SimpleNamespace(Image=image)}
        with patch.dict("sys.modules", modules):
            self.assertEqual(worker._infer_mlx(b"image"), "transcription")
            self.assertEqual(worker._infer_mlx(b"other image"), "transcription")
            load.assert_called_once_with("test-model")
            self.assertEqual(generate.call_args.kwargs["max_tokens"], 10)
            generate.return_value.generation_tokens = 10
            with self.assertRaisesRegex(RuntimeError, "truncated"):
                worker.transcribe("act.jpg")
            self.assertIsNone(worker.get_transcription("act.jpg"))


if __name__ == "__main__":
    unittest.main()
