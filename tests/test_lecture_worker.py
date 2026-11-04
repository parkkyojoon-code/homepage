import importlib.util
import pathlib
import json
import os
import subprocess
import sys
import threading
from contextlib import contextmanager
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
import unittest
from unittest.mock import patch

path = pathlib.Path(__file__).resolve().parents[1] / "workers" / "lectures" / "worker.py"
spec = importlib.util.spec_from_file_location("lecture_worker", path)
worker = importlib.util.module_from_spec(spec)
spec.loader.exec_module(worker)
BILL = "L" + "a" * 19
JOB = {"kind": "SEND", "orderId": "fake-order", "billId": BILL, "claimToken": "b" * 64,
       "amountWon": 1000, "recipientPhone": "01011112222", "recipientName": "가상 보호자", "productName": "가상 강의"}


@contextmanager
def health_server(status=200, ready=True):
    calls = []

    class Handler(BaseHTTPRequestHandler):
        def do_POST(self):
            body = json.loads(self.rfile.read(int(self.headers.get("Content-Length", "0"))))
            calls.append((self.path, body, self.headers.get("Authorization")))
            self.send_response(status if self.path.endswith("/health") else 500)
            if status == 302:
                self.send_header("Location", "/should-not-receive-token")
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            self.wfile.write(json.dumps({"ready": ready}).encode())

        def log_message(self, *_args):
            pass

    server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        yield f"http://127.0.0.1:{server.server_port}", calls
    finally:
        server.shutdown()
        server.server_close()
        thread.join(timeout=5)


class FakeTransport:
    def __init__(self, response):
        self.response = response
        self.calls = []

    def post(self, url, body, token=None):
        self.calls.append((url, body, token))
        if isinstance(self.response, Exception):
            raise self.response
        return self.response


def provider(transport):
    return worker.PaySsamV1(transport, "fake-key", "fake-member", "fake-merchant", "https://web.invalid/api/lectures/payssam/notification")


class WorkerTests(unittest.TestCase):
    def test_connection_check_over_http_never_claims_or_contacts_provider(self):
        with health_server() as (web, calls):
            external = provider(FakeTransport({}))
            service = worker.Worker(worker.HttpJson(), web, "x" * 32, external, True)
            service.check()
            self.assertEqual(calls, [("/api/lectures/internal/billing/health", {}, "Bearer " + "x" * 32)])
            self.assertEqual(external.transport.calls, [])

    def test_connection_check_rejects_error_redirect_and_false_ready(self):
        for status, ready in ((401, True), (503, True), (302, True), (200, False), (200, "true")):
            with self.subTest(status=status, ready=ready), health_server(status, ready) as (web, calls):
                service = worker.Worker(worker.HttpJson(), web, "x" * 32, provider(FakeTransport({})))
                with self.assertRaises(worker.TransportFailure):
                    service.check()
                self.assertEqual(len(calls), 1)

    def test_check_cli_exits_without_running_a_cycle_even_when_send_enabled(self):
        for ready in (True, False):
            with health_server(ready=ready) as (web, calls):
                env = {**os.environ, "LECTURES_WORKER_ENABLED": "true", "LECTURES_WORKER_SEND_ENABLED": "true",
                       "LECTURES_WEB_ORIGIN": web, "LECTURES_WORKER_TOKEN": "fake-machine-token-" * 3,
                       "PAYSSAM_API_KEY": "fake-provider-key", "PAYSSAM_MEMBER": "fake-member",
                       "PAYSSAM_MERCHANT": "fake-merchant", "PAYSSAM_CALLBACK_URL": "https://web.invalid/callback"}
                result = subprocess.run([sys.executable, str(path), "--check", "--once"], env=env,
                                        capture_output=True, text=True, timeout=20)
                self.assertEqual(result.returncode, 0 if ready else 1)
                self.assertEqual([call[0] for call in calls], ["/api/lectures/internal/billing/health"])
                for secret in (env["LECTURES_WORKER_TOKEN"], env["PAYSSAM_API_KEY"]):
                    self.assertNotIn(secret, result.stdout + result.stderr)

    def test_disabled_cli_check_fails_without_network(self):
        with health_server() as (web, calls):
            result = subprocess.run([sys.executable, str(path), "--check"],
                                    env={**os.environ, "LECTURES_WORKER_ENABLED": "false", "LECTURES_WEB_ORIGIN": web},
                                    capture_output=True, text=True, timeout=20)
            self.assertNotEqual(result.returncode, 0)
            self.assertEqual(calls, [])

    def test_default_disabled_never_starts_transport(self):
        with patch.object(worker, "HttpJson") as transport:
            self.assertIsNone(worker.configured_worker({}))
            transport.assert_not_called()

    def test_send_uses_original_v1_contract_and_fixed_id(self):
        transport = FakeTransport({"code": "0000", "bill_id": BILL})
        self.assertEqual(provider(transport).send(JOB), {"outcome": "SENT"})
        url, body, token = transport.calls[0]
        self.assertEqual(url, "https://erp-api.payssam.kr/if/bill/send")
        self.assertEqual(body["bill"]["bill_id"], BILL)
        self.assertEqual(body["bill"]["price"], "1000")
        self.assertEqual(body["bill"]["phone"], "01011112222")
        self.assertEqual(body["bill"]["hash"], worker.hashlib.sha256(f"{BILL},01011112222,1000".encode()).hexdigest())
        self.assertIsNone(token)

    def test_send_failure_and_mismatched_response_never_retry(self):
        for result in (worker.TransportFailure("not logged"), {"code": "0000", "bill_id": "wrong"}, {"code": "duplicate"}):
            transport = FakeTransport(result)
            self.assertEqual(provider(transport).send(JOB), {"outcome": "UNKNOWN"})
            self.assertEqual(len(transport.calls), 1)

    def test_read_accepts_real_v1_shape_without_code_but_rejects_wrong_identity(self):
        good = {"appr_state": "F", "appr_price": "1000", "bill_id": BILL}
        self.assertEqual(provider(FakeTransport(good)).read(JOB), {"state": "F", "amountWon": 1000, "echoedBillId": BILL})
        for change in ({"bill_id": "wrong"}, {"appr_price": "1000.5"}, {"merchant": "other"}, {"appr_state": "unknown"}, {"code": "error"}):
            self.assertEqual(provider(FakeTransport({**good, **change})).read(JOB)["state"], "ERROR")
        self.assertEqual(provider(FakeTransport({"appr_state": "W", "bill_id": BILL})).read(JOB)["state"], "W")

    def test_worker_retries_only_report_and_does_not_repeat_provider_send(self):
        class Internal:
            def __init__(self):
                self.claimed, self.reports = False, []

            def post(self, url, body, token=None):
                if url.endswith("/claim"):
                    if body["kind"] == "SEND" and not self.claimed:
                        self.claimed = True
                        return {"job": JOB}
                    return {"job": None}
                self.reports.append(body.copy())
                if len(self.reports) == 1:
                    raise worker.TransportFailure("lost acknowledgement")
                return {"applied": True}

        class Provider:
            def __init__(self):
                self.sends = 0

            def send(self, job):
                self.sends += 1
                return {"outcome": "SENT"}

        internal, external = Internal(), Provider()
        service = worker.Worker(internal, "https://web.invalid", "x" * 32, external, True)
        with patch.object(worker.time, "sleep"):
            self.assertEqual(service.cycle(batch=1), 1)
        self.assertEqual(external.sends, 1)
        self.assertEqual(internal.reports[0], internal.reports[1])

    def test_worker_and_provider_destinations_reject_unsafe_configuration(self):
        for url in ("http://external.invalid", "https://user:password@web.invalid", "https://web.invalid/path", "https://web.invalid?key=value"):
            with self.assertRaises(ValueError):
                worker.origin(url)
        self.assertEqual(worker.origin("http://127.0.0.1:3100"), "http://127.0.0.1:3100")
        self.assertIsNone(worker.NoRedirect().redirect_request(None, None, 302, "", {}, "https://other.invalid"))


if __name__ == "__main__":
    unittest.main()
